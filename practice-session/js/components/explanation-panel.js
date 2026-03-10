/**
 * explanation-panel.js — Right-side explanation surface.
 *
 * No event delegation needed — the panel is read-only.
 * Reveal is driven by toggling `.explanation-revealed` on #session-body.
 * The panel is ALWAYS mounted in the DOM; CSS handles width + opacity.
 *
 * Content order (per spec):
 *   1. Result summary bar
 *   2. Main explanation
 *   3. Per-choice breakdown
 *   4. Reference
 */

import { SESSION_DATA } from '../data/seed.js';

/**
 * Render the explanation panel and toggle the reveal class on sessionBodyEl.
 *
 * @param {HTMLElement} panelEl       — #explanation-panel
 * @param {HTMLElement} sessionBodyEl — #session-body (receives .explanation-revealed)
 * @param {object}      state         — SessionState
 */
export function renderExplanationPanel(panelEl, sessionBodyEl, state) {
  const idx      = state.currentIndex;
  const item     = state.items[idx];
  const question = SESSION_DATA.questions[idx];

  if (!item.isRevealed) {
    // Collapse: remove class, clear content, restore aria-hidden
    sessionBodyEl.classList.remove('explanation-revealed');
    panelEl.setAttribute('aria-hidden', 'true');
    panelEl.querySelector('.explanation-panel-inner').innerHTML = '';
    return;
  }

  // Expand
  sessionBodyEl.classList.add('explanation-revealed');
  panelEl.setAttribute('aria-hidden', 'false');
  panelEl.querySelector('.explanation-panel-inner').innerHTML = buildExplanationHtml(item, question);
}

// ---------------------------------------------------------------------------
// HTML builders
// ---------------------------------------------------------------------------

function buildExplanationHtml(item, question) {
  const sections = [buildResultSummary(item, question)];

  if (question.questionType === 'short_answer') {
    sections.push(buildRecallRatingScaffold());
    sections.push(buildUserAnswerReview(item));
    sections.push(buildModelAnswer(question));
    sections.push(buildMainExplanation(question));
    sections.push(buildReference(question));
    return sections.filter(Boolean).join('\n');
  }

  sections.push(buildMainExplanation(question));
  sections.push(buildChoiceBreakdown(item, question));
  sections.push(buildReference(question));

  return sections.filter(Boolean).join('\n');
}

function buildResultSummary(item, question) {
  const isShortAnswer = question.questionType === 'short_answer';

  if (isShortAnswer) {
    return `
      <div class="result-summary result-revealed">
        <div class="result-summary-main">
          <div class="result-kicker">Review State</div>
          <div class="result-title-row">
            <span class="result-icon">◷</span>
            <span class="result-text">Model Answer Open</span>
          </div>
        </div>
        <div class="result-detail">Compare your response against the model answer, then use the reserved recall controls below.</div>
      </div>
    `;
  }

  const breakdown = collectChoiceOutcomeData(item, question);

  const config = {
    correct:   {
      cssClass: 'result-correct',
      icon: '✓',
      label: 'Correct',
      detail: 'Your selection matches the keyed answer.',
      facts: [`Selected correct: ${formatChoiceLabels(breakdown.selectedCorrect)}`],
    },
    partial:   {
      cssClass: 'result-partial',
      icon: '~',
      label: 'Partial Credit',
      detail: `You selected ${breakdown.selectedCorrect.length} correct answer${breakdown.selectedCorrect.length === 1 ? '' : 's'} but missed ${breakdown.missedCorrect.length} remaining correct answer${breakdown.missedCorrect.length === 1 ? '' : 's'}.`,
      facts: [
        `Selected correct: ${formatChoiceLabels(breakdown.selectedCorrect)}`,
        `Missed correct: ${formatChoiceLabels(breakdown.missedCorrect)}`,
      ],
    },
    incorrect: {
      cssClass: 'result-incorrect',
      icon: '✗',
      label: 'Incorrect',
      detail: breakdown.selectedIncorrect.length > 0
        ? `Your selection includes ${breakdown.selectedIncorrect.length} incorrect answer${breakdown.selectedIncorrect.length === 1 ? '' : 's'}.`
        : 'The selected answer does not match the keyed response.',
      facts: [
        breakdown.selectedIncorrect.length > 0
          ? `Selected incorrect: ${formatChoiceLabels(breakdown.selectedIncorrect)}`
          : '',
        `Correct answer: ${formatChoiceLabels(breakdown.correctChoices)}`,
      ].filter(Boolean),
    },
  }[item.result] ?? { cssClass: 'result-revealed', icon: '—', label: 'Revealed', detail: 'Review the explanation and answer breakdown below.', facts: [] };

  const factsHtml = config.facts.length
    ? `<div class="result-facts">${config.facts.map((fact) => `<span class="result-fact">${fact}</span>`).join('')}</div>`
    : '';

  return `
    <div class="result-summary ${config.cssClass}">
      <div class="result-summary-main">
        <div class="result-kicker">Result</div>
        <div class="result-title-row">
          <span class="result-icon">${config.icon}</span>
          <span class="result-text">${config.label}</span>
        </div>
      </div>
      <div class="result-detail">${config.detail}</div>
      ${factsHtml}
    </div>
  `;
}

