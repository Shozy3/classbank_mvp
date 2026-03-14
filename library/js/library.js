/* library.js — bootstrap and event wiring for the Library screen */
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  // -------------------------------------------------------------------------
  // Element references
  // -------------------------------------------------------------------------
  const treeEl          = document.getElementById('hierarchy-tree');
  const hierarchyEmpty  = document.getElementById('hierarchy-empty');
  const workspaceEl     = document.getElementById('library-workspace');
  const paneHeaderBtn   = document.getElementById('btn-create-course');
  const emptyCreateBtn  = document.getElementById('btn-create-course-empty');
  const createBackupBtn = document.getElementById('btn-create-backup');
  const pickBackupBtn   = document.getElementById('btn-pick-backup');
  const restoreBackupBtn = document.getElementById('btn-restore-backup');
  const backupSelectEl  = document.getElementById('sel-backup-file');
  const backupStatusEl  = document.getElementById('backup-status');
  const restoreConfirmModal = document.getElementById('modal-restore-confirm');
  const restoreConfirmInput = document.getElementById('restore-confirm-input');
  const restoreConfirmCancelBtn = document.getElementById('btn-restore-cancel');
  const restoreConfirmAcceptBtn = document.getElementById('btn-restore-confirm');

  const searchInput     = document.getElementById('search-input');
  const typeFilterGroup = document.getElementById('type-filter');
  const statusFilterGroup = document.getElementById('status-filter');
  const listEl          = document.getElementById('item-list');
  const listEmptyEl     = document.getElementById('list-empty');
  const listEmptyMsg    = document.getElementById('empty-message');
  const itemCountEl     = document.getElementById('item-count');
  const bulkBar         = document.getElementById('bulk-bar');
  const bulkCount       = document.getElementById('bulk-count');
  const btnBulkDuplicate = document.getElementById('btn-bulk-duplicate');
  const btnBulkMove      = document.getElementById('btn-bulk-move');
  const btnBulkDelete    = document.getElementById('btn-bulk-delete');
  const btnBulkClear     = document.getElementById('btn-bulk-clear');

  const previewPane     = document.getElementById('preview-pane');
  const previewContent  = document.getElementById('preview-content');
  const btnPreviewDup   = document.getElementById('btn-preview-duplicate');
  const btnPreviewMove  = document.getElementById('btn-preview-move');
  const btnPreviewDel   = document.getElementById('btn-preview-delete');
  const btnClosePreview = document.getElementById('btn-close-preview');

  const deleteModal     = document.getElementById('modal-confirm-delete');
  const deleteTitle     = document.getElementById('delete-modal-title');
  const deleteBody      = document.getElementById('delete-modal-body');
  const btnDeleteCancel = document.getElementById('btn-delete-cancel');
  const btnDeleteConfirm = document.getElementById('btn-delete-confirm');

  const moveModal       = document.getElementById('modal-move');
  const moveSelectCourse = document.getElementById('move-select-course');
  const moveSelectUnit  = document.getElementById('move-select-unit');
  const moveSelectTopic = document.getElementById('move-select-topic');
  const btnMoveCancel   = document.getElementById('btn-move-cancel');
  const btnMoveConfirm  = document.getElementById('btn-move-confirm');

  const renameInput     = document.getElementById('inline-rename-input');

  // -------------------------------------------------------------------------
  // Mount components
  // -------------------------------------------------------------------------
  HierarchyTree.mount({ treeEl, emptyEl: hierarchyEmpty, renameInput });

  ItemList.mount({
    listEl,
    emptyEl: listEmptyEl,
    emptyMsgEl: listEmptyMsg,
    countEl: itemCountEl,
    bulkBarEl: bulkBar,
    bulkCountEl: bulkCount,
  });

  PreviewPanel.mount({
    paneEl: previewPane,
    contentEl: previewContent,
    workspaceEl,
    dupBtn: btnPreviewDup,
    moveBtn: btnPreviewMove,
    deleteBtn: btnPreviewDel,
    closeBtn: btnClosePreview,
  });

  // -------------------------------------------------------------------------
  // Load initial data
  // -------------------------------------------------------------------------
  try {
    const courses = await window.api.getCourses();
    LibraryState.set('courses', courses);
    HierarchyTree.render();
    ItemList.render();
  } catch (err) {
    console.error('[library] failed to load courses:', err);
  }

  // -------------------------------------------------------------------------
  // Create course buttons
  // -------------------------------------------------------------------------
  paneHeaderBtn.addEventListener('click', () => HierarchyTree.showCreateCourse());
  emptyCreateBtn.addEventListener('click', () => HierarchyTree.showCreateCourse());

  // -------------------------------------------------------------------------
  // Backup + restore controls
  // -------------------------------------------------------------------------
  const backupApiAvailable = Boolean(
    window.api
    && typeof window.api.createBackup === 'function'
    && typeof window.api.listBackups === 'function'
    && typeof window.api.restoreBackup === 'function'
  );

  if (!backupApiAvailable) {
    createBackupBtn.disabled = true;
    pickBackupBtn.disabled = true;
    restoreBackupBtn.disabled = true;
    setBackupStatus('Backup controls are only available in the desktop app.', 'error');
  } else {
    await refreshBackupOptions();

    createBackupBtn.addEventListener('click', async () => {
      createBackupBtn.disabled = true;
      try {
        const result = await window.api.createBackup({ notes: 'Created from Library screen' });
        await refreshBackupOptions(result.filePath);
        setBackupStatus(`Backup created: ${result.filePath}`, 'success');
      } catch (err) {
        console.error('[library] create backup failed:', err);
        setBackupStatus(err?.message || 'Failed to create backup.', 'error');
      } finally {
        createBackupBtn.disabled = false;
      }
    });

    pickBackupBtn.addEventListener('click', async () => {
      if (!window.api.chooseBackupFile) {
        setBackupStatus('File picker is unavailable in this environment.', 'error');
        return;
      }
      try {
        const choice = await window.api.chooseBackupFile();
        if (!choice || choice.canceled || !choice.filePath) return;
        await refreshBackupOptions(choice.filePath);
        setBackupStatus(`Selected backup: ${choice.filePath}`, null);
      } catch (err) {
        console.error('[library] choose backup file failed:', err);
        setBackupStatus(err?.message || 'Failed to choose backup file.', 'error');
      }
    });

    restoreBackupBtn.addEventListener('click', async () => {
      const filePath = backupSelectEl.value;
      if (!filePath) {
        setBackupStatus('Choose a backup file before restoring.', 'error');
        return;
      }

      openRestoreConfirmModal(filePath);
    });

    restoreConfirmInput.addEventListener('input', () => {
      restoreConfirmAcceptBtn.disabled = restoreConfirmInput.value.trim().toUpperCase() !== 'RESTORE';
    });

    restoreConfirmCancelBtn.addEventListener('click', () => {
      closeRestoreConfirmModal();
      setBackupStatus('Restore canceled.', null);
    });

    restoreConfirmAcceptBtn.addEventListener('click', async () => {
      const filePath = restoreConfirmModal.dataset.filePath;
      if (!filePath) {
        closeRestoreConfirmModal();
        setBackupStatus('Restore target missing. Select a backup and try again.', 'error');
        return;
      }

      closeRestoreConfirmModal();
      restoreBackupBtn.disabled = true;
      try {
        const result = await window.api.restoreBackup({
          filePath,
          confirmOverwrite: true,
        });
        setBackupStatus(`Restore complete from ${result.filePath}. Click here to reload now.`, 'success', {
          actionLabel: 'Reload now',
          onAction: () => window.location.reload(),
        });
        await refreshBackupOptions(result.filePath);
      } catch (err) {
        console.error('[library] restore backup failed:', err);
        setBackupStatus(err?.message || 'Restore failed.', 'error');
      } finally {
        restoreBackupBtn.disabled = false;
      }
    });

    restoreConfirmModal.addEventListener('click', (e) => {
      if (e.target === restoreConfirmModal) {
        closeRestoreConfirmModal();
      }
    });
  }

  // -------------------------------------------------------------------------
  // Search input (client-side filter, no debounce needed for local data)
  // -------------------------------------------------------------------------
  searchInput.addEventListener('input', () => {
    LibraryState.set('searchQuery', searchInput.value);
    ItemList.render();
  });

  // -------------------------------------------------------------------------
  // Type filter pills
  // -------------------------------------------------------------------------
  typeFilterGroup.addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill[data-type]');
    if (!pill) return;
    typeFilterGroup.querySelectorAll('.filter-pill').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    LibraryState.set('typeFilter', pill.dataset.type);
    ItemList.render();
  });

  // -------------------------------------------------------------------------
  // Status filter pills
  // -------------------------------------------------------------------------
  statusFilterGroup.addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill[data-status]');
    if (!pill) return;
    statusFilterGroup.querySelectorAll('.filter-pill').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    LibraryState.set('statusFilter', pill.dataset.status);
    ItemList.render();
  });

  // -------------------------------------------------------------------------
  // Topic selected → load items
  // -------------------------------------------------------------------------
  document.addEventListener('library:topic-selected', async (e) => {
    const { topicId } = e.detail;
    LibraryState.set('isLoadingItems', true);
    LibraryState.set('items', []);
    LibraryState.set('selectedItemId', null);
    LibraryState.set('selectedItemType', null);
    LibraryState.set('bulkSelectedIds', new Set());
    ItemList.render();
    PreviewPanel.close();

    try {
      const [questions, flashcards] = await Promise.all([
        window.api.getQuestions({ topicIds: [topicId] }),
        window.api.getFlashcards(topicId),
      ]);
      const merged = LibraryState.mergeItems(questions, flashcards);
      LibraryState.set('items', merged);
    } catch (err) {
      console.error('[library] failed to load items:', err);
    }

    LibraryState.set('isLoadingItems', false);
    ItemList.render();
  });

  // -------------------------------------------------------------------------
  // Item selected → show preview
  // -------------------------------------------------------------------------
  document.addEventListener('library:item-selected', () => {
    PreviewPanel.render();
    ItemList.render();
  });

  // -------------------------------------------------------------------------
  // Flags updated in item list → sync preview
  // -------------------------------------------------------------------------
  document.addEventListener('library:item-flags-updated', () => {
    PreviewPanel.render();
    ItemList.render();
  });

  // -------------------------------------------------------------------------
  // Duplicate item (from preview panel event)
  // -------------------------------------------------------------------------
  document.addEventListener('library:duplicate-item', async (e) => {
    const { itemId, itemType } = e.detail;
    const state = LibraryState.get();
    try {
      let newItem;
      if (itemType === 'question') {
        const q = await window.api.duplicateQuestion(itemId);
        newItem = _questionToItem(q);
      } else {
        const f = await window.api.duplicateFlashcard(itemId);
        newItem = _flashcardToItem(f);
      }
      LibraryState.set('items', [...state.items, newItem]);
      LibraryState.set('selectedItemId', newItem.id);
      LibraryState.set('selectedItemType', newItem.contentType);
      ItemList.render();
      PreviewPanel.render();
    } catch (err) {
      console.error('[library] duplicate from preview failed:', err);
    }
  });

  // -------------------------------------------------------------------------
  // Confirm delete modal
  // -------------------------------------------------------------------------
  let _pendingDelete = null;

  document.addEventListener('library:confirm-delete', (e) => {
    _pendingDelete = e.detail;
    const isEntity = e.detail.entity; // hierarchy node vs item
    const label = isEntity
      ? `Delete "${e.detail.name}"?`
      : `Delete ${e.detail.name}?`;
    deleteTitle.textContent = label;
    deleteBody.textContent = 'This cannot be undone.';
    deleteModal.showModal();
  });

  btnDeleteCancel.addEventListener('click', () => {
    deleteModal.close();
    _pendingDelete = null;
  });

  btnDeleteConfirm.addEventListener('click', async () => {
    deleteModal.close();
    if (!_pendingDelete) return;
    const pd = _pendingDelete;
    _pendingDelete = null;

    if (pd.entity) {
      // Hierarchy node delete
      await HierarchyTree.deleteNode(pd.type, pd.id);
      if (pd.type === 'topic' && LibraryState.get().selectedTopicId === pd.id) {
        LibraryState.set('items', []);
        ItemList.render();
        PreviewPanel.close();
      }
    } else if (pd.type === 'bulk') {
      // Bulk delete
      const state = LibraryState.get();
      for (const id of pd.ids) {
        const item = state.items.find((i) => i.id === id);
        if (!item) continue;
        try {
          if (item.contentType === 'question') await window.api.deleteQuestion(id);
          else await window.api.deleteFlashcard(id);
          LibraryState.removeItemFromState(id);
        } catch (err) {
          console.error('[library] bulk delete item failed:', id, err);
        }
      }
      LibraryState.set('bulkSelectedIds', new Set());
      ItemList.render();
      PreviewPanel.close();
    } else {
      // Single item delete
      try {
        if (pd.type === 'question') await window.api.deleteQuestion(pd.id);
        else await window.api.deleteFlashcard(pd.id);
        LibraryState.removeItemFromState(pd.id);
        ItemList.render();
        PreviewPanel.close();
      } catch (err) {
        console.error('[library] delete item failed:', err);
      }
    }
  });

  // Close modal on backdrop click
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) { deleteModal.close(); _pendingDelete = null; }
  });

  // -------------------------------------------------------------------------
  // Move items modal
  // -------------------------------------------------------------------------
  let _pendingMove = null;

  document.addEventListener('library:move-items', async (e) => {
    _pendingMove = e.detail;
    await _populateMoveModal();
    moveModal.showModal();
  });

  async function _populateMoveModal() {
    moveSelectCourse.innerHTML = '<option value="">Select course…</option>';
    moveSelectUnit.innerHTML = '<option value="">Select unit…</option>';
    moveSelectTopic.innerHTML = '<option value="">Select topic…</option>';
    moveSelectUnit.disabled = true;
    moveSelectTopic.disabled = true;
    btnMoveConfirm.disabled = true;

    try {
      const courses = await window.api.getCourses();
      for (const c of courses) {
        const opt = document.createElement('option');
        opt.value = c.courseId;
        opt.textContent = c.courseName;
        moveSelectCourse.appendChild(opt);
      }
    } catch (err) {
      console.error('[library] move modal load courses failed:', err);
    }
  }

  moveSelectCourse.addEventListener('change', async () => {
    const courseId = moveSelectCourse.value;
    moveSelectUnit.innerHTML = '<option value="">Select unit…</option>';
    moveSelectTopic.innerHTML = '<option value="">Select topic…</option>';
    moveSelectUnit.disabled = !courseId;
    moveSelectTopic.disabled = true;
    btnMoveConfirm.disabled = true;
    if (!courseId) return;
    try {
      const units = await window.api.getUnits(courseId);
      for (const u of units) {
        const opt = document.createElement('option');
        opt.value = u.unitId;
        opt.textContent = u.unitName;
        moveSelectUnit.appendChild(opt);
      }
    } catch (err) {
      console.error('[library] move modal load units failed:', err);
    }
  });

  moveSelectUnit.addEventListener('change', async () => {
    const unitId = moveSelectUnit.value;
    moveSelectTopic.innerHTML = '<option value="">Select topic…</option>';
    moveSelectTopic.disabled = !unitId;
    btnMoveConfirm.disabled = true;
    if (!unitId) return;
    try {
      const topics = await window.api.getTopics(unitId);
      for (const t of topics) {
        const opt = document.createElement('option');
        opt.value = t.topicId;
        opt.textContent = t.topicName;
        moveSelectTopic.appendChild(opt);
      }
    } catch (err) {
      console.error('[library] move modal load topics failed:', err);
    }
  });

  moveSelectTopic.addEventListener('change', () => {
    btnMoveConfirm.disabled = !moveSelectTopic.value;
  });

  btnMoveCancel.addEventListener('click', () => {
    moveModal.close();
    _pendingMove = null;
  });

  btnMoveConfirm.addEventListener('click', async () => {
    const targetTopicId = moveSelectTopic.value;
    moveModal.close();
    if (!_pendingMove || !targetTopicId) { _pendingMove = null; return; }

    const { itemIds, contentType } = _pendingMove;
    _pendingMove = null;

    try {
      if (Array.isArray(itemIds)) {
        await ItemList.bulkMove(targetTopicId);
      } else {
        await window.api.moveItems({ itemIds: [itemIds], targetTopicId, contentType });
        LibraryState.removeItemFromState(itemIds);
        ItemList.render();
        PreviewPanel.close();
      }
    } catch (err) {
      console.error('[library] move failed:', err);
    }
  });

  moveModal.addEventListener('click', (e) => {
    if (e.target === moveModal) { moveModal.close(); _pendingMove = null; }
  });

  // -------------------------------------------------------------------------
  // Bulk action bar buttons
  // -------------------------------------------------------------------------
  btnBulkDuplicate.addEventListener('click', () => ItemList.bulkDuplicate());
  btnBulkMove.addEventListener('click', () => {
    const state = LibraryState.get();
    const ids = [...state.bulkSelectedIds];
    if (ids.length === 0) return;
    // Mixed types — default to 'question'; move modal handles each type
    document.dispatchEvent(new CustomEvent('library:move-items', {
      detail: { itemIds: ids, contentType: 'mixed' },
    }));
  });
  btnBulkDelete.addEventListener('click', () => ItemList.bulkDelete());
  btnBulkClear.addEventListener('click', () => ItemList.clearSelection());

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  function _questionToItem(q) {
    return {
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
  }

  function _flashcardToItem(f) {
    return {
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

  async function refreshBackupOptions(selectedFilePath = null) {
    const backups = await window.api.listBackups({ limit: 100 });
    const priorValue = backupSelectEl.value;
    const preferred = selectedFilePath || priorValue;

    backupSelectEl.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = backups.length > 0
      ? 'Select backup file...'
      : 'No backups recorded yet';
    backupSelectEl.appendChild(placeholder);

    for (const backup of backups) {
      const option = document.createElement('option');
      option.value = backup.filePath;
      const baseName = backup.filePath.split('/').pop();
      const size = backup.fileSizeBytes == null
        ? 'unknown size'
        : `${Math.max(1, Math.round(backup.fileSizeBytes / 1024))} KB`;
      option.textContent = `${backup.createdAt} - ${baseName} (${size})${backup.exists ? '' : ' [missing]'}`;
      backupSelectEl.appendChild(option);
    }

    if (preferred) {
      const hasPreferred = Array.from(backupSelectEl.options).some((opt) => opt.value === preferred);
      if (hasPreferred) {
        backupSelectEl.value = preferred;
      } else {
        const customOption = document.createElement('option');
        customOption.value = preferred;
        customOption.textContent = `${preferred} [manual]`;
        backupSelectEl.appendChild(customOption);
        backupSelectEl.value = preferred;
      }
    }
  }

  function setBackupStatus(message, kind, action = null) {
    backupStatusEl.innerHTML = '';
    backupStatusEl.textContent = message || '';
    backupStatusEl.classList.remove('success', 'error');
    if (kind === 'success' || kind === 'error') {
      backupStatusEl.classList.add(kind);
    }

    if (action && typeof action.onAction === 'function') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'link-btn';
      btn.textContent = action.actionLabel || 'Run action';
      btn.addEventListener('click', action.onAction);
      backupStatusEl.append(' ');
      backupStatusEl.appendChild(btn);
    }
  }

  function openRestoreConfirmModal(filePath) {
    restoreConfirmModal.dataset.filePath = filePath;
    restoreConfirmInput.value = '';
    restoreConfirmAcceptBtn.disabled = true;
    restoreConfirmModal.showModal();
    restoreConfirmInput.focus();
  }

  function closeRestoreConfirmModal() {
    restoreConfirmModal.dataset.filePath = '';
    restoreConfirmInput.value = '';
    restoreConfirmAcceptBtn.disabled = true;
    if (restoreConfirmModal.open) {
      restoreConfirmModal.close();
    }
  }
});
