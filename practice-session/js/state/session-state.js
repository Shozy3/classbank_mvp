/**
 * session-state.js — Plain-JS session state and mutators.
 *
 * State uses explicit boolean fields per item — no single overloaded
 * `status` string. The derived nav status is computed by `getNavStatus()`.
 *
 * All mutator functions mutate the shared `SessionState` object in place.
 * Call render() after any mutation.
 */

import { SESSION_DATA } from '../data/seed.js';

// ---------------------------------------------------------------------------
// Default item state factory
// ---------------------------------------------------------------------------
function makeItemState(question, overrides = {}) {
  return {
    questionId:        question.questionId,

    // Visit / interaction flags
    hasBeenVisited:    false,
    isAnswered:        false,
    isRevealed:        false,
    isSkipped:         false,

    // Answer state
    selectedChoiceIds: [],
    shortAnswerText:   '',

    // Interaction modifiers
    strikeoutChoiceIds: [],

    // Result — only meaningful when isRevealed is true
    result: null,   // null | 'correct' | 'partial' | 'incorrect'

    // Item metadata
    isBookmarked: false,
    isFlagged:    false,

    // Apply any seed-level overrides
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Session state (mutable, module-level singleton)
// ---------------------------------------------------------------------------
export const SessionState = {
  currentIndex:  0,
  items:         [],
  timerSeconds:  0,
  isTimerRunning: false,
};

// ---------------------------------------------------------------------------
// Init — build items[] from SESSION_DATA
// ---------------------------------------------------------------------------
export function initState() {
  SessionState.currentIndex  = 0;
  SessionState.timerSeconds  = 0;
  SessionState.isTimerRunning = true;

  SessionState.items = SESSION_DATA.questions.map((q) => {
    const override = SESSION_DATA.initialOverrides[q.questionId] ?? {};
    return makeItemState(q, override);
  });

  // Mark Q1 as visited on load
  if (SessionState.items.length > 0) {
    SessionState.items[0].hasBeenVisited = true;
  }
}

// ---------------------------------------------------------------------------
// Derived — navigator status for a single item
// ---------------------------------------------------------------------------
export function getNavStatus(item) {
  if (item.isRevealed) {
    if (item.result === 'correct')   return 'correct';
    if (item.result === 'partial')   return 'partial';
    if (item.result === 'incorrect') return 'incorrect';
    // short_answer has null result but is still revealed
    return 'answered';
  }
  if (item.isSkipped)  return 'skipped';
  if (item.isAnswered) return 'answered';
  return 'unseen';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function currentItem() {
  return SessionState.items[SessionState.currentIndex];
}

function getQuestion(itemIdx) {
  return SESSION_DATA.questions[itemIdx];
}

// ---------------------------------------------------------------------------
// Result computation (called inside reveal())
// ---------------------------------------------------------------------------
function computeResult(item, question) {
  const type = question.questionType;

  if (type === 'single_best' || type === 'true_false') {
    if (item.selectedChoiceIds.length === 0) return 'incorrect';
    const chosen = item.selectedChoiceIds[0];
    const correct = question.choices.find(c => c.choiceId === chosen)?.isCorrect ?? false;
    return correct ? 'correct' : 'incorrect';
  }

  if (type === 'multi_select') {
    const correctIds = question.choices.filter(c => c.isCorrect).map(c => c.choiceId);
    const selected   = item.selectedChoiceIds;

    if (selected.length === 0) return 'incorrect';

    const falsePositives = selected.filter(id => !correctIds.includes(id));
    if (falsePositives.length > 0) return 'incorrect';

    const truePositives = selected.filter(id => correctIds.includes(id));
    if (truePositives.length === correctIds.length) return 'correct';

    // Some correct, none wrong → partial
    return 'partial';
  }

  if (type === 'short_answer') {
    // No auto-grade; reveal model answer only
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Mutators
// ---------------------------------------------------------------------------

/**
 * Select or toggle a choice.
 * - single_best / true_false: replace selection
 * - multi_select: toggle
 * Noop if item is already revealed.
 */
export function selectChoice(itemIdx, choiceId) {
  const item     = SessionState.items[itemIdx];
  const question = getQuestion(itemIdx);
  if (item.isRevealed) return;

  const type = question.questionType;

  if (type === 'single_best' || type === 'true_false') {
    // Toggle off if same choice clicked again
    if (item.selectedChoiceIds[0] === choiceId) {
      item.selectedChoiceIds = [];
      item.isAnswered = false;
    } else {
      item.selectedChoiceIds = [choiceId];
      item.isAnswered = true;
    }
  } else if (type === 'multi_select') {
    const idx = item.selectedChoiceIds.indexOf(choiceId);
    if (idx === -1) {
      item.selectedChoiceIds = [...item.selectedChoiceIds, choiceId];
    } else {
      item.selectedChoiceIds = item.selectedChoiceIds.filter(id => id !== choiceId);
    }
    item.isAnswered = item.selectedChoiceIds.length > 0;
  }

  // Selecting clears skipped state
  item.isSkipped = false;
}

/**
 * Toggle strikeout on a choice. Noop if item is revealed.
 */
export function toggleStrikeout(itemIdx, choiceId) {
  const item = SessionState.items[itemIdx];
  if (item.isRevealed) return;

  const idx = item.strikeoutChoiceIds.indexOf(choiceId);
  if (idx === -1) {
    item.strikeoutChoiceIds = [...item.strikeoutChoiceIds, choiceId];
  } else {
    item.strikeoutChoiceIds = item.strikeoutChoiceIds.filter(id => id !== choiceId);
  }
}

/**
 * Toggle bookmark on any item (bookmark persists after reveal).
 */
export function toggleBookmark(itemIdx) {
  SessionState.items[itemIdx].isBookmarked = !SessionState.items[itemIdx].isBookmarked;
}

/**
 * Toggle flag on any item.
 */
export function toggleFlag(itemIdx) {
  SessionState.items[itemIdx].isFlagged = !SessionState.items[itemIdx].isFlagged;
}

/**
 * Update short-answer text. Noop if revealed.
 */
export function updateShortAnswer(itemIdx, text) {
  const item = SessionState.items[itemIdx];
  if (item.isRevealed) return;
  item.shortAnswerText = text;
  item.isAnswered = text.trim().length > 0;
  item.isSkipped = false;
}

/**
 * Skip the current item and advance to the next.
 */
export function skipCurrent() {
  const item = currentItem();
  item.isSkipped  = true;
  item.isAnswered = false;
  goNext();
}

/**
 * Reveal the current item: compute result, lock choices.
 */
export function reveal() {
  const idx      = SessionState.currentIndex;
  const item     = SessionState.items[idx];
  const question = getQuestion(idx);

  if (item.isRevealed) return;

  item.isRevealed    = true;
  item.hasBeenVisited = true;
  item.isSkipped     = false;
  item.result        = computeResult(item, question);

  // If they hadn't answered, mark as answered-via-reveal for nav display
  if (!item.isAnswered && question.questionType !== 'short_answer') {
    // result is 'incorrect' from computeResult; item stays not-answered
    // but isRevealed takes over for nav rendering
  }
}

/**
 * Navigate to a specific index.
 */
export function goTo(idx) {
  if (idx < 0 || idx >= SessionState.items.length) return;
  SessionState.currentIndex = idx;
  SessionState.items[idx].hasBeenVisited = true;
}

/**
 * Navigate to the previous item (clamps at 0).
 */
export function goPrev() {
  goTo(SessionState.currentIndex - 1);
}

/**
 * Navigate to the next item (clamps at last).
 */
export function goNext() {
  goTo(SessionState.currentIndex + 1);
}
