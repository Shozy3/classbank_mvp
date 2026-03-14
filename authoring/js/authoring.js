const state = {
  hierarchy: { courses: [], units: [], topics: [] },
  selectedCourseId: null,
  selectedUnitId: null,
  selectedTopicId: null,
  questions: [],
  flashcards: [],
  selectedItem: null,
  form: null,
  saveState: 'idle',
  error: '',
};

function blankQuestion(topicId) {
  return {
    contentType: 'question',
    questionId: null,
    topicId,
    questionType: 'single_best',
    title: '',
    difficulty: 2,
    isBookmarked: false,
    isFlagged: false,
    stem: '',
    mainExplanationHtml: '',
    modelAnswerHtml: '',
    referenceText: '',
    choices: [
      { label: 'A', html: '', isCorrect: true, explanationHtml: '' },
      { label: 'B', html: '', isCorrect: false, explanationHtml: '' },
    ],
    isDirty: false,
  };
}

function blankFlashcard(topicId) {
  return {
    contentType: 'flashcard',
    flashcardId: null,
    topicId,
    isBookmarked: false,
    isFlagged: false,
    frontHtml: '',
    backHtml: '',
    referenceText: '',
    isDirty: false,
  };
}

function setSaveState(next) {
  state.saveState = next;
  const el = document.getElementById('save-status');
  if (!el) return;
  el.className = `save-status ${next}`;
  const labelByState = {
    idle: 'Idle',
    unsaved: 'Unsaved changes',
    saving: 'Saving...',
    success: 'Saved',
    error: 'Save failed',
  };
  el.textContent = labelByState[next] || 'Idle';
}

function markDirty() {
  if (!state.form) return;
  state.form.isDirty = true;
  setSaveState('unsaved');
}

function requireApi() {
  if (!window.api) {
    throw new Error('window.api unavailable. Run in Electron to author content.');
  }
}

async function loadHierarchy() {
  requireApi();
  const courses = await window.api.getCourses();
  if (!Array.isArray(courses) || courses.length === 0) {
    throw new Error('No courses found. Create hierarchy in Library first.');
  }

  state.hierarchy.courses = courses;
  state.selectedCourseId = courses[0].course_id;

  const units = await window.api.getUnits(state.selectedCourseId);
  state.hierarchy.units = units;
  state.selectedUnitId = units[0]?.unit_id || null;

  const topics = state.selectedUnitId ? await window.api.getTopics(state.selectedUnitId) : [];
  state.hierarchy.topics = topics;
  state.selectedTopicId = topics[0]?.topic_id || null;
}

async function loadItemsForTopic() {
  if (!state.selectedTopicId) {
    state.questions = [];
    state.flashcards = [];
    return;
  }

  state.questions = await window.api.getQuestions({ topicIds: [state.selectedTopicId] });
  state.flashcards = await window.api.getFlashcards(state.selectedTopicId);
}

function pickItem(contentType, id) {
  if (contentType === 'question') {
    const q = state.questions.find((item) => item.questionId === id);
    if (!q) return;
    state.selectedItem = { contentType: 'question', id };
    state.form = {
      contentType: 'question',
      questionId: q.questionId,
      topicId: q.topicId,
      questionType: q.questionType,
      title: q.title || '',
      difficulty: q.difficulty || 2,
      isBookmarked: Boolean(q.isBookmarked),
      isFlagged: Boolean(q.isFlagged),
      stem: q.stem || '',
      mainExplanationHtml: q.mainExplanationHtml || '',
      modelAnswerHtml: q.modelAnswerHtml || '',
      referenceText: q.referenceText || '',
      choices: Array.isArray(q.choices) ? q.choices.map((c) => ({
        label: c.label || '',
        html: c.html || '',
        isCorrect: Boolean(c.isCorrect),
        explanationHtml: c.explanationHtml || '',
      })) : [],
      isDirty: false,
    };
  } else {
    const fc = state.flashcards.find((item) => item.flashcardId === id);
    if (!fc) return;
    state.selectedItem = { contentType: 'flashcard', id };
    state.form = {
      contentType: 'flashcard',
      flashcardId: fc.flashcardId,
      topicId: fc.topicId,
      isBookmarked: Boolean(fc.isBookmarked),
      isFlagged: Boolean(fc.isFlagged),
      frontHtml: fc.frontHtml || '',
      backHtml: fc.backHtml || '',
      referenceText: fc.referenceText || '',
      isDirty: false,
    };
  }

  state.error = '';
  setSaveState('idle');
  render();
}

