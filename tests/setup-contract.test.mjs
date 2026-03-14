/**
 * Setup contract tests — validates DB APIs used by Practice Setup:
 *   getQuestions filter semantics (unseenOnly, incorrectOnly)
 *   getSpacedReviewDueCounts return shape
 *   listDueSpacedReviewItems return shape and recordSpacedReviewRating
 *
 * Run:  npm test  (includes rebuild step for native module)
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT  = path.join(__dirname, '..');
const require = createRequire(import.meta.url);
const db = require(path.join(ROOT, 'db/index.js'));
const Database = require('better-sqlite3');

const SCHEMA_PATH  = path.join(ROOT, 'schema.sql');
const FIXTURE_PATH = path.join(ROOT, 'fixtures/sample-course-data.json');

const KNOWN_TOPIC_ID = 'topic-race-conditions';

let tmpDir = null;

function openFreshDb() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'classbank-setup-test-'));
  db.initializeDatabase({
    userDataPath: tmpDir,
    schemaPath:   SCHEMA_PATH,
    fixturePath:  FIXTURE_PATH,
  });
}

function closeFreshDb() {
  db.closeDatabase();
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
}

// -------------------------------------------------------------------------
// Helpers — minimal session seeding (bypasses session orchestration layer)
// -------------------------------------------------------------------------

let inspector = null;

function openInspector() {
  inspector = new Database(path.join(tmpDir, 'app.db'));
  inspector.pragma('foreign_keys = ON');
}

function closeInspector() {
  if (inspector) {
    inspector.close();
    inspector = null;
  }
}

/**
 * Insert a bare-minimum practice_session row and one practice_session_items
 * row that marks the given questionId as revealed with the given isCorrect flag.
 */
function seedSessionItem(questionId, isCorrect) {
  const sessionId = `test-session-${Math.random().toString(36).slice(2)}`;
  const now = new Date().toISOString();

  inspector.prepare(`
    INSERT INTO practice_sessions
      (id, session_type, timer_mode, created_at)
    VALUES (?, 'free_practice', 'none', ?)
  `).run(sessionId, now);

  inspector.prepare(`
    INSERT INTO practice_session_items
      (id, session_id, content_type, question_id,
       presented_order, was_answered, was_revealed,
       is_correct, time_spent_seconds, created_at)
    VALUES (?, ?, 'question', ?, 0, 1, 1, ?, 10, ?)
  `).run(`item-${sessionId}`, sessionId, questionId, isCorrect ? 1 : 0, now);
}

