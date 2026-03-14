/* library-state.js — singleton reactive state store for the Library screen */
'use strict';

const LibraryState = (() => {
  const _state = {
    // Hierarchy cache
    courses: [],
    units: {},     // courseId → Unit[]
    topics: {},    // unitId  → Topic[]

    // Expand state
    expandedCourses: new Set(),
    expandedUnits: new Set(),

    // Selection
    selectedCourseId: null,
    selectedUnitId: null,
    selectedTopicId: null,

    // Items for current topic (merged questions + flashcards)
    items: [],
    isLoadingItems: false,

    // Filters (applied client-side)
    searchQuery: '',
    typeFilter: 'all',    // 'all' | 'single_best' | 'true_false' | 'short_answer' | 'flashcard'
    statusFilter: 'all',  // 'all' | 'bookmarked' | 'flagged'

    // Item selection
    selectedItemId: null,
    selectedItemType: null,  // 'question' | 'flashcard'
    bulkSelectedIds: new Set(),

    // Topic item counts (topicId → { questionCount, flashcardCount })
    topicCounts: {},
  };

  const _subscribers = {};

  function subscribe(key, handler) {
    if (!_subscribers[key]) _subscribers[key] = [];
    _subscribers[key].push(handler);
    return () => {
      _subscribers[key] = _subscribers[key].filter((h) => h !== handler);
    };
  }

  function _emit(key) {
    if (_subscribers[key]) {
      _subscribers[key].forEach((h) => h(_state));
    }
    if (_subscribers['*']) {
      _subscribers['*'].forEach((h) => h(_state, key));
    }
  }

  function get() {
    return _state;
  }

  function set(key, value) {
    _state[key] = value;
    _emit(key);
  }

  function getFilteredItems() {
    let items = _state.items;

    if (_state.typeFilter !== 'all') {
      if (_state.typeFilter === 'flashcard') {
        items = items.filter((i) => i.contentType === 'flashcard');
      } else {
        items = items.filter((i) => i.contentType === 'question' && i.questionType === _state.typeFilter);
      }
    }

    if (_state.statusFilter === 'bookmarked') {
      items = items.filter((i) => i.isBookmarked);
    } else if (_state.statusFilter === 'flagged') {
      items = items.filter((i) => i.isFlagged);
    }

    if (_state.searchQuery.trim().length > 0) {
      const q = _state.searchQuery.trim().toLowerCase();
      items = items.filter((i) => {
        const title = (i.displayTitle || '').toLowerCase();
        const preview = (i.previewText || '').toLowerCase();
        return title.includes(q) || preview.includes(q);
      });
    }

    return items;
  }

  // Merge questions + flashcards for a topic into a unified item array
  function mergeItems(questions, flashcards) {
    const qItems = questions.map((q) => ({
      contentType: 'question',
      id: q.questionId,
      questionId: q.questionId,
      topicId: q.topicId,
      questionType: q.questionType,
      title: q.title || null,
      stem: q.stem || '',
      choices: q.choices || [],
      mainExplanationHtml: q.mainExplanationHtml || '',
      referenceText: q.referenceText || '',
      modelAnswerHtml: q.modelAnswerHtml || '',
      difficulty: q.difficulty,
      isBookmarked: q.isBookmarked,
      isFlagged: q.isFlagged,
      lastEditedAt: q.lastEditedAt,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
      displayTitle: q.title || stripHtml(q.stem).slice(0, 80),
      previewText: stripHtml(q.stem),
    }));

    const fItems = flashcards.map((f) => ({
      contentType: 'flashcard',
      id: f.flashcardId,
      flashcardId: f.flashcardId,
      topicId: f.topicId,
      questionType: 'flashcard',
      frontHtml: f.frontHtml || '',
      backHtml: f.backHtml || '',
      referenceText: f.referenceText || '',
      reviewCount: f.reviewCount,
      lapseCount: f.lapseCount,
      dueAt: f.dueAt,
      isBookmarked: f.isBookmarked,
      isFlagged: f.isFlagged,
      lastEditedAt: f.lastEditedAt,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      displayTitle: stripHtml(f.frontHtml).slice(0, 80),
      previewText: stripHtml(f.frontHtml),
    }));

    // Questions first, then flashcards, sorted by displayTitle
    qItems.sort((a, b) => a.displayTitle.localeCompare(b.displayTitle));
    fItems.sort((a, b) => a.displayTitle.localeCompare(b.displayTitle));

    return [...qItems, ...fItems];
  }

  function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
  }

  function getSelectedItem() {
    if (!_state.selectedItemId) return null;
    return _state.items.find((i) => i.id === _state.selectedItemId) || null;
  }

  function updateItemInState(itemId, patch) {
    const idx = _state.items.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const updated = { ..._state.items[idx], ...patch };
    const next = [..._state.items];
    next[idx] = updated;
    _state.items = next;
    _emit('items');
  }

  function removeItemFromState(itemId) {
    _state.items = _state.items.filter((i) => i.id !== itemId);
    if (_state.selectedItemId === itemId) {
      _state.selectedItemId = null;
      _state.selectedItemType = null;
      _emit('selectedItemId');
    }
    _state.bulkSelectedIds.delete(itemId);
    _emit('items');
  }

  return {
    get,
    set,
    subscribe,
    getFilteredItems,
    mergeItems,
    stripHtml,
    getSelectedItem,
    updateItemInState,
    removeItemFromState,
  };
})();
