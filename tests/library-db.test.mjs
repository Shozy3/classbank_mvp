/**
 * Library DB unit tests — uses Node built-in test runner.
 * Run: node --test tests/library-db.test.mjs
 *
 * Uses a real on-disk DB in a temp directory, seeded with sample fixture data,
 * then torn down after each test suite via closeDatabase().
 */
import { test, before, after, beforeEach, afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Import the DB module (CommonJS require via createRequire)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const db = require(path.join(ROOT, 'db/index.js'));

const SCHEMA_PATH  = path.join(ROOT, 'schema.sql');
const FIXTURE_PATH = path.join(ROOT, 'fixtures/sample-course-data.json');

// Known IDs from the fixture
const KNOWN = {
  courseId:    'course-ece420',
  unitId:      'unit-processes-threads',
  topicId:     'topic-race-conditions',
  questionId:  'q-race-001',
  flashcardId: 'fc-race-001',
};

// -------------------------------------------------------------------------
// Helper — bootstrap a fresh in-temp-dir database
// -------------------------------------------------------------------------
let _tmpDir = null;

function openFreshDb() {
  _tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'classbank-test-'));
  db.initializeDatabase({
    userDataPath: _tmpDir,
    schemaPath:   SCHEMA_PATH,
    fixturePath:  FIXTURE_PATH,
  });
}

function closeFreshDb() {
  db.closeDatabase();
  if (_tmpDir) {
    fs.rmSync(_tmpDir, { recursive: true, force: true });
    _tmpDir = null;
  }
}

// =========================================================================
// Hierarchy CRUD
// =========================================================================

describe('createCourse', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('returns courseId + courseName', () => {
    const result = db.createCourse({ name: 'Test Course', code: 'TC101' });
    assert.ok(typeof result.courseId === 'string' && result.courseId.length > 0);
    assert.equal(result.courseName, 'Test Course');
    assert.equal(result.courseCode, 'TC101');
  });

  test('appears in getCourses', () => {
    const before = db.getCourses().length;
    db.createCourse({ name: 'Another Course' });
    const after = db.getCourses().length;
    assert.equal(after, before + 1);
  });

  test('throws on missing name', () => {
    assert.throws(() => db.createCourse({ code: 'X' }), /name is required/i);
  });

  test('trims name whitespace', () => {
    const result = db.createCourse({ name: '  Padded  ' });
    assert.equal(result.courseName, 'Padded');
  });
});

describe('updateCourse', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('updates name and code', () => {
    const c = db.createCourse({ name: 'Old Name', code: 'OLD' });
    const result = db.updateCourse({ courseId: c.courseId, name: 'New Name', code: 'NEW' });
    assert.equal(result.courseName, 'New Name');
    assert.equal(result.courseCode, 'NEW');
  });

  test('throws on unknown courseId', () => {
    assert.throws(() => db.updateCourse({ courseId: 'does-not-exist', name: 'X' }), /not found/i);
  });
});

describe('deleteCourse', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('removes the course', () => {
    const c = db.createCourse({ name: 'Doomed Course' });
    db.deleteCourse(c.courseId);
    const courses = db.getCourses();
    assert.ok(!courses.some((x) => x.course_id === c.courseId));
  });

  test('throws on unknown courseId', () => {
    assert.throws(() => db.deleteCourse('ghost-id'), /not found/i);
  });
});

describe('createUnit', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('returns unitId + unitName + courseId', () => {
    const result = db.createUnit({ courseId: KNOWN.courseId, name: 'Test Unit' });
    assert.ok(typeof result.unitId === 'string');
    assert.equal(result.unitName, 'Test Unit');
    assert.equal(result.courseId, KNOWN.courseId);
  });

  test('appears in getUnits', () => {
    const before = db.getUnits(KNOWN.courseId).length;
    db.createUnit({ courseId: KNOWN.courseId, name: 'Extra Unit' });
    const after = db.getUnits(KNOWN.courseId).length;
    assert.equal(after, before + 1);
  });

  test('throws on missing courseId', () => {
    assert.throws(() => db.createUnit({ name: 'X' }), /courseId is required/i);
  });
});

