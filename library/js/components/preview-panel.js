/* preview-panel.js — right pane item preview */
'use strict';

const PreviewPanel = (() => {
  let _paneEl = null;
  let _contentEl = null;
  let _workspaceEl = null;
  let _dupBtn = null;
  let _moveBtn = null;
  let _deleteBtn = null;
  let _closeBtn = null;

  const TYPE_LABEL = {
    single_best:  'MCQ — Single Best Answer',
    multi_select: 'MCQ — Multi-Select',
    true_false:   'True / False',
    short_answer: 'Short Answer',
    flashcard:    'Flashcard',
  };

  // -------------------------------------------------------------------------
  // Mount
  // -------------------------------------------------------------------------
  function mount({ paneEl, contentEl, workspaceEl, dupBtn, moveBtn, deleteBtn, closeBtn }) {
    _paneEl = paneEl;
    _contentEl = contentEl;
    _workspaceEl = workspaceEl;
    _dupBtn = dupBtn;
    _moveBtn = moveBtn;
    _deleteBtn = deleteBtn;
    _closeBtn = closeBtn;

    _closeBtn.addEventListener('click', close);
    _dupBtn.addEventListener('click', _handleDuplicate);
    _moveBtn.addEventListener('click', _handleMove);
    _deleteBtn.addEventListener('click', _handleDelete);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  function render() {
    const item = LibraryState.getSelectedItem();
    if (!item) {
      close();
      return;
    }

    _paneEl.hidden = false;
    _workspaceEl.classList.add('preview-open');
    _contentEl.innerHTML = '';
    _contentEl.appendChild(item.contentType === 'flashcard' ? _buildFlashcard(item) : _buildQuestion(item));
  }

  function close() {
    _paneEl.hidden = true;
    _workspaceEl.classList.remove('preview-open');
  }

  // -------------------------------------------------------------------------
  // Build question preview
  // -------------------------------------------------------------------------
  function _buildQuestion(item) {
    const frag = document.createDocumentFragment();

    // Header row: type badge + difficulty + flags
    const header = document.createElement('div');
    header.className = 'preview-header';

    const typeBadge = _makeTypeBadge(item.questionType);
    header.appendChild(typeBadge);

    if (item.difficulty) {
      const dots = document.createElement('div');
      dots.className = 'difficulty-dots';
      for (let i = 1; i <= 5; i++) {
        const d = document.createElement('span');
        d.className = 'difficulty-dot' + (i <= item.difficulty ? ' filled' : '');
        dots.appendChild(d);
      }
      header.appendChild(dots);
    }

    header.appendChild(_makeFlagButtons(item));
    frag.appendChild(header);

    // Stem
    const stemLabel = document.createElement('div');
    stemLabel.className = 'preview-label';
    stemLabel.textContent = 'Question';
    frag.appendChild(stemLabel);

    const stem = document.createElement('div');
    stem.className = 'preview-stem';
    stem.textContent = _truncate(LibraryState.stripHtml(item.stem), 350);
    frag.appendChild(stem);

    // Choices (MCQ types)
    if (item.choices && item.choices.length > 0 && item.questionType !== 'short_answer') {
      const choicesLabel = document.createElement('div');
      choicesLabel.className = 'preview-label';
      choicesLabel.textContent = 'Choices';
      frag.appendChild(choicesLabel);

      const choiceList = document.createElement('div');
      choiceList.className = 'preview-choices';
      for (const c of item.choices.slice(0, 6)) {
        const choiceEl = document.createElement('div');
        choiceEl.className = 'preview-choice';
        const raw = LibraryState.stripHtml(c.html || c.choice_rich_text || '');
        choiceEl.textContent = `${c.label || '•'} ${_truncate(raw, 60)}`;
        choiceEl.title = raw;
        choiceList.appendChild(choiceEl);
      }
      frag.appendChild(choiceList);
    }

    // Model answer for short-answer
    if (item.questionType === 'short_answer' && item.modelAnswerHtml) {
      const maLabel = document.createElement('div');
      maLabel.className = 'preview-label';
      maLabel.textContent = 'Model Answer';
      frag.appendChild(maLabel);

      const ma = document.createElement('div');
      ma.className = 'preview-stem';
      ma.textContent = _truncate(LibraryState.stripHtml(item.modelAnswerHtml), 200);
      frag.appendChild(ma);
    }

    frag.appendChild(_buildMeta(item));

    return frag;
  }

  // -------------------------------------------------------------------------
  // Build flashcard preview
  // -------------------------------------------------------------------------
  function _buildFlashcard(item) {
    const frag = document.createDocumentFragment();

    const header = document.createElement('div');
    header.className = 'preview-header';
    header.appendChild(_makeTypeBadge('flashcard'));
    header.appendChild(_makeFlagButtons(item));
    frag.appendChild(header);

    const frontLabel = document.createElement('div');
    frontLabel.className = 'preview-label';
    frontLabel.textContent = 'Front';
    frag.appendChild(frontLabel);

    const front = document.createElement('div');
    front.className = 'preview-stem';
    front.textContent = _truncate(LibraryState.stripHtml(item.frontHtml), 260);
    frag.appendChild(front);

    const backLabel = document.createElement('div');
    backLabel.className = 'preview-label';
    backLabel.textContent = 'Back';
    frag.appendChild(backLabel);

    const back = document.createElement('div');
    back.className = 'preview-stem';
    back.textContent = _truncate(LibraryState.stripHtml(item.backHtml), 260);
    frag.appendChild(back);

    if (item.reviewCount > 0) {
      const rc = document.createElement('div');
      rc.className = 'preview-label';
      rc.textContent = `Reviewed ${item.reviewCount} time${item.reviewCount !== 1 ? 's' : ''}`;
      frag.appendChild(rc);
    }

    frag.appendChild(_buildMeta(item));
    return frag;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  function _makeTypeBadge(type) {
    const clsMap = {
      single_best:  'type-badge-mcq',
      multi_select: 'type-badge-mcq',
      true_false:   'type-badge-tf',
      short_answer: 'type-badge-sa',
      flashcard:    'type-badge-flash',
    };
    const labelMap = {
      single_best:  'MCQ',
      multi_select: 'Multi-Select',
      true_false:   'T/F',
      short_answer: 'Short Answer',
      flashcard:    'Flashcard',
    };
    const badge = document.createElement('span');
    badge.className = `type-badge ${clsMap[type] || ''}`;
    badge.textContent = labelMap[type] || type;
    return badge;
  }

  function _makeFlagButtons(item) {
    const wrap = document.createElement('div');
    wrap.className = 'preview-flags';

    const bookmarkBtn = document.createElement('button');
    bookmarkBtn.className = 'preview-flag-btn' + (item.isBookmarked ? ' bookmark-active' : '');
    bookmarkBtn.title = item.isBookmarked ? 'Remove bookmark' : 'Bookmark';
    bookmarkBtn.textContent = '🔖';
    bookmarkBtn.dataset.action = 'preview-bookmark';
    bookmarkBtn.addEventListener('click', () => _handleFlagToggle(item.id, item.contentType, 'bookmark'));
    wrap.appendChild(bookmarkBtn);

    const flagBtn = document.createElement('button');
    flagBtn.className = 'preview-flag-btn' + (item.isFlagged ? ' flag-active' : '');
    flagBtn.title = item.isFlagged ? 'Remove flag' : 'Flag for review';
    flagBtn.textContent = '⚑';
    flagBtn.dataset.action = 'preview-flag';
    flagBtn.addEventListener('click', () => _handleFlagToggle(item.id, item.contentType, 'flag'));
    wrap.appendChild(flagBtn);

    return wrap;
  }

  function _buildMeta(item) {
    const meta = document.createElement('div');
    meta.className = 'preview-meta';

    if (item.lastEditedAt) {
      const row = document.createElement('div');
      row.className = 'preview-meta-row';
      row.textContent = `Last edited: ${new Date(item.lastEditedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      meta.appendChild(row);
    }

    const state = LibraryState.get();
    if (item.topicId && state.topics) {
      let topicName = null;
      for (const arr of Object.values(state.topics)) {
        const t = arr.find((x) => x.topicId === item.topicId);
        if (t) { topicName = t.topicName; break; }
      }
      if (topicName) {
        const row = document.createElement('div');
        row.className = 'preview-meta-row';
        row.textContent = `Topic: ${topicName}`;
        meta.appendChild(row);
      }
    }

    return meta;
  }

  function _truncate(text, max) {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  async function _handleFlagToggle(itemId, contentType, which) {
    const state = LibraryState.get();
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return;
    const patch = {
      isBookmarked: which === 'bookmark' ? !item.isBookmarked : item.isBookmarked,
      isFlagged:    which === 'flag'     ? !item.isFlagged    : item.isFlagged,
    };
    try {
      await window.api.updateItemFlags({ itemId, contentType, ...patch });
      LibraryState.updateItemInState(itemId, patch);
      document.dispatchEvent(new CustomEvent('library:item-flags-updated', { detail: { itemId } }));
      render();
    } catch (err) {
      console.error('[library] preview flag toggle failed:', err);
    }
  }

  async function _handleDuplicate() {
    const state = LibraryState.get();
    const item = LibraryState.getSelectedItem();
    if (!item) return;
    document.dispatchEvent(new CustomEvent('library:duplicate-item', { detail: { itemId: item.id, itemType: item.contentType } }));
  }

  function _handleMove() {
    const item = LibraryState.getSelectedItem();
    if (!item) return;
    document.dispatchEvent(new CustomEvent('library:move-items', {
      detail: { itemIds: [item.id], contentType: item.contentType },
    }));
  }

  function _handleDelete() {
    const item = LibraryState.getSelectedItem();
    if (!item) return;
    document.dispatchEvent(new CustomEvent('library:confirm-delete', {
      detail: { type: item.contentType, id: item.id, name: item.displayTitle || '(untitled)', entity: false },
    }));
  }

  return { mount, render, close };
})();
