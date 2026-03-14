const MODE_LABELS = {
  free_practice: 'Free Practice',
  timed_block: 'Timed Block',
  review_incorrect: 'Review Incorrect',
  spaced_review: 'Spaced Review',
};

let sessionList = [];
let selectedSessionId = null;
let adaptiveWeakItems = [];

const EMPTY_STATE_CONFIG = {
  noHistory: {
    title: 'No history yet',
    message: 'Complete a practice session to populate this list.',
    actionHref: '../practice-setup/index.html',
    actionLabel: 'Start a practice session',
    tone: 'neutral',
  },
  runtimeUnavailable: {
    title: 'Desktop runtime required',
    message: 'History is available in the desktop app runtime.',
    actionHref: '../practice-setup/index.html',
    actionLabel: 'Open Practice Setup',
    tone: 'info',
  },
  loadFailed: {
    title: 'History unavailable',
    message: 'Unable to load session history. Retry after restarting the app.',
    actionHref: '../practice-setup/index.html',
    actionLabel: 'Open Practice Setup',
    tone: 'error',
  },
};

const els = {
  list: document.getElementById('history-list'),
  count: document.getElementById('history-count'),
  empty: document.getElementById('history-empty'),
  detail: document.getElementById('history-detail'),
  detailEmpty: document.getElementById('history-detail-empty'),
};

function formatMode(mode) {
  return MODE_LABELS[mode] || mode || 'Unknown';
}

function formatDateTime(value) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString();
}

