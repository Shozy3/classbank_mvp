/**
 * session.js — Main orchestrator for the Practice Session prototype.
 *
 * Responsibilities:
 *   - Initialize state from seed data
 *   - Call one-time setup functions on each component (event delegation)
 *   - Drive re-renders on every state change via render()
 *   - Run the timer on a separate interval (no full re-render per tick)
 */

import { SESSION_DATA }              from './data/seed.js';
import {
  SessionState,
  getSessionSummary,
  initState,
  isSessionComplete,
  markSessionCompleted,
  selectChoice,
  toggleStrikeout,
  toggleBookmark,
  toggleFlag,
  updateShortAnswer,
  setSelfRating,
  skipCurrent,
  reveal,
  goTo,
  goPrev,
  goNext,
}                                    from './state/session-state.js';
import { setupNavigator,
         renderNavigator }           from './components/navigator.js';
import { setupQuestionPanel,
         renderQuestionPanel }       from './components/question-panel.js';
import { setupExplanationPanel,
         renderExplanationPanel }    from './components/explanation-panel.js';
import { setupToolbar,
         renderToolbar }             from './components/session-toolbar.js';

// ---------------------------------------------------------------------------
// DOM references (resolved once on load)
// ---------------------------------------------------------------------------
let els = {};
let sessionRuntime = null;
let persistTimer = null;
let persistenceInFlight = false;
let finalizeTriggered = false;
const srRatingInFlight = new Set();
const adaptiveResultInFlight = new Set();
const adaptiveResultSaved = new Set();

const ADAPTIVE_MCQ_TYPES = new Set(['single_best', 'multi_select', 'true_false']);

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Guard: if setup produced an invalid/empty config, redirect back rather than
  // silently falling back to unrelated demo questions.
  if (SESSION_DATA._configError) {
    sessionStorage.removeItem('classbank_session_config');
    window.location.replace('../practice-setup/index.html');
    return;
  }

  els = {
    sessionRoot: document.getElementById('session-root'),
    sessionHeader: document.getElementById('session-header'),
    sessionBody:   document.getElementById('session-body'),
    sessionSummary: document.getElementById('session-summary'),
    questionPanel: document.getElementById('question-panel'),
    explanationPanel: document.getElementById('explanation-panel'),
    toolbar:       document.querySelector('.toolbar'),
    navigator:     document.getElementById('navigator'),
    timer:         document.getElementById('timer'),
    headerProgress: document.getElementById('header-progress'),
    headerCourse: document.getElementById('header-course'),
    headerTopic: document.getElementById('header-topic'),
    headerMode: document.getElementById('header-mode'),
    headerStateLabel: document.getElementById('header-state-label'),
    headerStateDetail: document.getElementById('header-state-detail'),
    headerStateCluster: document.querySelector('.header-state-cluster'),
  };

  // 1. Build state from seed
  initState();
  sessionRuntime = buildSessionRuntime();

  // 2. Wire delegated event listeners (once each)
  setupNavigator(els.navigator, dispatch);
  setupQuestionPanel(els.questionPanel, dispatch);
  setupExplanationPanel(els.explanationPanel, dispatch);
  setupToolbar(els.toolbar, dispatch);
  setupSummary(els.sessionSummary);

  // 3. Initial render
  renderAll();

  // 4. Start timer
  startTimer();

  // Persist initial session shell so progress has a durable parent row.
  void saveSessionProgress();
});

window.addEventListener('beforeunload', () => {
  if (!sessionRuntime) return;

  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }

  if (isSessionComplete()) {
    void finalizeSessionPersistence();
    return;
  }

  void saveSessionProgress();
});

