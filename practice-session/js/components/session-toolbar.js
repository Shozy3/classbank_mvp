/**
 * session-toolbar.js — Session action toolbar.
 *
 * Contains: Prev · Next · Skip | Reveal/Submit | Bookmark · Flag
 * Timer lives in #session-header, not here.
 *
 * setupToolbar() attaches one delegated click listener on the container.
 * renderToolbar() rebuilds innerHTML — no listeners reattached.
 */

import { SESSION_DATA } from '../data/seed.js';

/**
 * One-time setup: delegates toolbar button clicks via data-action.
 *
 * @param {HTMLElement} containerEl
 * @param {function}    onAction
 */
export function setupToolbar(containerEl, onAction) {
  containerEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.disabled) return;
    const action = btn.dataset.action;
    if (action) onAction({ type: action });
  });
}

/**
 * Render the toolbar for current session state.
 *
 * @param {HTMLElement} containerEl  — .toolbar
 * @param {object}      state        — SessionState
 */
export function renderToolbar(containerEl, state) {
  const idx      = state.currentIndex;
  const item     = state.items[idx];
  const question = SESSION_DATA.questions[idx];
  const total    = state.items.length;

  const isFirst    = idx === 0;
  const isLast     = idx === total - 1;
  const isRevealed = item.isRevealed;
  const isShort    = question.questionType === 'short_answer';
  const isFlashcard = question.questionType === 'flashcard';

  // Reveal button label
  const revealLabel = isRevealed
    ? (isShort || isFlashcard) ? 'Back Side Open' : 'Explanation Open'
    : isShort    ? 'Reveal Answer'
    : isFlashcard ? 'Reveal Back Side'
    : 'Reveal';

  const revealClass = isRevealed ? 'btn-state' : 'btn-primary';

  // Bookmark / Flag active states
  const bmClass   = item.isBookmarked ? ' active-bookmark' : '';
  const flagClass = item.isFlagged    ? ' active-flag'     : '';

  containerEl.innerHTML = `
    <div class="toolbar-group">
      <button
        class="btn btn-ghost"
        data-action="prev"
        ${isFirst ? 'disabled' : ''}
        title="Previous question (←)"
      >← Prev</button>

      <button
        class="btn btn-ghost"
        data-action="next"
        ${isLast ? 'disabled' : ''}
        title="${isLast ? 'You have reached the last question' : 'Next question (→)'}"
      >${isLast && isRevealed ? 'End of Session' : 'Next →'}</button>

      <button
        class="btn btn-ghost"
        data-action="skip"
        ${isRevealed ? 'disabled' : ''}
        title="Skip and return later"
      >Skip</button>
    </div>

    <div class="toolbar-sep"></div>

    <div class="toolbar-spacer"></div>

    <div class="toolbar-group">
      <button
        class="btn ${revealClass}"
        data-action="reveal"
        ${isRevealed ? 'disabled' : ''}
        title="${isShort ? 'Reveal model answer' : isFlashcard ? 'Reveal flashcard back side' : 'Reveal answer and explanation'}"
      >${revealLabel}</button>
    </div>

    <div class="toolbar-spacer"></div>

    <div class="toolbar-sep"></div>

    <div class="toolbar-group">
      <button
        class="btn btn-toggle${bmClass}"
        data-action="bookmark"
        title="${item.isBookmarked ? 'Remove bookmark' : 'Bookmark this question'}"
      >
        <span class="btn-icon">${item.isBookmarked ? '★' : '☆'}</span>
        <span class="btn-label">${item.isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
      </button>

      <button
        class="btn btn-toggle${flagClass}"
        data-action="flag"
        title="${item.isFlagged ? 'Remove flag' : 'Flag for review'}"
      >
        <span class="btn-icon">⚑</span>
        <span class="btn-label">${item.isFlagged ? 'Flagged' : 'Flag'}</span>
      </button>
    </div>
  `;
}
