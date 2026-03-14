/**
 * setup.js — Practice Setup screen orchestrator.
 *
 * Responsibilities:
 *   - Render the two-column setup UI from COURSE_DATA
 *   - Track filter/option state in SetupState
 *   - Recompute matching question count on every control change
 *   - Write config to sessionStorage and navigate to practice-session on Start
 *
 * Rendering strategy:
 *   - renderAll() builds the full body HTML once on init
 *   - updateSummary() patches only the summary card and Start button reactively
 *   - No full re-renders after init (avoids focus loss and flicker)
 */

import { COURSE_DATA } from '../../practice-session/js/data/course-data.js';
import { applyFilterRules } from './filter-rules.mjs';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** @type {{ course_id: string, course_name: string, course_code: string, units: any[] }} */
let COURSE = COURSE_DATA.courses[0];
let lastQuestionQueryResult = [];

const ALL_TYPES = ['single_best', 'multi_select', 'true_false', 'short_answer'];
const TYPE_LABELS = {
  single_best:  'Single Best Answer',
  multi_select: 'Multi-Select',
  true_false:   'True / False',
  short_answer: 'Short Answer',
};

const MODE_LABELS = {
  free_practice:    'Free Practice',
  timed_block:      'Timed Block',
  review_incorrect: 'Review Incorrect',
  spaced_review:    'Spaced Review',
};

const SetupState = {
  courseId:         COURSE.course_id,
  unitIds:          new Set(),   // populated in initSetup
  topicIds:         new Set(),   // populated in initSetup
  questionTypes:    new Set(ALL_TYPES),
  difficulties:     new Set([1, 2, 3]),
  bookmarkedOnly:   false,
  flaggedOnly:      false,
  incorrectOnly:    false,
  adaptiveWeakOnly: false,
  unseenOnly:       false,
  questionCount:    0,           // clamped effective count (≤ maxCount)
  requestedCount:   0,           // last count explicitly typed by user
  maxCount:         0,           // total questions that pass current filters
  shuffleQuestions: true,
  shuffleChoices:   true,
  mode:             'free_practice',
  timerMode:        'none',
  usingDb:          false,
  srDueCounts:      { totalDue: 0, questionDue: 0, flashcardDue: 0 },
  adaptiveWeakCount: 0,
};

// ---------------------------------------------------------------------------
// Count computation
// ---------------------------------------------------------------------------

function getMatchingCountLocal() {
  const reviewHistory = readLocalReviewHistory();
  let n = 0;
  for (const unit of COURSE.units) {
    if (!SetupState.unitIds.has(unit.unit_id)) continue;
    for (const topic of unit.topics) {
      if (!SetupState.topicIds.has(topic.topic_id)) continue;
      for (const q of topic.questions) {
        if (!SetupState.questionTypes.has(q.question_type)) continue;
        const diff = typeof q.difficulty === 'number' ? q.difficulty : 2;
        if (!SetupState.difficulties.has(diff)) continue;
        if (SetupState.bookmarkedOnly && !q.is_bookmarked) continue;
        if (SetupState.flaggedOnly    && !q.is_flagged)    continue;

        const questionId = q.question_id;
        const wasSeen = reviewHistory.seenIds.has(questionId);
        const wasIncorrect = reviewHistory.incorrectIds.has(questionId);

        if (SetupState.incorrectOnly && !wasIncorrect) continue;
        if (SetupState.unseenOnly && wasSeen) continue;

        n++;
      }
    }
  }
  return n;
}

function toFilterPayload() {
  return {
    topicIds: [...SetupState.topicIds],
    questionTypes: [...SetupState.questionTypes],
    difficulties: [...SetupState.difficulties],
    bookmarkedOnly: SetupState.bookmarkedOnly,
    flaggedOnly: SetupState.flaggedOnly,
    incorrectOnly: SetupState.incorrectOnly,
    adaptiveWeakOnly: SetupState.adaptiveWeakOnly,
    unseenOnly: SetupState.unseenOnly,
  };
}

function readLocalReviewHistory() {
  try {
    const seenRaw = localStorage.getItem('classbank_seen_question_ids');
    const incorrectRaw = localStorage.getItem('classbank_incorrect_question_ids');
    const seenParsed = JSON.parse(seenRaw || '[]');
    const incorrectParsed = JSON.parse(incorrectRaw || '[]');
    const seen = Array.isArray(seenParsed) ? seenParsed : [];
    const incorrect = Array.isArray(incorrectParsed) ? incorrectParsed : [];
    return {
      seenIds: new Set(seen.filter((id) => typeof id === 'string')),
      incorrectIds: new Set(incorrect.filter((id) => typeof id === 'string')),
    };
  } catch {
    return { seenIds: new Set(), incorrectIds: new Set() };
  }
}