// ---------------------------------------------------------------------------
// Action dispatcher
// ---------------------------------------------------------------------------
function dispatch(action) {
  const idx = SessionState.currentIndex;
  let shouldPersist = false;

  switch (action.type) {
    case 'selectChoice':
      selectChoice(idx, action.choiceId);
      shouldPersist = true;
      break;

    case 'strikeout':
      toggleStrikeout(idx, action.choiceId);
      shouldPersist = true;
      break;

    case 'shortAnswerInput':
      updateShortAnswer(idx, action.text);
      // Update state but avoid full re-render on every keystroke;
      // header, navigator, and toolbar are cheap; question/explanation panels are not
      renderHeader();
      renderNavigator(els.navigator, SessionState);
      renderToolbar(els.toolbar, SessionState);
      schedulePersist();
      return; // early return — skip full renderAll

    case 'skip':
      skipCurrent();
      shouldPersist = true;
      break;

    case 'reveal':
      reveal();
      void maybePersistAdaptiveMcqResult(idx);
      shouldPersist = true;
      break;

    case 'selfRate': {
      const srItemState = SessionState.items[idx];
      const priorRating = SessionState.items[idx]?.selfRating ?? null;
      const priorSyncState = srItemState?.srRatingSyncState || 'idle';
      const priorSyncError = srItemState?.srRatingError || '';
      if (srItemState) {
        srItemState.srRatingSyncState = 'saving';
        srItemState.srRatingError = '';
      }
      setSelfRating(idx, action.rating);
      // For SR sessions persist the rating directly to the SR engine
      const srQuestion = SESSION_DATA.questions[idx];
      if (srQuestion && window.api?.recordSpacedReviewRating) {
        const srContentType = srQuestion.questionType === 'flashcard' ? 'flashcard' : 'question';
        const srItemId = srQuestion.questionType === 'flashcard'
          ? srQuestion.flashcardId
          : srQuestion.questionId;
        const srItem = SessionState.items[idx];
        void persistSpacedReviewRating({
          index: idx,
          priorRating,
          priorSyncState,
          priorSyncError,
          payload: {
            contentType:      srContentType,
            itemId:           srItemId,
            selfRating:       action.rating,
            result:           srItem.result || 'correct',
            timeSpentSeconds: srItem.accumulatedTimeSeconds || 0,
          },
        });
      }
      shouldPersist = true;
      break;
    }

    case 'bookmark':
      toggleBookmark(idx);
      shouldPersist = true;
      break;

    case 'flag':
      toggleFlag(idx);
      shouldPersist = true;
      break;

    case 'prev':
      goPrev();
      shouldPersist = true;
      break;

    case 'next':
      goNext();
      shouldPersist = true;
      break;

    case 'goTo':
      goTo(action.index);
      shouldPersist = true;
      break;

    case 'reviewIncorrect':
      startIncorrectReview();
      return;

    case 'returnToSetup':
      window.location.href = '../practice-setup/index.html';
      return;

    default:
      console.warn('[session] Unknown action:', action);
      return;
  }

  renderAll();

  if (shouldPersist) {
    schedulePersist();
  }

  if (isSessionComplete()) {
    void completeSession();
  }
}

function setupSummary(summaryEl) {
  if (!summaryEl) return;

  summaryEl.addEventListener('click', (event) => {
    const target = event.target.closest('[data-summary-action]');
    if (!target || target.disabled) return;
    dispatch({ type: target.dataset.summaryAction });
  });
}

function schedulePersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  persistTimer = setTimeout(() => {
    void saveSessionProgress();
  }, 180);
}

async function persistSpacedReviewRating({ index, priorRating, priorSyncState, priorSyncError, payload }) {
  const key = `${payload.contentType}:${payload.itemId}`;
  if (srRatingInFlight.has(key)) return;
  srRatingInFlight.add(key);

  let success = false;
  try {
    await window.api.recordSpacedReviewRating(payload);
    success = true;
    const item = SessionState.items[index];
    if (item) {
      item.srRatingSyncState = 'saved';
      item.srRatingError = '';
      renderAll();
      setTimeout(() => {
        const i = SessionState.items[index];
        if (i && i.srRatingSyncState === 'saved') {
          i.srRatingSyncState = 'idle';
          renderAll();
        }
      }, 2000);
    }
  } catch (error) {
    console.error('[session] Failed to record SR rating:', error);
    // Restore the prior rating so users can retry immediately.
    setSelfRating(index, priorRating || null);
    const item = SessionState.items[index];
    if (item) {
      item.srRatingSyncState = 'error';
      item.srRatingError = 'Rating failed to save. Try again.';
    }
    renderAll();
    schedulePersist();
  } finally {
    if (!success) {
      const item = SessionState.items[index];
      if (item && !item.srRatingError) {
        item.srRatingSyncState = priorSyncState || 'idle';
        item.srRatingError = priorSyncError || '';
      }
    }
    srRatingInFlight.delete(key);
  }
}

function isAdaptiveMcqQuestion(question) {
  return question && ADAPTIVE_MCQ_TYPES.has(question.questionType);
}

