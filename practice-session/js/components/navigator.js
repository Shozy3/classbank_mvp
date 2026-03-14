/**
 * navigator.js — Question navigator strip.
 *
 * setupNavigator() attaches one delegated click listener to the container.
 * renderNavigator() regenerates innerHTML — no listeners reattached.
 */

import { getNavStatus } from '../state/session-state.js';

/**
 * One-time setup: delegates clicks on #navigator via data-nav-index.
 *
 * @param {HTMLElement} containerEl
 * @param {function}    onAction  — called with { type: 'goTo', index: number }
 */
export function setupNavigator(containerEl, onAction) {
  containerEl.addEventListener('click', (e) => {
    const item = e.target.closest('[data-nav-index]');
    if (!item) return;
    const index = parseInt(item.dataset.navIndex, 10);
    if (!Number.isNaN(index)) {
      onAction({ type: 'goTo', index });
    }
  });

  containerEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest('[data-nav-index]');
    if (!item) return;
    const index = parseInt(item.dataset.navIndex, 10);
    if (Number.isNaN(index)) return;
    e.preventDefault();
    onAction({ type: 'goTo', index });
  });
}

/**
 * Render the navigator strip.
 *
 * @param {HTMLElement} containerEl
 * @param {object}      state  — SessionState
 */
export function renderNavigator(containerEl, state) {
  const items = state.items.map((item, idx) => {
    const navStatus   = getNavStatus(item);
    const isCurrent   = idx === state.currentIndex;

    const classes = buildNavItemClasses(navStatus, isCurrent, item.isFlagged, item.isBookmarked);
    const ariaCurrent = isCurrent ? ' aria-current="true"' : '';

    return `<div
      class="${classes}"
      data-nav-index="${idx}"
      title="Question ${idx + 1}${buildNavTitle(navStatus, item)}"
      role="button"
      tabindex="0"
      ${ariaCurrent}
    >${idx + 1}</div>`;
  });

  containerEl.innerHTML = `
    <div class="navigator-label">Questions</div>
    <div class="nav-strip" role="list">
      ${items.join('\n      ')}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildNavItemClasses(navStatus, isCurrent, isFlagged, isBookmarked) {
  const classes = ['nav-item'];

  if (navStatus !== 'unseen') {
    classes.push(`has-${navStatus}`);
  }

  if (isCurrent) {
    classes.push('current');
  } else {
    // Status drives the base visual
    switch (navStatus) {
      case 'correct':   classes.push('correct');   break;
      case 'partial':   classes.push('partial');   break;
      case 'incorrect': classes.push('incorrect'); break;
      case 'skipped':   classes.push('skipped');   break;
      case 'answered':  classes.push('answered');  break;
      case 'unanswered': classes.push('unanswered'); break;
      // 'unseen' — no extra class, default styling
    }
  }

  if (isFlagged)    classes.push('flagged');
  if (isBookmarked) classes.push('bookmarked');

  return classes.join(' ');
}

function buildNavTitle(navStatus, item) {
  const statusLabel = {
    correct:   ' — Correct',
    partial:   ' — Partial credit',
    incorrect: ' — Incorrect',
    skipped:   ' — Skipped',
    answered:  ' — Answered',
    unanswered: ' — Unanswered',
    unseen:    '',
  }[navStatus] ?? '';

  const flags = [];
  if (item.isFlagged)    flags.push('flagged');
  if (item.isBookmarked) flags.push('bookmarked');

  const flagsLabel = flags.length ? ` (${flags.join(', ')})` : '';
  return `${statusLabel}${flagsLabel}`;
}