describe('updateUnit', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('updates unit name', () => {
    const u = db.createUnit({ courseId: KNOWN.courseId, name: 'Old Unit' });
    const result = db.updateUnit({ unitId: u.unitId, name: 'New Unit' });
    assert.equal(result.unitName, 'New Unit');
  });

  test('throws on unknown unitId', () => {
    assert.throws(() => db.updateUnit({ unitId: 'no-such-unit', name: 'X' }), /not found/i);
  });
});

describe('deleteUnit', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('removes the unit', () => {
    const u = db.createUnit({ courseId: KNOWN.courseId, name: 'Temp Unit' });
    db.deleteUnit(u.unitId);
    const units = db.getUnits(KNOWN.courseId);
    assert.ok(!units.some((x) => x.unit_id === u.unitId));
  });

  test('throws on unknown unitId', () => {
    assert.throws(() => db.deleteUnit('no-unit'), /not found/i);
  });
});

describe('createTopic', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('returns topicId + topicName + unitId', () => {
    const result = db.createTopic({ unitId: KNOWN.unitId, name: 'Test Topic' });
    assert.ok(typeof result.topicId === 'string');
    assert.equal(result.topicName, 'Test Topic');
    assert.equal(result.unitId, KNOWN.unitId);
  });

  test('appears in getTopics', () => {
    const before = db.getTopics(KNOWN.unitId).length;
    db.createTopic({ unitId: KNOWN.unitId, name: 'Another Topic' });
    const after = db.getTopics(KNOWN.unitId).length;
    assert.equal(after, before + 1);
  });
});

describe('updateTopic', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('updates topic name', () => {
    const t = db.createTopic({ unitId: KNOWN.unitId, name: 'Old Topic' });
    const result = db.updateTopic({ topicId: t.topicId, name: 'Renamed Topic' });
    assert.equal(result.topicName, 'Renamed Topic');
  });

  test('throws on unknown topicId', () => {
    assert.throws(() => db.updateTopic({ topicId: 'ghost', name: 'X' }), /not found/i);
  });
});

describe('deleteTopic', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('removes the topic', () => {
    const t = db.createTopic({ unitId: KNOWN.unitId, name: 'Temp Topic' });
    db.deleteTopic(t.topicId);
    const topics = db.getTopics(KNOWN.unitId);
    assert.ok(!topics.some((x) => x.topic_id === t.topicId));
  });

  test('throws on unknown topicId', () => {
    assert.throws(() => db.deleteTopic('nope'), /not found/i);
  });
});

// =========================================================================
// Flashcard queries
// =========================================================================

describe('getFlashcards', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('returns flashcards for known topic', () => {
    const cards = db.getFlashcards(KNOWN.topicId);
    assert.ok(Array.isArray(cards));
    assert.ok(cards.length > 0);
    assert.ok(typeof cards[0].flashcardId === 'string');
    assert.ok(typeof cards[0].frontHtml === 'string');
  });

  test('returns empty array for topic with no flashcards', () => {
    const t = db.createTopic({ unitId: KNOWN.unitId, name: 'Empty Topic' });
    const cards = db.getFlashcards(t.topicId);
    assert.deepEqual(cards, []);
  });

  test('throws on missing topicId', () => {
    assert.throws(() => db.getFlashcards(undefined), /topicId is required/i);
  });
});

// =========================================================================
// Item counts
// =========================================================================

describe('getItemCountsByTopic', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('returns counts for known topic', () => {
    const result = db.getItemCountsByTopic([KNOWN.topicId]);
    assert.equal(result.length, 1);
    assert.equal(result[0].topicId, KNOWN.topicId);
    assert.ok(result[0].questionCount >= 0);
    assert.ok(result[0].flashcardCount >= 0);
  });

  test('returns zeros for unknown topic', () => {
    const result = db.getItemCountsByTopic(['no-such-topic']);
    assert.equal(result[0].questionCount, 0);
    assert.equal(result[0].flashcardCount, 0);
  });

  test('throws on non-array input', () => {
    assert.throws(() => db.getItemCountsByTopic(null), /non-empty array/i);
  });
});