function startNewQuestion() {
  state.selectedItem = null;
  state.form = blankQuestion(state.selectedTopicId);
  state.error = '';
  setSaveState('idle');
  render();
}

function startNewFlashcard() {
  state.selectedItem = null;
  state.form = blankFlashcard(state.selectedTopicId);
  state.error = '';
  setSaveState('idle');
  render();
}

function ensureForm() {
  if (!state.form) {
    startNewQuestion();
  }
}

function renderSidebar() {
  const root = document.getElementById('authoring-sidebar');
  if (!root) return;

  const courseOptions = state.hierarchy.courses.map((course) => (
    `<option value="${escapeHtml(course.course_id)}" ${state.selectedCourseId === course.course_id ? 'selected' : ''}>${escapeHtml(course.course_name)}</option>`
  )).join('');

  const unitOptions = state.hierarchy.units.map((unit) => (
    `<option value="${escapeHtml(unit.unit_id)}" ${state.selectedUnitId === unit.unit_id ? 'selected' : ''}>${escapeHtml(unit.unit_name)}</option>`
  )).join('');

  const topicOptions = state.hierarchy.topics.map((topic) => (
    `<option value="${escapeHtml(topic.topic_id)}" ${state.selectedTopicId === topic.topic_id ? 'selected' : ''}>${escapeHtml(topic.topic_name)}</option>`
  )).join('');

  const questionButtons = state.questions.map((q) => {
    const active = state.selectedItem?.contentType === 'question' && state.selectedItem.id === q.questionId;
    const name = q.title || q.stem.replace(/<[^>]+>/g, ' ').trim().slice(0, 60) || 'Untitled question';
    return `<button class="item-button ${active ? 'active' : ''}" data-pick-type="question" data-pick-id="${escapeHtml(q.questionId)}">Q: ${escapeHtml(name)}</button>`;
  }).join('');

  const flashcardButtons = state.flashcards.map((fc) => {
    const active = state.selectedItem?.contentType === 'flashcard' && state.selectedItem.id === fc.flashcardId;
    const name = fc.frontHtml.replace(/<[^>]+>/g, ' ').trim().slice(0, 60) || 'Untitled flashcard';
    return `<button class="item-button ${active ? 'active' : ''}" data-pick-type="flashcard" data-pick-id="${escapeHtml(fc.flashcardId)}">F: ${escapeHtml(name)}</button>`;
  }).join('');

  root.innerHTML = `
    <div class="sidebar-group">
      <div class="sidebar-title">Scope</div>
      <div class="field">
        <label for="sel-course">Course</label>
        <select id="sel-course">${courseOptions}</select>
      </div>
      <div class="field">
        <label for="sel-unit">Unit</label>
        <select id="sel-unit">${unitOptions || '<option value="">No units</option>'}</select>
      </div>
      <div class="field">
        <label for="sel-topic">Topic</label>
        <select id="sel-topic">${topicOptions || '<option value="">No topics</option>'}</select>
      </div>
    </div>

    <div class="sidebar-group">
      <div class="sidebar-title">Create</div>
      <div class="toolbar">
        <button id="btn-new-question" ${state.selectedTopicId ? '' : 'disabled'}>New Question</button>
        <button id="btn-new-flashcard" ${state.selectedTopicId ? '' : 'disabled'}>New Flashcard</button>
      </div>
    </div>

    <div class="sidebar-group">
      <div class="sidebar-title">Questions (${state.questions.length})</div>
      <div class="item-list">${questionButtons || '<div class="muted">No questions in topic.</div>'}</div>
    </div>

    <div class="sidebar-group">
      <div class="sidebar-title">Flashcards (${state.flashcards.length})</div>
      <div class="item-list">${flashcardButtons || '<div class="muted">No flashcards in topic.</div>'}</div>
    </div>
  `;
}