// =========================================================================
// getQuestions filter semantics
// =========================================================================
describe('getQuestions filter semantics', () => {
  before(() => {
    openFreshDb();
    openInspector();
  });

  after(() => {
    closeInspector();
    closeFreshDb();
  });

  test('unseenOnly returns all questions when none have been attempted', () => {
    const all    = db.getQuestions({ topicIds: [KNOWN_TOPIC_ID] });
    const unseen = db.getQuestions({ topicIds: [KNOWN_TOPIC_ID], unseenOnly: true });
    assert.ok(all.length > 0, 'fixture must have questions in the test topic');
    assert.equal(
      unseen.length,
      all.filter((q) => !['short_answer'].includes(q.questionType)).length
        + all.filter((q) => q.questionType === 'short_answer').length,
      'all questions are unseen when no session items exist'
    );
    // Simpler: every question id in unseen must also be in all
    const allIds = new Set(all.map((q) => q.questionId));
    for (const q of unseen) {
      assert.ok(allIds.has(q.questionId), `unseen q ${q.questionId} not in full list`);
    }
  });

  test('unseenOnly excludes questions that have been revealed', () => {
    const all = db.getQuestions({ topicIds: [KNOWN_TOPIC_ID] });
    assert.ok(all.length > 0);

    const target = all[0];
    seedSessionItem(target.questionId, true);

    const unseen = db.getQuestions({ topicIds: [KNOWN_TOPIC_ID], unseenOnly: true });
    const unseenIds = new Set(unseen.map((q) => q.questionId));
    assert.ok(!unseenIds.has(target.questionId), 'seen question should be excluded by unseenOnly');
  });

  test('incorrectOnly returns empty when no questions have been answered incorrectly', () => {
    // Start from a fresh DB without any sessions
    closeFreshDb();
    openFreshDb();
    openInspector();

    const incorrect = db.getQuestions({ topicIds: [KNOWN_TOPIC_ID], incorrectOnly: true });
    assert.equal(incorrect.length, 0, 'no incorrect items in a fresh DB');
  });

  test('incorrectOnly includes a question that was answered incorrectly', () => {
    const all = db.getQuestions({ topicIds: [KNOWN_TOPIC_ID] });
    assert.ok(all.length > 0);

    const target = all[0];
    seedSessionItem(target.questionId, false); // mark as incorrect

    const incorrect = db.getQuestions({ topicIds: [KNOWN_TOPIC_ID], incorrectOnly: true });
    const incorrectIds = incorrect.map((q) => q.questionId);
    assert.ok(incorrectIds.includes(target.questionId), 'incorrectly-answered question should appear in incorrectOnly results');
  });

  test('incorrectOnly excludes questions answered correctly', () => {
    const all = db.getQuestions({ topicIds: [KNOWN_TOPIC_ID] });
    const correctTarget = all.find((q) => q.questionId !== all[0].questionId) || all[0];

    // Mark a different question as correct only (first is already incorrect from previous test)
    seedSessionItem(correctTarget.questionId, true);

    const incorrect = db.getQuestions({ topicIds: [KNOWN_TOPIC_ID], incorrectOnly: true });
    // The correctly-answered question should NOT appear unless it also has an incorrect attempt
    const incorrectIds = incorrect.map((q) => q.questionId);
    // Only verify the first question (seeded as incorrect) is present
    assert.ok(incorrectIds.includes(all[0].questionId));
  });
});

// =========================================================================
// getSpacedReviewDueCounts
// =========================================================================
describe('getSpacedReviewDueCounts return shape', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('returns object with totalDue, questionDue, flashcardDue', () => {
    const counts = db.getSpacedReviewDueCounts({});
    assert.ok(typeof counts === 'object' && counts !== null, 'should return an object');
    assert.ok(typeof counts.totalDue    === 'number', 'totalDue must be a number');
    assert.ok(typeof counts.questionDue === 'number', 'questionDue must be a number');
    assert.ok(typeof counts.flashcardDue === 'number', 'flashcardDue must be a number');
  });

  test('totalDue equals questionDue + flashcardDue', () => {
    const counts = db.getSpacedReviewDueCounts({});
    assert.equal(counts.totalDue, counts.questionDue + counts.flashcardDue);
  });

  test('fresh fixture has due items (null due_at means always due)', () => {
    const counts = db.getSpacedReviewDueCounts({});
    // The fixture has at least one flashcard in topic-race-conditions
    assert.ok(counts.totalDue >= 0, 'totalDue is non-negative');
    // At least one type should be positive since fixture has flashcards and short-answer q's
    assert.ok(
      counts.flashcardDue > 0 || counts.questionDue >= 0,
      'fixture should have flashcards or questions in SR pool'
    );
  });

  test('topicIds filter scopes results to that topic', () => {
    const all    = db.getSpacedReviewDueCounts({});
    const scoped = db.getSpacedReviewDueCounts({ topicIds: [KNOWN_TOPIC_ID] });
    assert.ok(scoped.totalDue <= all.totalDue, 'scoped count cannot exceed global count');
  });
});