// =========================================================================
// Search
// =========================================================================

describe('searchItems', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('returns results for broad query', () => {
    const results = db.searchItems({ query: 'race' });
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
    assert.ok(results[0].id);
    assert.ok(results[0].contentType === 'question' || results[0].contentType === 'flashcard');
  });

  test('query too short throws', () => {
    assert.throws(() => db.searchItems({ query: 'x' }), /at least 2 characters/i);
  });

  test('scoped by topicId returns relevant items', () => {
    const results = db.searchItems({ query: 'race', topicId: KNOWN.topicId });
    assert.ok(Array.isArray(results));
    // All results must belong to the scoped topic
    for (const r of results) assert.equal(r.topicId, KNOWN.topicId);
  });

  test('type filter limits to questions', () => {
    const results = db.searchItems({ query: 'race', type: 'question' });
    for (const r of results) assert.equal(r.contentType, 'question');
  });

  test('type filter limits to flashcards', () => {
    const results = db.searchItems({ query: 'race', type: 'flashcard' });
    for (const r of results) assert.equal(r.contentType, 'flashcard');
  });

  test('LIKE injection characters are escaped safely', () => {
    // This should not throw — just return empty results (no crash)
    const results = db.searchItems({ query: '% injection' });
    assert.ok(Array.isArray(results));
  });
});

// =========================================================================
// Content mutations — delete
// =========================================================================

describe('deleteQuestion', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('removes question from DB', () => {
    const questions = db.getQuestions({ topicIds: [KNOWN.topicId] });
    assert.ok(questions.length > 0, 'need at least one question to delete');
    const victim = questions[0];
    const result = db.deleteQuestion(victim.questionId);
    assert.ok(result.ok);
    const after = db.getQuestions({ topicIds: [KNOWN.topicId] });
    assert.ok(!after.some((q) => q.questionId === victim.questionId));
  });

  test('throws on unknown questionId', () => {
    assert.throws(() => db.deleteQuestion('ghost-q'), /not found/i);
  });
});

describe('deleteFlashcard', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('removes flashcard from DB', () => {
    const cards = db.getFlashcards(KNOWN.topicId);
    assert.ok(cards.length > 0, 'need at least one flashcard to delete');
    const victim = cards[0];
    const result = db.deleteFlashcard(victim.flashcardId);
    assert.ok(result.ok);
    const after = db.getFlashcards(KNOWN.topicId);
    assert.ok(!after.some((f) => f.flashcardId === victim.flashcardId));
  });

  test('throws on unknown flashcardId', () => {
    assert.throws(() => db.deleteFlashcard('ghost-fc'), /not found/i);
  });
});

// =========================================================================
// Content mutations — duplicate
// =========================================================================

describe('duplicateQuestion', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('returns new question with different ID', () => {
    const result = db.duplicateQuestion(KNOWN.questionId);
    assert.ok(typeof result.questionId === 'string');
    assert.notEqual(result.questionId, KNOWN.questionId);
  });

  test('copy has same topicId', () => {
    const result = db.duplicateQuestion(KNOWN.questionId);
    assert.equal(result.topicId, KNOWN.topicId);
  });

  test('copy title contains "(copy)"', () => {
    const result = db.duplicateQuestion(KNOWN.questionId);
    assert.ok(result.title && result.title.includes('(copy)'));
  });

  test('copy appears in getQuestions', () => {
    const before = db.getQuestions({ topicIds: [KNOWN.topicId] });
    const copy = db.duplicateQuestion(KNOWN.questionId);
    const after = db.getQuestions({ topicIds: [KNOWN.topicId] });
    assert.equal(after.length, before.length + 1);
    assert.ok(after.some((q) => q.questionId === copy.questionId));
  });

  test('throws on unknown questionId', () => {
    assert.throws(() => db.duplicateQuestion('ghost-q'), /not found/i);
  });
});