function renderChoiceRows() {
  if (!state.form || state.form.contentType !== 'question') return '';
  if (state.form.questionType === 'short_answer') return '';

  return state.form.choices.map((choice, index) => `
    <div class="choice-row" data-choice-index="${index}">
      <div class="choice-head">
        <input type="text" data-choice-field="label" data-choice-index="${index}" value="${escapeHtml(choice.label)}" placeholder="Label">
        <label><input type="checkbox" data-choice-field="isCorrect" data-choice-index="${index}" ${choice.isCorrect ? 'checked' : ''}> Correct</label>
        <button type="button" data-remove-choice="${index}">Remove</button>
      </div>
      ${renderRichEditor({
        richId: `choice-html-${index}`,
        label: 'Choice Content',
        value: choice.html,
        placeholder: 'Type choice text, add code, table, image, or math...',
        compact: true,
        richRole: 'html',
      })}
      ${renderRichEditor({
        richId: `choice-explanation-${index}`,
        label: 'Per-choice Explanation',
        value: choice.explanationHtml,
        placeholder: 'Explain why this option is correct or incorrect...',
        compact: true,
        richRole: 'explanationHtml',
      })}
    </div>
  `).join('');
}

function renderRichEditor({ richId, label, value, placeholder, compact = false, richRole = '' }) {
  return `
    <div class="rich-editor-wrap">
      <label>${escapeHtml(label)}</label>
      <div class="rich-toolbar" data-rich-toolbar="${escapeHtml(richId)}">
        <button type="button" data-rich-action="bold" data-rich-target="${escapeHtml(richId)}" title="Bold"><strong>B</strong></button>
        <button type="button" data-rich-action="italic" data-rich-target="${escapeHtml(richId)}" title="Italic"><em>I</em></button>
        <button type="button" data-rich-action="ul" data-rich-target="${escapeHtml(richId)}" title="Bullet list">List</button>
        <button type="button" data-rich-action="link" data-rich-target="${escapeHtml(richId)}" title="Insert link">Link</button>
        <button type="button" data-rich-action="image" data-rich-target="${escapeHtml(richId)}" title="Insert image">Image</button>
        <button type="button" data-rich-action="code" data-rich-target="${escapeHtml(richId)}" title="Insert code block">Code</button>
        <button type="button" data-rich-action="table" data-rich-target="${escapeHtml(richId)}" title="Insert table">Table</button>
        <button type="button" data-rich-action="math" data-rich-target="${escapeHtml(richId)}" title="Insert LaTeX/math">Math</button>
      </div>
      <div
        class="rich-editor ${compact ? 'compact' : ''}"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        data-rich-id="${escapeHtml(richId)}"
        data-rich-role="${escapeHtml(richRole)}"
        data-placeholder="${escapeHtml(placeholder || '')}"
      >${value || ''}</div>
    </div>
  `;
}

function getRichEditorById(richId) {
  return document.querySelector(`[data-rich-id="${CSS.escape(richId)}"]`);
}