async function queryMatchingQuestions(options = {}) {
  if (!SetupState.usingDb || !window.api?.getQuestions) {
    return null;
  }

  const shouldFilterAdaptiveWeak = SetupState.adaptiveWeakOnly;

  const payload = {
    ...toFilterPayload(),
    randomSample: shouldFilterAdaptiveWeak
      ? null
      : (Number.isInteger(options.randomSample) ? options.randomSample : null),
  };

  const rows = await window.api.getQuestions(payload);
  if (!Array.isArray(rows)) {
    throw new Error('db:getQuestions returned unexpected payload.');
  }

  if (!shouldFilterAdaptiveWeak) {
    return rows;
  }

  const adaptiveWeakRows = await queryAdaptiveWeakQuestions();
  const adaptiveWeakIds = new Set(adaptiveWeakRows.map((row) => row.questionId).filter((id) => typeof id === 'string'));
  let filteredRows = rows.filter((row) => adaptiveWeakIds.has(row.questionId));

  if (Number.isInteger(options.randomSample) && options.randomSample > 0 && filteredRows.length > options.randomSample) {
    const shuffled = [...filteredRows];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    filteredRows = shuffled.slice(0, options.randomSample);
  }

  return filteredRows;
}

async function querySpacedReviewDue() {
  if (!SetupState.usingDb || !window.api?.getSpacedReviewDueCounts) {
    return { totalDue: 0, questionDue: 0, flashcardDue: 0 };
  }
  try {
    const counts = await window.api.getSpacedReviewDueCounts({ topicIds: [...SetupState.topicIds] });
    if (!counts || typeof counts !== 'object') return { totalDue: 0, questionDue: 0, flashcardDue: 0 };
    return {
      totalDue:     Number(counts.totalDue)     || 0,
      questionDue:  Number(counts.questionDue)  || 0,
      flashcardDue: Number(counts.flashcardDue) || 0,
    };
  } catch {
    return { totalDue: 0, questionDue: 0, flashcardDue: 0 };
  }
}