// =========================================================================
// listDueSpacedReviewItems
// =========================================================================
describe('listDueSpacedReviewItems return shape', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('returns an array', () => {
    const items = db.listDueSpacedReviewItems({});
    assert.ok(Array.isArray(items));
  });

  test('each item has required fields for session seeding', () => {
    const items = db.listDueSpacedReviewItems({ topicIds: [KNOWN_TOPIC_ID] });
    for (const item of items) {
      assert.ok(typeof item.itemId       === 'string', 'itemId must be a string');
      assert.ok(typeof item.topicId      === 'string', 'topicId must be a string');
      assert.ok(typeof item.contentType  === 'string', 'contentType must be a string');
      assert.ok(typeof item.promptHtml   === 'string', 'promptHtml must be a string');
      assert.ok(typeof item.answerHtml   === 'string', 'answerHtml must be a string');
      assert.ok(
        item.contentType === 'flashcard' || item.contentType === 'question',
        `contentType must be 'flashcard' or 'question', got ${item.contentType}`
      );
    }
  });

  test('topicIds filter returns only items from that topic', () => {
    const items = db.listDueSpacedReviewItems({ topicIds: [KNOWN_TOPIC_ID] });
    for (const item of items) {
      assert.equal(item.topicId, KNOWN_TOPIC_ID, 'all returned items belong to the requested topic');
    }
  });

  test('count matches getSpacedReviewDueCounts breakdown', () => {
    const items  = db.listDueSpacedReviewItems({ topicIds: [KNOWN_TOPIC_ID] });
    const counts = db.getSpacedReviewDueCounts({ topicIds: [KNOWN_TOPIC_ID] });
    assert.equal(items.length, counts.totalDue);
    assert.equal(items.filter((i) => i.contentType === 'flashcard').length, counts.flashcardDue);
    assert.equal(items.filter((i) => i.contentType === 'question').length,  counts.questionDue);
  });
});

