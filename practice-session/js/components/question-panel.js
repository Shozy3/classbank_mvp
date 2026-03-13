/**
 * question-panel.js — Left-side question surface.
 *
 * setupQuestionPanel() attaches delegated listeners once.
 * renderQuestionPanel() rebuilds innerHTML on every state change.
 *
 * Strikeout: right-click (contextmenu) OR Option+click (altKey).
 * Choice select: plain click (before reveal).
 * Short-answer textarea: input event.
 */

import { SESSION_DATA } from '../data/seed.js';

const TYPE_LABELS = {
  single_best:  'Single Best',
  multi_select: 'Multi-Select',
  true_false:   'True / False',
  short_answer: 'Short Answer',
};

const TYPE_CSS_CLASS = {
  single_best:  'type-single-best',
  multi_select: 'type-multi-select',
  true_false:   'type-true-false',
  short_answer: 'type-short-answer',
};

/**
 * One-time setup: delegates choice clicks, strikeout, and short-answer input.
 *
 * @param {HTMLElement} containerEl
 * @param {function}    onAction
 */
export function setupQuestionPanel(containerEl, onAction) {
  // Click: select choice OR option+click = strikeout
  containerEl.addEventListener('click', (e) => {
    const choiceEl = e.target.closest('[data-choice-id]');
    if (!choiceEl) return;

    // Prevent interaction on revealed/disabled choices
    if (choiceEl.classList.contains('disabled')) return;

    const choiceId = choiceEl.dataset.choiceId;

    if (e.altKey) {
      // Option+click = strikeout
      onAction({ type: 'strikeout', choiceId });
    } else {
      onAction({ type: 'selectChoice', choiceId });
    }
  });

  // Right-click = strikeout
  containerEl.addEventListener('contextmenu', (e) => {
    const choiceEl = e.target.closest('[data-choice-id]');
    if (!choiceEl) return;
    if (choiceEl.classList.contains('disabled')) return;

    e.preventDefault();
    const choiceId = choiceEl.dataset.choiceId;
    onAction({ type: 'strikeout', choiceId });
  });

  // Short-answer textarea input
  containerEl.addEventListener('input', (e) => {
    if (e.target.dataset.shortAnswer !== undefined) {
      onAction({ type: 'shortAnswerInput', text: e.target.value });
    }
  });

  // Keyboard: Enter/Space on choice (accessibility)
  containerEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const choiceEl = e.target.closest('[data-choice-id]');
    if (!choiceEl) return;
    if (choiceEl.classList.contains('disabled')) return;
    e.preventDefault();
    const choiceId = choiceEl.dataset.choiceId;
    onAction({ type: 'selectChoice', choiceId });
  });
}

/**
 * Render the question panel for the current item.
 *
 * @param {HTMLElement} containerEl  — #question-panel
 * @param {object}      state        — SessionState
 */