describe('duplicateFlashcard', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('returns new flashcard with different ID', () => {
    const result = db.duplicateFlashcard(KNOWN.flashcardId);
    assert.ok(typeof result.flashcardId === 'string');
    assert.notEqual(result.flashcardId, KNOWN.flashcardId);
  });

  test('copy has same topicId', () => {
    const result = db.duplicateFlashcard(KNOWN.flashcardId);
    assert.equal(result.topicId, KNOWN.topicId);
  });

  test('copy appears in getFlashcards', () => {
    const before = db.getFlashcards(KNOWN.topicId);
    const copy = db.duplicateFlashcard(KNOWN.flashcardId);
    const after = db.getFlashcards(KNOWN.topicId);
    assert.equal(after.length, before.length + 1);
    assert.ok(after.some((f) => f.flashcardId === copy.flashcardId));
  });

  test('throws on unknown flashcardId', () => {
    assert.throws(() => db.duplicateFlashcard('ghost-fc'), /not found/i);
  });
});

// =========================================================================
// moveItems
// =========================================================================

describe('moveItems', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('moves a question to another topic', () => {
    // Create a fresh target topic
    const target = db.createTopic({ unitId: KNOWN.unitId, name: 'Move Target' });
    const questions = db.getQuestions({ topicIds: [KNOWN.topicId] });
    assert.ok(questions.length > 0, 'need at least one question');

    const victim = questions[0];
    const result = db.moveItems({
      itemIds: [victim.questionId],
      targetTopicId: target.topicId,
      contentType: 'question',
    });
    assert.ok(result.ok);
    assert.equal(result.movedCount, 1);

    const inTarget = db.getQuestions({ topicIds: [target.topicId] });
    assert.ok(inTarget.some((q) => q.questionId === victim.questionId));
  });

  test('moves a flashcard to another topic', () => {
    const target = db.createTopic({ unitId: KNOWN.unitId, name: 'FC Move Target' });
    const cards = db.getFlashcards(KNOWN.topicId);
    assert.ok(cards.length > 0, 'need at least one flashcard');

    const victim = cards[0];
    const result = db.moveItems({
      itemIds: [victim.flashcardId],
      targetTopicId: target.topicId,
      contentType: 'flashcard',
    });
    assert.ok(result.ok);
    assert.equal(result.movedCount, 1);

    const inTarget = db.getFlashcards(target.topicId);
    assert.ok(inTarget.some((f) => f.flashcardId === victim.flashcardId));
  });

  test('throws on invalid targetTopicId', () => {
    const questions = db.getQuestions({ topicIds: [KNOWN.topicId] });
    assert.throws(
      () => db.moveItems({ itemIds: [questions[0].questionId], targetTopicId: 'no-topic', contentType: 'question' }),
      /not found/i
    );
  });
});

// =========================================================================
// updateItemFlags
// =========================================================================

describe('updateItemFlags', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('sets is_bookmarked on a question', () => {
    const result = db.updateItemFlags({
      itemId: KNOWN.questionId,
      contentType: 'question',
      isBookmarked: true,
    });
    assert.ok(result.ok);

    const questions = db.getQuestions({ topicIds: [KNOWN.topicId] });
    const q = questions.find((x) => x.questionId === KNOWN.questionId);
    assert.ok(q.isBookmarked === true || q.isBookmarked === 1);
  });

  test('sets is_flagged on a flashcard', () => {
    const result = db.updateItemFlags({
      itemId: KNOWN.flashcardId,
      contentType: 'flashcard',
      isFlagged: true,
    });
    assert.ok(result.ok);

    const cards = db.getFlashcards(KNOWN.topicId);
    const f = cards.find((x) => x.flashcardId === KNOWN.flashcardId);
    assert.ok(f.isFlagged === true || f.isFlagged === 1);
  });

  test('throws on unknown itemId', () => {
    assert.throws(
      () => db.updateItemFlags({ itemId: 'ghost-item', contentType: 'question', isBookmarked: true }),
      /not found/i
    );
  });

  test('throws on invalid contentType', () => {
    assert.throws(
      () => db.updateItemFlags({ itemId: KNOWN.questionId, contentType: 'bad-type', isBookmarked: true }),
      /contentType/i
    );
  });
});

