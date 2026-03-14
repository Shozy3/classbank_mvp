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
    partialCredit: null,
    selfRating: null,
    srRatingSyncState: 'idle', // idle | saving | error
    srRatingError: '',

    // Timing fields used for session persistence
    enteredAtEpochMs: null,
    accumulatedTimeSeconds: 0,
    submittedAt: null,

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
  completedAt: null,
};

// ---------------------------------------------------------------------------
// Init — build items[] from SESSION_DATA
// ---------------------------------------------------------------------------
export function initState() {
  SessionState.currentIndex  = 0;
  SessionState.timerSeconds  = 0;
  SessionState.isTimerRunning = true;
  SessionState.completedAt = null;

  SessionState.items = SESSION_DATA.questions.map((q) => {
    const override = SESSION_DATA.initialOverrides[q.questionId] ?? {};
    return makeItemState(q, override);
  });

  // Mark Q1 as visited on load
  if (SessionState.items.length > 0) {
    SessionState.items[0].hasBeenVisited = true;
    markItemEntered(SessionState.items[0]);
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

function markItemEntered(item) {
  item.enteredAtEpochMs = Date.now();
}

function commitElapsedForItem(item) {
  if (!item || item.enteredAtEpochMs == null) return;
  const elapsedMs = Date.now() - item.enteredAtEpochMs;
  if (elapsedMs > 0) {
    item.accumulatedTimeSeconds += Math.floor(elapsedMs / 1000);
  }
  item.enteredAtEpochMs = Date.now();
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

  if (type === 'short_answer' || type === 'flashcard') {
    // No auto-grade; reveal model answer / card back only
    return null;
  }

  return null;
}

function computePartialCredit(item, question) {
  const type = question.questionType;

  if (type === 'multi_select') {
    const correctIds = question.choices.filter((c) => c.isCorrect).map((c) => c.choiceId);
    const selected = item.selectedChoiceIds;
    if (selected.length === 0) return 0;

    const falsePositives = selected.filter((id) => !correctIds.includes(id));
    if (falsePositives.length > 0) return 0;

    const truePositives = selected.filter((id) => correctIds.includes(id));
    if (truePositives.length === correctIds.length) return 1;
    return 0.5;
  }

  if (type === 'single_best' || type === 'true_false') {
    return item.result === 'correct' ? 1 : 0;
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
  item.partialCredit = computePartialCredit(item, question);
  item.submittedAt = new Date().toISOString();
  commitElapsedForItem(item);

  // If they hadn't answered, mark as answered-via-reveal for nav display
  if (!item.isAnswered && question.questionType !== 'short_answer' && question.questionType !== 'flashcard') {
    // result is 'incorrect' from computeResult; item stays not-answered
    // but isRevealed takes over for nav rendering
  }
}

/**
 * Navigate to a specific index.
 */
export function goTo(idx) {
  if (idx < 0 || idx >= SessionState.items.length) return;

  const previous = SessionState.items[SessionState.currentIndex];
  if (previous) {
    commitElapsedForItem(previous);
  }

  SessionState.currentIndex = idx;
  const next = SessionState.items[idx];
  next.hasBeenVisited = true;
  markItemEntered(next);
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

/**
 * Set the self-rating for a revealed item (Again / Hard / Good / Easy).
 */
export function setSelfRating(itemIdx, rating) {
  const item = SessionState.items[itemIdx];
  if (!item || !item.isRevealed) return;
  const valid = new Set(['Again', 'Hard', 'Good', 'Easy']);
  if (!valid.has(rating)) return;
  item.selfRating = rating;
}

export function markSessionCompleted(timestamp = new Date().toISOString()) {
  SessionState.completedAt = timestamp;
  SessionState.isTimerRunning = false;
}

export function isSessionComplete() {
  if (!SessionState.items.length) return false;
  return SessionState.items.every((item) => item.isRevealed);
}

export function getSessionSummary() {
  const totalItems = SessionState.items.length;
  let answeredCount = 0;
  let revealedCount = 0;
  let skippedCount = 0;
  let correctCount = 0;
  let partialCount = 0;
  let incorrectCount = 0;
  let bookmarkedCount = 0;
  let flaggedCount = 0;
  const missedIndexes = [];

  SessionState.items.forEach((item, idx) => {
    if (item.isAnswered) answeredCount++;
    if (item.isRevealed) revealedCount++;
    if (item.isSkipped) skippedCount++;
    if (item.isBookmarked) bookmarkedCount++;
    if (item.isFlagged) flaggedCount++;

    if (item.result === 'correct') {
      correctCount++;
    } else if (item.result === 'partial') {
      partialCount++;
      missedIndexes.push(idx);
    } else if (item.result === 'incorrect') {
      incorrectCount++;
      missedIndexes.push(idx);
    }
  });

  const gradedCount = correctCount + partialCount + incorrectCount;
  const scoreDenominator = revealedCount;
  const scorePercent = scoreDenominator > 0
    ? Number((((correctCount + (partialCount * 0.5)) / scoreDenominator) * 100).toFixed(1))
    : null;

  return {
    totalItems,
    answeredCount,
    revealedCount,
    unrevealedCount: Math.max(totalItems - revealedCount, 0),
    skippedCount,
    correctCount,
    partialCount,
    incorrectCount,
    gradedCount,
    scoreDenominator,
    bookmarkedCount,
    flaggedCount,
    missedIndexes,
    canReviewIncorrect: missedIndexes.length > 0,
    scorePercent,
  };
}
