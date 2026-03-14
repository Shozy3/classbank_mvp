/* hierarchy-tree.js — course/unit/topic tree component */
'use strict';

const HierarchyTree = (() => {
  let _treeEl = null;
  let _emptyEl = null;
  let _renameInput = null;
  let _activeContextMenu = null;

  // -------------------------------------------------------------------------
  // Mount
  // -------------------------------------------------------------------------
  function mount({ treeEl, emptyEl, renameInput }) {
    _treeEl = treeEl;
    _emptyEl = emptyEl;
    _renameInput = renameInput;

    _treeEl.addEventListener('click', _onTreeClick);
    document.addEventListener('click', _onDocumentClick);
    document.addEventListener('keydown', _onDocumentKeydown);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  function render() {
    const state = LibraryState.get();
    const { courses } = state;

    if (courses.length === 0) {
      _treeEl.innerHTML = '';
      _emptyEl.hidden = false;
      return;
    }
    _emptyEl.hidden = true;

    _treeEl.innerHTML = '';
    for (const course of courses) {
      _treeEl.appendChild(_buildCourseNode(course, state));
    }
  }

  function _buildCourseNode(course, state) {
    const node = document.createElement('div');
    node.className = 'tree-node tree-level-course';
    node.dataset.type = 'course';
    node.dataset.id = course.courseId;

    const isExpanded = state.expandedCourses.has(course.courseId);
    const isSelected = state.selectedCourseId === course.courseId && !state.selectedTopicId && !state.selectedUnitId;

    const row = _buildRow({
      label: course.courseName,
      hasToggle: true,
      isExpanded,
      isSelected,
      indent: 0,
      type: 'course',
      id: course.courseId,
      addTitle: 'Add unit',
    });
    node.appendChild(row);

    if (isExpanded) {
      const units = state.units[course.courseId] || [];
      const childWrap = document.createElement('div');
      childWrap.className = 'tree-children';
      for (const unit of units) {
        childWrap.appendChild(_buildUnitNode(unit, state));
      }
      node.appendChild(childWrap);
    }

    return node;
  }

  function _buildUnitNode(unit, state) {
    const node = document.createElement('div');
    node.className = 'tree-node tree-level-unit';
    node.dataset.type = 'unit';
    node.dataset.id = unit.unitId;

    const isExpanded = state.expandedUnits.has(unit.unitId);
    const isSelected = state.selectedUnitId === unit.unitId && !state.selectedTopicId;

    const row = _buildRow({
      label: unit.unitName,
      hasToggle: true,
      isExpanded,
      isSelected,
      indent: 1,
      type: 'unit',
      id: unit.unitId,
      addTitle: 'Add topic',
    });
    node.appendChild(row);

    if (isExpanded) {
      const topics = state.topics[unit.unitId] || [];
      const childWrap = document.createElement('div');
      childWrap.className = 'tree-children';
      for (const topic of topics) {
        // Count badge
        const counts = state.topicCounts[topic.topicId];
        const countText = counts
          ? `${counts.questionCount + counts.flashcardCount}`
          : null;
        childWrap.appendChild(_buildTopicNode(topic, state, countText));
      }
      node.appendChild(childWrap);
    }

    return node;
  }

  function _buildTopicNode(topic, state, countText) {
    const node = document.createElement('div');
    node.className = 'tree-node tree-level-topic';
    node.dataset.type = 'topic';
    node.dataset.id = topic.topicId;

    const isSelected = state.selectedTopicId === topic.topicId;

    const row = _buildRow({
      label: topic.topicName,
      hasToggle: false,
      isExpanded: false,
      isSelected,
      indent: 2,
      type: 'topic',
      id: topic.topicId,
      countText,
      addTitle: null,
    });
    node.appendChild(row);

    return node;
  }

  function _buildRow({ label, hasToggle, isExpanded, isSelected, indent, type, id, countText, addTitle }) {
    const row = document.createElement('div');
    row.className = 'tree-node-row' + (isSelected ? ' selected' : '');
    row.dataset.rowType = type;
    row.dataset.rowId = id;
    row.style.paddingLeft = `${8 + indent * 14}px`;

    // Toggle
    if (hasToggle) {
      const toggle = document.createElement('span');
      toggle.className = 'tree-toggle' + (isExpanded ? ' expanded' : '');
      toggle.dataset.action = 'toggle';
      toggle.textContent = '▶';
      row.appendChild(toggle);
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'tree-toggle-spacer';
      row.appendChild(spacer);
    }

    // Label
    const labelEl = document.createElement('span');
    labelEl.className = 'tree-node-label';
    labelEl.textContent = label;
    labelEl.title = label;
    labelEl.dataset.action = 'select';
    row.appendChild(labelEl);

    // Count badge (topics)
    if (countText != null) {
      const countEl = document.createElement('span');
      countEl.className = 'tree-node-count';
      countEl.textContent = countText;
      row.appendChild(countEl);
    }

    // Actions (add + menu)
    const actions = document.createElement('div');
    actions.className = 'tree-node-actions';

    if (addTitle) {
      const addBtn = document.createElement('button');
      addBtn.className = 'tree-action-btn';
      addBtn.title = addTitle;
      addBtn.dataset.action = 'add-child';
      addBtn.dataset.rowType = type;
      addBtn.dataset.rowId = id;
      addBtn.textContent = '+';
      actions.appendChild(addBtn);
    }

    const menuBtn = document.createElement('button');
    menuBtn.className = 'tree-action-btn';
    menuBtn.title = 'Options';
    menuBtn.dataset.action = 'menu';
    menuBtn.dataset.rowType = type;
    menuBtn.dataset.rowId = id;
    menuBtn.textContent = '⋮';
    actions.appendChild(menuBtn);

    row.appendChild(actions);

    return row;
  }

  // -------------------------------------------------------------------------
  // Event handling
  // -------------------------------------------------------------------------
  function _onTreeClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const rowEl = btn.closest('[data-row-type]') || btn;
    const type = rowEl.dataset.rowType || btn.dataset.rowType;
    const id = rowEl.dataset.rowId || btn.dataset.rowId;

    if (action === 'toggle') {
      e.stopPropagation();
      _handleToggle(type, id);
    } else if (action === 'select') {
      _handleSelect(type, id);
    } else if (action === 'add-child') {
      e.stopPropagation();
      _handleAddChild(type, id);
    } else if (action === 'menu') {
      e.stopPropagation();
      _showContextMenu(btn, type, id);
    }
  }

  async function _handleToggle(type, id) {
    const state = LibraryState.get();
    if (type === 'course') {
      if (state.expandedCourses.has(id)) {
        state.expandedCourses.delete(id);
      } else {
        state.expandedCourses.add(id);
        if (!state.units[id]) {
          await _loadUnits(id);
        }
      }
    } else if (type === 'unit') {
      if (state.expandedUnits.has(id)) {
        state.expandedUnits.delete(id);
      } else {
        state.expandedUnits.add(id);
        if (!state.topics[id]) {
          await _loadTopics(id);
        }
      }
    }
    render();
  }

  function _handleSelect(type, id) {
    const state = LibraryState.get();
    if (type === 'topic') {
      LibraryState.set('selectedTopicId', id);
      LibraryState.set('selectedItemId', null);
      LibraryState.set('selectedItemType', null);
      LibraryState.set('bulkSelectedIds', new Set());
      document.dispatchEvent(new CustomEvent('library:topic-selected', { detail: { topicId: id } }));
    } else if (type === 'unit') {
      LibraryState.set('selectedUnitId', id);
      LibraryState.set('selectedTopicId', null);
    } else if (type === 'course') {
      LibraryState.set('selectedCourseId', id);
      LibraryState.set('selectedUnitId', null);
      LibraryState.set('selectedTopicId', null);
    }
    render();
  }

  async function _handleAddChild(parentType, parentId) {
    if (parentType === 'course') {
      // Ensure expanded
      LibraryState.get().expandedCourses.add(parentId);
      if (!LibraryState.get().units[parentId]) {
        await _loadUnits(parentId);
      }
      render();
      _showInlineAdd('unit', parentId);
    } else if (parentType === 'unit') {
      LibraryState.get().expandedUnits.add(parentId);
      if (!LibraryState.get().topics[parentId]) {
        await _loadTopics(parentId);
      }
      render();
      _showInlineAdd('topic', parentId);
    }
  }

  function _showContextMenu(triggerBtn, type, id) {
    _closeContextMenu();
    const rect = triggerBtn.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'tree-context-menu';
    menu.setAttribute('role', 'menu');

    const renameItem = document.createElement('button');
    renameItem.className = 'tree-context-menu-item';
    renameItem.textContent = 'Rename';
    renameItem.addEventListener('click', () => {
      _closeContextMenu();
      _startRename(type, id);
    });
    menu.appendChild(renameItem);

    const deleteItem = document.createElement('button');
    deleteItem.className = 'tree-context-menu-item danger';
    deleteItem.textContent = 'Delete';
    deleteItem.addEventListener('click', () => {
      _closeContextMenu();
      _confirmDeleteNode(type, id);
    });
    menu.appendChild(deleteItem);

    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.left}px`;
    document.body.appendChild(menu);
    _activeContextMenu = menu;
  }

  function _closeContextMenu() {
    if (_activeContextMenu) {
      _activeContextMenu.remove();
      _activeContextMenu = null;
    }
  }

  function _onDocumentClick() {
    _closeContextMenu();
  }

  function _onDocumentKeydown(e) {
    if (e.key === 'Escape') {
      _closeContextMenu();
    }
  }

  // -------------------------------------------------------------------------
  // Inline rename
  // -------------------------------------------------------------------------
  function _startRename(type, id) {
    const row = _treeEl.querySelector(`[data-row-type="${type}"][data-row-id="${id}"]`);
    if (!row) return;

    const labelEl = row.querySelector('.tree-node-label');
    if (!labelEl) return;

    const currentName = labelEl.textContent;
    const rect = labelEl.getBoundingClientRect();

    _renameInput.value = currentName;
    _renameInput.hidden = false;
    _renameInput.style.top = `${rect.top}px`;
    _renameInput.style.left = `${rect.left}px`;
    _renameInput.style.width = `${Math.max(rect.width, 120)}px`;
    _renameInput.dataset.renameType = type;
    _renameInput.dataset.renameId = id;
    _renameInput.dataset.originalName = currentName;
    _renameInput.focus();
    _renameInput.select();

    const commitRename = async () => {
      const newName = _renameInput.value.trim();
      _renameInput.hidden = true;
      if (!newName || newName === currentName) return;

      try {
        if (type === 'course') {
          const result = await window.api.updateCourse({ courseId: id, name: newName });
          const state = LibraryState.get();
          const course = state.courses.find((c) => c.courseId === id);
          if (course) course.courseName = result.courseName;
          LibraryState.set('courses', [...state.courses]);
        } else if (type === 'unit') {
          const result = await window.api.updateUnit({ unitId: id, name: newName });
          const state = LibraryState.get();
          for (const courseId of Object.keys(state.units)) {
            const unitArr = state.units[courseId];
            const unit = unitArr.find((u) => u.unitId === id);
            if (unit) { unit.unitName = result.unitName; break; }
          }
          LibraryState.set('units', { ...state.units });
        } else if (type === 'topic') {
          const result = await window.api.updateTopic({ topicId: id, name: newName });
          const state = LibraryState.get();
          for (const unitId of Object.keys(state.topics)) {
            const topicArr = state.topics[unitId];
            const topic = topicArr.find((t) => t.topicId === id);
            if (topic) { topic.topicName = result.topicName; break; }
          }
          LibraryState.set('topics', { ...state.topics });
        }
        render();
      } catch (err) {
        console.error('[library] rename failed:', err);
      }
    };

    const cancelRename = () => { _renameInput.hidden = true; };

    _renameInput.onblur = commitRename;
    _renameInput.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); _renameInput.blur(); }
      if (e.key === 'Escape') { _renameInput.onblur = null; cancelRename(); }
    };
  }

  // -------------------------------------------------------------------------
  // Inline add
  // -------------------------------------------------------------------------
  function _showInlineAdd(childType, parentId) {
    // Find the parent's children container and append an input row
    const parentRow = _treeEl.querySelector(`[data-row-type="${childType === 'unit' ? 'course' : 'unit'}"][data-row-id="${parentId}"]`);
    if (!parentRow) return;
    const parentNode = parentRow.closest('.tree-node');
    if (!parentNode) return;
    let childrenEl = parentNode.querySelector('.tree-children');
    if (!childrenEl) {
      childrenEl = document.createElement('div');
      childrenEl.className = 'tree-children';
      parentNode.appendChild(childrenEl);
    }

    // Remove existing inline-add if any
    const existing = childrenEl.querySelector('.tree-inline-add');
    if (existing) existing.remove();

    const addRow = document.createElement('div');
    addRow.className = 'tree-inline-add';
    const indent = childType === 'unit' ? 14 : 28;
    addRow.style.paddingLeft = `${8 + indent}px`;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tree-inline-add-input';
    input.placeholder = childType === 'unit' ? 'Unit name…' : 'Topic name…';
    addRow.appendChild(input);
    childrenEl.appendChild(addRow);
    input.focus();

    const commit = async () => {
      const name = input.value.trim();
      addRow.remove();
      if (!name) return;
      try {
        if (childType === 'unit') {
          const result = await window.api.createUnit({ courseId: parentId, name });
          const state = LibraryState.get();
          const units = state.units[parentId] || [];
          units.push(result);
          LibraryState.set('units', { ...state.units, [parentId]: units });
        } else {
          const result = await window.api.createTopic({ unitId: parentId, name });
          const state = LibraryState.get();
          const topics = state.topics[parentId] || [];
          topics.push(result);
          LibraryState.set('topics', { ...state.topics, [parentId]: topics });
        }
        render();
      } catch (err) {
        console.error('[library] create failed:', err);
      }
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.removeEventListener('blur', commit); addRow.remove(); }
    });
  }

  // -------------------------------------------------------------------------
  // Create course (called from outside)
  // -------------------------------------------------------------------------
  function showCreateCourse() {
    const addRow = document.createElement('div');
    addRow.className = 'tree-inline-add';
    addRow.style.paddingLeft = '8px';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tree-inline-add-input';
    input.placeholder = 'Course name…';
    addRow.appendChild(input);
    _treeEl.appendChild(addRow);
    _emptyEl.hidden = true;
    input.focus();

    const commit = async () => {
      const name = input.value.trim();
      addRow.remove();
      if (!name) { render(); return; }
      try {
        const result = await window.api.createCourse({ name });
        const state = LibraryState.get();
        LibraryState.set('courses', [...state.courses, result]);
        render();
      } catch (err) {
        console.error('[library] create course failed:', err);
        render();
      }
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.removeEventListener('blur', commit); addRow.remove(); render(); }
    });
  }

  // -------------------------------------------------------------------------
  // Delete node
  // -------------------------------------------------------------------------
  function _confirmDeleteNode(type, id) {
    const state = LibraryState.get();
    let name = id;
    if (type === 'course') {
      const c = state.courses.find((x) => x.courseId === id);
      name = c ? c.courseName : id;
    } else if (type === 'unit') {
      for (const arr of Object.values(state.units)) {
        const u = arr.find((x) => x.unitId === id);
        if (u) { name = u.unitName; break; }
      }
    } else if (type === 'topic') {
      for (const arr of Object.values(state.topics)) {
        const t = arr.find((x) => x.topicId === id);
        if (t) { name = t.topicName; break; }
      }
    }

    document.dispatchEvent(new CustomEvent('library:confirm-delete', {
      detail: { type, id, name, entity: true },
    }));
  }

  async function deleteNode(type, id) {
    try {
      if (type === 'course') {
        await window.api.deleteCourse(id);
        const state = LibraryState.get();
        LibraryState.set('courses', state.courses.filter((c) => c.courseId !== id));
        delete state.units[id];
        LibraryState.set('units', { ...state.units });
        if (state.selectedCourseId === id) {
          LibraryState.set('selectedCourseId', null);
          LibraryState.set('selectedUnitId', null);
          LibraryState.set('selectedTopicId', null);
        }
      } else if (type === 'unit') {
        await window.api.deleteUnit(id);
        const state = LibraryState.get();
        for (const courseId of Object.keys(state.units)) {
          state.units[courseId] = state.units[courseId].filter((u) => u.unitId !== id);
        }
        delete state.topics[id];
        LibraryState.set('units', { ...state.units });
        LibraryState.set('topics', { ...state.topics });
        if (state.selectedUnitId === id) {
          LibraryState.set('selectedUnitId', null);
          LibraryState.set('selectedTopicId', null);
        }
      } else if (type === 'topic') {
        await window.api.deleteTopic(id);
        const state = LibraryState.get();
        for (const unitId of Object.keys(state.topics)) {
          state.topics[unitId] = state.topics[unitId].filter((t) => t.topicId !== id);
        }
        LibraryState.set('topics', { ...state.topics });
        if (state.selectedTopicId === id) {
          LibraryState.set('selectedTopicId', null);
          LibraryState.set('items', []);
        }
      }
      render();
    } catch (err) {
      console.error('[library] delete node failed:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Data loading helpers
  // -------------------------------------------------------------------------
  async function _loadUnits(courseId) {
    try {
      const units = await window.api.getUnits(courseId);
      const state = LibraryState.get();
      LibraryState.set('units', { ...state.units, [courseId]: units });
    } catch (err) {
      console.error('[library] loadUnits failed:', err);
    }
  }

  async function _loadTopics(unitId) {
    try {
      const topics = await window.api.getTopics(unitId);
      const state = LibraryState.get();
      LibraryState.set('topics', { ...state.topics, [unitId]: topics });
      // Fetch counts for these topics
      if (topics.length > 0) {
        const topicIds = topics.map((t) => t.topicId);
        const counts = await window.api.getItemCountsByTopic(topicIds);
        const topicCounts = { ...state.topicCounts };
        for (const c of counts) { topicCounts[c.topicId] = c; }
        LibraryState.set('topicCounts', topicCounts);
      }
    } catch (err) {
      console.error('[library] loadTopics failed:', err);
    }
  }

  return { mount, render, showCreateCourse, deleteNode };
})();