function formatDuration(seconds) {
  if (!Number.isInteger(seconds) || seconds < 0) return 'N/A';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function updateCountLabel() {
  els.count.textContent = `${sessionList.length} session${sessionList.length === 1 ? '' : 's'}`;
}

function renderEmpty(stateKey) {
  const state = EMPTY_STATE_CONFIG[stateKey] || EMPTY_STATE_CONFIG.noHistory;

  els.empty.hidden = false;
  els.empty.classList.toggle('empty-state-error', state.tone === 'error');
  els.empty.classList.toggle('empty-state-info', state.tone === 'info');

  const titleNode = els.empty.querySelector('h3');
  if (titleNode) {
    titleNode.textContent = state.title;
  }

  const messageNode = els.empty.querySelector('p');
  if (messageNode) {
    messageNode.textContent = state.message;
  }

  const actionNode = els.empty.querySelector('a.action-link');
  if (actionNode) {
    actionNode.textContent = state.actionLabel;
    actionNode.setAttribute('href', state.actionHref);
  }

  els.list.innerHTML = '';
  selectedSessionId = null;
  renderDetailPlaceholder('Select a session', 'Session details will appear here.');
}

function renderDetailPlaceholder(title, message) {
  els.detail.hidden = true;
  els.detail.innerHTML = '';
  els.detailEmpty.hidden = false;
  const h3 = els.detailEmpty.querySelector('h3');
  const p = els.detailEmpty.querySelector('p');
  if (h3) h3.textContent = title;
  if (p) p.textContent = message;
}

function renderList() {
  if (!sessionList.length) {
    renderEmpty('noHistory');
    return;
  }

  els.empty.hidden = true;
  els.list.innerHTML = sessionList.map((session) => {
    const score = session.scorePercent == null ? 'N/A' : `${session.scorePercent.toFixed(1)}%`;
    const dateLabel = formatDateTime(session.displayedAt);
    const selectedClass = session.sessionId === selectedSessionId ? ' is-selected' : '';

    return `
      <button class="history-row${selectedClass}" data-session-id="${session.sessionId}" role="option" aria-selected="${session.sessionId === selectedSessionId}">
        <div class="row-head">
          <span class="row-mode">${formatMode(session.sessionType)}</span>
          <span class="row-date">${dateLabel}</span>
        </div>
        <div class="row-metrics">
          <span class="metric score">Score ${score}</span>
          <span class="metric">Revealed ${numberOrZero(session.revealedCount)}</span>
          <span class="metric">Incorrect ${numberOrZero(session.incorrectCount)}</span>
          <span class="metric">Duration ${formatDuration(session.durationSeconds)}</span>
        </div>
      </button>
    `;
  }).join('');
}

function renderDetail(detail) {
  if (!detail) {
    renderDetailPlaceholder('Session unavailable', 'This record could not be loaded.');
    return;
  }

  const score = detail.scorePercent == null ? 'N/A' : `${detail.scorePercent.toFixed(1)}%`;
  const hasCorruptRecord = detail.hasCorruptFilterPayload === true;

  const typeBadges = Array.isArray(detail.questionTypeBreakdown)
    ? detail.questionTypeBreakdown.map((entry) => `<span class="badge">${entry.questionType}: ${entry.itemCount}</span>`).join('')
    : '';

  const topicBadges = Array.isArray(detail.topicBreakdown)
    ? detail.topicBreakdown.slice(0, 4).map((entry) => `<span class="badge">${entry.topicName}: ${entry.itemCount}</span>`).join('')
    : '';

  const scopedTopicIds = new Set(Array.isArray(detail.topicBreakdown)
    ? detail.topicBreakdown.map((entry) => entry.topicId).filter((id) => typeof id === 'string')
    : []);

  const scopedWeakItems = adaptiveWeakItems
    .filter((row) => scopedTopicIds.size === 0 || scopedTopicIds.has(row.topicId))
    .slice(0, 4);

  const adaptiveWeakMarkup = scopedWeakItems.length > 0
    ? scopedWeakItems.map((row) => {
      const score = Number(row.weaknessScore);
      const percent = Number.isFinite(score) ? `${(score * 100).toFixed(1)}%` : 'N/A';
      return `<span class="badge">${escapeHtml(row.topicName || 'Topic')}: ${percent}</span>`;
    }).join('')
    : '<span class="detail-value">No adaptive weak-question signals yet.</span>';

  els.detailEmpty.hidden = true;
  els.detail.hidden = false;
  els.detail.innerHTML = `
    <div class="detail-card">
      <h3>Session Summary</h3>
      <div class="detail-grid">
        <div><span class="detail-label">Mode</span><span class="detail-value">${formatMode(detail.sessionType)}</span></div>
        <div><span class="detail-label">Timer</span><span class="detail-value">${detail.timerMode || 'none'}</span></div>
        <div><span class="detail-label">Started</span><span class="detail-value">${formatDateTime(detail.startedAt || detail.createdAt)}</span></div>
        <div><span class="detail-label">Completed</span><span class="detail-value">${formatDateTime(detail.completedAt)}</span></div>
        <div><span class="detail-label">Duration</span><span class="detail-value">${formatDuration(detail.durationSeconds)}</span></div>
        <div><span class="detail-label">Score</span><span class="detail-value">${score}</span></div>
      </div>
    </div>

    <div class="detail-card">
      <h3>Outcome</h3>
      <div class="detail-grid">
        <div><span class="detail-label">Items</span><span class="detail-value">${numberOrZero(detail.itemCount)}</span></div>
        <div><span class="detail-label">Revealed</span><span class="detail-value">${numberOrZero(detail.revealedCount)}</span></div>
        <div><span class="detail-label">Correct</span><span class="detail-value">${numberOrZero(detail.correctCount)}</span></div>
        <div><span class="detail-label">Partial</span><span class="detail-value">${numberOrZero(detail.partialCount)}</span></div>
        <div><span class="detail-label">Incorrect</span><span class="detail-value">${numberOrZero(detail.incorrectCount)}</span></div>
        <div><span class="detail-label">Skipped</span><span class="detail-value">${numberOrZero(detail.skippedCount)}</span></div>
      </div>
    </div>

    <div class="detail-card">
      <h3>Question Type Mix</h3>
      <div class="badge-list">${typeBadges || '<span class="detail-value">No question items recorded.</span>'}</div>
    </div>

    <div class="detail-card">
      <h3>Topic Mix</h3>
      <div class="badge-list">${topicBadges || '<span class="detail-value">No topic-linked items recorded.</span>'}</div>
    </div>

    <div class="detail-card">
      <h3>Adaptive MCQ Focus</h3>
      <div class="badge-list">${adaptiveWeakMarkup}</div>
    </div>

    <div class="detail-card">
      <h3>Follow-up</h3>
      <a class="action-link" href="../practice-setup/index.html">Open Practice Setup</a>
      ${hasCorruptRecord ? '<div class="badge warn detail-warning-badge">Corrupt session metadata detected. Showing safe fallback view.</div>' : ''}
    </div>
  `;
}

async function loadAdaptiveWeakItems() {
  if (!window.api?.listAdaptiveWeakQuestions) {
    adaptiveWeakItems = [];
    return;
  }

  try {
    const rows = await window.api.listAdaptiveWeakQuestions({ limit: 200 });
    adaptiveWeakItems = Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.error('[review-history] Failed to load adaptive weak-question signals.', error);
    adaptiveWeakItems = [];
  }
}

async function selectSession(sessionId) {
  selectedSessionId = sessionId;
  renderList();

  if (!window.api?.getSessionHistoryDetail) {
    renderDetailPlaceholder('Session details unavailable', 'Run this screen in Electron to inspect persisted records.');
    return;
  }

  try {
    const detail = await window.api.getSessionHistoryDetail({ sessionId });
    renderDetail(detail);
  } catch (error) {
    console.error('[review-history] Failed to load session detail.', error);
    renderDetailPlaceholder('Invalid session record', 'This session could not be rendered due to invalid or missing data.');
  }
}

function bindEvents() {
  els.list.addEventListener('click', (event) => {
    const target = event.target.closest('[data-session-id]');
    if (!target) return;
    const { sessionId } = target.dataset;
    if (!sessionId) return;
    void selectSession(sessionId);
  });
}

async function loadHistory() {
  if (!window.api?.listSessionHistory) {
    sessionList = [];
    updateCountLabel();
    renderEmpty('runtimeUnavailable');
    return;
  }

  try {
    await loadAdaptiveWeakItems();
    const rows = await window.api.listSessionHistory({ limit: 200 });
    sessionList = Array.isArray(rows) ? rows : [];
    updateCountLabel();
    renderList();

    if (sessionList.length > 0) {
      void selectSession(sessionList[0].sessionId);
    }
  } catch (error) {
    console.error('[review-history] Failed to load history list.', error);
    sessionList = [];
    updateCountLabel();
    renderEmpty('loadFailed');
  }
}

bindEvents();
void loadHistory();
