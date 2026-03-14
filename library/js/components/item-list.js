/* item-list.js — center pane item list + toolbar */
'use strict';

const ItemList = (() => {
  let _listEl = null;
  let _emptyEl = null;
  let _emptyMsgEl = null;
  let _countEl = null;
  let _bulkBarEl = null;
  let _bulkCountEl = null;

  const TYPE_BADGE = {
    single_best: { label: 'MCQ',   cls: 'type-badge-mcq' },
    multi_select:{ label: 'MCQ',   cls: 'type-badge-mcq' },
    true_false:  { label: 'T/F',   cls: 'type-badge-tf'  },
    short_answer:{ label: 'SA',    cls: 'type-badge-sa'  },
    flashcard:   { label: 'Flash', cls: 'type-badge-flash'},
  };

  // -------------------------------------------------------------------------
  // Mount
  // -------------------------------------------------------------------------
  function mount({ listEl, emptyEl, emptyMsgEl, countEl, bulkBarEl, bulkCountEl }) {
    _listEl     = listEl;
    _emptyEl    = emptyEl;
    _emptyMsgEl = emptyMsgEl;
    _countEl    = countEl;
    _bulkBarEl  = bulkBarEl;
    _bulkCountEl = bulkCountEl;
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  function render() {
    const state = LibraryState.get();
    const items = LibraryState.getFilteredItems();

    _updateBulkBar(state);

    if (!state.selectedTopicId) {
      _showEmpty('Select a topic to view its content.');
      return;
    }

    if (state.isLoadingItems) {
      _showEmpty('Loading…');
      return;
    }

    if (items.length === 0) {
      const hasItems = state.items.length > 0;
      _showEmpty(hasItems ? 'No items match your filters.' : 'No items in this topic yet.');
      return;
    }

    _emptyEl.hidden = true;
    _listEl.innerHTML = '';

    for (const item of items) {
      _listEl.appendChild(_buildRow(item, state));
    }

    _countEl.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;
    _listEl.addEventListener('click', _onListClick);
  }

  function _showEmpty(msg) {
    _listEl.innerHTML = '';
    if (_emptyMsgEl) _emptyMsgEl.textContent = msg;
    _emptyEl.hidden = false;
    _countEl.textContent = '';
  }

  function _buildRow(item, state) {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.dataset.itemId = item.id;
    row.dataset.itemType = item.contentType;
    row.setAttribute('role', 'listitem');

    if (state.selectedItemId === item.id) row.classList.add('selected');
    if (state.bulkSelectedIds.has(item.id)) row.classList.add('bulk-selected');

    // Checkbox
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'item-row-checkbox';
    cb.checked = state.bulkSelectedIds.has(item.id);
    cb.dataset.action = 'bulk-toggle';
    cb.dataset.itemId = item.id;
    cb.addEventListener('click', (e) => e.stopPropagation());
    row.appendChild(cb);

    // Type badge
    const badgeInfo = TYPE_BADGE[item.questionType] || { label: '?', cls: '' };
    const badge = document.createElement('span');
    badge.className = `type-badge ${badgeInfo.cls}`;
    badge.textContent = badgeInfo.label;
    row.appendChild(badge);

    // Title
    const titleEl = document.createElement('span');
    titleEl.className = 'item-row-title';
    titleEl.textContent = item.displayTitle || '(untitled)';
    titleEl.title = item.displayTitle || '';
    row.appendChild(titleEl);

    // Difficulty dots (questions only)
    if (item.contentType === 'question') {
      const dots = document.createElement('div');
      dots.className = 'difficulty-dots';
      for (let i = 1; i <= 5; i++) {
        const dot = document.createElement('span');
        dot.className = 'difficulty-dot' + (item.difficulty && i <= item.difficulty ? ' filled' : '');
        dots.appendChild(dot);
      }
      row.appendChild(dots);
    }

    // Bookmark button
    const bookmarkBtn = document.createElement('button');
    bookmarkBtn.className = 'item-flag-btn' + (item.isBookmarked ? ' bookmark-active' : '');
    bookmarkBtn.title = item.isBookmarked ? 'Remove bookmark' : 'Bookmark';
    bookmarkBtn.textContent = '🔖';
    bookmarkBtn.dataset.action = 'toggle-bookmark';
    bookmarkBtn.dataset.itemId = item.id;
    bookmarkBtn.dataset.itemType = item.contentType;
    bookmarkBtn.addEventListener('click', (e) => e.stopPropagation());
    row.appendChild(bookmarkBtn);

    // Flag button
    const flagBtn = document.createElement('button');
    flagBtn.className = 'item-flag-btn' + (item.isFlagged ? ' flag-active' : '');
    flagBtn.title = item.isFlagged ? 'Remove flag' : 'Flag for review';
    flagBtn.textContent = '⚑';
    flagBtn.dataset.action = 'toggle-flag';
    flagBtn.dataset.itemId = item.id;
    flagBtn.dataset.itemType = item.contentType;
    flagBtn.addEventListener('click', (e) => e.stopPropagation());
    row.appendChild(flagBtn);

    // Last edited date
    const dateEl = document.createElement('span');
    dateEl.className = 'item-row-date';
    dateEl.textContent = _formatDate(item.lastEditedAt);
    row.appendChild(dateEl);

    // Inline action buttons (duplicate, delete) — shown on hover via CSS
    const actions = document.createElement('div');
    actions.className = 'item-row-actions';

    const dupBtn = document.createElement('button');
    dupBtn.className = 'item-row-action-btn';
    dupBtn.title = 'Duplicate';
    dupBtn.textContent = '⧉';
    dupBtn.dataset.action = 'row-duplicate';
    dupBtn.dataset.itemId = item.id;
    dupBtn.dataset.itemType = item.contentType;
    dupBtn.addEventListener('click', (e) => e.stopPropagation());
    actions.appendChild(dupBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'item-row-action-btn danger';
    delBtn.title = 'Delete';
    delBtn.textContent = '✕';
    delBtn.dataset.action = 'row-delete';
    delBtn.dataset.itemId = item.id;
    delBtn.dataset.itemType = item.contentType;
    delBtn.addEventListener('click', (e) => e.stopPropagation());
    actions.appendChild(delBtn);

    row.appendChild(actions);

    return row;
  }

  function _updateBulkBar(state) {
    const count = state.bulkSelectedIds.size;
    if (count === 0) {
      _bulkBarEl.hidden = true;
    } else {
      _bulkBarEl.hidden = false;
      _bulkCountEl.textContent = `${count} selected`;
    }
  }

  // -------------------------------------------------------------------------
  // Event handling (delegated on the list container)
  // -------------------------------------------------------------------------
  function _onListClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) {
      // Clicking the row itself
      const row = e.target.closest('.item-row');
      if (row) _selectItem(row.dataset.itemId, row.dataset.itemType);
      return;
    }

    const action = target.dataset.action;
    const itemId = target.dataset.itemId;
    const itemType = target.dataset.itemType;

    if (action === 'bulk-toggle') {
      _handleBulkToggle(itemId, target.checked);
    } else if (action === 'toggle-bookmark') {
      _handleFlagToggle(itemId, itemType, 'bookmark');
    } else if (action === 'toggle-flag') {
      _handleFlagToggle(itemId, itemType, 'flag');
    } else if (action === 'row-duplicate') {
      _handleDuplicate(itemId, itemType);
    } else if (action === 'row-delete') {
      _confirmDelete(itemId, itemType);
    }
  }

  function _selectItem(itemId, itemType) {
    LibraryState.set('selectedItemId', itemId);
    LibraryState.set('selectedItemType', itemType);
    document.dispatchEvent(new CustomEvent('library:item-selected', { detail: { itemId, itemType } }));
    // Update selected CSS without full re-render for performance
    _listEl.querySelectorAll('.item-row').forEach((r) => {
      r.classList.toggle('selected', r.dataset.itemId === itemId);
    });
  }

  function _handleBulkToggle(itemId, checked) {
    const state = LibraryState.get();
    const set = new Set(state.bulkSelectedIds);
    if (checked) set.add(itemId); else set.delete(itemId);
    LibraryState.set('bulkSelectedIds', set);
    _updateBulkBar(LibraryState.get());
  }

  async function _handleFlagToggle(itemId, itemType, which) {
    const state = LibraryState.get();
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return;

    const patch = {};
    if (which === 'bookmark') {
      patch.isBookmarked = !item.isBookmarked;
      patch.isFlagged = item.isFlagged;
    } else {
      patch.isBookmarked = item.isBookmarked;
      patch.isFlagged = !item.isFlagged;
    }

    try {
      await window.api.updateItemFlags({
        itemId,
        contentType: itemType,
        isBookmarked: patch.isBookmarked,
        isFlagged: patch.isFlagged,
      });
      LibraryState.updateItemInState(itemId, patch);
      document.dispatchEvent(new CustomEvent('library:item-flags-updated', { detail: { itemId } }));
      render();
    } catch (err) {
      console.error('[library] flag toggle failed:', err);
    }
  }

  async function _handleDuplicate(itemId, itemType) {
    try {
      let newItem;
      if (itemType === 'question') {
        const q = await window.api.duplicateQuestion(itemId);
        newItem = {
          contentType: 'question',
          id: q.questionId,
          questionId: q.questionId,
          topicId: q.topicId,
          questionType: q.questionType,
          title: q.title,
          stem: q.stem,
          choices: q.choices,
          mainExplanationHtml: q.mainExplanationHtml,
          referenceText: q.referenceText,
          modelAnswerHtml: q.modelAnswerHtml,
          difficulty: q.difficulty,
          isBookmarked: q.isBookmarked,
          isFlagged: q.isFlagged,
          lastEditedAt: q.lastEditedAt,
          createdAt: q.createdAt,
          updatedAt: q.updatedAt,
          displayTitle: q.title || LibraryState.stripHtml(q.stem).slice(0, 80),
          previewText: LibraryState.stripHtml(q.stem),
        };
      } else {
        const f = await window.api.duplicateFlashcard(itemId);
        newItem = {
          contentType: 'flashcard',
          id: f.flashcardId,
          flashcardId: f.flashcardId,
          topicId: f.topicId,
          questionType: 'flashcard',
          frontHtml: f.frontHtml,
          backHtml: f.backHtml,
          referenceText: f.referenceText,
          reviewCount: 0,
          lapseCount: 0,
          dueAt: null,
          isBookmarked: f.isBookmarked,
          isFlagged: f.isFlagged,
          lastEditedAt: f.lastEditedAt,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
          displayTitle: LibraryState.stripHtml(f.frontHtml).slice(0, 80),
          previewText: LibraryState.stripHtml(f.frontHtml),
        };
      }
      const state = LibraryState.get();
      LibraryState.set('items', [...state.items, newItem]);
      LibraryState.set('selectedItemId', newItem.id);
      LibraryState.set('selectedItemType', newItem.contentType);
      document.dispatchEvent(new CustomEvent('library:item-selected', { detail: { itemId: newItem.id, itemType: newItem.contentType } }));
      render();
    } catch (err) {
      console.error('[library] duplicate failed:', err);
    }
  }

  function _confirmDelete(itemId, itemType) {
    const state = LibraryState.get();
    const item = state.items.find((i) => i.id === itemId);
    const name = item ? item.displayTitle || '(untitled)' : itemId;
    document.dispatchEvent(new CustomEvent('library:confirm-delete', {
      detail: { type: itemType, id: itemId, name, entity: false },
    }));
  }

  // -------------------------------------------------------------------------
  // Bulk actions (called from outside)
  // -------------------------------------------------------------------------
  async function bulkDuplicate() {
    const state = LibraryState.get();
    const ids = [...state.bulkSelectedIds];
    for (const id of ids) {
      const item = state.items.find((i) => i.id === id);
      if (item) await _handleDuplicate(id, item.contentType);
    }
    LibraryState.set('bulkSelectedIds', new Set());
  }

  function bulkDelete() {
    const state = LibraryState.get();
    const ids = [...state.bulkSelectedIds];
    if (ids.length === 0) return;
    document.dispatchEvent(new CustomEvent('library:confirm-delete', {
      detail: { type: 'bulk', ids, name: `${ids.length} item(s)`, entity: false },
    }));
  }

  function clearSelection() {
    LibraryState.set('bulkSelectedIds', new Set());
    render();
  }

  async function bulkMove(targetTopicId) {
    const state = LibraryState.get();
    const ids = [...state.bulkSelectedIds];
    const qIds = ids.filter((id) => state.items.find((i) => i.id === id && i.contentType === 'question'));
    const fIds = ids.filter((id) => state.items.find((i) => i.id === id && i.contentType === 'flashcard'));
    if (qIds.length > 0) await window.api.moveItems({ itemIds: qIds, targetTopicId, contentType: 'question' });
    if (fIds.length > 0) await window.api.moveItems({ itemIds: fIds, targetTopicId, contentType: 'flashcard' });
    // Remove moved items from current view
    const movedIds = new Set(ids);
    LibraryState.set('items', state.items.filter((i) => !movedIds.has(i.id)));
    LibraryState.set('bulkSelectedIds', new Set());
    render();
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  function _formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return { mount, render, bulkDuplicate, bulkDelete, clearSelection, bulkMove };
})();