export function renderQuestionPanel(containerEl, state) {
  const idx      = state.currentIndex;
  const item     = state.items[idx];
  const question = SESSION_DATA.questions[idx];

  const typeLabel    = TYPE_LABELS[question.questionType]    ?? question.questionType;
  const typeCssClass = TYPE_CSS_CLASS[question.questionType] ?? '';

  let bodyHtml = '';
  const footerHtml = renderQuestionFooter(item, question);

  if (question.questionType === 'short_answer') {
    bodyHtml = renderShortAnswer(item, question);
  } else {
    bodyHtml = renderChoices(item, question);
  }

  containerEl.innerHTML = `
    <div class="question-panel-inner">
      <div class="question-surface">
        <div class="question-meta-row">
          <div class="question-meta">
            <span class="question-number">Question ${idx + 1} of ${state.items.length}</span>
            <span class="question-type-badge ${typeCssClass}">${typeLabel}</span>
          </div>
        </div>
        <div class="question-stem-block">
          <div class="question-stem">${question.stem}</div>
        </div>
        <div class="question-response-area">
          ${bodyHtml}
        </div>
      </div>
      ${footerHtml}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function renderChoices(item, question) {
  const isMulti = question.questionType === 'multi_select';

  const hintHtml = isMulti && !item.isRevealed
    ? `<div class="multi-select-hint">Select all that apply.</div>`
    : '';

  const choicesHtml = question.choices.map(choice =>
    renderChoice(choice, item, question)
  ).join('\n');

  return `
    <div class="question-response-shell">
      ${hintHtml}
      <ul class="choices-list" role="list">
        ${choicesHtml}
      </ul>
    </div>
  `;
}

function renderChoice(choice, item, question) {
  const { choiceId, label, html, isCorrect } = choice;

  const isSelected   = item.selectedChoiceIds.includes(choiceId);
  const isStrikeout  = item.strikeoutChoiceIds.includes(choiceId);
  const isRevealed   = item.isRevealed;

  const classes = buildChoiceClasses({
    isSelected,
    isStrikeout,
    isRevealed,
    isCorrect,
    isChosen: isSelected,
    result: item.result,
    questionType: question.questionType,
  });

  const status = buildChoiceStatus({
    isSelected,
    isStrikeout,
    isRevealed,
    isCorrect,
    result: item.result,
    questionType: question.questionType,
  });

  const iconHtml = renderChoiceIcon(isRevealed, isCorrect, isSelected);
  const statusHtml = status
    ? `<span class="choice-status ${status.cssClass}">${status.label}</span>`
    : '';

  return `<li
    class="${classes}"
    data-choice-id="${choiceId}"
    role="button"
    tabindex="${isRevealed ? -1 : 0}"
    aria-pressed="${isSelected}"
  >
    <span class="choice-label">${label}</span>
    <span class="choice-content">
      ${statusHtml}
      <span class="choice-body">${html}</span>
    </span>
    <span class="choice-icon">${iconHtml}</span>
  </li>`;
}

function buildChoiceClasses({ isSelected, isStrikeout, isRevealed, isCorrect, isChosen, result, questionType }) {
  const classes = ['choice'];

  if (!isRevealed) {
    if (isSelected)  classes.push('selected');
    if (isStrikeout) classes.push('strikeout');
    return classes.join(' ');
  }

  // After reveal — override interaction classes with result classes
  classes.push('disabled');

  const isMulti = questionType === 'multi_select';
  const isPartialResult = result === 'partial';

  if (isCorrect && isChosen) {
    classes.push('revealed-correct');
    if (isMulti && isPartialResult) classes.push('partial-context');
  } else if (!isCorrect && isChosen) {
    classes.push('revealed-incorrect');
  } else if (isCorrect && !isChosen) {
    classes.push('revealed-missed-correct');
  }
  // else: not correct, not chosen — apply disabled opacity only

  return classes.join(' ');
}

function renderChoiceIcon(isRevealed, isCorrect, isChosen) {
  if (!isRevealed) return '';
  if (isCorrect && isChosen)  return ''; // checkmark injected via CSS ::after on .choice-icon
  if (!isCorrect && isChosen) return ''; // × injected via CSS ::after
  if (isCorrect && !isChosen) return ''; // ↑ injected via CSS ::after
  return '';
}

function renderShortAnswer(item, question) {
  const revealedClass = item.isRevealed ? ' revealed' : '';
  const readOnly      = item.isRevealed ? ' readonly' : '';

  const noteHtml = item.isRevealed
    ? `<div class="short-answer-surface-note">Your response is locked for comparison while the model answer and explanation stay visible in the right panel.</div>`
    : `<div class="short-answer-surface-note">Write a concise response before revealing the model answer.</div>`;

  return `
    <div class="short-answer-area${revealedClass}">
      <div class="short-answer-label">Your Answer</div>
      <textarea
        class="short-answer-textarea"
        data-short-answer
        placeholder="Type your answer here…"
        ${readOnly}
      >${escapeHtml(item.shortAnswerText)}</textarea>
      ${noteHtml}
    </div>
  `;
}

function renderQuestionFooter(item, question) {
  if (question.questionType === 'short_answer') {
    return item.isRevealed
      ? `<div class="question-panel-footer">Use the right panel to compare your response against the model answer, then rate recall.</div>`
      : `<div class="question-panel-footer">Keep the answer concise and definition-focused. The explanation panel stays hidden until reveal.</div>`;
  }

  if (item.isRevealed) {
    return `<div class="question-panel-footer">Answer states are now locked. Use the explanation panel to review correctness, missed answers, and rationale.</div>`;
  }

  return `<div class="question-panel-footer">Option-click or right-click any choice to strike it out before reveal.</div>`;
}

function buildChoiceStatus({ isSelected, isStrikeout, isRevealed, isCorrect, result, questionType }) {
  if (!isRevealed) {
    if (isSelected && isStrikeout) {
      return { label: 'Selected and struck out', cssClass: 'status-strikeout' };
    }
    if (isStrikeout) {
      return { label: 'Struck out', cssClass: 'status-strikeout' };
    }
    return null;
  }

  if (isCorrect && isSelected) {
    if (questionType === 'multi_select' && result === 'partial') {
      return { label: 'Selected correct', cssClass: 'status-partial' };
    }
    return { label: 'Correct choice', cssClass: 'status-correct' };
  }

  if (!isCorrect && isSelected) {
    return { label: 'Selected incorrect', cssClass: 'status-incorrect' };
  }

  if (isCorrect && !isSelected) {
    return { label: 'Missed correct', cssClass: 'status-missed' };
  }

  return null; // unchosen incorrect — no pill needed
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