async function maybePersistAdaptiveMcqResult(index) {
  if (!window.api?.recordAdaptiveMcqResult) return;

  const question = SESSION_DATA.questions[index];
  const item = SessionState.items[index];

  if (!isAdaptiveMcqQuestion(question) || !item?.isRevealed || !item.result) {
    return;
  }

  const key = `${sessionRuntime?.sessionId || 'session'}:${question.questionId}`;
  if (adaptiveResultSaved.has(key) || adaptiveResultInFlight.has(key)) {
    return;
  }

  adaptiveResultInFlight.add(key);
  try {
    await window.api.recordAdaptiveMcqResult({
      itemId: question.questionId,
      result: item.result,
      partialCredit: item.partialCredit,
      timeSpentSeconds: item.accumulatedTimeSeconds || 0,
    });
    adaptiveResultSaved.add(key);
  } catch (error) {
    console.error('[session] Failed to persist adaptive MCQ result.', error);
  } finally {
    adaptiveResultInFlight.delete(key);
  }
}

function getSetupConfig() {
  try {
    const raw = sessionStorage.getItem('classbank_session_config');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function buildSessionRuntime() {
  const cfg = getSetupConfig() || {};
  const now = new Date().toISOString();

  return {
    sessionId: `${SESSION_DATA.sessionId || 'session'}-${Date.now()}`,
    createdAt: now,
    startedAt: now,
    sessionType: cfg.mode || 'free_practice',
    timerMode: cfg.timerMode || 'none',
    shuffleQuestions: cfg.shuffleQuestions ?? true,
    shuffleChoices: cfg.shuffleChoices ?? true,
    randomSampleSize: Number.isInteger(cfg.questionCount) ? cfg.questionCount : null,
    setupConfig: cfg,
    showSummary: false,
    isCompleting: false,
    completedAt: null,
    filterPayload: {
      topicIds: cfg.topicIds || [],
      questionTypes: cfg.questionTypes || [],
      difficulties: cfg.difficulties || [],
      bookmarkedOnly: Boolean(cfg.bookmarkedOnly),
      flaggedOnly: Boolean(cfg.flaggedOnly),
      incorrectOnly: Boolean(cfg.incorrectOnly),
      adaptiveWeakOnly: Boolean(cfg.adaptiveWeakOnly),
      unseenOnly: Boolean(cfg.unseenOnly),
    },
  };
}

function updateLocalReviewHistory() {
  try {
    const seenRaw = localStorage.getItem('classbank_seen_question_ids');
    const incorrectRaw = localStorage.getItem('classbank_incorrect_question_ids');
    const seenParsed = JSON.parse(seenRaw || '[]');
    const incorrectParsed = JSON.parse(incorrectRaw || '[]');
    const seen = new Set(Array.isArray(seenParsed) ? seenParsed : []);
    const incorrect = new Set(Array.isArray(incorrectParsed) ? incorrectParsed : []);

    SessionState.items.forEach((item, idx) => {
      if (!item.isRevealed) return;
      const questionId = SESSION_DATA.questions[idx]?.questionId;
      if (!questionId) return;
      seen.add(questionId);
      if (item.result === 'incorrect' || item.result === 'partial') {
        incorrect.add(questionId);
      }
    });

    localStorage.setItem('classbank_seen_question_ids', JSON.stringify([...seen]));
    localStorage.setItem('classbank_incorrect_question_ids', JSON.stringify([...incorrect]));
  } catch (error) {
    console.error('[session] Failed to update local review history.', error);
  }
}

function buildSessionItemPayload(item, idx) {
  const question     = SESSION_DATA.questions[idx];
  const isFlashcard  = question.questionType === 'flashcard';
  const responsePayload = {
    selectedChoiceIds:  item.selectedChoiceIds,
    strikeoutChoiceIds: item.strikeoutChoiceIds,
    shortAnswerText:    item.shortAnswerText,
  };

  return {
    sessionItemId: `${sessionRuntime.sessionId}::${isFlashcard ? 'flashcard' : 'question'}::${idx}`,
    contentType:   isFlashcard ? 'flashcard' : 'question',
    questionId:    isFlashcard ? null : question.questionId,
    flashcardId:   isFlashcard ? question.flashcardId : null,
    presentedOrder: idx,
    wasAnswered:   item.isAnswered,
    submittedAt:   item.submittedAt,
    timeSpentSeconds: item.accumulatedTimeSeconds,
    responsePayload,
    isCorrect:     item.result == null ? null : item.result === 'correct',
    partialCredit: item.partialCredit,
    wasRevealed:   item.isRevealed,
    wasSkipped:    item.isSkipped,
    wasBookmarkedDuringSession: item.isBookmarked,
    wasFlaggedDuringSession:    item.isFlagged,
    selfRating:    item.selfRating,
    result:        item.result,
  };
}

function buildSavePayload(operation) {
  const completedAt = operation === 'finalizeSession'
    ? (sessionRuntime.completedAt || new Date().toISOString())
    : null;

  return {
    operation,
    updateAggregates: operation === 'finalizeSession',
    session: {
      sessionId: sessionRuntime.sessionId,
      sessionType: sessionRuntime.sessionType,
      timerMode: sessionRuntime.timerMode,
      totalTimeSeconds: SessionState.timerSeconds,
      shuffleQuestions: sessionRuntime.shuffleQuestions,
      shuffleChoices: sessionRuntime.shuffleChoices,
      randomSampleSize: sessionRuntime.randomSampleSize,
      filterPayload: sessionRuntime.filterPayload,
      createdAt: sessionRuntime.createdAt,
      startedAt: sessionRuntime.startedAt,
      completedAt,
    },
    items: SessionState.items.map((item, idx) => buildSessionItemPayload(item, idx)),
  };
}

async function saveSessionProgress() {
  if (!sessionRuntime) return;

  if (!window.api?.saveSession) {
    updateLocalReviewHistory();
    return;
  }

  if (persistenceInFlight) return;

  persistenceInFlight = true;
  try {
    await window.api.saveSession(buildSavePayload('saveProgress'));
  } catch (error) {
    console.error('[session] Failed to persist session progress.', error);
  } finally {
    persistenceInFlight = false;
  }
}

async function finalizeSessionPersistence() {
  if (!sessionRuntime || finalizeTriggered) return;

  const completedAt = sessionRuntime.completedAt || new Date().toISOString();
  sessionRuntime.completedAt = completedAt;
  markSessionCompleted(completedAt);

  if (!window.api?.saveSession) {
    finalizeTriggered = true;
    updateLocalReviewHistory();
    return;
  }

  finalizeTriggered = true;
  try {
    await window.api.saveSession(buildSavePayload('finalizeSession'));
    updateLocalReviewHistory();
  } catch (error) {
    finalizeTriggered = false;
    console.error('[session] Failed to finalize session persistence.', error);
  }
}

async function completeSession() {
  if (!sessionRuntime || sessionRuntime.showSummary || sessionRuntime.isCompleting) return;

  sessionRuntime.isCompleting = true;
  SessionState.isTimerRunning = false;

  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }

  try {
    await finalizeSessionPersistence();
  } finally {
    sessionRuntime.showSummary = true;
    sessionRuntime.isCompleting = false;
    renderAll();
  }
}

// ---------------------------------------------------------------------------
// Render coordinator
// ---------------------------------------------------------------------------
function renderAll() {
  syncSurfaceMode();
  renderHeader();

  if (sessionRuntime?.showSummary) {
    renderSummary();
    return;
  }

  renderToolbar(els.toolbar, SessionState);
  renderQuestionPanel(els.questionPanel, SessionState);
  renderExplanationPanel(els.explanationPanel, els.sessionBody, SessionState);
  renderNavigator(els.navigator, SessionState);
}

function syncSurfaceMode() {
  const showSummary = Boolean(sessionRuntime?.showSummary);

  if (els.sessionRoot) {
    els.sessionRoot.classList.toggle('summary-visible', showSummary);
  }

  if (els.sessionSummary) {
    els.sessionSummary.hidden = !showSummary;
  }

  if (showSummary && els.sessionBody) {
    els.sessionBody.classList.remove('explanation-revealed');
  }
}

function renderHeader() {
  if (sessionRuntime?.showSummary) {
    renderSummaryHeader();
    return;
  }

  const idx = SessionState.currentIndex;
  const item = SessionState.items[idx];
  const question = SESSION_DATA.questions[idx];

  if (els.headerCourse) {
    els.headerCourse.textContent = SESSION_DATA.courseLabel;
  }

  if (els.headerTopic) {
    els.headerTopic.textContent = SESSION_DATA.topicLabel;
  }

  if (els.headerMode) {
    els.headerMode.textContent = SESSION_DATA.modeLabel;
  }

  if (els.headerProgress) {
    els.headerProgress.textContent =
      `${SessionState.currentIndex + 1} of ${SessionState.items.length}`;
  }

  if (els.headerStateLabel && els.headerStateDetail) {
    const stateCopy = getHeaderStateCopy(item, question);
    els.headerStateLabel.textContent = stateCopy.label;
    els.headerStateDetail.textContent = stateCopy.detail;
    if (els.headerStateCluster) {
      els.headerStateCluster.className = 'header-state-cluster'
        + (stateCopy.labelClass ? ' ' + stateCopy.labelClass : '');
    }
  }
}

function getHeaderStateCopy(item, question) {
  if (!item.isRevealed) {
    if (question.questionType === 'short_answer') {
      return item.isAnswered
        ? { label: 'Response Drafted', detail: 'Reveal the model answer when you are done.',              labelClass: '' }
        : { label: 'Writing Response', detail: 'Capture your answer before revealing the model answer.', labelClass: '' };
    }

    if (question.questionType === 'flashcard') {
      return { label: 'Flashcard Front', detail: 'Recall the back side, then reveal when ready.', labelClass: '' };
    }

    return item.isAnswered
      ? { label: 'Answer Selected',   detail: 'Reveal to lock your answer and open the explanation.',               labelClass: '' }
      : { label: 'Awaiting Reveal',   detail: 'Select a response, then reveal to open the explanation panel.', labelClass: '' };
  }

  if (question.questionType === 'short_answer' || question.questionType === 'flashcard') {
    const detail = question.questionType === 'flashcard'
      ? 'Review the back side, then rate your recall in the explanation panel.'
      : 'Compare your response, then rate recall in the explanation panel.';
    return { label: 'Back Side Open', detail, labelClass: '' };
  }

  const revealedCopy = {
    correct:   { label: 'Correct',        detail: 'Explanation is open with the answer breakdown.',         labelClass: 'state-correct'   },
    partial:   { label: 'Partial Credit', detail: 'Review the missed correct answer before moving on.',    labelClass: 'state-partial'   },
    incorrect: { label: 'Incorrect',      detail: 'Explanation is open so you can review the full logic.', labelClass: 'state-incorrect' },
  };

  return revealedCopy[item.result] ?? { label: 'Explanation Open', detail: 'Review the explanation before continuing.', labelClass: '' };
}

function renderSummaryHeader() {
  const summary = getSessionSummary();
  const scoreLabel = summary.scorePercent == null ? 'Summary Ready' : `Score ${summary.scorePercent.toFixed(1)}%`;
  const detail = summary.canReviewIncorrect
    ? `${summary.incorrectCount + summary.partialCount} missed item${summary.incorrectCount + summary.partialCount === 1 ? '' : 's'} available for focused follow-up.`
    : 'No missed items in revealed content. Start a fresh session to continue.';

  if (els.headerCourse) {
    els.headerCourse.textContent = SESSION_DATA.courseLabel;
  }

  if (els.headerTopic) {
    els.headerTopic.textContent = SESSION_DATA.topicLabel;
  }

  if (els.headerMode) {
    els.headerMode.textContent = SESSION_DATA.modeLabel;
  }

  if (els.headerProgress) {
    els.headerProgress.textContent = 'Complete';
  }

  if (els.headerStateLabel) {
    els.headerStateLabel.textContent = 'Session Complete';
  }

  if (els.headerStateDetail) {
    els.headerStateDetail.textContent = `${scoreLabel} · ${detail}`;
  }

  if (els.headerStateCluster) {
    els.headerStateCluster.className = 'header-state-cluster state-complete';
  }
}

function renderSummary() {
  if (!els.sessionSummary) return;

  const summary = getSessionSummary();
  const reviewDisabled = summary.canReviewIncorrect ? '' : 'disabled';
  const reviewLabel = summary.canReviewIncorrect
    ? `Review ${summary.missedIndexes.length} missed item${summary.missedIndexes.length === 1 ? '' : 's'}`
    : 'No missed items to review';
  const scoreValue = summary.scorePercent == null ? 'N/A' : `${summary.scorePercent.toFixed(1)}%`;
  const scoreCaption = summary.scorePercent == null
    ? 'No revealed items yet.'
    : `Computed from ${summary.scoreDenominator} revealed item${summary.scoreDenominator === 1 ? '' : 's'} with partial credit weighted at 0.5.`;
  const completedAt = sessionRuntime?.completedAt || SessionState.completedAt || null;

  els.sessionSummary.innerHTML = `
    <div class="session-summary-shell">
      <div class="session-summary-hero">
        <div class="summary-kicker">Practice Session</div>
        <h2 class="summary-title">Session complete</h2>
        <p class="summary-copy">Review your outcomes, verify what needs reinforcement, and continue directly into a targeted follow-up pass.</p>
        <div class="summary-hero-metrics">
          <div class="summary-hero-metric">
            <span class="summary-hero-label">Score</span>
            <span class="summary-hero-value">${scoreValue}</span>
            <span class="summary-hero-note">${scoreCaption}</span>
          </div>
          <div class="summary-hero-metric">
            <span class="summary-hero-label">Time Used</span>
            <span class="summary-hero-value">${formatSummaryDuration(SessionState.timerSeconds)}</span>
          </div>
          <div class="summary-hero-metric">
            <span class="summary-hero-label">Completed</span>
            <span class="summary-hero-value">${formatCompletedAt(completedAt)}</span>
          </div>
        </div>
      </div>

      <div class="session-summary-grid">
        <div class="summary-card summary-card-emphasis">
          <div class="summary-card-label">Outcome</div>
          <div class="summary-stat-grid">
            <div class="summary-stat"><span class="summary-stat-value">${summary.correctCount}</span><span class="summary-stat-label">Correct</span></div>
            <div class="summary-stat"><span class="summary-stat-value">${summary.partialCount}</span><span class="summary-stat-label">Partial</span></div>
            <div class="summary-stat"><span class="summary-stat-value">${summary.incorrectCount}</span><span class="summary-stat-label">Incorrect</span></div>
            <div class="summary-stat"><span class="summary-stat-value">${summary.skippedCount}</span><span class="summary-stat-label">Skipped</span></div>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-card-label">Coverage</div>
          <div class="summary-inline-list">
            <span class="summary-inline-item">Revealed ${summary.revealedCount} of ${summary.totalItems}</span>
            <span class="summary-inline-item">Answered ${summary.answeredCount}</span>
            <span class="summary-inline-item">Bookmarked ${summary.bookmarkedCount}</span>
            <span class="summary-inline-item">Flagged ${summary.flaggedCount}</span>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-card-label">Next Step</div>
          <p class="summary-card-copy">${summary.canReviewIncorrect ? 'Missed items are queued for immediate review so you can close gaps before starting a new mixed session.' : 'No missed items were found in revealed content. Build a new session to keep momentum and broaden coverage.'}</p>
          <div class="summary-action-row">
            <button class="btn btn-primary summary-action" data-summary-action="reviewIncorrect" ${reviewDisabled}>${reviewLabel}</button>
            <button class="btn btn-ghost summary-action" data-summary-action="returnToSetup">Return to Setup</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function startIncorrectReview() {
  const summary = getSessionSummary();
  if (!summary.canReviewIncorrect) return;

  const baseConfig = sessionRuntime?.setupConfig || getSetupConfig() || {};
  const preloadedQuestions = summary.missedIndexes
    .map((idx) => SESSION_DATA.questions[idx])
    .filter((question) => question && question.questionType !== 'flashcard');

  if (preloadedQuestions.length === 0) return;

  const nextConfig = {
    ...baseConfig,
    courseName: baseConfig.courseName || SESSION_DATA.courseLabel,
    courseCode: baseConfig.courseCode || 'Course',
    topicLabel: 'Missed Items Review',
    questionTypes: [...new Set(preloadedQuestions.map((question) => question.questionType))],
    incorrectOnly: true,
    unseenOnly: false,
    questionCount: preloadedQuestions.length,
    mode: 'review_incorrect',
    timerMode: 'none',
    preloadedQuestions,
    preloadedSrItems: null,
  };

  sessionStorage.setItem('classbank_session_config', JSON.stringify(nextConfig));
  window.location.href = '../practice-session/index.html';
}

function formatSummaryDuration(seconds) {
  if (!Number.isInteger(seconds) || seconds < 0) return 'N/A';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatCompletedAt(value) {
  if (!value) return 'Just now';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Just now';
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Timer — runs independently, updates only the timer span
// ---------------------------------------------------------------------------
let timerInterval = null;

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (!SessionState.isTimerRunning) return;
    SessionState.timerSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function updateTimerDisplay() {
  if (!els.timer) return;
  els.timer.textContent = formatTime(SessionState.timerSeconds);
}

function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}