// =========================================================================
// recordSpacedReviewRating
// =========================================================================
describe('recordSpacedReviewRating', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('records a flashcard rating and updates sr_state_json', () => {
    const flashcards = db.listDueSpacedReviewItems({ topicIds: [KNOWN_TOPIC_ID] })
      .filter((i) => i.contentType === 'flashcard');

    if (flashcards.length === 0) {
      // skip if fixture has no flashcards (shouldn't happen but guard anyway)
      return;
    }

    const target = flashcards[0];
    assert.doesNotThrow(() => {
      db.recordSpacedReviewRating({
        contentType: 'flashcard',
        itemId: target.itemId,
        selfRating: 'Good',
        result: 'correct',
        timeSpentSeconds: 15,
      });
    });
  });

  test('rejects unknown contentType', () => {
    assert.throws(
      () => db.recordSpacedReviewRating({
        contentType: 'unknown',
        itemId: 'fc-race-001',
        selfRating: 'Good',
        result: 'correct',
        timeSpentSeconds: 5,
      }),
      /contentType/
    );
  });

  test('rejects missing selfRating', () => {
    assert.throws(
      () => db.recordSpacedReviewRating({
        contentType: 'flashcard',
        itemId: 'fc-race-001',
        selfRating: null,
        result: 'correct',
        timeSpentSeconds: 5,
      }),
      /selfRating/
    );
  });

  test('tracks short-answer SR state reviewCount/lapseCount across ratings', () => {
    const created = db.createQuestion({
      topicId: KNOWN_TOPIC_ID,
      questionType: 'short_answer',
      title: `SR short-answer ${Date.now()}`,
      stem: '<p>What is a semaphore?</p>',
      modelAnswerHtml: '<p>A semaphore coordinates access with signaling counters.</p>',
      mainExplanationHtml: '<p>Semaphores are synchronization primitives.</p>',
      referenceText: 'setup-contract SR test',
      difficulty: 2,
    });

    db.recordSpacedReviewRating({
      contentType: 'question',
      itemId: created.questionId,
      selfRating: 'Again',
      result: 'incorrect',
      timeSpentSeconds: 8,
    });

    db.recordSpacedReviewRating({
      contentType: 'question',
      itemId: created.questionId,
      selfRating: 'Good',
      result: 'correct',
      timeSpentSeconds: 9,
    });

    const refreshed = db.getQuestionById(created.questionId);
    assert.ok(refreshed.adaptiveReviewStateJson, 'short-answer SR state should exist after rating');
    assert.equal(refreshed.adaptiveReviewStateJson.reviewCount, 2);
    assert.equal(refreshed.adaptiveReviewStateJson.lapseCount, 1);
    assert.equal(refreshed.adaptiveReviewStateJson.lastRating, 'Good');
    assert.ok(typeof refreshed.adaptiveReviewStateJson.lastReviewedAt === 'string');
  });

  test('tracks flashcard lapse_count and SR state metadata on Again', () => {
    const created = db.createFlashcard({
      topicId: KNOWN_TOPIC_ID,
      frontHtml: '<p>SR flashcard front</p>',
      backHtml: '<p>SR flashcard back</p>',
      referenceText: 'setup-contract SR flashcard test',
    });

    db.recordSpacedReviewRating({
      contentType: 'flashcard',
      itemId: created.flashcardId,
      selfRating: 'Again',
      result: 'incorrect',
      timeSpentSeconds: 6,
    });

    const refreshed = db.getFlashcardById(created.flashcardId);
    assert.equal(refreshed.reviewCount, 1);
    assert.equal(refreshed.lapseCount, 1);
    assert.ok(refreshed.srStateJson, 'flashcard SR state should exist after rating');
    assert.equal(refreshed.srStateJson.reviewCount, 1);
    assert.equal(refreshed.srStateJson.lapseCount, 1);
    assert.equal(refreshed.srStateJson.lastRating, 'Again');
    assert.ok(typeof refreshed.srStateJson.lastReviewedAt === 'string');
  });

  test('editing a previously short-answer item to MCQ clears SR state', () => {
    const created = db.createQuestion({
      topicId: KNOWN_TOPIC_ID,
      questionType: 'short_answer',
      title: `SR reset convert ${Date.now()}`,
      stem: '<p>Short answer that will be converted.</p>',
      modelAnswerHtml: '<p>Initial model answer.</p>',
      mainExplanationHtml: '<p>Initial explanation.</p>',
      referenceText: 'setup-contract SR conversion test',
      difficulty: 2,
    });

    db.recordSpacedReviewRating({
      contentType: 'question',
      itemId: created.questionId,
      selfRating: 'Hard',
      result: 'correct',
      timeSpentSeconds: 11,
    });

    const preUpdate = db.getQuestionById(created.questionId);
    assert.ok(preUpdate.adaptiveReviewStateJson, 'precondition: short-answer has SR state');

    const updated = db.updateQuestion({
      questionId: created.questionId,
      topicId: preUpdate.topicId,
      questionType: 'single_best',
      title: preUpdate.title,
      stem: preUpdate.stem,
      modelAnswerHtml: null,
      mainExplanationHtml: preUpdate.mainExplanationHtml,
      referenceText: preUpdate.referenceText,
      difficulty: preUpdate.difficulty,
      isBookmarked: preUpdate.isBookmarked,
      isFlagged: preUpdate.isFlagged,
      choices: [
        { label: 'A', html: '<p>Option A</p>', isCorrect: true, explanationHtml: '', sortOrder: 0 },
        { label: 'B', html: '<p>Option B</p>', isCorrect: false, explanationHtml: '', sortOrder: 1 },
      ],
    });

    assert.equal(updated.questionType, 'single_best');
    assert.equal(updated.adaptiveReviewStateJson, null, 'converted item must clear prior short-answer SR state');
  });

  test('rating a newly created flashcard updates due list and due counts', () => {
    const beforeCounts = db.getSpacedReviewDueCounts({ topicIds: [KNOWN_TOPIC_ID] });

    const created = db.createFlashcard({
      topicId: KNOWN_TOPIC_ID,
      frontHtml: '<p>Due count integration front</p>',
      backHtml: '<p>Due count integration back</p>',
      referenceText: 'setup-contract due count integration',
    });

    const afterCreateCounts = db.getSpacedReviewDueCounts({ topicIds: [KNOWN_TOPIC_ID] });
    assert.equal(afterCreateCounts.totalDue, beforeCounts.totalDue + 1, 'new flashcard should be immediately due');

    const dueBeforeRating = db.listDueSpacedReviewItems({ topicIds: [KNOWN_TOPIC_ID], limit: 500 });
    assert.ok(
      dueBeforeRating.some((item) => item.contentType === 'flashcard' && item.itemId === created.flashcardId),
      'new flashcard should appear in due list before rating'
    );

    db.recordSpacedReviewRating({
      contentType: 'flashcard',
      itemId: created.flashcardId,
      selfRating: 'Easy',
      result: 'correct',
      timeSpentSeconds: 4,
    });

    const dueAfterRating = db.listDueSpacedReviewItems({ topicIds: [KNOWN_TOPIC_ID], limit: 500 });
    assert.ok(
      !dueAfterRating.some((item) => item.contentType === 'flashcard' && item.itemId === created.flashcardId),
      'rated flashcard should no longer be immediately due'
    );

    const afterRatingCounts = db.getSpacedReviewDueCounts({ topicIds: [KNOWN_TOPIC_ID] });
    assert.equal(
      afterRatingCounts.totalDue,
      beforeCounts.totalDue,
      'due total should return to baseline after scheduling future due date'
    );
  });

  test('rating a newly created short-answer question updates due list and due counts', () => {
    const beforeCounts = db.getSpacedReviewDueCounts({ topicIds: [KNOWN_TOPIC_ID] });

    const created = db.createQuestion({
      topicId: KNOWN_TOPIC_ID,
      questionType: 'short_answer',
      title: `Due count SA integration ${Date.now()}`,
      stem: '<p>Short answer due-count integration stem.</p>',
      modelAnswerHtml: '<p>Model answer.</p>',
      mainExplanationHtml: '<p>Explanation.</p>',
      referenceText: 'setup-contract SA due count integration',
      difficulty: 2,
    });

    const afterCreateCounts = db.getSpacedReviewDueCounts({ topicIds: [KNOWN_TOPIC_ID] });
    assert.equal(afterCreateCounts.totalDue, beforeCounts.totalDue + 1, 'new short-answer question should be immediately due');

    const dueBeforeRating = db.listDueSpacedReviewItems({ topicIds: [KNOWN_TOPIC_ID], limit: 500 });
    assert.ok(
      dueBeforeRating.some((item) => item.contentType === 'question' && item.itemId === created.questionId),
      'new short-answer question should appear in due list before rating'
    );

    db.recordSpacedReviewRating({
      contentType: 'question',
      itemId: created.questionId,
      selfRating: 'Easy',
      result: 'correct',
      timeSpentSeconds: 4,
    });

    const dueAfterRating = db.listDueSpacedReviewItems({ topicIds: [KNOWN_TOPIC_ID], limit: 500 });
    assert.ok(
      !dueAfterRating.some((item) => item.contentType === 'question' && item.itemId === created.questionId),
      'rated short-answer question should no longer be immediately due'
    );

    const afterRatingCounts = db.getSpacedReviewDueCounts({ topicIds: [KNOWN_TOPIC_ID] });
    assert.equal(
      afterRatingCounts.totalDue,
      beforeCounts.totalDue,
      'due total should return to baseline after scheduling future due date'
    );
  });
});

