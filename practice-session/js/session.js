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
  initState,
  selectChoice,
  toggleStrikeout,
  toggleBookmark,
  toggleFlag,
  updateShortAnswer,
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
import { renderExplanationPanel }    from './components/explanation-panel.js';
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
    sessionHeader: document.getElementById('session-header'),
    sessionBody:   document.getElementById('session-body'),
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
  setupToolbar(els.toolbar, dispatch);

  // 3. Initial render
  renderAll();

  // 4. Start timer
  startTimer();

  // Persist initial session shell so progress has a durable parent row.
  void saveSessionProgress();
});

window.addEventListener('beforeunload', () => {
  if (!sessionRuntime) return;
  void finalizeSessionPersistence();
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
      shouldPersist = true;
      break;

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

    default:
      console.warn('[session] Unknown action:', action);
      return;
  }

  renderAll();

  if (shouldPersist) {
    schedulePersist();
  }

  if (!finalizeTriggered && isSessionComplete()) {
    void finalizeSessionPersistence();
  }
}

function schedulePersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  persistTimer = setTimeout(() => {
    void saveSessionProgress();
  }, 180);
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
    filterPayload: {
      topicIds: cfg.topicIds || [],
      questionTypes: cfg.questionTypes || [],
      difficulties: cfg.difficulties || [],
      bookmarkedOnly: Boolean(cfg.bookmarkedOnly),
      flaggedOnly: Boolean(cfg.flaggedOnly),
      incorrectOnly: Boolean(cfg.incorrectOnly),
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
  const question = SESSION_DATA.questions[idx];
  const responsePayload = {
    selectedChoiceIds: item.selectedChoiceIds,
    strikeoutChoiceIds: item.strikeoutChoiceIds,
    shortAnswerText: item.shortAnswerText,
  };

  return {
    sessionItemId: `${sessionRuntime.sessionId}::question::${idx}`,
    contentType: 'question',
    questionId: question.questionId,
    presentedOrder: idx,
    wasAnswered: item.isAnswered,
    submittedAt: item.submittedAt,
    timeSpentSeconds: item.accumulatedTimeSeconds,
    responsePayload,
    isCorrect: item.result == null ? null : item.result === 'correct',
    partialCredit: item.partialCredit,
    wasRevealed: item.isRevealed,
    wasSkipped: item.isSkipped,
    wasBookmarkedDuringSession: item.isBookmarked,
    wasFlaggedDuringSession: item.isFlagged,
    selfRating: item.selfRating,
    result: item.result,
  };
}

function buildSavePayload(operation) {
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
      completedAt: operation === 'finalizeSession' ? new Date().toISOString() : null,
    },
    items: SessionState.items.map((item, idx) => buildSessionItemPayload(item, idx)),
  };
}

function isSessionComplete() {
  if (!SessionState.items.length) return false;
  return SessionState.items.every((item) => item.isRevealed);
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

  if (!window.api?.saveSession) {
    finalizeTriggered = true;
    updateLocalReviewHistory();
    return;
  }

  finalizeTriggered = true;
  try {
    await window.api.saveSession(buildSavePayload('finalizeSession'));
  } catch (error) {
    finalizeTriggered = false;
    console.error('[session] Failed to finalize session persistence.', error);
  }
}

// ---------------------------------------------------------------------------
// Render coordinator
// ---------------------------------------------------------------------------
function renderAll() {
  renderHeader();
  renderToolbar(els.toolbar, SessionState);
  renderQuestionPanel(els.questionPanel, SessionState);
  renderExplanationPanel(els.explanationPanel, els.sessionBody, SessionState);
  renderNavigator(els.navigator, SessionState);
}

function renderHeader() {
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

    return item.isAnswered
      ? { label: 'Answer Selected',   detail: 'Reveal to lock your answer and open the explanation.',               labelClass: '' }
      : { label: 'Awaiting Reveal',   detail: 'Select a response, then reveal to open the explanation panel.', labelClass: '' };
  }

  if (question.questionType === 'short_answer') {
    return { label: 'Model Answer Open', detail: 'Compare your response, then rate recall in the explanation panel.', labelClass: '' };
  }

  const revealedCopy = {
    correct:   { label: 'Correct',        detail: 'Explanation is open with the answer breakdown.',         labelClass: 'state-correct'   },
    partial:   { label: 'Partial Credit', detail: 'Review the missed correct answer before moving on.',    labelClass: 'state-partial'   },
    incorrect: { label: 'Incorrect',      detail: 'Explanation is open so you can review the full logic.', labelClass: 'state-incorrect' },
  };

  return revealedCopy[item.result] ?? { label: 'Explanation Open', detail: 'Review the explanation before continuing.', labelClass: '' };
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
