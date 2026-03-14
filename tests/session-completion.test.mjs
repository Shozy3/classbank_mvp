/**
 * Session completion contract tests — validates finalized-session semantics
 * used by the Practice Session summary and history surfaces.
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const require = createRequire(import.meta.url);
const db = require(path.join(ROOT, 'db/index.js'));
const Database = require('better-sqlite3');

const SCHEMA_PATH = path.join(ROOT, 'schema.sql');
const FIXTURE_PATH = path.join(ROOT, 'fixtures/sample-course-data.json');
const KNOWN_TOPIC_ID = 'topic-race-conditions';

let tmpDir = null;
let inspector = null;

function openFreshDb() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'classbank-session-completion-'));
  db.initializeDatabase({
    userDataPath: tmpDir,
    schemaPath: SCHEMA_PATH,
    fixturePath: FIXTURE_PATH,
  });
  inspector = new Database(path.join(tmpDir, 'app.db'));
  inspector.pragma('foreign_keys = ON');
}

function closeFreshDb() {
  if (inspector) {
    inspector.close();
    inspector = null;
  }
  db.closeDatabase();
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
}

function buildPayload({ sessionId, operation = 'saveProgress', items }) {
  return {
    operation,
    updateAggregates: operation === 'finalizeSession',
    session: {
      sessionId,
      sessionType: 'free_practice',
      timerMode: 'none',
      totalTimeSeconds: 215,
      shuffleQuestions: true,
      shuffleChoices: true,
      randomSampleSize: items.length,
      filterPayload: { topicIds: [KNOWN_TOPIC_ID] },
      createdAt: '2026-03-13T10:00:00.000Z',
      startedAt: '2026-03-13T10:00:00.000Z',
      completedAt: operation === 'finalizeSession' ? '2026-03-13T10:03:35.000Z' : null,
    },
    items: items.map((item, idx) => ({
      sessionItemId: `${sessionId}::question::${idx}`,
      contentType: 'question',
      questionId: item.questionId,
      presentedOrder: idx,
      wasAnswered: item.wasAnswered,
      submittedAt: item.submittedAt ?? '2026-03-13T10:01:00.000Z',
      timeSpentSeconds: item.timeSpentSeconds ?? 25,
      responsePayload: item.responsePayload ?? { selectedChoiceIds: [] },
      isCorrect: item.isCorrect,
      partialCredit: item.partialCredit,
      wasRevealed: item.wasRevealed,
      wasSkipped: item.wasSkipped,
      wasBookmarkedDuringSession: item.wasBookmarkedDuringSession ?? false,
      wasFlaggedDuringSession: item.wasFlaggedDuringSession ?? false,
      selfRating: item.selfRating ?? null,
      result: item.result,
    })),
  };
}

function getQuestionRow(questionId) {
  return inspector.prepare(`
    SELECT times_seen, times_correct, times_incorrect, last_result, last_used_at
    FROM questions
    WHERE id = ?
  `).get(questionId);
}

function getSessionRow(sessionId) {
  return inspector.prepare(`
    SELECT completed_at
    FROM practice_sessions
    WHERE id = ?
  `).get(sessionId);
}

function getFixtureQuestions() {
  const questions = db.getQuestions({ topicIds: [KNOWN_TOPIC_ID] });
  const single = questions.find((question) => question.questionType === 'single_best');
  const multi = questions.find((question) => question.questionType === 'multi_select');
  const short = questions.find((question) => question.questionType === 'short_answer');

  assert.ok(single, 'fixture must contain a single-best question');
  assert.ok(multi, 'fixture must contain a multi-select question');
  assert.ok(short, 'fixture must contain a short-answer question');

  return { single, multi, short };
}

describe('saveSession finalization semantics', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('saveProgress keeps session incomplete and does not update question aggregates', () => {
    const { single } = getFixtureQuestions();
    const before = getQuestionRow(single.questionId);

    const sessionId = `session-progress-${Date.now()}`;
    db.saveSession(buildPayload({
      sessionId,
      operation: 'saveProgress',
      items: [
        {
          questionId: single.questionId,
          wasAnswered: true,
          isCorrect: false,
          partialCredit: 0,
          wasRevealed: true,
          wasSkipped: false,
          result: 'incorrect',
        },
      ],
    }));

    const sessionRow = getSessionRow(sessionId);
    const after = getQuestionRow(single.questionId);

    assert.equal(sessionRow.completed_at, null, 'saveProgress should not mark the session complete');
    assert.equal(after.times_seen, before.times_seen, 'saveProgress should not increment times_seen');
    assert.equal(after.times_incorrect, before.times_incorrect, 'saveProgress should not increment times_incorrect');
    assert.equal(after.last_result, before.last_result, 'saveProgress should not overwrite question aggregate state');
  });

  test('finalizeSession stamps completed_at and updates question aggregates once', () => {
    const { single } = getFixtureQuestions();
    const before = getQuestionRow(single.questionId);

    const sessionId = `session-finalize-${Date.now()}`;
    db.saveSession(buildPayload({
      sessionId,
      operation: 'finalizeSession',
      items: [
        {
          questionId: single.questionId,
          wasAnswered: true,
          isCorrect: false,
          partialCredit: 0,
          wasRevealed: true,
          wasSkipped: false,
          result: 'incorrect',
        },
      ],
    }));

    const sessionRow = getSessionRow(sessionId);
    const after = getQuestionRow(single.questionId);

    assert.ok(sessionRow.completed_at, 'finalizeSession should stamp completed_at');
    assert.equal(after.times_seen, before.times_seen + 1, 'finalizeSession should increment times_seen');
    assert.equal(after.times_incorrect, before.times_incorrect + 1, 'finalizeSession should increment times_incorrect');
    assert.equal(after.last_result, 'incorrect', 'finalizeSession should update last_result');
    assert.ok(after.last_used_at, 'finalizeSession should update last_used_at');
  });
});

describe('session history summary payloads', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('listSessionHistory returns mixed outcome counts for a finalized session', () => {
    const { single, multi, short } = getFixtureQuestions();
    const sessionId = `session-history-${Date.now()}`;

    db.saveSession(buildPayload({
      sessionId,
      operation: 'finalizeSession',
      items: [
        {
          questionId: single.questionId,
          wasAnswered: true,
          isCorrect: true,
          partialCredit: 1,
          wasRevealed: true,
          wasSkipped: false,
          result: 'correct',
          responsePayload: { selectedChoiceIds: ['correct-choice'] },
        },
        {
          questionId: multi.questionId,
          wasAnswered: true,
          isCorrect: false,
          partialCredit: 0.5,
          wasRevealed: true,
          wasSkipped: false,
          result: 'partial',
          responsePayload: { selectedChoiceIds: ['partial-choice'] },
        },
        {
          questionId: short.questionId,
          wasAnswered: false,
          isCorrect: null,
          partialCredit: null,
          wasRevealed: false,
          wasSkipped: true,
          result: null,
          submittedAt: null,
          responsePayload: { shortAnswerText: '' },
        },
      ],
    }));

    const history = db.listSessionHistory({ limit: 10 });
    const entry = history.find((row) => row.sessionId === sessionId);

    assert.ok(entry, 'finalized session should appear in history');
    assert.equal(entry.itemCount, 3);
    assert.equal(entry.revealedCount, 2);
    assert.equal(entry.correctCount, 1);
    assert.equal(entry.partialCount, 1);
    assert.equal(entry.incorrectCount, 0);
    assert.equal(entry.skippedCount, 1);
    assert.equal(entry.scorePercent, 75, 'history score should weight partial answers at 0.5');
  });

  test('getSessionHistoryDetail exposes breakdowns needed by summary and history UIs', () => {
    const { single, multi } = getFixtureQuestions();
    const sessionId = `session-detail-${Date.now()}`;

    db.saveSession(buildPayload({
      sessionId,
      operation: 'finalizeSession',
      items: [
        {
          questionId: single.questionId,
          wasAnswered: true,
          isCorrect: false,
          partialCredit: 0,
          wasRevealed: true,
          wasSkipped: false,
          result: 'incorrect',
        },
        {
          questionId: multi.questionId,
          wasAnswered: true,
          isCorrect: false,
          partialCredit: 0.5,
          wasRevealed: true,
          wasSkipped: false,
          result: 'partial',
        },
      ],
    }));

    const detail = db.getSessionHistoryDetail({ sessionId });

    assert.ok(detail, 'detail payload should load for a finalized session');
    assert.equal(detail.itemCount, 2);
    assert.ok(Array.isArray(detail.contentBreakdown) && detail.contentBreakdown.length >= 1);
    assert.ok(Array.isArray(detail.questionTypeBreakdown) && detail.questionTypeBreakdown.length >= 1);
    assert.ok(Array.isArray(detail.topicBreakdown) && detail.topicBreakdown.length >= 1);

    const questionBreakdown = detail.contentBreakdown.find((entry) => entry.contentType === 'question');
    assert.ok(questionBreakdown, 'question content breakdown should be present');
    assert.equal(questionBreakdown.itemCount, 2);
    assert.equal(questionBreakdown.incorrectCount, 1);
    assert.equal(questionBreakdown.partialCount, 1);
  });
});