// =========================================================================
// Review history + stats dashboard data APIs
// =========================================================================

describe('session history and stats APIs', () => {
  before(openFreshDb);
  after(closeFreshDb);

  function isoDaysAgo(daysAgo) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString();
  }

  test('listSessionHistory returns newest-first rows with aggregate metrics', () => {
    const oldSession = {
      session: {
        sessionId: 'hist-old',
        sessionType: 'free_practice',
        timerMode: 'none',
        totalTimeSeconds: 95,
        shuffleQuestions: true,
        shuffleChoices: true,
        randomSampleSize: 10,
        filterPayload: { topicIds: [KNOWN.topicId] },
        createdAt: isoDaysAgo(2),
        startedAt: isoDaysAgo(2),
        completedAt: isoDaysAgo(2),
      },
      items: [
        {
          contentType: 'question',
          questionId: KNOWN.questionId,
          presentedOrder: 0,
          wasAnswered: true,
          submittedAt: isoDaysAgo(2),
          timeSpentSeconds: 20,
          responsePayload: { selectedChoiceIds: ['a'] },
          isCorrect: true,
          partialCredit: 1,
          wasRevealed: true,
          wasSkipped: false,
          wasBookmarkedDuringSession: false,
          wasFlaggedDuringSession: false,
          selfRating: null,
          result: 'correct',
        },
      ],
    };

    const newSession = {
      session: {
        sessionId: 'hist-new',
        sessionType: 'review_incorrect',
        timerMode: 'none',
        totalTimeSeconds: 120,
        shuffleQuestions: true,
        shuffleChoices: true,
        randomSampleSize: 5,
        filterPayload: { incorrectOnly: true },
        createdAt: isoDaysAgo(0),
        startedAt: isoDaysAgo(0),
        completedAt: isoDaysAgo(0),
      },
      items: [
        {
          contentType: 'question',
          questionId: KNOWN.questionId,
          presentedOrder: 0,
          wasAnswered: true,
          submittedAt: isoDaysAgo(0),
          timeSpentSeconds: 25,
          responsePayload: { selectedChoiceIds: ['x'] },
          isCorrect: false,
          partialCredit: 0,
          wasRevealed: true,
          wasSkipped: false,
          wasBookmarkedDuringSession: false,
          wasFlaggedDuringSession: false,
          selfRating: null,
          result: 'incorrect',
        },
      ],
    };

    db.saveSession({ operation: 'finalizeSession', updateAggregates: true, ...oldSession });
    db.saveSession({ operation: 'finalizeSession', updateAggregates: true, ...newSession });

    const rows = db.listSessionHistory({ limit: 5 });
    assert.ok(rows.length >= 2);
    assert.equal(rows[0].sessionId, 'hist-new');
    assert.equal(rows[1].sessionId, 'hist-old');
    assert.equal(rows[0].incorrectCount, 1);
    assert.equal(rows[1].correctCount, 1);
  });

  test('getSessionHistoryDetail returns detail for known session and null for missing', () => {
    const detail = db.getSessionHistoryDetail({ sessionId: 'hist-new' });
    assert.ok(detail);
    assert.equal(detail.sessionId, 'hist-new');
    assert.ok(Array.isArray(detail.contentBreakdown));
    assert.ok(Array.isArray(detail.questionTypeBreakdown));
    assert.ok(Array.isArray(detail.topicBreakdown));

    const missing = db.getSessionHistoryDetail({ sessionId: 'missing-session-id' });
    assert.equal(missing, null);
  });

  test('getStatsDashboardSummary returns streak, due, and answered metrics', () => {
    const summary = db.getStatsDashboardSummary();
    assert.ok(summary);
    assert.ok(summary.streak);
    assert.ok(typeof summary.streak.currentStreakDays === 'number');
    assert.ok(typeof summary.streak.longestStreakDays === 'number');
    assert.ok(summary.recentSessions);
    assert.ok(summary.answered);
    assert.ok(summary.due);
  });
});
