/**
 * Authoring DB tests — question/flashcard create+update validation and edit side effects.
 * Run: node --test tests/authoring-db.test.mjs
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
const Database = require('better-sqlite3');
const db = require(path.join(ROOT, 'db/index.js'));

const SCHEMA_PATH = path.join(ROOT, 'schema.sql');
const FIXTURE_PATH = path.join(ROOT, 'fixtures/sample-course-data.json');
const KNOWN_TOPIC_ID = 'topic-race-conditions';

let tmpDir = null;
let inspector = null;

function openFreshDb() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'classbank-authoring-test-'));
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

describe('question authoring APIs', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('createQuestion persists a valid single_best question', () => {
    const created = db.createQuestion({
      topicId: KNOWN_TOPIC_ID,
      questionType: 'single_best',
      title: 'Mutex basics',
      stem: '<p>Which primitive prevents race conditions?</p>',
      mainExplanationHtml: '<p>Mutual exclusion prevents concurrent writes.</p>',
      referenceText: 'OS lecture 3',
      difficulty: 2,
      choices: [
        { label: 'A', html: '<p>Mutex</p>', isCorrect: true },
        { label: 'B', html: '<p>Spin forever</p>', isCorrect: false },
      ],
    });

    assert.equal(created.questionType, 'single_best');
    assert.equal(created.choices.length, 2);
    assert.ok(created.questionId);

    const fetched = db.getQuestionById(created.questionId);
    assert.equal(fetched.title, 'Mutex basics');
    assert.equal(fetched.choices.filter((c) => c.isCorrect).length, 1);
  });

  test('createQuestion rejects invalid single_best answer configuration', () => {
    assert.throws(
      () => db.createQuestion({
        topicId: KNOWN_TOPIC_ID,
        questionType: 'single_best',
        stem: '<p>Pick one</p>',
        choices: [
          { html: '<p>A</p>', isCorrect: true },
          { html: '<p>B</p>', isCorrect: true },
        ],
      }),
      /exactly one correct choice/i
    );
  });

  test('updateQuestion writes revision snapshot and resets short-answer review state', () => {
    const created = db.createQuestion({
      topicId: KNOWN_TOPIC_ID,
      questionType: 'short_answer',
      stem: '<p>Define deadlock.</p>',
      modelAnswerHtml: '<p>Circular wait among resources.</p>',
      mainExplanationHtml: '<p>Deadlock requires Coffman conditions.</p>',
      difficulty: 3,
      choices: [],
    });

    inspector.prepare(`
      UPDATE questions
      SET times_seen = 4, times_correct = 3, times_incorrect = 1, last_result = 'correct',
          last_used_at = '2026-03-10T00:00:00.000Z', adaptive_review_state_json = '{"x":1}'
      WHERE id = ?
    `).run(created.questionId);

    inspector.prepare(`
      INSERT INTO review_snapshots (id, entity_type, entity_id, reviewed_at, result, state_payload_json)
      VALUES (?, 'question', ?, ?, 'correct', '{}')
    `).run('snap-question-1', created.questionId, '2026-03-10T00:00:00.000Z');

    const beforeSnapshots = inspector.prepare(`
      SELECT COUNT(*) AS count
      FROM revision_snapshots
      WHERE entity_type = 'question' AND entity_id = ?
    `).get(created.questionId).count;

    const updated = db.updateQuestion({
      questionId: created.questionId,
      topicId: KNOWN_TOPIC_ID,
      questionType: 'short_answer',
      stem: '<p>Define deadlock with example.</p>',
      modelAnswerHtml: '<p>Circular wait in resource graph.</p>',
      mainExplanationHtml: '<p>Includes mutual exclusion and hold-and-wait.</p>',
      difficulty: 4,
      choices: [],
    });

    assert.equal(updated.stem, '<p>Define deadlock with example.</p>');

    const afterSnapshots = inspector.prepare(`
      SELECT COUNT(*) AS count
      FROM revision_snapshots
      WHERE entity_type = 'question' AND entity_id = ?
    `).get(created.questionId).count;

    assert.equal(afterSnapshots, beforeSnapshots + 1);

    const questionRow = inspector.prepare(`
      SELECT times_seen, times_correct, times_incorrect, last_result, last_used_at, adaptive_review_state_json
      FROM questions
      WHERE id = ?
    `).get(created.questionId);

    assert.equal(questionRow.times_seen, 0);
    assert.equal(questionRow.times_correct, 0);
    assert.equal(questionRow.times_incorrect, 0);
    assert.equal(questionRow.last_result, null);
    assert.equal(questionRow.last_used_at, null);
    assert.equal(questionRow.adaptive_review_state_json, null);

    const remainingReviewSnapshots = inspector.prepare(`
      SELECT COUNT(*) AS count
      FROM review_snapshots
      WHERE entity_type = 'question' AND entity_id = ?
    `).get(created.questionId).count;

    assert.equal(remainingReviewSnapshots, 0);
  });
});

describe('flashcard authoring APIs', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('createFlashcard rejects empty front/back', () => {
    assert.throws(
      () => db.createFlashcard({
        topicId: KNOWN_TOPIC_ID,
        frontHtml: '   ',
        backHtml: '<p>Answer</p>',
      }),
      /frontHtml is required/i
    );

    assert.throws(
      () => db.createFlashcard({
        topicId: KNOWN_TOPIC_ID,
        frontHtml: '<p>Prompt</p>',
        backHtml: '',
      }),
      /backHtml is required/i
    );
  });

  test('updateFlashcard writes revision snapshot and resets SR fields', () => {
    const created = db.createFlashcard({
      topicId: KNOWN_TOPIC_ID,
      frontHtml: '<p>Front</p>',
      backHtml: '<p>Back</p>',
      referenceText: 'Initial ref',
    });

    inspector.prepare(`
      UPDATE flashcards
      SET sr_state_json = '{"interval":4}', due_at = '2026-03-12T00:00:00.000Z',
          last_reviewed_at = '2026-03-11T00:00:00.000Z', review_count = 7, lapse_count = 2
      WHERE id = ?
    `).run(created.flashcardId);

    inspector.prepare(`
      INSERT INTO review_snapshots (id, entity_type, entity_id, reviewed_at, result, self_rating, state_payload_json)
      VALUES (?, 'flashcard', ?, ?, 'correct', 'Good', '{}')
    `).run('snap-flashcard-1', created.flashcardId, '2026-03-11T00:00:00.000Z');

    const beforeSnapshots = inspector.prepare(`
      SELECT COUNT(*) AS count
      FROM revision_snapshots
      WHERE entity_type = 'flashcard' AND entity_id = ?
    `).get(created.flashcardId).count;

    const updated = db.updateFlashcard({
      flashcardId: created.flashcardId,
      topicId: KNOWN_TOPIC_ID,
      frontHtml: '<p>Updated front</p>',
      backHtml: '<p>Updated back</p>',
      referenceText: 'Updated ref',
    });

    assert.equal(updated.frontHtml, '<p>Updated front</p>');
    assert.equal(updated.backHtml, '<p>Updated back</p>');

    const afterSnapshots = inspector.prepare(`
      SELECT COUNT(*) AS count
      FROM revision_snapshots
      WHERE entity_type = 'flashcard' AND entity_id = ?
    `).get(created.flashcardId).count;

    assert.equal(afterSnapshots, beforeSnapshots + 1);

    const row = inspector.prepare(`
      SELECT sr_state_json, due_at, last_reviewed_at, review_count, lapse_count
      FROM flashcards
      WHERE id = ?
    `).get(created.flashcardId);

    assert.equal(row.sr_state_json, null);
    assert.equal(row.due_at, null);
    assert.equal(row.last_reviewed_at, null);
    assert.equal(row.review_count, 0);
    assert.equal(row.lapse_count, 0);

    const remainingReviewSnapshots = inspector.prepare(`
      SELECT COUNT(*) AS count
      FROM review_snapshots
      WHERE entity_type = 'flashcard' AND entity_id = ?
    `).get(created.flashcardId).count;

    assert.equal(remainingReviewSnapshots, 0);
  });
});
