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

  // 2. Wire delegated event listeners (once each)
  setupNavigator(els.navigator, dispatch);
  setupQuestionPanel(els.questionPanel, dispatch);
  setupToolbar(els.toolbar, dispatch);

  // 3. Initial render
  renderAll();

  // 4. Start timer
  startTimer();
});

// ---------------------------------------------------------------------------
// Action dispatcher
// ---------------------------------------------------------------------------
function dispatch(action) {
  const idx = SessionState.currentIndex;

  switch (action.type) {
    case 'selectChoice':
      selectChoice(idx, action.choiceId);
      break;

    case 'strikeout':
      toggleStrikeout(idx, action.choiceId);
      break;

    case 'shortAnswerInput':
      updateShortAnswer(idx, action.text);
      // Update state but avoid full re-render on every keystroke;
      // just mark answered — navigator re-render is cheap
      renderNavigator(els.navigator, SessionState);
      renderToolbar(els.toolbar, SessionState);
      return; // early return — skip full renderAll

    case 'skip':
      skipCurrent();
      break;

    case 'reveal':
      reveal();
      break;

    case 'bookmark':
      toggleBookmark(idx);
      break;

    case 'flag':
      toggleFlag(idx);
      break;

    case 'prev':
      goPrev();
      break;

    case 'next':
      goNext();
      break;

    case 'goTo':
      goTo(action.index);
      break;

    default:
      console.warn('[session] Unknown action:', action);
      return;
  }

  renderAll();
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
        ? { label: 'Draft Ready',      detail: 'Reveal the model answer when you are done.',              labelClass: '' }
        : { label: 'Writing Response', detail: 'Capture your answer before revealing the model answer.', labelClass: '' };
    }

    return item.isAnswered
      ? { label: 'Response Selected', detail: 'Review is locked only after you reveal the explanation.',         labelClass: '' }
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