function focusRichEditor(editor) {
  if (!editor) return;
  editor.focus();
  const selection = window.getSelection();
  if (!selection) return;
  if (!editor.contains(selection.anchorNode)) {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function insertHtmlAtCaret(editor, html) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    editor.insertAdjacentHTML('beforeend', html);
    return;
  }

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) {
    editor.insertAdjacentHTML('beforeend', html);
    return;
  }

  range.deleteContents();
  const fragment = range.createContextualFragment(html);
  const lastNode = fragment.lastChild;
  range.insertNode(fragment);
  if (lastNode) {
    range.setStartAfter(lastNode);
    range.setEndAfter(lastNode);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function applyRichAction(action, richId) {
  const editor = getRichEditorById(richId);
  if (!editor) return;
  focusRichEditor(editor);

  if (action === 'bold') {
    document.execCommand('bold');
    return;
  }
  if (action === 'italic') {
    document.execCommand('italic');
    return;
  }
  if (action === 'ul') {
    document.execCommand('insertUnorderedList');
    return;
  }
  if (action === 'link') {
    const url = window.prompt('Enter URL');
    if (!url) return;
    document.execCommand('createLink', false, url.trim());
    return;
  }
  if (action === 'image') {
    const src = window.prompt('Image URL');
    if (!src) return;
    const alt = window.prompt('Image alt text (optional)') || '';
    insertHtmlAtCaret(editor, `<img src="${escapeHtml(src.trim())}" alt="${escapeHtml(alt)}">`);
    return;
  }
  if (action === 'code') {
    const snippet = window.prompt('Code snippet', '// code here') || '// code here';
    insertHtmlAtCaret(editor, `<pre><code>${escapeHtml(snippet)}</code></pre>`);
    return;
  }
  if (action === 'table') {
    const tableHtml = [
      '<table>',
      '<thead><tr><th>Column 1</th><th>Column 2</th></tr></thead>',
      '<tbody><tr><td>Value</td><td>Value</td></tr><tr><td>Value</td><td>Value</td></tr></tbody>',
      '</table>',
    ].join('');
    insertHtmlAtCaret(editor, tableHtml);
    return;
  }
  if (action === 'math') {
    const latex = window.prompt('LaTeX expression', 'x^2 + y^2 = z^2') || 'x^2 + y^2 = z^2';
    insertHtmlAtCaret(editor, `<span class="math-inline">\\(${escapeHtml(latex)}\\)</span>`);
  }
}

function renderQuestionEditor() {
  const f = state.form;
  const questionTypeOptions = [
    ['single_best', 'Single Best'],
    ['multi_select', 'Multi-select'],
    ['true_false', 'True / False'],
    ['short_answer', 'Short answer'],
  ].map(([value, label]) => (`<option value="${value}" ${f.questionType === value ? 'selected' : ''}>${label}</option>`)).join('');

  return `
    <div class="section">
      <h3 class="section-title">Metadata</h3>
      <div class="grid-two">
        <div class="field">
          <label for="fld-title">Title</label>
          <input type="text" id="fld-title" value="${escapeHtml(f.title)}">
        </div>
        <div class="field">
          <label for="fld-question-type">Question Type</label>
          <select id="fld-question-type">${questionTypeOptions}</select>
        </div>
        <div class="field">
          <label for="fld-difficulty">Difficulty (1-5)</label>
          <input type="number" id="fld-difficulty" min="1" max="5" value="${Number(f.difficulty || 2)}">
        </div>
        <div class="field">
          <label><input type="checkbox" id="fld-bookmarked" ${f.isBookmarked ? 'checked' : ''}> Bookmarked</label>
          <label><input type="checkbox" id="fld-flagged" ${f.isFlagged ? 'checked' : ''}> Flagged</label>
        </div>
      </div>
    </div>

    <div class="section">
      <h3 class="section-title">Question Stem</h3>
      <div class="field">
        ${renderRichEditor({
          richId: 'fld-stem',
          label: 'Stem',
          value: f.stem,
          placeholder: 'Write question stem with formatting, image, code, table, and math...',
        })}
      </div>
    </div>

    ${f.questionType === 'short_answer' ? '' : `
      <div class="section">
        <h3 class="section-title">Choices</h3>
        <div id="choice-list">${renderChoiceRows()}</div>
        <div class="toolbar">
          <button type="button" id="btn-add-choice">Add Choice</button>
        </div>
      </div>
    `}

    <div class="section">
      <h3 class="section-title">Main Explanation</h3>
      <div class="field">
        ${renderRichEditor({
          richId: 'fld-main-explanation',
          label: 'Main Explanation',
          value: f.mainExplanationHtml,
          placeholder: 'Provide rationale, teaching points, and references...',
        })}
      </div>
    </div>

    ${f.questionType === 'short_answer' ? `
      <div class="section">
        <h3 class="section-title">Model Answer</h3>
        <div class="field">
          ${renderRichEditor({
            richId: 'fld-model-answer',
            label: 'Model Answer',
            value: f.modelAnswerHtml,
            placeholder: 'Provide ideal short-answer response with key points...',
          })}
        </div>
      </div>
    ` : ''}

    <div class="section">
      <h3 class="section-title">Reference</h3>
      <div class="field">
        <label for="fld-reference">Reference Text</label>
        <textarea id="fld-reference">${escapeHtml(f.referenceText)}</textarea>
      </div>
    </div>
  `;
}

function renderFlashcardEditor() {
  const f = state.form;
  return `
    <div class="section">
      <h3 class="section-title">Metadata</h3>
      <div class="grid-two">
        <div class="field">
          <label><input type="checkbox" id="fld-bookmarked" ${f.isBookmarked ? 'checked' : ''}> Bookmarked</label>
          <label><input type="checkbox" id="fld-flagged" ${f.isFlagged ? 'checked' : ''}> Flagged</label>
        </div>
      </div>
    </div>

    <div class="section">
      <h3 class="section-title">Front</h3>
      <div class="field">
        ${renderRichEditor({
          richId: 'fld-front',
          label: 'Front',
          value: f.frontHtml,
          placeholder: 'Front prompt, definition, equation, or diagram...',
        })}
      </div>
    </div>

    <div class="section">
      <h3 class="section-title">Back</h3>
      <div class="field">
        ${renderRichEditor({
          richId: 'fld-back',
          label: 'Back',
          value: f.backHtml,
          placeholder: 'Answer side with details, code, table, or math...',
        })}
      </div>
    </div>

    <div class="section">
      <h3 class="section-title">Reference</h3>
      <div class="field">
        <label for="fld-reference">Reference Text</label>
        <textarea id="fld-reference">${escapeHtml(f.referenceText)}</textarea>
      </div>
    </div>
  `;
}

function renderEditor() {
  const root = document.getElementById('authoring-editor');
  if (!root) return;

  if (!state.form) {
    root.innerHTML = `
      <div class="section">
        <h3 class="section-title">No item selected</h3>
        <p>Select an existing item from the left, or create a new question/flashcard.</p>
      </div>
    `;
    return;
  }

  const hasItemId = Boolean(state.form.questionId || state.form.flashcardId);

  root.innerHTML = `
    ${state.error ? `<div class="error-banner">${escapeHtml(state.error)}</div>` : ''}

    <div class="section">
      <h3 class="section-title">Save Bar</h3>
      <div class="toolbar">
        <button class="primary" id="btn-save">Save</button>
        <button id="btn-duplicate" ${hasItemId ? '' : 'disabled'}>Duplicate</button>
        <button id="btn-delete" ${hasItemId ? '' : 'disabled'}>Delete</button>
      </div>
    </div>

    ${state.form.contentType === 'question' ? renderQuestionEditor() : renderFlashcardEditor()}
  `;
}

function render() {
  renderSidebar();
  renderEditor();
  bindEvents();
}

function syncFormFromDom() {
  if (!state.form) return;
  if (state.form.contentType === 'question') {
    state.form.title = document.getElementById('fld-title')?.value ?? state.form.title;
    state.form.questionType = document.getElementById('fld-question-type')?.value ?? state.form.questionType;
    state.form.difficulty = Number(document.getElementById('fld-difficulty')?.value || state.form.difficulty || 2);
    state.form.isBookmarked = Boolean(document.getElementById('fld-bookmarked')?.checked);
    state.form.isFlagged = Boolean(document.getElementById('fld-flagged')?.checked);
    state.form.stem = getRichEditorById('fld-stem')?.innerHTML ?? state.form.stem;
    state.form.mainExplanationHtml = getRichEditorById('fld-main-explanation')?.innerHTML ?? state.form.mainExplanationHtml;
    state.form.modelAnswerHtml = getRichEditorById('fld-model-answer')?.innerHTML ?? state.form.modelAnswerHtml;
    state.form.referenceText = document.getElementById('fld-reference')?.value ?? state.form.referenceText;

    const nextChoices = [];
    const rows = document.querySelectorAll('.choice-row[data-choice-index]');
    for (const row of rows) {
      const index = Number(row.getAttribute('data-choice-index'));
      if (!Number.isInteger(index)) continue;
      const label = row.querySelector('[data-choice-field="label"]')?.value ?? '';
      const html = row.querySelector('[data-rich-role="html"]')?.innerHTML ?? '';
      const isCorrect = Boolean(row.querySelector('[data-choice-field="isCorrect"]')?.checked);
      const explanationHtml = row.querySelector('[data-rich-role="explanationHtml"]')?.innerHTML ?? '';
      nextChoices.push({ label, html, isCorrect, explanationHtml });
    }
    state.form.choices = nextChoices;
  } else {
    state.form.isBookmarked = Boolean(document.getElementById('fld-bookmarked')?.checked);
    state.form.isFlagged = Boolean(document.getElementById('fld-flagged')?.checked);
    state.form.frontHtml = getRichEditorById('fld-front')?.innerHTML ?? state.form.frontHtml;
    state.form.backHtml = getRichEditorById('fld-back')?.innerHTML ?? state.form.backHtml;
    state.form.referenceText = document.getElementById('fld-reference')?.value ?? state.form.referenceText;
  }
}

async function saveCurrent() {
  if (!state.form) return;
  syncFormFromDom();
  state.error = '';
  setSaveState('saving');

  try {
    if (state.form.contentType === 'question') {
      const payload = {
        questionId: state.form.questionId,
        topicId: state.selectedTopicId,
        questionType: state.form.questionType,
        title: state.form.title,
        difficulty: state.form.difficulty,
        isBookmarked: state.form.isBookmarked,
        isFlagged: state.form.isFlagged,
        stem: state.form.stem,
        mainExplanationHtml: state.form.mainExplanationHtml,
        modelAnswerHtml: state.form.questionType === 'short_answer' ? state.form.modelAnswerHtml : null,
        referenceText: state.form.referenceText,
        choices: state.form.questionType === 'short_answer' ? [] : state.form.choices,
      };

      const saved = state.form.questionId
        ? await window.api.updateQuestion(payload)
        : await window.api.createQuestion(payload);

      state.form.questionId = saved.questionId;
      state.selectedItem = { contentType: 'question', id: saved.questionId };
    } else {
      const payload = {
        flashcardId: state.form.flashcardId,
        topicId: state.selectedTopicId,
        frontHtml: state.form.frontHtml,
        backHtml: state.form.backHtml,
        referenceText: state.form.referenceText,
        isBookmarked: state.form.isBookmarked,
        isFlagged: state.form.isFlagged,
      };

      const saved = state.form.flashcardId
        ? await window.api.updateFlashcard(payload)
        : await window.api.createFlashcard(payload);

      state.form.flashcardId = saved.flashcardId;
      state.selectedItem = { contentType: 'flashcard', id: saved.flashcardId };
    }

    await loadItemsForTopic();
    state.form.isDirty = false;
    setSaveState('success');
    render();
  } catch (error) {
    console.error(error);
    state.error = error?.message || 'Save failed.';
    setSaveState('error');
    render();
  }
}

async function duplicateCurrent() {
  if (!state.form) return;
  try {
    if (state.form.contentType === 'question' && state.form.questionId) {
      const duplicated = await window.api.duplicateQuestion(state.form.questionId);
      await loadItemsForTopic();
      pickItem('question', duplicated.questionId);
      return;
    }

    if (state.form.contentType === 'flashcard' && state.form.flashcardId) {
      const duplicated = await window.api.duplicateFlashcard(state.form.flashcardId);
      await loadItemsForTopic();
      pickItem('flashcard', duplicated.flashcardId);
    }
  } catch (error) {
    state.error = error?.message || 'Duplicate failed.';
    render();
  }
}

async function deleteCurrent() {
  if (!state.form) return;
  try {
    if (state.form.contentType === 'question' && state.form.questionId) {
      await window.api.deleteQuestion(state.form.questionId);
      state.form = blankQuestion(state.selectedTopicId);
      state.selectedItem = null;
    } else if (state.form.contentType === 'flashcard' && state.form.flashcardId) {
      await window.api.deleteFlashcard(state.form.flashcardId);
      state.form = blankFlashcard(state.selectedTopicId);
      state.selectedItem = null;
    }

    await loadItemsForTopic();
    setSaveState('idle');
    render();
  } catch (error) {
    state.error = error?.message || 'Delete failed.';
    render();
  }
}

async function onScopeChange(nextCourseId, nextUnitId, nextTopicId) {
  if (state.form?.isDirty) {
    const proceed = window.confirm('You have unsaved changes. Continue and discard them?');
    if (!proceed) {
      render();
      return;
    }
  }

  if (nextCourseId && nextCourseId !== state.selectedCourseId) {
    state.selectedCourseId = nextCourseId;
    state.hierarchy.units = await window.api.getUnits(state.selectedCourseId);
    state.selectedUnitId = state.hierarchy.units[0]?.unit_id || null;
    state.hierarchy.topics = state.selectedUnitId ? await window.api.getTopics(state.selectedUnitId) : [];
    state.selectedTopicId = state.hierarchy.topics[0]?.topic_id || null;
  }

  if (nextUnitId && nextUnitId !== state.selectedUnitId) {
    state.selectedUnitId = nextUnitId;
    state.hierarchy.topics = await window.api.getTopics(state.selectedUnitId);
    state.selectedTopicId = state.hierarchy.topics[0]?.topic_id || null;
  }

  if (typeof nextTopicId === 'string') {
    state.selectedTopicId = nextTopicId || null;
  }

  await loadItemsForTopic();
  state.selectedItem = null;
  state.form = state.selectedTopicId ? blankQuestion(state.selectedTopicId) : null;
  setSaveState('idle');
  render();
}

function bindEvents() {
  document.getElementById('sel-course')?.addEventListener('change', async (event) => {
    await onScopeChange(event.target.value, null, null);
  });

  document.getElementById('sel-unit')?.addEventListener('change', async (event) => {
    await onScopeChange(null, event.target.value, null);
  });

  document.getElementById('sel-topic')?.addEventListener('change', async (event) => {
    await onScopeChange(null, null, event.target.value);
  });

  document.getElementById('btn-new-question')?.addEventListener('click', () => {
    state.form = blankQuestion(state.selectedTopicId);
    state.selectedItem = null;
    setSaveState('idle');
    render();
  });

  document.getElementById('btn-new-flashcard')?.addEventListener('click', () => {
    state.form = blankFlashcard(state.selectedTopicId);
    state.selectedItem = null;
    setSaveState('idle');
    render();
  });

  for (const button of document.querySelectorAll('[data-pick-type]')) {
    button.addEventListener('click', () => {
      const type = button.getAttribute('data-pick-type');
      const id = button.getAttribute('data-pick-id');
      pickItem(type, id);
    });
  }

  document.getElementById('btn-save')?.addEventListener('click', saveCurrent);
  document.getElementById('btn-duplicate')?.addEventListener('click', duplicateCurrent);
  document.getElementById('btn-delete')?.addEventListener('click', deleteCurrent);

  for (const button of document.querySelectorAll('[data-rich-action]')) {
    button.addEventListener('click', () => {
      const action = button.getAttribute('data-rich-action');
      const target = button.getAttribute('data-rich-target');
      applyRichAction(action, target);
      syncFormFromDom();
      markDirty();
    });
  }

  document.getElementById('btn-add-choice')?.addEventListener('click', () => {
    if (!state.form || state.form.contentType !== 'question') return;
    state.form.choices.push({
      label: String.fromCharCode(65 + state.form.choices.length),
      html: '',
      isCorrect: false,
      explanationHtml: '',
    });
    markDirty();
    render();
  });

  for (const button of document.querySelectorAll('[data-remove-choice]')) {
    button.addEventListener('click', () => {
      if (!state.form || state.form.contentType !== 'question') return;
      const index = Number(button.getAttribute('data-remove-choice'));
      state.form.choices.splice(index, 1);
      markDirty();
      render();
    });
  }

  for (const editor of document.querySelectorAll('[contenteditable="true"][data-rich-id]')) {
    editor.addEventListener('input', () => {
      syncFormFromDom();
      markDirty();
    });
  }

  for (const input of document.querySelectorAll('input, textarea, select')) {
    if (input.id === 'sel-course' || input.id === 'sel-unit' || input.id === 'sel-topic') continue;
    input.addEventListener('input', () => {
      syncFormFromDom();
      markDirty();
    });
    input.addEventListener('change', () => {
      syncFormFromDom();
      markDirty();
      if (input.id === 'fld-question-type') {
        if (state.form.questionType === 'short_answer') {
          state.form.choices = [];
        } else if (!state.form.choices.length) {
          state.form.choices = [
            { label: 'A', html: '', isCorrect: true, explanationHtml: '' },
            { label: 'B', html: '', isCorrect: false, explanationHtml: '' },
          ];
        }
        render();
      }
    });
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

window.addEventListener('beforeunload', (event) => {
  if (state.form?.isDirty) {
    event.preventDefault();
    event.returnValue = '';
  }
});

async function init() {
  try {
    await loadHierarchy();
    await loadItemsForTopic();
    ensureForm();
    render();
  } catch (error) {
    const root = document.getElementById('authoring-editor');
    if (!root) return;
    root.innerHTML = `<div class="error-banner">${escapeHtml(error?.message || 'Failed to load authoring screen.')}</div>`;
    console.error(error);
  }
}

init();