async function loadSpacedReviewDueItems() {
  if (!SetupState.usingDb || !window.api?.listDueSpacedReviewItems) return [];
  try {
    const items = await window.api.listDueSpacedReviewItems({ topicIds: [...SetupState.topicIds] });
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

async function queryAdaptiveWeakQuestions() {
  if (!SetupState.usingDb || !window.api?.listAdaptiveWeakQuestions) return [];

  try {
    const rows = await window.api.listAdaptiveWeakQuestions({
      topicIds: [...SetupState.topicIds],
      limit: 500,
    });
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function loadCourseFromDb() {
  if (!window.api?.getCourses || !window.api?.getUnits || !window.api?.getTopics) {
    return null;
  }

  const courses = await window.api.getCourses();
  if (!Array.isArray(courses) || courses.length === 0) {
    return null;
  }

  const baseCourse = courses[0];
  const course = {
    course_id: baseCourse.course_id,
    course_name: baseCourse.course_name,
    course_code: baseCourse.course_code || 'Course',
    units: [],
  };

  const units = await window.api.getUnits(course.course_id);
  for (const unit of units) {
    const topics = await window.api.getTopics(unit.unit_id);
    course.units.push({
      unit_id: unit.unit_id,
      unit_name: unit.unit_name,
      sort_order: unit.sort_order,
      topics: topics.map((topic) => ({
        topic_id: topic.topic_id,
        topic_name: topic.topic_name,
        sort_order: topic.sort_order,
        questions: [],
      })),
    });
  }

  return course;
}

async function initSetup() {
  try {
    const dbCourse = await loadCourseFromDb();
    if (dbCourse) {
      COURSE = dbCourse;
      SetupState.usingDb = true;
    } else {
      SetupState.usingDb = false;
      COURSE = COURSE_DATA.courses[0];
    }
  } catch (error) {
    console.error('[setup] Failed to load DB course hierarchy, using fallback fixture.', error);
    SetupState.usingDb = false;
    COURSE = COURSE_DATA.courses[0];
  }

  SetupState.courseId = COURSE.course_id;
  SetupState.unitIds.clear();
  SetupState.topicIds.clear();

  // Default: all units + topics selected
  for (const unit of COURSE.units) {
    SetupState.unitIds.add(unit.unit_id);
    for (const topic of unit.topics) {
      SetupState.topicIds.add(topic.topic_id);
    }
  }

  if (SetupState.usingDb) {
    try {
      lastQuestionQueryResult = await queryMatchingQuestions();
      SetupState.maxCount = lastQuestionQueryResult.length;
    } catch (error) {
      console.error('[setup] Failed to query DB question count, switching to fixture count.', error);
      SetupState.usingDb = false;
      COURSE = COURSE_DATA.courses[0];
      SetupState.maxCount = getMatchingCountLocal();
    }
  } else {
    SetupState.maxCount = getMatchingCountLocal();
  }

  SetupState.questionCount  = SetupState.maxCount;
  SetupState.requestedCount = SetupState.maxCount;

  if (SetupState.usingDb) {
    try {
      SetupState.srDueCounts = await querySpacedReviewDue();
      SetupState.adaptiveWeakCount = (await queryAdaptiveWeakQuestions()).length;
    } catch (error) {
      console.error('[setup] Failed to load SR due counts.', error);
    }
  }
}

// ---------------------------------------------------------------------------
// Render — builds the full body once
// ---------------------------------------------------------------------------

function renderAll() {
  const body = document.getElementById('setup-body');
  if (!body) return;

  body.innerHTML = `
    <div class="setup-filters" role="form" aria-label="Session filters">

      ${renderCourseSection()}
      ${renderUnitSection()}
      ${renderTopicSection()}
      ${renderTypeSection()}
      ${renderDifficultySection()}
      ${renderMetaFiltersSection()}
      ${renderCountSection()}

    </div>

    <div class="setup-options">

      ${renderModeSection()}
      ${renderTimerSection()}
      ${renderOptionsSection()}
      ${renderSummarySection()}

      <button
        class="btn-start-session"
        id="btn-start-session"
        type="button"
        ${SetupState.maxCount === 0 ? 'disabled' : ''}
        aria-label="Start practice session"
      >Start Session →</button>

    </div>
  `;

  attachListeners();
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function renderCourseSection() {
  return `
    <div class="setup-section">
      <div class="setup-section-header">Course</div>
      <div class="setup-course-display">
        ${escapeHtml(COURSE.course_name)}
        <span class="course-code">${escapeHtml(COURSE.course_code)}</span>
      </div>
    </div>
  `;
}

function renderUnitSection() {
  const checkboxes = COURSE.units.map(unit => `
    <label class="setup-checkbox-item" for="unit-${unit.unit_id}">
      <input
        type="checkbox"
        id="unit-${unit.unit_id}"
        class="unit-checkbox"
        data-unit-id="${unit.unit_id}"
        ${SetupState.unitIds.has(unit.unit_id) ? 'checked' : ''}
        aria-label="${escapeHtml(unit.unit_name)}"
      >
      <span class="setup-checkbox-label">${escapeHtml(unit.unit_name)}</span>
    </label>
  `).join('');

  return `
    <div class="setup-section">
      <div class="setup-section-header">Units</div>
      <div class="setup-checkbox-group" id="unit-checkboxes">
        ${checkboxes}
      </div>
    </div>
  `;
}

function renderTopicSection() {
  const groups = COURSE.units.map(unit => {
    const unitSelected = SetupState.unitIds.has(unit.unit_id);

    const topicItems = unit.topics.map(topic => `
      <label
        class="setup-checkbox-item${!unitSelected ? ' is-disabled' : ''}"
        for="topic-${topic.topic_id}"
      >
        <input
          type="checkbox"
          id="topic-${topic.topic_id}"
          class="topic-checkbox"
          data-topic-id="${topic.topic_id}"
          data-unit-id="${unit.unit_id}"
          ${SetupState.topicIds.has(topic.topic_id) ? 'checked' : ''}
          ${!unitSelected ? 'disabled' : ''}
          aria-label="${escapeHtml(topic.topic_name)}"
        >
        <span class="setup-checkbox-label">${escapeHtml(topic.topic_name)}</span>
      </label>
    `).join('');

    return `
      <div class="topic-group" data-parent-unit="${unit.unit_id}">
        <div class="topic-group-unit-label">${escapeHtml(unit.unit_name)}</div>
        ${topicItems}
      </div>
    `;
  }).join('');

  return `
    <div class="setup-section">
      <div class="setup-section-header">Topics</div>
      <div class="setup-checkbox-group" id="topic-checkboxes">
        ${groups}
      </div>
    </div>
  `;
}

function renderTypeSection() {
  const checkboxes = ALL_TYPES.map(type => `
    <label class="setup-checkbox-item" for="type-${type}">
      <input
        type="checkbox"
        id="type-${type}"
        class="type-checkbox"
        data-type="${type}"
        ${SetupState.questionTypes.has(type) ? 'checked' : ''}
        aria-label="${escapeHtml(TYPE_LABELS[type])}"
      >
      <span class="setup-checkbox-label">${escapeHtml(TYPE_LABELS[type])}</span>
    </label>
  `).join('');

  return `
    <div class="setup-section">
      <div class="setup-section-header">Question Types</div>
      <div class="setup-checkbox-group" id="type-checkboxes">
        ${checkboxes}
      </div>
    </div>
  `;
}

function renderCountSection() {
  return `
    <div class="setup-section">
      <div class="setup-section-header">Question Count</div>
      <div class="setup-count-row">
        <input
          type="number"
          id="question-count"
          class="setup-count-input"
          min="1"
          max="${SetupState.maxCount}"
          value="${SetupState.questionCount}"
          ${SetupState.maxCount === 0 ? 'disabled' : ''}
          aria-label="Number of questions"
        >
        <span class="setup-count-of-label">
          of <span class="count-total" id="count-total">${SetupState.maxCount}</span> available
        </span>
      </div>
    </div>
  `;
}

function renderDifficultySection() {
  const levels = [
    { value: 1, label: 'Easy' },
    { value: 2, label: 'Medium' },
    { value: 3, label: 'Hard' },
  ];

  const checkboxes = levels.map(({ value, label }) => `
    <label class="setup-checkbox-item" for="diff-${value}">
      <input
        type="checkbox"
        id="diff-${value}"
        class="diff-checkbox"
        data-difficulty="${value}"
        ${SetupState.difficulties.has(value) ? 'checked' : ''}
        aria-label="${label}"
      >
      <span class="setup-checkbox-label">${label}</span>
    </label>
  `).join('');

  return `
    <div class="setup-section">
      <div class="setup-section-header">Difficulty</div>
      <div class="setup-checkbox-group" id="diff-checkboxes">
        ${checkboxes}
      </div>
    </div>
  `;
}

function renderMetaFiltersSection() {
  return `
    <div class="setup-section">
      <div class="setup-section-header">Narrow Filters</div>
      <div class="setup-toggle-group">

        <div class="toggle-row">
          <span class="toggle-label">Bookmarked Only</span>
          <label class="toggle-switch" aria-label="Bookmarked only">
            <input
              type="checkbox"
              id="toggle-bookmarked"
              class="toggle-input"
              ${SetupState.bookmarkedOnly ? 'checked' : ''}
              role="switch"
              aria-checked="${SetupState.bookmarkedOnly}"
            >
            <span class="toggle-track"></span>
          </label>
        </div>

        <div class="toggle-row">
          <span class="toggle-label">Flagged Only</span>
          <label class="toggle-switch" aria-label="Flagged only">
            <input
              type="checkbox"
              id="toggle-flagged"
              class="toggle-input"
              ${SetupState.flaggedOnly ? 'checked' : ''}
              role="switch"
              aria-checked="${SetupState.flaggedOnly}"
            >
            <span class="toggle-track"></span>
          </label>
        </div>

        <div class="toggle-row">
          <div class="toggle-label-group">
            <span class="toggle-label">Incorrect Only</span>
            <span class="toggle-helper-text">Uses saved review history</span>
          </div>
          <label class="toggle-switch" aria-label="Incorrect only">
            <input
              type="checkbox"
              id="toggle-incorrect"
              class="toggle-input"
              ${SetupState.incorrectOnly ? 'checked' : ''}
              role="switch"
              aria-checked="${SetupState.incorrectOnly}"
            >
            <span class="toggle-track"></span>
          </label>
        </div>

        <div class="toggle-row">
          <div class="toggle-label-group">
            <span class="toggle-label">Unseen Only</span>
            <span class="toggle-helper-text">Uses saved reveal history</span>
          </div>
          <label class="toggle-switch" aria-label="Unseen only">
            <input
              type="checkbox"
              id="toggle-unseen"
              class="toggle-input"
              ${SetupState.unseenOnly ? 'checked' : ''}
              role="switch"
              aria-checked="${SetupState.unseenOnly}"
            >
            <span class="toggle-track"></span>
          </label>
        </div>

        <div class="toggle-row">
          <div class="toggle-label-group">
            <span class="toggle-label">Adaptive Weak Only</span>
            <span class="toggle-helper-text">DB-only MCQ weakness signals (${SetupState.adaptiveWeakCount})</span>
          </div>
          <label class="toggle-switch" aria-label="Adaptive weak only">
            <input
              type="checkbox"
              id="toggle-adaptive-weak"
              class="toggle-input"
              ${SetupState.adaptiveWeakOnly ? 'checked' : ''}
              ${SetupState.usingDb ? '' : 'disabled'}
              role="switch"
              aria-checked="${SetupState.adaptiveWeakOnly}"
            >
            <span class="toggle-track"></span>
          </label>
        </div>

      </div>
    </div>
  `;
}

function renderModeSection() {
  const hasDue    = SetupState.srDueCounts.totalDue > 0;
  const srEnabled = SetupState.usingDb && hasDue;
  const reviewIncorrectHelper = SetupState.adaptiveWeakCount > 0
    ? `Filters to previously missed items. ${SetupState.adaptiveWeakCount} adaptive weak MCQ${SetupState.adaptiveWeakCount === 1 ? '' : 's'} detected.`
    : 'Filters to previously missed items.';
  const srHelper  = !SetupState.usingDb
    ? 'Requires persisted session data.'
    : hasDue
      ? `${SetupState.srDueCounts.totalDue} item${SetupState.srDueCounts.totalDue === 1 ? '' : 's'} due for review.`
      : 'No items currently due.';

  const modes = [
    { id: 'free_practice',    icon: '▷', label: 'Free Practice',    helper: null,                                          enabled: true      },
    { id: 'timed_block',      icon: '⏱', label: 'Timed Block',      helper: 'Use per-block or per-question timer.',        enabled: true      },
    { id: 'review_incorrect', icon: '↩', label: 'Review Incorrect',  helper: reviewIncorrectHelper,                         enabled: true      },
    { id: 'spaced_review',    icon: '◈', label: 'Spaced Review',     helper: srHelper,                                     enabled: srEnabled },
  ];

  const items = modes.map(m => `
    <label
      class="setup-mode-option${!m.enabled ? ' is-disabled' : ''}"
      for="mode-${m.id}"
    >
      <input
        type="radio"
        id="mode-${m.id}"
        class="mode-radio"
        name="session-mode"
        value="${m.id}"
        ${SetupState.mode === m.id ? 'checked' : ''}
        ${!m.enabled ? 'disabled' : ''}
      >
      <span class="mode-option-icon">${m.icon}</span>
      <span class="mode-option-body">
        <span class="mode-option-label">${escapeHtml(m.label)}</span>
        ${m.helper ? `<span class="mode-option-helper">${escapeHtml(m.helper)}</span>` : ''}
      </span>
    </label>
  `).join('');

  return `
    <div class="setup-section">
      <div class="setup-section-header">Session Mode</div>
      <div class="setup-mode-group" id="mode-radios" role="radiogroup" aria-label="Session mode">
        ${items}
      </div>
    </div>
  `;
}

function renderTimerSection() {
  const timers = [
    { id: 'none',         label: 'No Timer',    enabled: true },
    { id: 'per_question', label: 'Per Question', enabled: true },
    { id: 'per_block',    label: 'Per Block',    enabled: true },
  ];

  const items = timers.map(t => `
    <label
      class="setup-timer-option${!t.enabled ? ' is-disabled' : ''}"
      for="timer-${t.id}"
    >
      <input
        type="radio"
        id="timer-${t.id}"
        class="timer-radio"
        name="timer-mode"
        value="${t.id}"
        ${SetupState.timerMode === t.id ? 'checked' : ''}
        ${!t.enabled ? 'disabled' : ''}
      >
      <span class="setup-checkbox-label">${escapeHtml(t.label)}</span>
    </label>
  `).join('');

  return `
    <div class="setup-section">
      <div class="setup-section-header">Timer</div>
      <div class="setup-checkbox-group" id="timer-radios" role="radiogroup" aria-label="Timer mode">
        ${items}
      </div>
      <div class="timer-group-helper">Per-block timer is available for timed sessions.</div>
    </div>
  `;
}

function renderOptionsSection() {
  return `
    <div class="setup-section">
      <div class="setup-section-header">Options</div>
      <div class="setup-toggle-group">

        <div class="toggle-row">
          <span class="toggle-label">Shuffle Questions</span>
          <label class="toggle-switch" aria-label="Shuffle questions">
            <input
              type="checkbox"
              id="toggle-shuffle-questions"
              class="toggle-input"
              ${SetupState.shuffleQuestions ? 'checked' : ''}
              role="switch"
              aria-checked="${SetupState.shuffleQuestions}"
            >
            <span class="toggle-track"></span>
          </label>
        </div>

        <div class="toggle-row">
          <span class="toggle-label">Shuffle Choices</span>
          <label class="toggle-switch" aria-label="Shuffle answer choices">
            <input
              type="checkbox"
              id="toggle-shuffle-choices"
              class="toggle-input"
              ${SetupState.shuffleChoices ? 'checked' : ''}
              role="switch"
              aria-checked="${SetupState.shuffleChoices}"
            >
            <span class="toggle-track"></span>
          </label>
        </div>

      </div>
    </div>
  `;
}

function renderSummarySection() {
  return `
    <div class="setup-section">
      <div class="setup-section-header">Session Preview</div>
      <div class="setup-summary-card" id="summary-card">
        <div class="summary-count-line" id="summary-count-line"></div>
        <div class="summary-detail-line" id="summary-detail"></div>
        <div id="clamp-notice-slot"></div>
        <div id="summary-warning-slot"></div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Reactive summary update (no full re-render)
// ---------------------------------------------------------------------------

function updateSummary() {
  const count    = SetupState.questionCount;
  const maxCount = SetupState.maxCount;
  const warn     = maxCount === 0;
  const isSR     = SetupState.mode === 'spaced_review';
  const label    = isSR
    ? (count === 1 ? 'item due' : 'items due')
    : (count === 1 ? 'question' : 'questions');

  const countLine  = document.getElementById('summary-count-line');
  const detailLine = document.getElementById('summary-detail');
  const clampSlot  = document.getElementById('clamp-notice-slot');
  const warnSlot   = document.getElementById('summary-warning-slot');
  const startBtn   = document.getElementById('btn-start-session');
  const countInput = document.getElementById('question-count');
  const countTotal = document.getElementById('count-total');

  // Single source of truth for the count line — no two-span desync possible
  if (countLine) {
    countLine.innerHTML = `<span class="count-number">${warn ? '0' : count}</span> ${label} selected`;
  }

  // Dynamic detail line — derives from live state, not hardcoded
  if (detailLine) {
    const modeLabel = MODE_LABELS[SetupState.mode] || 'Free Practice';
    const adaptiveLabel = SetupState.usingDb
      ? ` · ${SetupState.adaptiveWeakCount} adaptive weak MCQ${SetupState.adaptiveWeakCount === 1 ? '' : 's'}`
      : '';
    detailLine.textContent = `${COURSE.course_code} — ${modeLabel}${adaptiveLabel}`;
  }

  if (countTotal) countTotal.textContent = String(maxCount);

  // Clamp notice in the summary card — shown when available < requested
  if (clampSlot) {
    if (!warn && SetupState.requestedCount > maxCount && maxCount > 0) {
      const qWord = maxCount === 1 ? 'question' : 'questions';
      clampSlot.innerHTML = `<div class="count-clamp-notice">Only ${maxCount} ${qWord} match the current filters. Session will use ${maxCount}.</div>`;
    } else {
      clampSlot.innerHTML = '';
    }
  }

  if (warnSlot) {
    let warnHtml = '';
    if (warn) {
      const warnMsg = isSR
        ? 'No items are currently due for spaced review. Complete more content or wait for items to become due.'
        : 'No questions match the current filters. Adjust your selection to continue.';
      warnHtml = `
        <div class="summary-warning" role="alert">
          <span class="summary-warning-icon">⚠</span>
          <span>${warnMsg}</span>
        </div>
      `;
    }
    warnSlot.innerHTML = warnHtml;
  }

  if (startBtn) startBtn.disabled = warn;

  if (countInput) {
    countInput.max      = String(maxCount);
    // SR sessions always use all due items — disable count editing
    countInput.disabled = warn || isSR;
    if (!isSR) {
      if (maxCount > 0 && parseInt(countInput.value, 10) > maxCount) {
        countInput.value = String(maxCount);
      }
      if (maxCount > 0 && parseInt(countInput.value, 10) < 1) {
        countInput.value = '1';
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Unit → topic cascade
// ---------------------------------------------------------------------------

/**
 * When a unit is toggled, enable/disable and check/uncheck its child topics
 * so the UI and SetupState stay in sync.
 */
function applyUnitCascade(unitId, checked) {
  // Update SetupState
  if (checked) {
    SetupState.unitIds.add(unitId);
  } else {
    SetupState.unitIds.delete(unitId);
  }

  // Update child topic checkboxes in the DOM
  const topicCheckboxes = document.querySelectorAll(
    `.topic-checkbox[data-unit-id="${unitId}"]`
  );

  topicCheckboxes.forEach(checkbox => {
    const topicId = checkbox.dataset.topicId;
    checkbox.disabled = !checked;
    checkbox.checked  = checked;

    const label = checkbox.closest('.setup-checkbox-item');
    if (label) {
      label.classList.toggle('is-disabled', !checked);
    }

    if (checked) {
      SetupState.topicIds.add(topicId);
    } else {
      SetupState.topicIds.delete(topicId);
    }
  });
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

function attachListeners() {
  function syncFilterControlsFromState() {
    const incorrectToggle = document.getElementById('toggle-incorrect');
    if (incorrectToggle) {
      incorrectToggle.checked = SetupState.incorrectOnly;
      incorrectToggle.setAttribute('aria-checked', String(SetupState.incorrectOnly));
    }

    const adaptiveToggle = document.getElementById('toggle-adaptive-weak');
    if (adaptiveToggle) {
      adaptiveToggle.checked = SetupState.adaptiveWeakOnly;
      adaptiveToggle.setAttribute('aria-checked', String(SetupState.adaptiveWeakOnly));
    }

    const unseenToggle = document.getElementById('toggle-unseen');
    if (unseenToggle) {
      unseenToggle.checked = SetupState.unseenOnly;
      unseenToggle.setAttribute('aria-checked', String(SetupState.unseenOnly));
    }

    const freeRadio = document.getElementById('mode-free_practice');
    const reviewIncorrectRadio = document.getElementById('mode-review_incorrect');
    if (freeRadio && reviewIncorrectRadio) {
      freeRadio.checked = SetupState.mode === 'free_practice';
      reviewIncorrectRadio.checked = SetupState.mode === 'review_incorrect';
    }
  }

  // Unit checkboxes
  document.getElementById('unit-checkboxes')?.addEventListener('change', (e) => {
    const cb = e.target.closest('.unit-checkbox');
    if (!cb) return;
    applyUnitCascade(cb.dataset.unitId, cb.checked);
    void recomputeCount();
  });

  // Topic checkboxes
  document.getElementById('topic-checkboxes')?.addEventListener('change', (e) => {
    const cb = e.target.closest('.topic-checkbox');
    if (!cb) return;
    const topicId = cb.dataset.topicId;
    if (cb.checked) {
      SetupState.topicIds.add(topicId);
    } else {
      SetupState.topicIds.delete(topicId);
    }
    void recomputeCount();
  });

  // Question type checkboxes
  document.getElementById('type-checkboxes')?.addEventListener('change', (e) => {
    const cb = e.target.closest('.type-checkbox');
    if (!cb) return;
    const type = cb.dataset.type;
    if (cb.checked) {
      SetupState.questionTypes.add(type);
    } else {
      SetupState.questionTypes.delete(type);
    }
    void recomputeCount();
  });

  // Question count input
  document.getElementById('question-count')?.addEventListener('input', (e) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 1)         val = 1;
    if (val > SetupState.maxCount)     val = SetupState.maxCount;
    SetupState.questionCount  = val;
    SetupState.requestedCount = val;
    updateSummary();
  });

  // Shuffle questions toggle
  document.getElementById('toggle-shuffle-questions')?.addEventListener('change', (e) => {
    SetupState.shuffleQuestions = e.target.checked;
    e.target.setAttribute('aria-checked', String(e.target.checked));
  });

  // Shuffle choices toggle
  document.getElementById('toggle-shuffle-choices')?.addEventListener('change', (e) => {
    SetupState.shuffleChoices = e.target.checked;
    e.target.setAttribute('aria-checked', String(e.target.checked));
  });

  // Difficulty checkboxes
  document.getElementById('diff-checkboxes')?.addEventListener('change', (e) => {
    const cb = e.target.closest('.diff-checkbox');
    if (!cb) return;
    const d = parseInt(cb.dataset.difficulty, 10);
    if (cb.checked) {
      SetupState.difficulties.add(d);
    } else {
      SetupState.difficulties.delete(d);
    }
    void recomputeCount();
  });

  // Bookmarked Only toggle
  document.getElementById('toggle-bookmarked')?.addEventListener('change', (e) => {
    SetupState.bookmarkedOnly = e.target.checked;
    e.target.setAttribute('aria-checked', String(e.target.checked));
    void recomputeCount();
  });

  // Flagged Only toggle
  document.getElementById('toggle-flagged')?.addEventListener('change', (e) => {
    SetupState.flaggedOnly = e.target.checked;
    e.target.setAttribute('aria-checked', String(e.target.checked));
    void recomputeCount();
  });

  // Incorrect Only toggle
  document.getElementById('toggle-incorrect')?.addEventListener('change', (e) => {
    const next = applyFilterRules(SetupState, { type: 'toggleIncorrect', checked: e.target.checked });
    SetupState.incorrectOnly = next.incorrectOnly;
    SetupState.adaptiveWeakOnly = next.adaptiveWeakOnly;
    SetupState.unseenOnly = next.unseenOnly;
    SetupState.mode = next.mode;
    syncFilterControlsFromState();
    void recomputeCount();
  });

  // Adaptive Weak Only toggle
  document.getElementById('toggle-adaptive-weak')?.addEventListener('change', (e) => {
    const next = applyFilterRules(SetupState, { type: 'toggleAdaptiveWeak', checked: e.target.checked });
    SetupState.incorrectOnly = next.incorrectOnly;
    SetupState.adaptiveWeakOnly = next.adaptiveWeakOnly;
    SetupState.unseenOnly = next.unseenOnly;
    SetupState.mode = next.mode;
    syncFilterControlsFromState();
    void recomputeCount();
  });

  // Unseen Only toggle
  document.getElementById('toggle-unseen')?.addEventListener('change', (e) => {
    const next = applyFilterRules(SetupState, { type: 'toggleUnseen', checked: e.target.checked });
    SetupState.incorrectOnly = next.incorrectOnly;
    SetupState.adaptiveWeakOnly = next.adaptiveWeakOnly;
    SetupState.unseenOnly = next.unseenOnly;
    SetupState.mode = next.mode;
    syncFilterControlsFromState();
    void recomputeCount();
  });

  // Session mode radios
  document.getElementById('mode-radios')?.addEventListener('change', (e) => {
    const rb = e.target.closest('.mode-radio');
    if (!rb) return;
    const next = applyFilterRules(SetupState, { type: 'setMode', mode: rb.value });
    SetupState.mode = next.mode;
    SetupState.incorrectOnly = next.incorrectOnly;
    SetupState.adaptiveWeakOnly = next.adaptiveWeakOnly;
    SetupState.unseenOnly = next.unseenOnly;
    syncFilterControlsFromState();

    if (SetupState.mode === 'review_incorrect') {
      void recomputeCount();
      return;
    }

    if (SetupState.mode === 'timed_block') {
      SetupState.timerMode = 'per_block';
      const perBlockRadio = document.getElementById('timer-per_block');
      if (perBlockRadio) {
        perBlockRadio.checked = true;
      }
      return;
    }

    if (SetupState.mode === 'spaced_review') {
      // SR sessions don't use countdown timers
      SetupState.timerMode = 'none';
      const noneRadio = document.getElementById('timer-none');
      if (noneRadio) noneRadio.checked = true;
      void recomputeCount();
      return;
    }
  });

  // Timer mode radios
  document.getElementById('timer-radios')?.addEventListener('change', (e) => {
    const rb = e.target.closest('.timer-radio');
    if (!rb) return;
    SetupState.timerMode = rb.value;
  });

  // Start Session button
  document.getElementById('btn-start-session')?.addEventListener('click', () => {
    void startSession();
  });
}

// ---------------------------------------------------------------------------
// Count sync helper
// ---------------------------------------------------------------------------

async function recomputeCount() {
  let next = 0;

  if (SetupState.mode === 'spaced_review') {
    if (SetupState.usingDb) {
      try {
        SetupState.srDueCounts = await querySpacedReviewDue();
        next = SetupState.srDueCounts.totalDue;
      } catch (error) {
        console.error('[setup] Failed to recompute SR due count.', error);
        next = 0;
      }
    }
  } else if (SetupState.usingDb) {
    try {
      lastQuestionQueryResult = await queryMatchingQuestions();
      next = lastQuestionQueryResult.length;
    } catch (error) {
      console.error('[setup] Failed to recompute DB count. Falling back to fixture.', error);
      SetupState.usingDb = false;
      COURSE = COURSE_DATA.courses[0];
      next = getMatchingCountLocal();
    }
  } else {
    next = getMatchingCountLocal();
  }

  SetupState.maxCount = next;

  if (SetupState.usingDb) {
    SetupState.adaptiveWeakCount = (await queryAdaptiveWeakQuestions()).length;
  } else {
    SetupState.adaptiveWeakCount = 0;
  }

  // SR sessions always use all due items — no random sub-sampling.
  if (SetupState.mode === 'spaced_review') {
    SetupState.questionCount  = next;
    SetupState.requestedCount = next;
  } else if (next === 0) {
    SetupState.questionCount = 0;
  } else {
    // Clamp to available pool; restore toward requestedCount when pool expands.
    SetupState.questionCount = Math.min(SetupState.requestedCount, next);
    if (SetupState.questionCount < 1) SetupState.questionCount = next;
  }

  // Sync number input value
  const countInput = document.getElementById('question-count');
  if (countInput) {
    countInput.value = String(SetupState.questionCount);
  }

  updateSummary();
}

// ---------------------------------------------------------------------------
// Start session
// ---------------------------------------------------------------------------

function deriveTopicLabelFromSelection() {
  const selected = [];
  const all = [];

  for (const unit of COURSE.units) {
    const unitEnabled = SetupState.unitIds.has(unit.unit_id);
    for (const topic of unit.topics) {
      all.push(topic.topic_name);
      if (unitEnabled && SetupState.topicIds.has(topic.topic_id)) {
        selected.push(topic.topic_name);
      }
    }
  }

  if (selected.length === 0) return 'No Topics Selected';
  if (selected.length === all.length) return 'All Topics';
  if (selected.length === 1) return selected[0];
  return selected.join(' · ');
}

async function startSession() {
  if (SetupState.maxCount === 0) return;

  let preloadedQuestions = null;
  let preloadedSrItems   = null;

  if (SetupState.usingDb) {
    try {
      if (SetupState.mode === 'spaced_review') {
        preloadedSrItems = await loadSpacedReviewDueItems();
        if (!preloadedSrItems || preloadedSrItems.length === 0) return;
      } else {
        preloadedQuestions = await queryMatchingQuestions({ randomSample: SetupState.questionCount });
      }
    } catch (error) {
      console.error('[setup] Failed to preload session content; session will fallback to fixture data.', error);
    }
  }

  const config = {
    courseId:         SetupState.courseId,
    courseName:       COURSE.course_name,
    courseCode:       COURSE.course_code,
    topicLabel:       deriveTopicLabelFromSelection(),
    unitIds:          [...SetupState.unitIds],
    topicIds:         [...SetupState.topicIds],
    questionTypes:    [...SetupState.questionTypes],
    difficulties:     [...SetupState.difficulties],
    bookmarkedOnly:   SetupState.bookmarkedOnly,
    flaggedOnly:      SetupState.flaggedOnly,
    incorrectOnly:    SetupState.incorrectOnly,
    adaptiveWeakOnly: SetupState.adaptiveWeakOnly,
    unseenOnly:       SetupState.unseenOnly,
    questionCount:    SetupState.questionCount,
    shuffleQuestions: SetupState.shuffleQuestions,
    shuffleChoices:   SetupState.shuffleChoices,
    mode:             SetupState.mode,
    timerMode:        SetupState.timerMode,
    preloadedQuestions,
    preloadedSrItems,
  };

  sessionStorage.setItem('classbank_session_config', JSON.stringify(config));
  window.location.href = '../practice-session/index.html';
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  await initSetup();
  renderAll();
  updateSummary();
});