function buildMainExplanation(question) {
  if (!question.mainExplanationHtml) return '';

  return `
    <div class="expl-section">
      <div class="expl-heading">Explanation</div>
      <div class="expl-body">${question.mainExplanationHtml}</div>
    </div>
  `;
}

function buildChoiceBreakdown(item, question) {
  if (!question.choices || question.choices.length === 0) return '';

  const items = question.choices.map(choice => {
    const breakdownState = getBreakdownState(item, choice);

    return `
      <div class="choice-breakdown-item ${breakdownState.rowClass}">
        <div class="choice-breakdown-marker">
          <span class="choice-breakdown-label ${breakdownState.labelClass}">${choice.label}</span>
          <span class="choice-breakdown-state">${breakdownState.stateLabel}</span>
        </div>
        <div class="choice-breakdown-content">
          <div class="choice-breakdown-answer">${choice.html}</div>
          ${choice.explanationHtml
            ? `<div class="choice-breakdown-expl">${choice.explanationHtml}</div>`
            : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="expl-section">
      <div class="expl-heading">Answer Breakdown</div>
      <div class="choice-breakdown-list">${items}</div>
    </div>
  `;
}

function buildRecallRatingScaffold() {
  return `
    <div class="expl-section recall-section">
      <div class="expl-heading">Recall Rating</div>
      <div class="recall-rating-shell" aria-hidden="true">
        <span class="recall-pill">Again</span>
        <span class="recall-pill">Hard</span>
        <span class="recall-pill is-primary">Good</span>
        <span class="recall-pill">Easy</span>
      </div>
      <div class="expl-caption">Static placeholder for the short-answer recall controls.</div>
    </div>
  `;
}

function buildUserAnswerReview(item) {
  const answerHtml = item.shortAnswerText.trim().length > 0
    ? `<p>${escapeHtml(item.shortAnswerText).replace(/\n/g, '<br>')}</p>`
    : '<p>No response recorded before reveal.</p>';

  return `
    <div class="expl-section expl-section-emphasis">
      <div class="expl-heading">Your Response</div>
      <div class="expl-body expl-body-compact">${answerHtml}</div>
    </div>
  `;
}

function buildModelAnswer(question) {
  if (!question.modelAnswerHtml) return '';

  return `
    <div class="expl-section expl-section-emphasis model-answer-section">
      <div class="expl-heading">Model Answer</div>
      <div class="model-answer-block">
        <div class="model-answer-body">${question.modelAnswerHtml}</div>
      </div>
    </div>
  `;
}

function buildReference(question) {
  if (!question.referenceText) return '';

  return `
    <div class="expl-section">
      <div class="expl-heading">Reference</div>
      <div class="expl-reference">${escapeHtml(question.referenceText)}</div>
    </div>
  `;
}

function collectChoiceOutcomeData(item, question) {
  const selectedCorrect = [];
  const selectedIncorrect = [];
  const missedCorrect = [];
  const correctChoices = [];

  question.choices.forEach((choice) => {
    if (choice.isCorrect) {
      correctChoices.push(choice.label);
    }

    if (item.selectedChoiceIds.includes(choice.choiceId)) {
      if (choice.isCorrect) {
        selectedCorrect.push(choice.label);
      } else {
        selectedIncorrect.push(choice.label);
      }
    } else if (choice.isCorrect) {
      missedCorrect.push(choice.label);
    }
  });

  return {
    selectedCorrect,
    selectedIncorrect,
    missedCorrect,
    correctChoices,
  };
}

function formatChoiceLabels(labels) {
  return labels.length ? labels.join(', ') : 'None';
}

function getBreakdownState(item, choice) {
  const isSelected = item.selectedChoiceIds.includes(choice.choiceId);

  if (choice.isCorrect && isSelected) {
    return {
      rowClass: item.result === 'partial' ? 'state-partial-correct' : 'state-correct',
      labelClass: 'is-correct',
      stateLabel: item.result === 'partial' ? 'Selected correct choice' : 'Correct choice',
    };
  }

  if (!choice.isCorrect && isSelected) {
    return {
      rowClass: 'state-incorrect',
      labelClass: 'is-incorrect',
      stateLabel: 'Selected incorrect choice',
    };
  }

  if (choice.isCorrect && !isSelected) {
    return {
      rowClass: 'state-missed',
      labelClass: 'is-missed',
      stateLabel: 'Missed correct choice',
    };
  }

  return {
    rowClass: 'state-neutral',
    labelClass: 'is-neutral',
    stateLabel: 'Not selected',
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
