function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const node = byId(id);
  if (!node) return;
  node.textContent = String(value);
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function setSummaryStatus(message, isError = false) {
  const node = byId('summary-status');
  if (!node) return;
  node.textContent = message;
  node.classList.toggle('error', Boolean(isError));
}

async function getContentSummary() {
  if (!window.api?.getCourses || !window.api?.getUnits || !window.api?.getTopics || !window.api?.getQuestions) {
    throw new Error('Required data APIs are not available in preload bridge.');
  }

  const courses = await window.api.getCourses();
  const safeCourses = Array.isArray(courses) ? courses : [];

  let totalUnits = 0;
  let totalTopics = 0;
  const topicIds = [];

  for (const course of safeCourses) {
    const units = await window.api.getUnits(course.course_id);
    const safeUnits = Array.isArray(units) ? units : [];
    totalUnits += safeUnits.length;

    for (const unit of safeUnits) {
      const topics = await window.api.getTopics(unit.unit_id);
      const safeTopics = Array.isArray(topics) ? topics : [];
      totalTopics += safeTopics.length;
      for (const topic of safeTopics) {
        if (typeof topic.topic_id === 'string' && topic.topic_id) {
          topicIds.push(topic.topic_id);
        }
      }
    }
  }

  const questionRowsByTopic = await Promise.all(
    topicIds.map(async (topicId) => {
      try {
        const rows = await window.api.getQuestions({ topicIds: [topicId] });
        return Array.isArray(rows) ? rows : [];
      } catch {
        return [];
      }
    })
  );

  const totalQuestions = questionRowsByTopic.reduce((acc, rows) => acc + rows.length, 0);

  return {
    courses: safeCourses.length,
    units: totalUnits,
    topics: totalTopics,
    questions: totalQuestions,
  };
}

async function getDueSummary() {
  if (!window.api?.getSpacedReviewDueCounts) {
    return { totalDue: 0, questionDue: 0, flashcardDue: 0 };
  }

  try {
    const counts = await window.api.getSpacedReviewDueCounts({});
    return {
      totalDue: numberOrZero(counts?.totalDue),
      questionDue: numberOrZero(counts?.questionDue),
      flashcardDue: numberOrZero(counts?.flashcardDue),
    };
  } catch {
    return { totalDue: 0, questionDue: 0, flashcardDue: 0 };
  }
}

async function refreshHomeSummary() {
  setSummaryStatus('Loading summary...', false);

  try {
    const [contentSummary, dueSummary] = await Promise.all([
      getContentSummary(),
      getDueSummary(),
    ]);

    setText('metric-courses', contentSummary.courses);
    setText('metric-units', contentSummary.units);
    setText('metric-topics', contentSummary.topics);
    setText('metric-questions', contentSummary.questions);

    setText('due-total', dueSummary.totalDue);
    setText('due-questions', dueSummary.questionDue);
    setText('due-flashcards', dueSummary.flashcardDue);

    if (contentSummary.courses === 0) {
      setSummaryStatus('No courses found yet. Start by creating your first course in Library.', false);
    } else {
      setSummaryStatus('Summary is current.', false);
    }
  } catch (error) {
    console.error('[home] Failed to load summary.', error);
    setText('metric-courses', '-');
    setText('metric-units', '-');
    setText('metric-topics', '-');
    setText('metric-questions', '-');
    setText('due-total', '-');
    setText('due-questions', '-');
    setText('due-flashcards', '-');
    setSummaryStatus('Unable to load summary metrics right now.', true);
  }
}

function wireEvents() {
  const refreshButton = byId('btn-refresh-summary');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      void refreshHomeSummary();
    });
  }
}

wireEvents();
void refreshHomeSummary();
