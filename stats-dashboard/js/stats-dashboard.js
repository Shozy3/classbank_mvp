function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function emptyCardMarkup({ title, message, tone = 'neutral' }) {
  return `
    <div class="empty-card empty-card-${tone}">
      <h2>${title}</h2>
      <p>${message}</p>
    </div>
  `;
}

function pct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : 'N/A';
}

function renderPrimary(streak, options = {}) {
  const root = document.getElementById('stats-primary');
  if (!root) return;

  if (options.error) {
    root.innerHTML = emptyCardMarkup({
      title: 'Stats unavailable',
      message: 'Unable to load streak metrics right now. Retry after restarting the app.',
      tone: 'error',
    });
    return;
  }

  if (!streak) {
    root.innerHTML = emptyCardMarkup({
      title: 'Streak',
      message: 'No study activity yet. Start a session to begin your streak.',
      tone: 'neutral',
    });
    return;
  }

  const current = num(streak.currentStreakDays);
  const longest = num(streak.longestStreakDays);
  const activeDays = num(streak.activeDays);
  const lastActive = streak.lastActiveDate || 'N/A';

  root.innerHTML = `
    <h2>Current Streak</h2>
    <div class="streak-value">${current} day${current === 1 ? '' : 's'}</div>
    <p>Consistency compounds memory. Keep the chain alive today.</p>
    <div class="streak-meta">
      <span class="streak-chip">Longest: ${longest} day${longest === 1 ? '' : 's'}</span>
      <span class="streak-chip">Active days: ${activeDays}</span>
      <span class="streak-chip">Last active: ${lastActive}</span>
    </div>
  `;
}

function renderSecondary(summary, options = {}) {
  const root = document.getElementById('stats-secondary');
  if (!root) return;

  if (options.error) {
    root.innerHTML = `
      <article class="card empty-card empty-card-error">
        <h2>Dashboard unavailable</h2>
        <p>Unable to load summary metrics. Try again after restarting the app.</p>
      </article>
    `;
    return;
  }

  if (!summary) {
    root.innerHTML = `
      <article class="card empty-card empty-card-neutral">
        <h2>No Data</h2>
        <p>Stats appear after your first completed sessions.</p>
      </article>
    `;
    return;
  }

  const recent = summary.recentSessions || {};
  const answered = summary.answered || {};
  const due = summary.due || {};
  const adaptiveReview = summary.adaptiveReview || {};
  const weakTopics = Array.isArray(summary.weakTopics) ? summary.weakTopics : [];

  const accuracy = answered.weightedAccuracyPercent == null
    ? 'N/A'
    : `${answered.weightedAccuracyPercent.toFixed(1)}%`;

  const weakTopicsMarkup = weakTopics.length
    ? weakTopics.map((topic) => `
        <span class="topic-pill">${topic.topicName}: ${pct(topic.combinedWeaknessPercent ?? topic.weaknessPercent)}</span>
      `).join('')
    : '<p>No weak-topic signals yet.</p>';

  root.innerHTML = `
    <article class="card">
      <h2>Recent Sessions</h2>
      <div class="metric-list">
        <div class="metric-row"><span class="metric-label">Last 7 days</span><span class="metric-value">${num(recent.sessions7d)}</span></div>
        <div class="metric-row"><span class="metric-label">Last 30 days</span><span class="metric-value">${num(recent.sessions30d)}</span></div>
        <div class="metric-row"><span class="metric-label">Total recorded</span><span class="metric-value">${num(recent.totalSessions)}</span></div>
      </div>
    </article>

    <article class="card">
      <h2>Answered</h2>
      <div class="metric-list">
        <div class="metric-row"><span class="metric-label">Revealed items</span><span class="metric-value">${num(answered.totalRevealed)}</span></div>
        <div class="metric-row"><span class="metric-label">Correct</span><span class="metric-value">${num(answered.correctCount)}</span></div>
        <div class="metric-row"><span class="metric-label">Incorrect</span><span class="metric-value">${num(answered.incorrectCount)}</span></div>
        <div class="metric-row"><span class="metric-label">Weighted accuracy</span><span class="metric-value">${accuracy}</span></div>
      </div>
    </article>

    <article class="card">
      <h2>Next Action</h2>
      <div class="metric-list">
        <div class="metric-row"><span class="metric-label">Due spaced items</span><span class="metric-value">${num(due.totalDue)}</span></div>
        <div class="metric-row"><span class="metric-label">Question due</span><span class="metric-value">${num(due.questionDue)}</span></div>
        <div class="metric-row"><span class="metric-label">Flashcard due</span><span class="metric-value">${num(due.flashcardDue)}</span></div>
        <div class="metric-row"><span class="metric-label">Adaptive weak MCQs</span><span class="metric-value">${num(adaptiveReview.weakQuestionCount)}</span></div>
      </div>
      <div class="topic-pill-list topic-pill-list-spaced">${weakTopicsMarkup}</div>
    </article>
  `;
}

async function loadStats() {
  if (!window.api?.getStatsDashboardSummary) {
    renderPrimary(null, { error: false });
    renderSecondary(null, { error: false });
    return;
  }

  try {
    const summary = await window.api.getStatsDashboardSummary();
    renderPrimary(summary?.streak || null, { error: false });
    renderSecondary(summary || null, { error: false });
  } catch (error) {
    console.error('[stats-dashboard] Failed to load stats summary.', error);
    renderPrimary(null, { error: true });
    renderSecondary(null, { error: true });
  }
}

void loadStats();