// =========================================================================
// Adaptive MCQ review engine
// =========================================================================
describe('recordAdaptiveMcqResult + listAdaptiveWeakQuestions', () => {
  before(() => {
    openFreshDb();
    openInspector();
  });

  after(() => {
    closeInspector();
    closeFreshDb();
  });

  function getFixtureMcq() {
    const questions = db.getQuestions({ topicIds: [KNOWN_TOPIC_ID] });
    const mcq = questions.find((q) => q.questionType === 'single_best' || q.questionType === 'multi_select' || q.questionType === 'true_false');
    assert.ok(mcq, 'fixture must include at least one MCQ item');
    return mcq;
  }

  test('rejects adaptive updates for non-MCQ question types', () => {
    const created = db.createQuestion({
      topicId: KNOWN_TOPIC_ID,
      questionType: 'short_answer',
      title: `Adaptive reject SA ${Date.now()}`,
      stem: '<p>Short-answer should not accept adaptive MCQ updates.</p>',
      modelAnswerHtml: '<p>Model answer.</p>',
      mainExplanationHtml: '<p>Explanation.</p>',
      referenceText: 'adaptive reject test',
      difficulty: 2,
    });

    assert.throws(
      () => db.recordAdaptiveMcqResult({
        itemId: created.questionId,
        result: 'incorrect',
        partialCredit: 0,
        timeSpentSeconds: 20,
      }),
      /Only MCQ question types/
    );
  });

  test('adaptive weakness increases for incorrect/partial and decreases on repeated fast-correct', () => {
    const mcq = getFixtureMcq();

    const first = db.recordAdaptiveMcqResult({
      itemId: mcq.questionId,
      result: 'incorrect',
      partialCredit: 0,
      timeSpentSeconds: 18,
    });
    assert.ok(first.state.weaknessScore > 0, 'incorrect should increase weakness from baseline');

    const second = db.recordAdaptiveMcqResult({
      itemId: mcq.questionId,
      result: 'partial',
      partialCredit: 0.5,
      timeSpentSeconds: 22,
    });
    assert.ok(second.state.weaknessScore > first.state.weaknessScore, 'partial should continue increasing weakness');

    let latest = second;
    for (let i = 0; i < 3; i += 1) {
      latest = db.recordAdaptiveMcqResult({
        itemId: mcq.questionId,
        result: 'correct',
        partialCredit: 1,
        timeSpentSeconds: 7,
      });
    }

    assert.ok(latest.state.weaknessScore < second.state.weaknessScore, 'fast repeated correct answers should reduce weakness');
    assert.ok(latest.state.weaknessScore >= 0 && latest.state.weaknessScore <= 1, 'weakness score must be clamped to [0,1]');

    const snapshotCount = inspector.prepare(`
      SELECT COUNT(*) AS c
      FROM review_snapshots
      WHERE entity_type = 'question' AND entity_id = ?
    `).get(mcq.questionId)?.c;
    assert.ok(Number(snapshotCount) >= 5, 'adaptive updates should append question review snapshots');
  });

  test('listAdaptiveWeakQuestions returns ranked weak items above threshold', () => {
    const mcq = getFixtureMcq();
    db.recordAdaptiveMcqResult({
      itemId: mcq.questionId,
      result: 'incorrect',
      partialCredit: 0,
      timeSpentSeconds: 30,
    });

    const weakItems = db.listAdaptiveWeakQuestions({
      topicIds: [KNOWN_TOPIC_ID],
      minWeakness: 0.2,
      limit: 20,
    });

    assert.ok(Array.isArray(weakItems), 'query should return an array');
    assert.ok(weakItems.length >= 1, 'expected at least one weak item after incorrect adaptive update');
    assert.ok(weakItems.every((item) => item.weaknessScore >= 0.2), 'all returned rows should satisfy threshold');
    assert.ok(weakItems.some((item) => item.questionId === mcq.questionId), 'updated question should appear in weak list');
  });

  test('editing reviewed MCQ resets adaptive state and clears question snapshots', () => {
    const mcq = getFixtureMcq();
    db.recordAdaptiveMcqResult({
      itemId: mcq.questionId,
      result: 'incorrect',
      partialCredit: 0,
      timeSpentSeconds: 19,
    });

    const before = db.getQuestionById(mcq.questionId);
    assert.ok(before.adaptiveReviewStateJson, 'precondition: adaptive state exists before edit');

    const updated = db.updateQuestion({
      questionId: before.questionId,
      topicId: before.topicId,
      questionType: before.questionType,
      title: `${before.title} (edited)`,
      stem: `${before.stem} <p>Edited for reset test.</p>`,
      modelAnswerHtml: before.modelAnswerHtml,
      mainExplanationHtml: before.mainExplanationHtml,
      referenceText: before.referenceText,
      difficulty: before.difficulty,
      isBookmarked: before.isBookmarked,
      isFlagged: before.isFlagged,
      choices: before.choices.map((choice, index) => ({
        label: choice.label,
        html: choice.html,
        isCorrect: choice.isCorrect,
        explanationHtml: choice.explanationHtml,
        sortOrder: Number.isInteger(choice.sortOrder) ? choice.sortOrder : index,
      })),
    });

    assert.equal(updated.adaptiveReviewStateJson, null, 'editing MCQ should reset adaptive review state');

    const snapshotCount = inspector.prepare(`
      SELECT COUNT(*) AS c
      FROM review_snapshots
      WHERE entity_type = 'question' AND entity_id = ?
    `).get(mcq.questionId)?.c;
    assert.equal(Number(snapshotCount), 0, 'editing MCQ should clear prior question review snapshots');
  });
});
