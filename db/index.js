const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

let db = null;

function resolveQuestionType(questionType) {
  const allowed = new Set(['single_best', 'multi_select', 'true_false', 'short_answer']);
  if (!allowed.has(questionType)) {
    throw new Error(`Unsupported question_type in fixture: ${questionType}`);
  }
  return questionType;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toBoolean(value) {
  return value === 1 || value === true;
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [];
}

function nowIso() {
  return new Date().toISOString();
}

const ADAPTIVE_MCQ_TYPES = new Set(['single_best', 'multi_select', 'true_false']);
const ADAPTIVE_WEAKNESS_MIN = 0;
const ADAPTIVE_WEAKNESS_MAX = 1;
const ADAPTIVE_DEFAULT_THRESHOLD = 0.45;

const ADAPTIVE_RULES = {
  incorrectPenalty: 0.24,
  partialPenalty: 0.14,
  slowCorrectPenalty: 0.06,
  fastCorrectRelief: 0.08,
  repeatedCorrectRelief: 0.03,
  slowSecondsThreshold: 75,
  fastSecondsThreshold: 25,
};

function normalizeOperation(value) {
  return value === 'finalizeSession' ? 'finalizeSession' : 'saveProgress';
}

function normalizeSessionType(value) {
  const allowed = new Set(['free_practice', 'timed_block', 'review_incorrect', 'spaced_review']);
  if (!allowed.has(value)) {
    throw new Error(`Invalid session_type: ${value}`);
  }
  return value;
}

function normalizeTimerMode(value) {
  const allowed = new Set(['none', 'per_block', 'per_question', 'both']);
  if (!allowed.has(value)) {
    throw new Error(`Invalid timer_mode: ${value}`);
  }
  return value;
}

function normalizeSelfRating(value) {
  if (value == null) return null;
  const allowed = new Set(['Again', 'Hard', 'Good', 'Easy']);
  if (!allowed.has(value)) {
    throw new Error(`Invalid self_rating: ${value}`);
  }
  return value;
}

function normalizeBoolean(value) {
  return value ? 1 : 0;
}

function normalizeInteger(value, fallback = null) {
  if (value == null) return fallback;
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  const rounded = Math.floor(next);
  return rounded < 0 ? 0 : rounded;
}

function normalizePartialCredit(value, result) {
  if (value == null) {
    if (result === 'correct') return 1;
    if (result === 'partial') return 0.5;
    if (result === 'incorrect') return 0;
    return null;
  }

  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 1) {
    throw new Error(`partial_credit must be between 0 and 1. Received: ${value}`);
  }
  return num;
}

function normalizeIsCorrect(value, result) {
  if (value == null) {
    if (result === 'correct') return 1;
    if (result === 'partial' || result === 'incorrect') return 0;
    return null;
  }
  return value ? 1 : 0;
}

function normalizeSessionPayload(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const session = source.session && typeof source.session === 'object' ? source.session : {};
  const items = Array.isArray(source.items) ? source.items : [];
  const operation = normalizeOperation(source.operation);

  if (!session.sessionId || typeof session.sessionId !== 'string') {
    throw new Error('session.sessionId is required.');
  }

  const normalizedSession = {
    sessionId: session.sessionId,
    sessionType: normalizeSessionType(session.sessionType || 'free_practice'),
    timerMode: normalizeTimerMode(session.timerMode || 'none'),
    totalTimeSeconds: normalizeInteger(session.totalTimeSeconds),
    shuffleQuestions: normalizeBoolean(session.shuffleQuestions ?? true),
    shuffleChoices: normalizeBoolean(session.shuffleChoices ?? true),
    randomSampleSize: normalizeInteger(session.randomSampleSize),
    filterPayloadJson: JSON.stringify(session.filterPayload ?? {}),
    createdAt: typeof session.createdAt === 'string' ? session.createdAt : nowIso(),
    startedAt: typeof session.startedAt === 'string' ? session.startedAt : nowIso(),
    completedAt: typeof session.completedAt === 'string' ? session.completedAt : null,
  };

  const normalizedItems = items.map((item, idx) => {
    const next = item && typeof item === 'object' ? item : {};
    const contentType = next.contentType === 'flashcard' ? 'flashcard' : 'question';
    const presentedOrder = Number.isInteger(next.presentedOrder)
      ? next.presentedOrder
      : Number.isInteger(next.order)
        ? next.order
        : idx;

    const questionId = contentType === 'question' ? String(next.questionId || '') : null;
    const flashcardId = contentType === 'flashcard' ? String(next.flashcardId || '') : null;

    if (contentType === 'question' && !questionId) {
      throw new Error(`items[${idx}] requires questionId for question content.`);
    }

    if (contentType === 'flashcard' && !flashcardId) {
      throw new Error(`items[${idx}] requires flashcardId for flashcard content.`);
    }

    const result = next.result ?? null;
    const normalizedResult = result === 'correct' || result === 'partial' || result === 'incorrect'
      ? result
      : null;

    const itemId = typeof next.sessionItemId === 'string' && next.sessionItemId.length > 0
      ? next.sessionItemId
      : `${normalizedSession.sessionId}::${contentType}::${presentedOrder}`;

    return {
      sessionItemId: itemId,
      contentType,
      questionId,
      flashcardId,
      presentedOrder,
      wasAnswered: normalizeBoolean(next.wasAnswered),
      submittedAt: typeof next.submittedAt === 'string' ? next.submittedAt : null,
      timeSpentSeconds: normalizeInteger(next.timeSpentSeconds, 0),
      responsePayloadJson: JSON.stringify(next.responsePayload ?? {}),
      isCorrect: normalizeIsCorrect(next.isCorrect, normalizedResult),
      partialCredit: normalizePartialCredit(next.partialCredit, normalizedResult),
      wasRevealed: normalizeBoolean(next.wasRevealed),
      wasSkipped: normalizeBoolean(next.wasSkipped),
      wasBookmarkedDuringSession: normalizeBoolean(next.wasBookmarkedDuringSession),
      wasFlaggedDuringSession: normalizeBoolean(next.wasFlaggedDuringSession),
      selfRating: normalizeSelfRating(next.selfRating ?? null),
      createdAt: typeof next.createdAt === 'string' ? next.createdAt : nowIso(),
      result: normalizedResult,
    };
  });

  return {
    operation,
    session: normalizedSession,
    items: normalizedItems,
    updateAggregates: Boolean(source.updateAggregates),
  };
}

function ensureDbOpen() {
  if (!db) {
    throw new Error('Database is not initialized.');
  }
  return db;
}

function seedFixtureData(fixturePath) {
  const conn = ensureDbOpen();
  const fixture = readJson(fixturePath);
  const courses = toArray(fixture.courses);

  const upsertCourse = conn.prepare(`
    INSERT INTO courses (id, name, code, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      code = excluded.code,
      updated_at = excluded.updated_at
  `);

  const upsertUnit = conn.prepare(`
    INSERT INTO units (id, course_id, name, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      course_id = excluded.course_id,
      name = excluded.name,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `);

  const upsertTopic = conn.prepare(`
    INSERT INTO topics (id, unit_id, name, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      unit_id = excluded.unit_id,
      name = excluded.name,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `);

  const upsertQuestion = conn.prepare(`
    INSERT INTO questions (
      id, topic_id, question_type, title, stem_rich_text, model_answer_rich_text,
      main_explanation_rich_text, reference_text, difficulty, is_bookmarked,
      is_flagged, times_seen, times_correct, times_incorrect, last_result,
      last_used_at, adaptive_review_state_json, created_at, updated_at, last_edited_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      topic_id = excluded.topic_id,
      question_type = excluded.question_type,
      title = excluded.title,
      stem_rich_text = excluded.stem_rich_text,
      model_answer_rich_text = excluded.model_answer_rich_text,
      main_explanation_rich_text = excluded.main_explanation_rich_text,
      reference_text = excluded.reference_text,
      difficulty = excluded.difficulty,
      is_bookmarked = excluded.is_bookmarked,
      is_flagged = excluded.is_flagged,
      updated_at = excluded.updated_at,
      last_edited_at = excluded.last_edited_at
  `);

  const deleteQuestionChoices = conn.prepare('DELETE FROM question_choices WHERE question_id = ?');

  const upsertChoice = conn.prepare(`
    INSERT INTO question_choices (
      id, question_id, label, choice_rich_text, is_correct, choice_explanation_rich_text, sort_order
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      question_id = excluded.question_id,
      label = excluded.label,
      choice_rich_text = excluded.choice_rich_text,
      is_correct = excluded.is_correct,
      choice_explanation_rich_text = excluded.choice_explanation_rich_text,
      sort_order = excluded.sort_order
  `);

  const upsertFlashcard = conn.prepare(`
    INSERT INTO flashcards (
      id, topic_id, front_rich_text, back_rich_text, reference_text, sr_state_json,
      due_at, last_reviewed_at, review_count, lapse_count, is_bookmarked,
      is_flagged, created_at, updated_at, last_edited_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      topic_id = excluded.topic_id,
      front_rich_text = excluded.front_rich_text,
      back_rich_text = excluded.back_rich_text,
      reference_text = excluded.reference_text,
      updated_at = excluded.updated_at,
      last_edited_at = excluded.last_edited_at,
      is_bookmarked = excluded.is_bookmarked,
      is_flagged = excluded.is_flagged
  `);

  const txn = conn.transaction(() => {
    for (const course of courses) {
      upsertCourse.run(
        course.course_id,
        course.course_name,
        course.course_code ?? null,
        course.created_at,
        course.updated_at
      );

      for (const unit of toArray(course.units)) {
        upsertUnit.run(
          unit.unit_id,
          course.course_id,
          unit.unit_name,
          unit.sort_order ?? 0,
          unit.created_at,
          unit.updated_at
        );

        for (const topic of toArray(unit.topics)) {
          upsertTopic.run(
            topic.topic_id,
            unit.unit_id,
            topic.topic_name,
            topic.sort_order ?? 0,
            topic.created_at,
            topic.updated_at
          );

          for (const question of toArray(topic.questions)) {
            upsertQuestion.run(
              question.question_id,
              topic.topic_id,
              resolveQuestionType(question.question_type),
              question.title ?? null,
              question.stem_rich_text,
              question.model_answer_rich_text ?? null,
              question.main_explanation_rich_text ?? null,
              question.reference_text ?? null,
              question.difficulty ?? null,
              question.is_bookmarked ? 1 : 0,
              question.is_flagged ? 1 : 0,
              question.times_seen ?? 0,
              question.times_correct ?? 0,
              question.times_incorrect ?? 0,
              question.last_result ?? null,
              question.last_used_at ?? null,
              question.adaptive_review_state_json
                ? JSON.stringify(question.adaptive_review_state_json)
                : null,
              question.created_at,
              question.updated_at,
              question.last_edited_at
            );

            deleteQuestionChoices.run(question.question_id);
            for (const choice of toArray(question.choices)) {
              upsertChoice.run(
                choice.choice_id,
                question.question_id,
                choice.label ?? null,
                choice.choice_rich_text,
                choice.is_correct ? 1 : 0,
                choice.choice_explanation_rich_text ?? null,
                choice.sort_order ?? 0
              );
            }
          }

          for (const flashcard of toArray(topic.flashcards)) {
            upsertFlashcard.run(
              flashcard.flashcard_id,
              topic.topic_id,
              flashcard.front_rich_text,
              flashcard.back_rich_text,
              flashcard.reference_text ?? null,
              flashcard.sr_state_json ? JSON.stringify(flashcard.sr_state_json) : null,
              flashcard.due_at ?? null,
              flashcard.last_reviewed_at ?? null,
              flashcard.review_count ?? 0,
              flashcard.lapse_count ?? 0,
              flashcard.is_bookmarked ? 1 : 0,
              flashcard.is_flagged ? 1 : 0,
              flashcard.created_at,
              flashcard.updated_at,
              flashcard.last_edited_at
            );
          }
        }
      }
    }
  });

  txn();
}

function initializeDatabase({ userDataPath, schemaPath, fixturePath }) {
  if (db) return db;

  const dbPath = path.join(userDataPath, 'app.db');
  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  const courseCount = db.prepare('SELECT COUNT(*) AS count FROM courses').get();
  if ((courseCount?.count ?? 0) === 0) {
    seedFixtureData(fixturePath);
  }

  return db;
}

function closeDatabase() {
  if (!db) return;
  db.close();
  db = null;
}

function getCourses() {
  const conn = ensureDbOpen();
  return conn.prepare(`
    SELECT id AS course_id, name AS course_name, code AS course_code, created_at, updated_at
    FROM courses
    ORDER BY name COLLATE NOCASE ASC
  `).all();
}

function getUnits(courseId) {
  if (!courseId || typeof courseId !== 'string') {
    throw new Error('courseId is required for db:getUnits.');
  }

  const conn = ensureDbOpen();
  return conn.prepare(`
    SELECT id AS unit_id, course_id, name AS unit_name, sort_order, created_at, updated_at
    FROM units
    WHERE course_id = ?
    ORDER BY sort_order ASC, unit_name COLLATE NOCASE ASC
  `).all(courseId);
}

function getTopics(unitId) {
  if (!unitId || typeof unitId !== 'string') {
    throw new Error('unitId is required for db:getTopics.');
  }

  const conn = ensureDbOpen();
  return conn.prepare(`
    SELECT id AS topic_id, unit_id, name AS topic_name, sort_order, created_at, updated_at
    FROM topics
    WHERE unit_id = ?
    ORDER BY sort_order ASC, topic_name COLLATE NOCASE ASC
  `).all(unitId);
}

function normalizeFilters(input) {
  const filters = input && typeof input === 'object' ? input : {};

  return {
    topicIds: Array.isArray(filters.topicIds)
      ? filters.topicIds.filter((x) => typeof x === 'string' && x.length > 0)
      : [],
    questionTypes: Array.isArray(filters.questionTypes)
      ? filters.questionTypes.filter((x) => typeof x === 'string' && x.length > 0)
      : [],
    difficulties: Array.isArray(filters.difficulties)
      ? filters.difficulties
          .map((x) => Number(x))
          .filter((x) => Number.isInteger(x) && x >= 1 && x <= 5)
      : [],
    bookmarkedOnly: Boolean(filters.bookmarkedOnly),
    flaggedOnly: Boolean(filters.flaggedOnly),
    incorrectOnly: Boolean(filters.incorrectOnly),
    unseenOnly: Boolean(filters.unseenOnly),
    randomSample: Number.isInteger(filters.randomSample) && filters.randomSample > 0
      ? filters.randomSample
      : null,
  };
}

function buildQuestionRowsQuery(filters) {
  const where = [];
  const params = [];

  if (filters.topicIds.length > 0) {
    where.push(`q.topic_id IN (${filters.topicIds.map(() => '?').join(', ')})`);
    params.push(...filters.topicIds);
  }

  if (filters.questionTypes.length > 0) {
    where.push(`q.question_type IN (${filters.questionTypes.map(() => '?').join(', ')})`);
    params.push(...filters.questionTypes);
  }

  if (filters.difficulties.length > 0) {
    where.push(`q.difficulty IN (${filters.difficulties.map(() => '?').join(', ')})`);
    params.push(...filters.difficulties);
  }

  if (filters.bookmarkedOnly) {
    where.push('q.is_bookmarked = 1');
  }

  if (filters.flaggedOnly) {
    where.push('q.is_flagged = 1');
  }

  if (filters.incorrectOnly) {
    where.push(`EXISTS (
      SELECT 1
      FROM practice_session_items psi
      WHERE psi.content_type = 'question'
        AND psi.question_id = q.id
        AND psi.was_revealed = 1
        AND (
          psi.is_correct = 0
          OR (psi.partial_credit IS NOT NULL AND psi.partial_credit < 1)
        )
    )`);
  }

  if (filters.unseenOnly) {
    where.push(`NOT EXISTS (
      SELECT 1
      FROM practice_session_items psi
      WHERE psi.content_type = 'question'
        AND psi.question_id = q.id
        AND psi.was_revealed = 1
    )`);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const orderClause = filters.randomSample ? 'ORDER BY RANDOM()' : 'ORDER BY q.id ASC';
  const limitClause = filters.randomSample ? 'LIMIT ?' : '';

  const sql = `
    SELECT
      q.id,
      q.topic_id,
      q.question_type,
      q.title,
      q.stem_rich_text,
      q.model_answer_rich_text,
      q.main_explanation_rich_text,
      q.reference_text,
      q.difficulty,
      q.is_bookmarked,
      q.is_flagged,
      q.adaptive_review_state_json,
      q.created_at,
      q.updated_at,
      q.last_edited_at
    FROM questions q
    ${whereClause}
    ${orderClause}
    ${limitClause}
  `;

  if (filters.randomSample) {
    params.push(filters.randomSample);
  }

  return { sql, params };
}

function getQuestions(inputFilters) {
  const conn = ensureDbOpen();
  const filters = normalizeFilters(inputFilters);
  const { sql, params } = buildQuestionRowsQuery(filters);

  const questionRows = conn.prepare(sql).all(...params);
  if (questionRows.length === 0) {
    return [];
  }

  const questionIds = questionRows.map((row) => row.id);
  const choiceSql = `
    SELECT
      id,
      question_id,
      label,
      choice_rich_text,
      is_correct,
      choice_explanation_rich_text,
      sort_order
    FROM question_choices
    WHERE question_id IN (${questionIds.map(() => '?').join(', ')})
    ORDER BY question_id ASC, sort_order ASC, id ASC
  `;

  const choiceRows = conn.prepare(choiceSql).all(...questionIds);
  const choicesByQuestionId = new Map();

  for (const row of choiceRows) {
    const nextChoice = {
      choiceId: row.id,
      label: row.label,
      html: row.choice_rich_text,
      isCorrect: toBoolean(row.is_correct),
      explanationHtml: row.choice_explanation_rich_text || '',
      sortOrder: row.sort_order,
    };

    const existing = choicesByQuestionId.get(row.question_id) || [];
    existing.push(nextChoice);
    choicesByQuestionId.set(row.question_id, existing);
  }

  return questionRows.map((row) => ({
    questionId: row.id,
    topicId: row.topic_id,
    questionType: row.question_type,
    title: row.title,
    stem: row.stem_rich_text,
    modelAnswerHtml: row.model_answer_rich_text,
    mainExplanationHtml: row.main_explanation_rich_text || '',
    referenceText: row.reference_text || '',
    difficulty: row.difficulty,
    isBookmarked: toBoolean(row.is_bookmarked),
    isFlagged: toBoolean(row.is_flagged),
    adaptiveReviewStateJson: row.adaptive_review_state_json ? JSON.parse(row.adaptive_review_state_json) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastEditedAt: row.last_edited_at,
    choices: choicesByQuestionId.get(row.id) || [],
  }));
}

function normalizeDifficulty(value) {
  if (value == null || value === '') return null;
  const next = Number(value);
  if (!Number.isInteger(next) || next < 1 || next > 5) {
    throw new Error('difficulty must be an integer between 1 and 5.');
  }
  return next;
}

function normalizeQuestionType(value) {
  const allowed = new Set(['single_best', 'multi_select', 'true_false', 'short_answer']);
  if (!allowed.has(value)) {
    throw new Error(`Invalid questionType: ${value}`);
  }
  return value;
}

function ensureTopicExists(conn, topicId) {
  const row = conn.prepare('SELECT 1 FROM topics WHERE id = ?').get(topicId);
  if (!row) {
    throw new Error(`Topic not found: ${topicId}`);
  }
}

function normalizeChoicePayload(choice, index) {
  const source = choice && typeof choice === 'object' ? choice : {};
  const html = typeof source.html === 'string' ? source.html.trim() : '';
  if (!html) {
    throw new Error(`choices[${index}].html is required.`);
  }

  return {
    label: source.label == null ? null : String(source.label).trim(),
    html,
    isCorrect: Boolean(source.isCorrect),
    explanationHtml: source.explanationHtml == null ? '' : String(source.explanationHtml),
    sortOrder: Number.isInteger(source.sortOrder) ? source.sortOrder : index,
  };
}

function normalizeQuestionPayload(payload, { requireQuestionId }) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const questionId = source.questionId;
  if (requireQuestionId && (!questionId || typeof questionId !== 'string')) {
    throw new Error('questionId is required.');
  }

  if (!source.topicId || typeof source.topicId !== 'string') {
    throw new Error('topicId is required.');
  }

  const questionType = normalizeQuestionType(source.questionType);
  const stem = typeof source.stem === 'string' ? source.stem.trim() : '';
  if (!stem) {
    throw new Error('stem is required.');
  }

  const modelAnswerHtml = source.modelAnswerHtml == null ? null : String(source.modelAnswerHtml).trim();
  if (questionType === 'short_answer' && !modelAnswerHtml) {
    throw new Error('modelAnswerHtml is required for short_answer questions.');
  }

  const choices = Array.isArray(source.choices)
    ? source.choices.map((choice, index) => normalizeChoicePayload(choice, index))
    : [];

  if (questionType === 'single_best' || questionType === 'true_false') {
    if (choices.length < 2) {
      throw new Error(`${questionType} questions require at least two choices.`);
    }
    const correctCount = choices.filter((choice) => choice.isCorrect).length;
    if (correctCount !== 1) {
      throw new Error(`${questionType} questions require exactly one correct choice.`);
    }
  }

  if (questionType === 'multi_select') {
    if (choices.length < 2) {
      throw new Error('multi_select questions require at least two choices.');
    }
    const correctCount = choices.filter((choice) => choice.isCorrect).length;
    if (correctCount < 1) {
      throw new Error('multi_select questions require at least one correct choice.');
    }
  }

  if (questionType === 'short_answer' && choices.length > 0) {
    throw new Error('short_answer questions do not support choices.');
  }

  return {
    questionId,
    topicId: source.topicId,
    questionType,
    title: source.title == null ? null : String(source.title).trim(),
    stem,
    modelAnswerHtml,
    mainExplanationHtml: source.mainExplanationHtml == null ? '' : String(source.mainExplanationHtml),
    referenceText: source.referenceText == null ? '' : String(source.referenceText),
    difficulty: normalizeDifficulty(source.difficulty),
    isBookmarked: Boolean(source.isBookmarked),
    isFlagged: Boolean(source.isFlagged),
    choices,
  };
}

function normalizeFlashcardPayload(payload, { requireFlashcardId }) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const flashcardId = source.flashcardId;
  if (requireFlashcardId && (!flashcardId || typeof flashcardId !== 'string')) {
    throw new Error('flashcardId is required.');
  }

  if (!source.topicId || typeof source.topicId !== 'string') {
    throw new Error('topicId is required.');
  }

  const frontHtml = typeof source.frontHtml === 'string' ? source.frontHtml.trim() : '';
  const backHtml = typeof source.backHtml === 'string' ? source.backHtml.trim() : '';

  if (!frontHtml) {
    throw new Error('frontHtml is required.');
  }
  if (!backHtml) {
    throw new Error('backHtml is required.');
  }

  return {
    flashcardId,
    topicId: source.topicId,
    frontHtml,
    backHtml,
    referenceText: source.referenceText == null ? '' : String(source.referenceText),
    isBookmarked: Boolean(source.isBookmarked),
    isFlagged: Boolean(source.isFlagged),
  };
}

function choicesAreEquivalent(existingChoices, normalizedChoices) {
  if (!Array.isArray(existingChoices) || !Array.isArray(normalizedChoices)) {
    return false;
  }

  if (existingChoices.length !== normalizedChoices.length) {
    return false;
  }

  for (let i = 0; i < existingChoices.length; i += 1) {
    const existing = existingChoices[i];
    const next = normalizedChoices[i];
    if ((existing?.label ?? null) !== (next?.label ?? null)) return false;
    if ((existing?.html ?? '') !== (next?.html ?? '')) return false;
    if (Boolean(existing?.isCorrect) !== Boolean(next?.isCorrect)) return false;
    if ((existing?.explanationHtml ?? '') !== (next?.explanationHtml ?? '')) return false;
    if ((existing?.sortOrder ?? i) !== (next?.sortOrder ?? i)) return false;
  }

  return true;
}

function hasSubstantiveQuestionChanges(existing, normalized) {
  if (existing.topicId !== normalized.topicId) return true;
  if (existing.questionType !== normalized.questionType) return true;
  if ((existing.stem ?? '') !== (normalized.stem ?? '')) return true;
  if ((existing.modelAnswerHtml ?? null) !== (normalized.modelAnswerHtml ?? null)) return true;
  if ((existing.mainExplanationHtml ?? '') !== (normalized.mainExplanationHtml ?? '')) return true;
  if ((existing.referenceText ?? '') !== (normalized.referenceText ?? '')) return true;
  if (!choicesAreEquivalent(existing.choices, normalized.choices)) return true;
  return false;
}

function hasSubstantiveFlashcardChanges(existing, normalized) {
  if (existing.topicId !== normalized.topicId) return true;
  if ((existing.frontHtml ?? '') !== (normalized.frontHtml ?? '')) return true;
  if ((existing.backHtml ?? '') !== (normalized.backHtml ?? '')) return true;
  if ((existing.referenceText ?? '') !== (normalized.referenceText ?? '')) return true;
  return false;
}

function questionParticipatesInReviewState(questionType) {
  return questionType === 'short_answer' || ADAPTIVE_MCQ_TYPES.has(questionType);
}

function getQuestionById(questionId) {
  if (!questionId || typeof questionId !== 'string') {
    throw new Error('questionId is required.');
  }

  const conn = ensureDbOpen();
  const row = conn.prepare(`
    SELECT
      id,
      topic_id,
      question_type,
      title,
      stem_rich_text,
      model_answer_rich_text,
      main_explanation_rich_text,
      reference_text,
      difficulty,
      is_bookmarked,
      is_flagged,
      adaptive_review_state_json,
      created_at,
      updated_at,
      last_edited_at
    FROM questions
    WHERE id = ?
  `).get(questionId);

  if (!row) {
    throw new Error(`Question not found: ${questionId}`);
  }

  const choiceRows = conn.prepare(`
    SELECT
      id,
      label,
      choice_rich_text,
      is_correct,
      choice_explanation_rich_text,
      sort_order
    FROM question_choices
    WHERE question_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(questionId);

  return {
    questionId: row.id,
    topicId: row.topic_id,
    questionType: row.question_type,
    title: row.title,
    stem: row.stem_rich_text,
    modelAnswerHtml: row.model_answer_rich_text,
    mainExplanationHtml: row.main_explanation_rich_text || '',
    referenceText: row.reference_text || '',
    difficulty: row.difficulty,
    isBookmarked: toBoolean(row.is_bookmarked),
    isFlagged: toBoolean(row.is_flagged),
    adaptiveReviewStateJson: row.adaptive_review_state_json ? JSON.parse(row.adaptive_review_state_json) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastEditedAt: row.last_edited_at,
    choices: choiceRows.map((choice) => ({
      choiceId: choice.id,
      label: choice.label,
      html: choice.choice_rich_text,
      isCorrect: toBoolean(choice.is_correct),
      explanationHtml: choice.choice_explanation_rich_text || '',
      sortOrder: choice.sort_order,
    })),
  };
}

function getFlashcardById(flashcardId) {
  if (!flashcardId || typeof flashcardId !== 'string') {
    throw new Error('flashcardId is required.');
  }

  const conn = ensureDbOpen();
  const row = conn.prepare(`
    SELECT
      id,
      topic_id,
      front_rich_text,
      back_rich_text,
      reference_text,
      sr_state_json,
      due_at,
      last_reviewed_at,
      review_count,
      lapse_count,
      is_bookmarked,
      is_flagged,
      created_at,
      updated_at,
      last_edited_at
    FROM flashcards
    WHERE id = ?
  `).get(flashcardId);

  if (!row) {
    throw new Error(`Flashcard not found: ${flashcardId}`);
  }

  return {
    flashcardId: row.id,
    topicId: row.topic_id,
    frontHtml: row.front_rich_text,
    backHtml: row.back_rich_text,
    referenceText: row.reference_text || '',
    srStateJson: row.sr_state_json ? JSON.parse(row.sr_state_json) : null,
    dueAt: row.due_at,
    lastReviewedAt: row.last_reviewed_at,
    reviewCount: row.review_count,
    lapseCount: row.lapse_count,
    isBookmarked: toBoolean(row.is_bookmarked),
    isFlagged: toBoolean(row.is_flagged),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastEditedAt: row.last_edited_at,
  };
}

function writeRevisionSnapshot(conn, entityType, entityId, payload) {
  conn.prepare(`
    INSERT INTO revision_snapshots (id, entity_type, entity_id, snapshot_payload_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    entityType,
    entityId,
    JSON.stringify(payload),
    nowIso()
  );
}

function createQuestion(payload) {
  const conn = ensureDbOpen();
  const normalized = normalizeQuestionPayload(payload, { requireQuestionId: false });
  ensureTopicExists(conn, normalized.topicId);

  const questionId = crypto.randomUUID();
  const now = nowIso();

  const txn = conn.transaction(() => {
    conn.prepare(`
      INSERT INTO questions (
        id, topic_id, question_type, title, stem_rich_text, model_answer_rich_text,
        main_explanation_rich_text, reference_text, difficulty, is_bookmarked, is_flagged,
        times_seen, times_correct, times_incorrect, last_result, last_used_at,
        adaptive_review_state_json, created_at, updated_at, last_edited_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, NULL, NULL, NULL, ?, ?, ?)
    `).run(
      questionId,
      normalized.topicId,
      normalized.questionType,
      normalized.title,
      normalized.stem,
      normalized.modelAnswerHtml,
      normalized.mainExplanationHtml,
      normalized.referenceText,
      normalized.difficulty,
      normalized.isBookmarked ? 1 : 0,
      normalized.isFlagged ? 1 : 0,
      now,
      now,
      now
    );

    for (const choice of normalized.choices) {
      conn.prepare(`
        INSERT INTO question_choices (
          id, question_id, label, choice_rich_text, is_correct, choice_explanation_rich_text, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        questionId,
        choice.label,
        choice.html,
        choice.isCorrect ? 1 : 0,
        choice.explanationHtml,
        choice.sortOrder
      );
    }
  });

  txn();
  return getQuestionById(questionId);
}

function updateQuestion(payload) {
  const conn = ensureDbOpen();
  const normalized = normalizeQuestionPayload(payload, { requireQuestionId: true });
  ensureTopicExists(conn, normalized.topicId);

  const existing = getQuestionById(normalized.questionId);
  const now = nowIso();

  const txn = conn.transaction(() => {
    writeRevisionSnapshot(conn, 'question', normalized.questionId, existing);

    const choicesChanged = !choicesAreEquivalent(existing.choices, normalized.choices);
    const hasSubstantiveChanges = hasSubstantiveQuestionChanges(existing, normalized);
    const shouldResetQuestionReviewState =
      hasSubstantiveChanges
      && (
        questionParticipatesInReviewState(normalized.questionType)
        || questionParticipatesInReviewState(existing.questionType)
      );

    conn.prepare(`
      UPDATE questions
      SET
        topic_id = ?,
        question_type = ?,
        title = ?,
        stem_rich_text = ?,
        model_answer_rich_text = ?,
        main_explanation_rich_text = ?,
        reference_text = ?,
        difficulty = ?,
        is_bookmarked = ?,
        is_flagged = ?,
        adaptive_review_state_json = CASE
          WHEN ? = 1 THEN NULL
          ELSE adaptive_review_state_json
        END,
        times_seen = CASE
          WHEN ? = 1 THEN 0
          ELSE times_seen
        END,
        times_correct = CASE
          WHEN ? = 1 THEN 0
          ELSE times_correct
        END,
        times_incorrect = CASE
          WHEN ? = 1 THEN 0
          ELSE times_incorrect
        END,
        last_result = CASE
          WHEN ? = 1 THEN NULL
          ELSE last_result
        END,
        last_used_at = CASE
          WHEN ? = 1 THEN NULL
          ELSE last_used_at
        END,
        updated_at = ?,
        last_edited_at = ?
      WHERE id = ?
    `).run(
      normalized.topicId,
      normalized.questionType,
      normalized.title,
      normalized.stem,
      normalized.modelAnswerHtml,
      normalized.mainExplanationHtml,
      normalized.referenceText,
      normalized.difficulty,
      normalized.isBookmarked ? 1 : 0,
      normalized.isFlagged ? 1 : 0,
      shouldResetQuestionReviewState ? 1 : 0,
      shouldResetQuestionReviewState ? 1 : 0,
      shouldResetQuestionReviewState ? 1 : 0,
      shouldResetQuestionReviewState ? 1 : 0,
      shouldResetQuestionReviewState ? 1 : 0,
      shouldResetQuestionReviewState ? 1 : 0,
      now,
      now,
      normalized.questionId
    );

    if (choicesChanged) {
      conn.prepare('DELETE FROM question_choices WHERE question_id = ?').run(normalized.questionId);

      for (const choice of normalized.choices) {
        conn.prepare(`
          INSERT INTO question_choices (
            id, question_id, label, choice_rich_text, is_correct, choice_explanation_rich_text, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          normalized.questionId,
          choice.label,
          choice.html,
          choice.isCorrect ? 1 : 0,
          choice.explanationHtml,
          choice.sortOrder
        );
      }
    }

    if (shouldResetQuestionReviewState) {
      conn.prepare(`
        DELETE FROM review_snapshots
        WHERE entity_type = 'question' AND entity_id = ?
      `).run(normalized.questionId);
    }
  });

  txn();
  return getQuestionById(normalized.questionId);
}

function createFlashcard(payload) {
  const conn = ensureDbOpen();
  const normalized = normalizeFlashcardPayload(payload, { requireFlashcardId: false });
  ensureTopicExists(conn, normalized.topicId);

  const flashcardId = crypto.randomUUID();
  const now = nowIso();

  conn.prepare(`
    INSERT INTO flashcards (
      id, topic_id, front_rich_text, back_rich_text, reference_text,
      sr_state_json, due_at, last_reviewed_at, review_count, lapse_count,
      is_bookmarked, is_flagged, created_at, updated_at, last_edited_at
    ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 0, ?, ?, ?, ?, ?)
  `).run(
    flashcardId,
    normalized.topicId,
    normalized.frontHtml,
    normalized.backHtml,
    normalized.referenceText,
    normalized.isBookmarked ? 1 : 0,
    normalized.isFlagged ? 1 : 0,
    now,
    now,
    now
  );

  return getFlashcardById(flashcardId);
}

function updateFlashcard(payload) {
  const conn = ensureDbOpen();
  const normalized = normalizeFlashcardPayload(payload, { requireFlashcardId: true });
  ensureTopicExists(conn, normalized.topicId);

  const existing = getFlashcardById(normalized.flashcardId);
  const now = nowIso();

  const txn = conn.transaction(() => {
    writeRevisionSnapshot(conn, 'flashcard', normalized.flashcardId, existing);

    const shouldResetFlashcardReviewState = hasSubstantiveFlashcardChanges(existing, normalized);

    conn.prepare(`
      UPDATE flashcards
      SET
        topic_id = ?,
        front_rich_text = ?,
        back_rich_text = ?,
        reference_text = ?,
        sr_state_json = CASE
          WHEN ? = 1 THEN NULL
          ELSE sr_state_json
        END,
        due_at = CASE
          WHEN ? = 1 THEN NULL
          ELSE due_at
        END,
        last_reviewed_at = CASE
          WHEN ? = 1 THEN NULL
          ELSE last_reviewed_at
        END,
        review_count = CASE
          WHEN ? = 1 THEN 0
          ELSE review_count
        END,
        lapse_count = CASE
          WHEN ? = 1 THEN 0
          ELSE lapse_count
        END,
        is_bookmarked = ?,
        is_flagged = ?,
        updated_at = ?,
        last_edited_at = ?
      WHERE id = ?
    `).run(
      normalized.topicId,
      normalized.frontHtml,
      normalized.backHtml,
      normalized.referenceText,
      shouldResetFlashcardReviewState ? 1 : 0,
      shouldResetFlashcardReviewState ? 1 : 0,
      shouldResetFlashcardReviewState ? 1 : 0,
      shouldResetFlashcardReviewState ? 1 : 0,
      shouldResetFlashcardReviewState ? 1 : 0,
      normalized.isBookmarked ? 1 : 0,
      normalized.isFlagged ? 1 : 0,
      now,
      now,
      normalized.flashcardId
    );

    if (shouldResetFlashcardReviewState) {
      conn.prepare(`
        DELETE FROM review_snapshots
        WHERE entity_type = 'flashcard' AND entity_id = ?
      `).run(normalized.flashcardId);
    }
  });

  txn();
  return getFlashcardById(normalized.flashcardId);
}

function saveSession(payload) {
  const conn = ensureDbOpen();
  const normalized = normalizeSessionPayload(payload);

  const upsertSessionStmt = conn.prepare(`
    INSERT INTO practice_sessions (
      id, session_type, timer_mode, total_time_seconds,
      shuffle_questions, shuffle_choices, random_sample_size,
      filter_payload_json, created_at, started_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      session_type = excluded.session_type,
      timer_mode = excluded.timer_mode,
      total_time_seconds = excluded.total_time_seconds,
      shuffle_questions = excluded.shuffle_questions,
      shuffle_choices = excluded.shuffle_choices,
      random_sample_size = excluded.random_sample_size,
      filter_payload_json = excluded.filter_payload_json,
      started_at = COALESCE(practice_sessions.started_at, excluded.started_at),
      completed_at = COALESCE(excluded.completed_at, practice_sessions.completed_at)
  `);

  const upsertItemStmt = conn.prepare(`
    INSERT INTO practice_session_items (
      id, session_id, content_type, question_id, flashcard_id,
      presented_order, was_answered, submitted_at, time_spent_seconds,
      response_payload_json, is_correct, partial_credit, was_revealed,
      was_skipped, was_bookmarked_during_session, was_flagged_during_session,
      self_rating, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      was_answered = excluded.was_answered,
      submitted_at = excluded.submitted_at,
      time_spent_seconds = excluded.time_spent_seconds,
      response_payload_json = excluded.response_payload_json,
      is_correct = excluded.is_correct,
      partial_credit = excluded.partial_credit,
      was_revealed = excluded.was_revealed,
      was_skipped = excluded.was_skipped,
      was_bookmarked_during_session = excluded.was_bookmarked_during_session,
      was_flagged_during_session = excluded.was_flagged_during_session,
      self_rating = excluded.self_rating
  `);

  const updateAggregatesStmt = conn.prepare(`
    UPDATE questions
    SET
      times_seen = times_seen + 1,
      times_correct = times_correct + CASE
        WHEN psi.is_correct = 1 THEN 1
        ELSE 0
      END,
      times_incorrect = times_incorrect + CASE
        WHEN psi.is_correct = 0 AND (psi.partial_credit IS NULL OR psi.partial_credit = 0) THEN 1
        ELSE 0
      END,
      last_result = CASE
        WHEN psi.is_correct = 1 THEN 'correct'
        WHEN psi.partial_credit > 0 AND psi.partial_credit < 1 THEN 'partial'
        WHEN psi.was_answered = 0 THEN 'unanswered'
        ELSE 'incorrect'
      END,
      last_used_at = COALESCE(psi.submitted_at, ?)
    FROM practice_session_items psi
    WHERE psi.session_id = ?
      AND psi.content_type = 'question'
      AND psi.question_id = questions.id
      AND psi.was_revealed = 1
  `);

  const txn = conn.transaction(() => {
    upsertSessionStmt.run(
      normalized.session.sessionId,
      normalized.session.sessionType,
      normalized.session.timerMode,
      normalized.session.totalTimeSeconds,
      normalized.session.shuffleQuestions,
      normalized.session.shuffleChoices,
      normalized.session.randomSampleSize,
      normalized.session.filterPayloadJson,
      normalized.session.createdAt,
      normalized.session.startedAt,
      normalized.operation === 'finalizeSession'
        ? (normalized.session.completedAt || nowIso())
        : normalized.session.completedAt
    );

    for (const item of normalized.items) {
      upsertItemStmt.run(
        item.sessionItemId,
        normalized.session.sessionId,
        item.contentType,
        item.questionId,
        item.flashcardId,
        item.presentedOrder,
        item.wasAnswered,
        item.submittedAt,
        item.timeSpentSeconds,
        item.responsePayloadJson,
        item.isCorrect,
        item.partialCredit,
        item.wasRevealed,
        item.wasSkipped,
        item.wasBookmarkedDuringSession,
        item.wasFlaggedDuringSession,
        item.selfRating,
        item.createdAt
      );
    }

    if (normalized.operation === 'finalizeSession' && normalized.updateAggregates) {
      updateAggregatesStmt.run(nowIso(), normalized.session.sessionId);
    }
  });

  txn();

  return {
    ok: true,
    operation: normalized.operation,
    sessionId: normalized.session.sessionId,
    itemCount: normalized.items.length,
    aggregatesUpdated: normalized.operation === 'finalizeSession' && normalized.updateAggregates,
  };
}

function getQuestionReviewStats(questionId) {
  if (!questionId || typeof questionId !== 'string') {
    throw new Error('questionId is required for db:getQuestionReviewStats.');
  }

  const conn = ensureDbOpen();
  const row = conn.prepare(`
    SELECT
      COUNT(*) AS seen_count,
      SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
      SUM(CASE WHEN is_correct = 0 AND (partial_credit IS NULL OR partial_credit = 0) THEN 1 ELSE 0 END) AS incorrect_count,
      SUM(CASE WHEN partial_credit > 0 AND partial_credit < 1 THEN 1 ELSE 0 END) AS partial_count,
      MAX(COALESCE(submitted_at, created_at)) AS last_reviewed_at
    FROM practice_session_items
    WHERE content_type = 'question'
      AND question_id = ?
      AND was_revealed = 1
  `).get(questionId);

  return {
    questionId,
    seenCount: Number(row?.seen_count ?? 0),
    correctCount: Number(row?.correct_count ?? 0),
    incorrectCount: Number(row?.incorrect_count ?? 0),
    partialCount: Number(row?.partial_count ?? 0),
    lastReviewedAt: row?.last_reviewed_at || null,
  };
}

function normalizeSessionHistoryOptions(options) {
  const source = options && typeof options === 'object' ? options : {};
  const allowedSessionTypes = new Set(['free_practice', 'timed_block', 'review_incorrect', 'spaced_review']);

  const limitValue = Number(source.limit);
  const limit = Number.isInteger(limitValue) && limitValue > 0
    ? Math.min(limitValue, 200)
    : 60;

  const sessionTypes = Array.isArray(source.sessionTypes)
    ? source.sessionTypes
        .filter((value) => typeof value === 'string')
        .filter((value) => allowedSessionTypes.has(value))
    : [];

  return {
    limit,
    sessionTypes,
  };
}

function resolveDurationSeconds(row) {
  if (Number.isInteger(row?.total_time_seconds)) {
    return row.total_time_seconds;
  }

  const startedAtMs = Date.parse(row?.started_at || '');
  const completedAtMs = Date.parse(row?.completed_at || '');

  if (!Number.isFinite(startedAtMs) || !Number.isFinite(completedAtMs)) {
    return null;
  }

  const deltaMs = completedAtMs - startedAtMs;
  if (deltaMs < 0) {
    return null;
  }

  return Math.floor(deltaMs / 1000);
}

function parseFilterPayloadWithStatus(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') {
    return {
      filterPayload: null,
      hasCorruptFilterPayload: false,
    };
  }

  const parsed = parseJsonOrNull(rawValue);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      filterPayload: null,
      hasCorruptFilterPayload: true,
    };
  }

  return {
    filterPayload: parsed,
    hasCorruptFilterPayload: false,
  };
}

function buildSessionHistoryRow(row) {
  const revealedCount = Number(row?.revealed_count ?? 0);
  const correctCount = Number(row?.correct_count ?? 0);
  const partialCount = Number(row?.partial_count ?? 0);
  const incorrectCount = Number(row?.incorrect_count ?? 0);
  const scorePercent = revealedCount > 0
    ? Number((((correctCount + (partialCount * 0.5)) / revealedCount) * 100).toFixed(1))
    : null;

  const { filterPayload, hasCorruptFilterPayload } = parseFilterPayloadWithStatus(row?.filter_payload_json);

  return {
    sessionId: row.id,
    sessionType: row.session_type,
    timerMode: row.timer_mode,
    createdAt: row.created_at,
    startedAt: row.started_at || null,
    completedAt: row.completed_at || null,
    displayedAt: row.completed_at || row.started_at || row.created_at,
    totalTimeSeconds: row.total_time_seconds,
    durationSeconds: resolveDurationSeconds(row),
    randomSampleSize: row.random_sample_size,
    itemCount: Number(row?.item_count ?? 0),
    answeredCount: Number(row?.answered_count ?? 0),
    revealedCount,
    skippedCount: Number(row?.skipped_count ?? 0),
    correctCount,
    incorrectCount,
    partialCount,
    scorePercent,
    filterPayload,
    hasCorruptFilterPayload,
  };
}

function listSessionHistory(options) {
  const conn = ensureDbOpen();
  const normalized = normalizeSessionHistoryOptions(options);

  const where = [];
  const params = [];

  if (normalized.sessionTypes.length > 0) {
    where.push(`ps.session_type IN (${normalized.sessionTypes.map(() => '?').join(', ')})`);
    params.push(...normalized.sessionTypes);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const rows = conn.prepare(`
    SELECT
      ps.id,
      ps.session_type,
      ps.timer_mode,
      ps.total_time_seconds,
      ps.random_sample_size,
      ps.filter_payload_json,
      ps.created_at,
      ps.started_at,
      ps.completed_at,
      COALESCE(agg.item_count, 0) AS item_count,
      COALESCE(agg.answered_count, 0) AS answered_count,
      COALESCE(agg.revealed_count, 0) AS revealed_count,
      COALESCE(agg.skipped_count, 0) AS skipped_count,
      COALESCE(agg.correct_count, 0) AS correct_count,
      COALESCE(agg.incorrect_count, 0) AS incorrect_count,
      COALESCE(agg.partial_count, 0) AS partial_count
    FROM practice_sessions ps
    LEFT JOIN (
      SELECT
        session_id,
        COUNT(*) AS item_count,
        SUM(CASE WHEN was_answered = 1 THEN 1 ELSE 0 END) AS answered_count,
        SUM(CASE WHEN was_revealed = 1 THEN 1 ELSE 0 END) AS revealed_count,
        SUM(CASE WHEN was_skipped = 1 THEN 1 ELSE 0 END) AS skipped_count,
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
        SUM(CASE WHEN is_correct = 0 AND (partial_credit IS NULL OR partial_credit = 0) THEN 1 ELSE 0 END) AS incorrect_count,
        SUM(CASE WHEN partial_credit > 0 AND partial_credit < 1 THEN 1 ELSE 0 END) AS partial_count
      FROM practice_session_items
      GROUP BY session_id
    ) agg ON agg.session_id = ps.id
    ${whereClause}
    ORDER BY COALESCE(ps.completed_at, ps.started_at, ps.created_at) DESC, ps.id DESC
    LIMIT ?
  `).all(...params, normalized.limit);

  return rows.map((row) => buildSessionHistoryRow(row));
}

function getSessionHistoryDetail(payload) {
  const sessionId = typeof payload === 'string'
    ? payload
    : payload && typeof payload === 'object'
      ? payload.sessionId
      : null;

  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('sessionId is required for db:getSessionHistoryDetail.');
  }

  const conn = ensureDbOpen();

  const row = conn.prepare(`
    SELECT
      ps.id,
      ps.session_type,
      ps.timer_mode,
      ps.total_time_seconds,
      ps.random_sample_size,
      ps.filter_payload_json,
      ps.created_at,
      ps.started_at,
      ps.completed_at,
      COALESCE(agg.item_count, 0) AS item_count,
      COALESCE(agg.answered_count, 0) AS answered_count,
      COALESCE(agg.revealed_count, 0) AS revealed_count,
      COALESCE(agg.skipped_count, 0) AS skipped_count,
      COALESCE(agg.correct_count, 0) AS correct_count,
      COALESCE(agg.incorrect_count, 0) AS incorrect_count,
      COALESCE(agg.partial_count, 0) AS partial_count
    FROM practice_sessions ps
    LEFT JOIN (
      SELECT
        session_id,
        COUNT(*) AS item_count,
        SUM(CASE WHEN was_answered = 1 THEN 1 ELSE 0 END) AS answered_count,
        SUM(CASE WHEN was_revealed = 1 THEN 1 ELSE 0 END) AS revealed_count,
        SUM(CASE WHEN was_skipped = 1 THEN 1 ELSE 0 END) AS skipped_count,
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
        SUM(CASE WHEN is_correct = 0 AND (partial_credit IS NULL OR partial_credit = 0) THEN 1 ELSE 0 END) AS incorrect_count,
        SUM(CASE WHEN partial_credit > 0 AND partial_credit < 1 THEN 1 ELSE 0 END) AS partial_count
      FROM practice_session_items
      GROUP BY session_id
    ) agg ON agg.session_id = ps.id
    WHERE ps.id = ?
    LIMIT 1
  `).get(sessionId);

  if (!row) {
    return null;
  }

  const contentBreakdownRows = conn.prepare(`
    SELECT
      content_type,
      COUNT(*) AS item_count,
      SUM(CASE WHEN was_answered = 1 THEN 1 ELSE 0 END) AS answered_count,
      SUM(CASE WHEN was_revealed = 1 THEN 1 ELSE 0 END) AS revealed_count,
      SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
      SUM(CASE WHEN is_correct = 0 AND (partial_credit IS NULL OR partial_credit = 0) THEN 1 ELSE 0 END) AS incorrect_count,
      SUM(CASE WHEN partial_credit > 0 AND partial_credit < 1 THEN 1 ELSE 0 END) AS partial_count
    FROM practice_session_items
    WHERE session_id = ?
    GROUP BY content_type
  `).all(sessionId);

  const questionTypeBreakdownRows = conn.prepare(`
    SELECT
      q.question_type,
      COUNT(*) AS item_count,
      SUM(CASE WHEN psi.is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
      SUM(CASE WHEN psi.is_correct = 0 AND (psi.partial_credit IS NULL OR psi.partial_credit = 0) THEN 1 ELSE 0 END) AS incorrect_count,
      SUM(CASE WHEN psi.partial_credit > 0 AND psi.partial_credit < 1 THEN 1 ELSE 0 END) AS partial_count
    FROM practice_session_items psi
    JOIN questions q ON q.id = psi.question_id
    WHERE psi.session_id = ?
      AND psi.content_type = 'question'
    GROUP BY q.question_type
    ORDER BY item_count DESC, q.question_type ASC
  `).all(sessionId);

  const topicBreakdownRows = conn.prepare(`
    SELECT
      t.id AS topic_id,
      t.name AS topic_name,
      COUNT(*) AS item_count,
      SUM(CASE WHEN psi.is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
      SUM(CASE WHEN psi.is_correct = 0 AND (psi.partial_credit IS NULL OR psi.partial_credit = 0) THEN 1 ELSE 0 END) AS incorrect_count,
      SUM(CASE WHEN psi.partial_credit > 0 AND psi.partial_credit < 1 THEN 1 ELSE 0 END) AS partial_count
    FROM practice_session_items psi
    JOIN questions q ON q.id = psi.question_id
    JOIN topics t ON t.id = q.topic_id
    WHERE psi.session_id = ?
      AND psi.content_type = 'question'
    GROUP BY t.id, t.name
    ORDER BY item_count DESC, t.name COLLATE NOCASE ASC
  `).all(sessionId);

  const detail = buildSessionHistoryRow(row);

  return {
    ...detail,
    contentBreakdown: contentBreakdownRows.map((entry) => ({
      contentType: entry.content_type,
      itemCount: Number(entry.item_count ?? 0),
      answeredCount: Number(entry.answered_count ?? 0),
      revealedCount: Number(entry.revealed_count ?? 0),
      correctCount: Number(entry.correct_count ?? 0),
      incorrectCount: Number(entry.incorrect_count ?? 0),
      partialCount: Number(entry.partial_count ?? 0),
    })),
    questionTypeBreakdown: questionTypeBreakdownRows.map((entry) => ({
      questionType: entry.question_type,
      itemCount: Number(entry.item_count ?? 0),
      correctCount: Number(entry.correct_count ?? 0),
      incorrectCount: Number(entry.incorrect_count ?? 0),
      partialCount: Number(entry.partial_count ?? 0),
    })),
    topicBreakdown: topicBreakdownRows.map((entry) => ({
      topicId: entry.topic_id,
      topicName: entry.topic_name,
      itemCount: Number(entry.item_count ?? 0),
      correctCount: Number(entry.correct_count ?? 0),
      incorrectCount: Number(entry.incorrect_count ?? 0),
      partialCount: Number(entry.partial_count ?? 0),
    })),
  };
}

function toLocalDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(base, delta) {
  const next = new Date(base);
  next.setDate(next.getDate() + delta);
  return next;
}

function calculateStreaks(dayKeys) {
  if (!Array.isArray(dayKeys) || dayKeys.length === 0) {
    return {
      currentStreakDays: 0,
      longestStreakDays: 0,
      activeDays: 0,
      lastActiveDate: null,
    };
  }

  const uniqueDays = [...new Set(dayKeys)].filter((day) => typeof day === 'string' && day.length > 0);
  uniqueDays.sort((a, b) => Date.parse(a) - Date.parse(b));

  const daySet = new Set(uniqueDays);
  const todayKey = toLocalDateKey(new Date());
  let currentStreakDays = 0;

  if (todayKey && daySet.has(todayKey)) {
    let cursor = new Date(todayKey);
    while (daySet.has(toLocalDateKey(cursor))) {
      currentStreakDays += 1;
      cursor = addDays(cursor, -1);
    }
  }

  let longestStreakDays = 1;
  let running = 1;
  for (let i = 1; i < uniqueDays.length; i += 1) {
    const prev = new Date(uniqueDays[i - 1]);
    const curr = new Date(uniqueDays[i]);
    const deltaMs = curr.getTime() - prev.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (deltaMs === oneDayMs) {
      running += 1;
      if (running > longestStreakDays) {
        longestStreakDays = running;
      }
    } else {
      running = 1;
    }
  }

  return {
    currentStreakDays,
    longestStreakDays,
    activeDays: uniqueDays.length,
    lastActiveDate: uniqueDays[uniqueDays.length - 1] || null,
  };
}

function getStatsDashboardSummary() {
  const conn = ensureDbOpen();

  const dayRows = conn.prepare(`
    SELECT DISTINCT
      date(COALESCE(completed_at, started_at, created_at), 'localtime') AS activity_day
    FROM practice_sessions
    WHERE COALESCE(completed_at, started_at, created_at) IS NOT NULL
      AND date(COALESCE(completed_at, started_at, created_at), 'localtime') IS NOT NULL
    ORDER BY activity_day ASC
  `).all();

  const streaks = calculateStreaks(dayRows.map((row) => row.activity_day));

  const totals = conn.prepare(`
    SELECT
      COUNT(*) AS revealed_count,
      SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
      SUM(CASE WHEN is_correct = 0 AND (partial_credit IS NULL OR partial_credit = 0) THEN 1 ELSE 0 END) AS incorrect_count,
      SUM(CASE WHEN partial_credit > 0 AND partial_credit < 1 THEN 1 ELSE 0 END) AS partial_count
    FROM practice_session_items
    WHERE was_revealed = 1
  `).get();

  const recentSessions = conn.prepare(`
    SELECT
      COUNT(*) AS total_sessions,
      SUM(CASE WHEN datetime(COALESCE(completed_at, started_at, created_at)) >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS sessions_7d,
      SUM(CASE WHEN datetime(COALESCE(completed_at, started_at, created_at)) >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS sessions_30d
    FROM practice_sessions
  `).get();

  const weakTopicsFromSessions = conn.prepare(`
    SELECT
      t.id AS topic_id,
      t.name AS topic_name,
      SUM(CASE WHEN psi.was_revealed = 1 THEN 1 ELSE 0 END) AS revealed_count,
      SUM(CASE WHEN psi.is_correct = 0 AND (psi.partial_credit IS NULL OR psi.partial_credit = 0) THEN 1 ELSE 0 END) AS incorrect_count,
      SUM(CASE WHEN psi.partial_credit > 0 AND psi.partial_credit < 1 THEN 1 ELSE 0 END) AS partial_count
    FROM practice_session_items psi
    JOIN questions q ON q.id = psi.question_id
    JOIN topics t ON t.id = q.topic_id
    WHERE psi.content_type = 'question'
      AND psi.was_revealed = 1
    GROUP BY t.id, t.name
    HAVING revealed_count > 0
    ORDER BY (1.0 * (incorrect_count + (partial_count * 0.5)) / revealed_count) DESC,
      revealed_count DESC,
      t.name COLLATE NOCASE ASC
  `).all();

  const adaptiveWeakQuestions = listAdaptiveWeakQuestions({ limit: 500 });
  const weakTopicMap = new Map();

  for (const topic of weakTopicsFromSessions) {
    const revealedCount = Number(topic.revealed_count ?? 0);
    const incorrectCount = Number(topic.incorrect_count ?? 0);
    const partialCount = Number(topic.partial_count ?? 0);
    const sessionWeaknessPercent = revealedCount > 0
      ? Number((((incorrectCount + (partialCount * 0.5)) / revealedCount) * 100).toFixed(1))
      : 0;

    weakTopicMap.set(topic.topic_id, {
      topicId: topic.topic_id,
      topicName: topic.topic_name,
      revealedCount,
      incorrectCount,
      partialCount,
      weaknessPercent: sessionWeaknessPercent,
      adaptiveWeakQuestionCount: 0,
      adaptiveWeaknessPercent: 0,
      combinedWeaknessPercent: sessionWeaknessPercent,
    });
  }

  for (const question of adaptiveWeakQuestions) {
    const existing = weakTopicMap.get(question.topicId) || {
      topicId: question.topicId,
      topicName: question.topicName,
      revealedCount: 0,
      incorrectCount: 0,
      partialCount: 0,
      weaknessPercent: 0,
      adaptiveWeakQuestionCount: 0,
      adaptiveWeaknessPercent: 0,
      combinedWeaknessPercent: 0,
    };

    const nextAdaptiveCount = existing.adaptiveWeakQuestionCount + 1;
    const nextAdaptiveAvg = Number((((existing.adaptiveWeaknessPercent * existing.adaptiveWeakQuestionCount) + (question.weaknessScore * 100)) / nextAdaptiveCount).toFixed(1));

    existing.adaptiveWeakQuestionCount = nextAdaptiveCount;
    existing.adaptiveWeaknessPercent = nextAdaptiveAvg;
    existing.combinedWeaknessPercent = Number(Math.max(existing.weaknessPercent, nextAdaptiveAvg).toFixed(1));
    weakTopicMap.set(question.topicId, existing);
  }

  const weakTopics = [...weakTopicMap.values()]
    .sort((a, b) => {
      if (b.combinedWeaknessPercent !== a.combinedWeaknessPercent) {
        return b.combinedWeaknessPercent - a.combinedWeaknessPercent;
      }
      if (b.adaptiveWeakQuestionCount !== a.adaptiveWeakQuestionCount) {
        return b.adaptiveWeakQuestionCount - a.adaptiveWeakQuestionCount;
      }
      return a.topicName.localeCompare(b.topicName);
    })
    .slice(0, 3);

  const dueCounts = getSpacedReviewDueCounts();
  const revealedCount = Number(totals?.revealed_count ?? 0);
  const correctCount = Number(totals?.correct_count ?? 0);
  const partialCount = Number(totals?.partial_count ?? 0);
  const incorrectCount = Number(totals?.incorrect_count ?? 0);
  const weightedCorrect = correctCount + (partialCount * 0.5);

  return {
    generatedAt: nowIso(),
    streak: streaks,
    recentSessions: {
      totalSessions: Number(recentSessions?.total_sessions ?? 0),
      sessions7d: Number(recentSessions?.sessions_7d ?? 0),
      sessions30d: Number(recentSessions?.sessions_30d ?? 0),
    },
    answered: {
      totalRevealed: revealedCount,
      correctCount,
      incorrectCount,
      partialCount,
      weightedAccuracyPercent: revealedCount > 0
        ? Number(((weightedCorrect / revealedCount) * 100).toFixed(1))
        : null,
    },
    due: {
      totalDue: Number(dueCounts?.totalDue ?? 0),
      questionDue: Number(dueCounts?.questionDue ?? 0),
      flashcardDue: Number(dueCounts?.flashcardDue ?? 0),
    },
    weakTopics,
    adaptiveReview: {
      weakQuestionCount: adaptiveWeakQuestions.length,
      topQuestions: adaptiveWeakQuestions.slice(0, 5).map((q) => ({
        questionId: q.questionId,
        topicId: q.topicId,
        topicName: q.topicName,
        questionType: q.questionType,
        weaknessPercent: Number((q.weaknessScore * 100).toFixed(1)),
        lastResult: q.lastResult,
      })),
    },
  };
}

// =========================================================
// Hierarchy CRUD
// =========================================================

function createCourse({ name, code } = {}) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Course name is required.');
  }
  const conn = ensureDbOpen();
  const now = nowIso();
  const id = crypto.randomUUID();
  conn.prepare(`
    INSERT INTO courses (id, name, code, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name.trim(), code ? String(code).trim() : null, now, now);
  return { courseId: id, courseName: name.trim(), courseCode: code ? String(code).trim() : null, createdAt: now, updatedAt: now };
}

function updateCourse({ courseId, name, code } = {}) {
  if (!courseId || typeof courseId !== 'string') throw new Error('courseId is required.');
  if (!name || typeof name !== 'string' || name.trim().length === 0) throw new Error('Course name is required.');
  const conn = ensureDbOpen();
  const now = nowIso();
  const result = conn.prepare(
    'UPDATE courses SET name = ?, code = ?, updated_at = ? WHERE id = ?'
  ).run(name.trim(), code ? String(code).trim() : null, now, courseId);
  if (result.changes === 0) throw new Error(`Course not found: ${courseId}`);
  return { courseId, courseName: name.trim(), courseCode: code ? String(code).trim() : null, updatedAt: now };
}

function deleteCourse(courseId) {
  if (!courseId || typeof courseId !== 'string') throw new Error('courseId is required.');
  const conn = ensureDbOpen();
  const result = conn.prepare('DELETE FROM courses WHERE id = ?').run(courseId);
  if (result.changes === 0) throw new Error(`Course not found: ${courseId}`);
  return { ok: true, courseId };
}

function createUnit({ courseId, name } = {}) {
  if (!courseId || typeof courseId !== 'string') throw new Error('courseId is required.');
  if (!name || typeof name !== 'string' || name.trim().length === 0) throw new Error('Unit name is required.');
  const conn = ensureDbOpen();
  const now = nowIso();
  const id = crypto.randomUUID();
  const sortRow = conn.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM units WHERE course_id = ?').get(courseId);
  const sortOrder = sortRow ? sortRow.next : 1;
  conn.prepare(`
    INSERT INTO units (id, course_id, name, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, courseId, name.trim(), sortOrder, now, now);
  return { unitId: id, courseId, unitName: name.trim(), sortOrder, createdAt: now, updatedAt: now };
}

function updateUnit({ unitId, name } = {}) {
  if (!unitId || typeof unitId !== 'string') throw new Error('unitId is required.');
  if (!name || typeof name !== 'string' || name.trim().length === 0) throw new Error('Unit name is required.');
  const conn = ensureDbOpen();
  const now = nowIso();
  const result = conn.prepare('UPDATE units SET name = ?, updated_at = ? WHERE id = ?').run(name.trim(), now, unitId);
  if (result.changes === 0) throw new Error(`Unit not found: ${unitId}`);
  return { unitId, unitName: name.trim(), updatedAt: now };
}

function deleteUnit(unitId) {
  if (!unitId || typeof unitId !== 'string') throw new Error('unitId is required.');
  const conn = ensureDbOpen();
  const result = conn.prepare('DELETE FROM units WHERE id = ?').run(unitId);
  if (result.changes === 0) throw new Error(`Unit not found: ${unitId}`);
  return { ok: true, unitId };
}

function createTopic({ unitId, name } = {}) {
  if (!unitId || typeof unitId !== 'string') throw new Error('unitId is required.');
  if (!name || typeof name !== 'string' || name.trim().length === 0) throw new Error('Topic name is required.');
  const conn = ensureDbOpen();
  const now = nowIso();
  const id = crypto.randomUUID();
  const sortRow = conn.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM topics WHERE unit_id = ?').get(unitId);
  const sortOrder = sortRow ? sortRow.next : 1;
  conn.prepare(`
    INSERT INTO topics (id, unit_id, name, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, unitId, name.trim(), sortOrder, now, now);
  return { topicId: id, unitId, topicName: name.trim(), sortOrder, createdAt: now, updatedAt: now };
}

function updateTopic({ topicId, name } = {}) {
  if (!topicId || typeof topicId !== 'string') throw new Error('topicId is required.');
  if (!name || typeof name !== 'string' || name.trim().length === 0) throw new Error('Topic name is required.');
  const conn = ensureDbOpen();
  const now = nowIso();
  const result = conn.prepare('UPDATE topics SET name = ?, updated_at = ? WHERE id = ?').run(name.trim(), now, topicId);
  if (result.changes === 0) throw new Error(`Topic not found: ${topicId}`);
  return { topicId, topicName: name.trim(), updatedAt: now };
}

function deleteTopic(topicId) {
  if (!topicId || typeof topicId !== 'string') throw new Error('topicId is required.');
  const conn = ensureDbOpen();
  const result = conn.prepare('DELETE FROM topics WHERE id = ?').run(topicId);
  if (result.changes === 0) throw new Error(`Topic not found: ${topicId}`);
  return { ok: true, topicId };
}

// =========================================================
// Flashcard queries
// =========================================================

function getFlashcards(topicId) {
  if (!topicId || typeof topicId !== 'string') throw new Error('topicId is required.');
  const conn = ensureDbOpen();
  return conn.prepare(`
    SELECT id, topic_id, front_rich_text, back_rich_text, reference_text,
           is_bookmarked, is_flagged, review_count, lapse_count,
           due_at, last_reviewed_at, created_at, updated_at, last_edited_at
    FROM flashcards
    WHERE topic_id = ?
    ORDER BY id ASC
  `).all(topicId).map((row) => ({
    flashcardId: row.id,
    topicId: row.topic_id,
    frontHtml: row.front_rich_text,
    backHtml: row.back_rich_text,
    referenceText: row.reference_text || '',
    isBookmarked: toBoolean(row.is_bookmarked),
    isFlagged: toBoolean(row.is_flagged),
    reviewCount: row.review_count,
    lapseCount: row.lapse_count,
    dueAt: row.due_at || null,
    lastReviewedAt: row.last_reviewed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastEditedAt: row.last_edited_at,
  }));
}

function getItemCountsByTopic(topicIds) {
  if (!Array.isArray(topicIds) || topicIds.length === 0) {
    throw new Error('topicIds must be a non-empty array.');
  }
  const ids = topicIds.filter((x) => typeof x === 'string' && x.length > 0);
  if (ids.length === 0) return [];
  const conn = ensureDbOpen();
  const placeholders = ids.map(() => '?').join(', ');
  const rows = conn.prepare(`
    SELECT topic_id,
      SUM(CASE WHEN content_type = 'question' THEN 1 ELSE 0 END) AS question_count,
      SUM(CASE WHEN content_type = 'flashcard' THEN 1 ELSE 0 END) AS flashcard_count
    FROM (
      SELECT topic_id, 'question' AS content_type FROM questions WHERE topic_id IN (${placeholders})
      UNION ALL
      SELECT topic_id, 'flashcard' AS content_type FROM flashcards WHERE topic_id IN (${placeholders})
    )
    GROUP BY topic_id
  `).all(...ids, ...ids);
  const resultMap = new Map(rows.map((r) => [r.topic_id, { topicId: r.topic_id, questionCount: Number(r.question_count), flashcardCount: Number(r.flashcard_count) }]));
  return ids.map((id) => resultMap.get(id) || { topicId: id, questionCount: 0, flashcardCount: 0 });
}

function escapeLike(str) {
  return str.replace(/[%_\\]/g, '\\$&');
}

function searchItems({ query, topicId, unitId, courseId, type } = {}) {
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    throw new Error('query must be at least 2 characters.');
  }
  const conn = ensureDbOpen();
  const pattern = '%' + escapeLike(query.trim()) + '%';

  const buildScopeJoin = (table, alias) => {
    if (topicId) {
      return { join: '', where: `${alias}.topic_id = ?`, params: [topicId] };
    }
    if (unitId) {
      return {
        join: `JOIN topics t ON ${alias}.topic_id = t.id`,
        where: 't.unit_id = ?',
        params: [unitId],
      };
    }
    if (courseId) {
      return {
        join: `JOIN topics t ON ${alias}.topic_id = t.id JOIN units u ON t.unit_id = u.id`,
        where: 'u.course_id = ?',
        params: [courseId],
      };
    }
    return { join: '', where: null, params: [] };
  };

  const typeFilter = type && type !== 'all' ? type : null;

  const results = [];

  if (!typeFilter || typeFilter === 'question' || ['single_best', 'multi_select', 'true_false', 'short_answer'].includes(typeFilter)) {
    const scope = buildScopeJoin('questions', 'q');
    const whereClauses = [`(q.title LIKE ? ESCAPE '\\' OR q.stem_rich_text LIKE ? ESCAPE '\\')`];
    const params = [pattern, pattern];
    if (scope.where) whereClauses.push(scope.where);
    params.push(...scope.params);
    if (typeFilter && typeFilter !== 'question') {
      whereClauses.push('q.question_type = ?');
      params.push(typeFilter);
    }
    const sql = `
      SELECT 'question' AS content_type, q.id, q.title, q.stem_rich_text AS preview_text,
             q.question_type, q.difficulty, q.is_bookmarked, q.is_flagged, q.last_edited_at, q.topic_id
      FROM questions q
      ${scope.join}
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY q.last_edited_at DESC
      LIMIT 200
    `;
    results.push(...conn.prepare(sql).all(...params));
  }

  if (!typeFilter || typeFilter === 'flashcard') {
    const scope = buildScopeJoin('flashcards', 'f');
    const whereClauses = [`f.front_rich_text LIKE ? ESCAPE '\\'`];
    const params = [pattern];
    if (scope.where) whereClauses.push(scope.where);
    params.push(...scope.params);
    const sql = `
      SELECT 'flashcard' AS content_type, f.id, NULL AS title, f.front_rich_text AS preview_text,
             'flashcard' AS question_type, NULL AS difficulty, f.is_bookmarked, f.is_flagged,
             f.last_edited_at, f.topic_id
      FROM flashcards f
      ${scope.join}
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY f.last_edited_at DESC
      LIMIT 200
    `;
    results.push(...conn.prepare(sql).all(...params));
  }

  return results.map((r) => ({
    contentType: r.content_type,
    id: r.id,
    title: r.title || null,
    previewText: r.preview_text || '',
    questionType: r.question_type,
    difficulty: r.difficulty || null,
    isBookmarked: toBoolean(r.is_bookmarked),
    isFlagged: toBoolean(r.is_flagged),
    lastEditedAt: r.last_edited_at,
    topicId: r.topic_id,
  }));
}

// =========================================================
// Content mutations
// =========================================================

function deleteQuestion(questionId) {
  if (!questionId || typeof questionId !== 'string') throw new Error('questionId is required.');
  const conn = ensureDbOpen();
  const result = conn.prepare('DELETE FROM questions WHERE id = ?').run(questionId);
  if (result.changes === 0) throw new Error(`Question not found: ${questionId}`);
  return { ok: true, questionId };
}

function deleteFlashcard(flashcardId) {
  if (!flashcardId || typeof flashcardId !== 'string') throw new Error('flashcardId is required.');
  const conn = ensureDbOpen();
  const result = conn.prepare('DELETE FROM flashcards WHERE id = ?').run(flashcardId);
  if (result.changes === 0) throw new Error(`Flashcard not found: ${flashcardId}`);
  return { ok: true, flashcardId };
}

function duplicateQuestion(questionId) {
  if (!questionId || typeof questionId !== 'string') throw new Error('questionId is required.');
  const conn = ensureDbOpen();

  const original = conn.prepare(`
    SELECT id, topic_id, question_type, title, stem_rich_text, model_answer_rich_text,
           main_explanation_rich_text, reference_text, difficulty, is_bookmarked, is_flagged,
           created_at, updated_at, last_edited_at
    FROM questions WHERE id = ?
  `).get(questionId);
  if (!original) throw new Error(`Question not found: ${questionId}`);

  const choices = conn.prepare(`
    SELECT id, label, choice_rich_text, is_correct, choice_explanation_rich_text, sort_order
    FROM question_choices WHERE question_id = ? ORDER BY sort_order ASC
  `).all(questionId);

  const newId = crypto.randomUUID();
  const now = nowIso();
  const copyTitle = original.title ? `${original.title} (copy)` : 'Question (copy)';

  const txn = conn.transaction(() => {
    conn.prepare(`
      INSERT INTO questions (
        id, topic_id, question_type, title, stem_rich_text, model_answer_rich_text,
        main_explanation_rich_text, reference_text, difficulty, is_bookmarked, is_flagged,
        times_seen, times_correct, times_incorrect, last_result, last_used_at,
        adaptive_review_state_json, created_at, updated_at, last_edited_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, NULL, NULL, NULL, ?, ?, ?)
    `).run(
      newId, original.topic_id, original.question_type, copyTitle,
      original.stem_rich_text, original.model_answer_rich_text,
      original.main_explanation_rich_text, original.reference_text,
      original.difficulty, original.is_bookmarked, original.is_flagged,
      now, now, now
    );

    for (const choice of choices) {
      conn.prepare(`
        INSERT INTO question_choices (id, question_id, label, choice_rich_text, is_correct, choice_explanation_rich_text, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(), newId, choice.label, choice.choice_rich_text,
        choice.is_correct, choice.choice_explanation_rich_text, choice.sort_order
      );
    }
  });
  txn();

  const newChoices = conn.prepare(`
    SELECT id, label, choice_rich_text, is_correct, choice_explanation_rich_text, sort_order
    FROM question_choices WHERE question_id = ? ORDER BY sort_order ASC
  `).all(newId);

  return {
    questionId: newId,
    topicId: original.topic_id,
    questionType: original.question_type,
    title: copyTitle,
    stem: original.stem_rich_text,
    modelAnswerHtml: original.model_answer_rich_text,
    mainExplanationHtml: original.main_explanation_rich_text || '',
    referenceText: original.reference_text || '',
    difficulty: original.difficulty,
    isBookmarked: toBoolean(original.is_bookmarked),
    isFlagged: toBoolean(original.is_flagged),
    createdAt: now,
    updatedAt: now,
    lastEditedAt: now,
    choices: newChoices.map((c) => ({
      choiceId: c.id,
      label: c.label,
      html: c.choice_rich_text,
      isCorrect: toBoolean(c.is_correct),
      explanationHtml: c.choice_explanation_rich_text || '',
      sortOrder: c.sort_order,
    })),
  };
}

function duplicateFlashcard(flashcardId) {
  if (!flashcardId || typeof flashcardId !== 'string') throw new Error('flashcardId is required.');
  const conn = ensureDbOpen();

  const original = conn.prepare(`
    SELECT id, topic_id, front_rich_text, back_rich_text, reference_text,
           is_bookmarked, is_flagged, created_at, updated_at, last_edited_at
    FROM flashcards WHERE id = ?
  `).get(flashcardId);
  if (!original) throw new Error(`Flashcard not found: ${flashcardId}`);

  const newId = crypto.randomUUID();
  const now = nowIso();

  conn.prepare(`
    INSERT INTO flashcards (
      id, topic_id, front_rich_text, back_rich_text, reference_text,
      sr_state_json, due_at, last_reviewed_at, review_count, lapse_count,
      is_bookmarked, is_flagged, created_at, updated_at, last_edited_at
    ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 0, ?, ?, ?, ?, ?)
  `).run(
    newId, original.topic_id, original.front_rich_text, original.back_rich_text,
    original.reference_text, original.is_bookmarked, original.is_flagged,
    now, now, now
  );

  return {
    flashcardId: newId,
    topicId: original.topic_id,
    frontHtml: original.front_rich_text,
    backHtml: original.back_rich_text,
    referenceText: original.reference_text || '',
    isBookmarked: toBoolean(original.is_bookmarked),
    isFlagged: toBoolean(original.is_flagged),
    reviewCount: 0,
    lapseCount: 0,
    dueAt: null,
    lastReviewedAt: null,
    createdAt: now,
    updatedAt: now,
    lastEditedAt: now,
  };
}

function moveItems({ itemIds, targetTopicId, contentType } = {}) {
  if (!targetTopicId || typeof targetTopicId !== 'string') throw new Error('targetTopicId is required.');
  if (!Array.isArray(itemIds) || itemIds.length === 0) throw new Error('itemIds must be a non-empty array.');
  if (contentType !== 'question' && contentType !== 'flashcard') throw new Error('contentType must be "question" or "flashcard".');
  const ids = itemIds.filter((x) => typeof x === 'string' && x.length > 0);
  if (ids.length === 0) throw new Error('No valid itemIds provided.');

  const conn = ensureDbOpen();
  const topicExists = conn.prepare('SELECT 1 FROM topics WHERE id = ?').get(targetTopicId);
  if (!topicExists) throw new Error(`Target topic not found: ${targetTopicId}`);

  const now = nowIso();
  const placeholders = ids.map(() => '?').join(', ');
  const table = contentType === 'question' ? 'questions' : 'flashcards';
  const result = conn.prepare(
    `UPDATE ${table} SET topic_id = ?, updated_at = ? WHERE id IN (${placeholders})`
  ).run(targetTopicId, now, ...ids);

  return { ok: true, movedCount: result.changes, targetTopicId, contentType };
}

function updateItemFlags({ itemId, contentType, isBookmarked, isFlagged } = {}) {
  if (!itemId || typeof itemId !== 'string') throw new Error('itemId is required.');
  if (contentType !== 'question' && contentType !== 'flashcard') throw new Error('contentType must be "question" or "flashcard".');
  const conn = ensureDbOpen();
  const now = nowIso();
  const table = contentType === 'question' ? 'questions' : 'flashcards';
  const fields = [];
  const params = [];
  if (isBookmarked !== undefined) { fields.push('is_bookmarked = ?'); params.push(isBookmarked ? 1 : 0); }
  if (isFlagged !== undefined) { fields.push('is_flagged = ?'); params.push(isFlagged ? 1 : 0); }
  if (fields.length === 0) return { ok: true, itemId, contentType };
  fields.push('updated_at = ?');
  params.push(now, itemId);
  const result = conn.prepare(`UPDATE ${table} SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  if (result.changes === 0) throw new Error(`Item not found: ${itemId}`);
  return { ok: true, itemId, contentType };
}

function getDatabasePath(conn) {
  const rows = conn.prepare('PRAGMA database_list').all();
  const mainDb = rows.find((row) => row.name === 'main');
  if (!mainDb || !mainDb.file) {
    throw new Error('Could not resolve SQLite database path.');
  }
  return mainDb.file;
}

function computeNextSrState(previousState, selfRating) {
  const prev = previousState && typeof previousState === 'object' ? previousState : {};
  const prevIntervalDays = Number.isFinite(Number(prev.intervalDays))
    ? Math.max(0, Number(prev.intervalDays))
    : 0;
  const prevEase = Number.isFinite(Number(prev.easeFactor))
    ? Number(prev.easeFactor)
    : 2.5;
  const prevReviewCount = Number.isFinite(Number(prev.reviewCount))
    ? Math.max(0, Number(prev.reviewCount))
    : 0;
  const prevLapseCount = Number.isFinite(Number(prev.lapseCount))
    ? Math.max(0, Number(prev.lapseCount))
    : 0;

  let intervalDays = 1;
  let easeFactor = prevEase;

  if (selfRating === 'Again') {
    intervalDays = 1;
    easeFactor = Math.max(1.3, prevEase - 0.2);
  } else if (selfRating === 'Hard') {
    intervalDays = Math.max(1, Math.round((prevIntervalDays || 1) * 1.25));
    easeFactor = Math.max(1.3, prevEase - 0.1);
  } else if (selfRating === 'Good') {
    intervalDays = Math.max(1, Math.round((prevIntervalDays || 1) * prevEase));
  } else if (selfRating === 'Easy') {
    intervalDays = Math.max(2, Math.round((prevIntervalDays || 2) * (prevEase + 0.35)));
    easeFactor = prevEase + 0.05;
  }

  const now = new Date();
  const reviewedAt = now.toISOString();
  const due = new Date(now.getTime() + (intervalDays * 24 * 60 * 60 * 1000));

  return {
    intervalDays,
    easeFactor: Number(easeFactor.toFixed(2)),
    dueAt: due.toISOString(),
    lastRating: selfRating,
    reviewCount: prevReviewCount + 1,
    lapseCount: prevLapseCount + (selfRating === 'Again' ? 1 : 0),
    lastReviewedAt: reviewedAt,
    updatedAt: reviewedAt,
  };
}

function parseJsonOrNull(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function clampAdaptiveWeakness(value) {
  const next = Number(value);
  if (!Number.isFinite(next)) return ADAPTIVE_WEAKNESS_MIN;
  if (next < ADAPTIVE_WEAKNESS_MIN) return ADAPTIVE_WEAKNESS_MIN;
  if (next > ADAPTIVE_WEAKNESS_MAX) return ADAPTIVE_WEAKNESS_MAX;
  return next;
}

function normalizeAdaptiveResult(value) {
  if (value !== 'correct' && value !== 'partial' && value !== 'incorrect' && value !== 'unanswered') {
    throw new Error('result must be one of correct, partial, incorrect, unanswered.');
  }
  return value;
}

function normalizeAdaptiveMinWeakness(value) {
  if (value == null) return ADAPTIVE_DEFAULT_THRESHOLD;
  const next = Number(value);
  if (!Number.isFinite(next)) return ADAPTIVE_DEFAULT_THRESHOLD;
  return clampAdaptiveWeakness(next);
}

function toAdaptiveSummary(state) {
  const weaknessScore = clampAdaptiveWeakness(state?.weaknessScore);
  return {
    weaknessScore,
    seenCount: Number.isFinite(Number(state?.seenCount)) ? Math.max(0, Number(state.seenCount)) : 0,
    incorrectCount: Number.isFinite(Number(state?.incorrectCount)) ? Math.max(0, Number(state.incorrectCount)) : 0,
    partialCount: Number.isFinite(Number(state?.partialCount)) ? Math.max(0, Number(state.partialCount)) : 0,
    slowCorrectCount: Number.isFinite(Number(state?.slowCorrectCount)) ? Math.max(0, Number(state.slowCorrectCount)) : 0,
    fastCorrectCount: Number.isFinite(Number(state?.fastCorrectCount)) ? Math.max(0, Number(state.fastCorrectCount)) : 0,
    consecutiveCorrectCount: Number.isFinite(Number(state?.consecutiveCorrectCount))
      ? Math.max(0, Number(state.consecutiveCorrectCount))
      : 0,
    averageTimeSeconds: Number.isFinite(Number(state?.averageTimeSeconds))
      ? Number(state.averageTimeSeconds)
      : null,
    lastReviewedAt: state?.lastReviewedAt || null,
    lastResult: state?.lastResult || null,
    needsWork: weaknessScore >= ADAPTIVE_DEFAULT_THRESHOLD,
  };
}

function computeNextAdaptiveMcqState(previousState, { result, partialCredit, timeSpentSeconds, reviewedAt }) {
  const prior = previousState && typeof previousState === 'object' ? previousState : {};
  const priorSeenCount = Number.isFinite(Number(prior.seenCount)) ? Math.max(0, Number(prior.seenCount)) : 0;
  const priorCorrectCount = Number.isFinite(Number(prior.correctCount)) ? Math.max(0, Number(prior.correctCount)) : 0;
  const priorIncorrectCount = Number.isFinite(Number(prior.incorrectCount)) ? Math.max(0, Number(prior.incorrectCount)) : 0;
  const priorPartialCount = Number.isFinite(Number(prior.partialCount)) ? Math.max(0, Number(prior.partialCount)) : 0;
  const priorSlowCorrectCount = Number.isFinite(Number(prior.slowCorrectCount)) ? Math.max(0, Number(prior.slowCorrectCount)) : 0;
  const priorFastCorrectCount = Number.isFinite(Number(prior.fastCorrectCount)) ? Math.max(0, Number(prior.fastCorrectCount)) : 0;
  const priorConsecutiveCorrectCount = Number.isFinite(Number(prior.consecutiveCorrectCount))
    ? Math.max(0, Number(prior.consecutiveCorrectCount))
    : 0;
  const priorWeakness = clampAdaptiveWeakness(prior.weaknessScore);
  const priorAvgTime = Number.isFinite(Number(prior.averageTimeSeconds)) ? Number(prior.averageTimeSeconds) : null;
  const normalizedTime = normalizeInteger(timeSpentSeconds, 0);
  const normalizedPartial = partialCredit == null ? null : Number(partialCredit);

  let weaknessDelta = 0;
  let consecutiveCorrectCount = priorConsecutiveCorrectCount;
  let correctCount = priorCorrectCount;
  let incorrectCount = priorIncorrectCount;
  let partialCount = priorPartialCount;
  let slowCorrectCount = priorSlowCorrectCount;
  let fastCorrectCount = priorFastCorrectCount;

  if (result === 'incorrect') {
    weaknessDelta += ADAPTIVE_RULES.incorrectPenalty;
    incorrectCount += 1;
    consecutiveCorrectCount = 0;
  } else if (result === 'partial') {
    weaknessDelta += ADAPTIVE_RULES.partialPenalty;
    partialCount += 1;
    consecutiveCorrectCount = 0;
  } else if (result === 'correct') {
    correctCount += 1;
    consecutiveCorrectCount += 1;

    if (normalizedTime >= ADAPTIVE_RULES.slowSecondsThreshold) {
      weaknessDelta += ADAPTIVE_RULES.slowCorrectPenalty;
      slowCorrectCount += 1;
    } else if (normalizedTime <= ADAPTIVE_RULES.fastSecondsThreshold) {
      weaknessDelta -= ADAPTIVE_RULES.fastCorrectRelief;
      fastCorrectCount += 1;
      if (consecutiveCorrectCount >= 3) {
        weaknessDelta -= ADAPTIVE_RULES.repeatedCorrectRelief;
      }
    }
  }

  const nextSeenCount = priorSeenCount + 1;
  const nextAverageTime = priorAvgTime == null
    ? normalizedTime
    : Number((((priorAvgTime * priorSeenCount) + normalizedTime) / nextSeenCount).toFixed(2));

  const nextWeaknessScore = clampAdaptiveWeakness(Number((priorWeakness + weaknessDelta).toFixed(4)));
  const nextState = {
    version: 1,
    weaknessScore: nextWeaknessScore,
    seenCount: nextSeenCount,
    correctCount,
    incorrectCount,
    partialCount,
    slowCorrectCount,
    fastCorrectCount,
    consecutiveCorrectCount,
    averageTimeSeconds: nextAverageTime,
    lastReviewedAt: reviewedAt,
    lastResult: result,
    lastPartialCredit: normalizedPartial,
    updatedAt: reviewedAt,
  };

  return {
    nextState,
    summary: toAdaptiveSummary(nextState),
  };
}

function recordAdaptiveMcqResult({ itemId, result, partialCredit, timeSpentSeconds } = {}) {
  if (!itemId || typeof itemId !== 'string') {
    throw new Error('itemId is required.');
  }

  const normalizedResult = normalizeAdaptiveResult(result);
  const conn = ensureDbOpen();
  const reviewedAt = nowIso();

  const existing = conn.prepare(`
    SELECT id, question_type, adaptive_review_state_json
    FROM questions
    WHERE id = ?
  `).get(itemId);

  if (!existing) throw new Error(`Question not found: ${itemId}`);
  if (!ADAPTIVE_MCQ_TYPES.has(existing.question_type)) {
    throw new Error('Only MCQ question types support adaptive MCQ review state updates.');
  }

  const priorState = parseJsonOrNull(existing.adaptive_review_state_json);
  const { nextState, summary } = computeNextAdaptiveMcqState(priorState, {
    result: normalizedResult,
    partialCredit,
    timeSpentSeconds,
    reviewedAt,
  });

  conn.prepare(`
    UPDATE questions
    SET
      adaptive_review_state_json = ?,
      updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(nextState), reviewedAt, itemId);

  conn.prepare(`
    INSERT INTO review_snapshots (
      id, entity_type, entity_id, reviewed_at, result, time_spent_seconds, self_rating, state_payload_json
    ) VALUES (?, 'question', ?, ?, ?, ?, NULL, ?)
  `).run(
    crypto.randomUUID(),
    itemId,
    reviewedAt,
    normalizedResult,
    normalizeInteger(timeSpentSeconds),
    JSON.stringify(nextState)
  );

  return {
    ok: true,
    itemId,
    questionType: existing.question_type,
    reviewedAt,
    state: nextState,
    summary,
  };
}

function listAdaptiveWeakQuestions({ topicIds, limit, minWeakness } = {}) {
  const conn = ensureDbOpen();
  const validTopicIds = Array.isArray(topicIds)
    ? topicIds.filter((id) => typeof id === 'string' && id.length > 0)
    : [];
  const maxItems = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 500) : 100;
  const minScore = normalizeAdaptiveMinWeakness(minWeakness);

  const where = [
    `q.question_type IN (${[...ADAPTIVE_MCQ_TYPES].map(() => '?').join(', ')})`,
    'q.adaptive_review_state_json IS NOT NULL',
  ];
  const params = [...ADAPTIVE_MCQ_TYPES];

  if (validTopicIds.length > 0) {
    where.push(`q.topic_id IN (${validTopicIds.map(() => '?').join(', ')})`);
    params.push(...validTopicIds);
  }

  const rows = conn.prepare(`
    SELECT
      q.id,
      q.topic_id,
      q.question_type,
      q.title,
      q.stem_rich_text,
      q.adaptive_review_state_json,
      q.last_result,
      q.last_used_at,
      t.name AS topic_name
    FROM questions q
    JOIN topics t ON t.id = q.topic_id
    WHERE ${where.join(' AND ')}
    ORDER BY q.id ASC
  `).all(...params);

  return rows
    .map((row) => {
      const state = parseJsonOrNull(row.adaptive_review_state_json);
      const summary = toAdaptiveSummary(state);
      return {
        questionId: row.id,
        topicId: row.topic_id,
        topicName: row.topic_name,
        questionType: row.question_type,
        title: row.title,
        stem: row.stem_rich_text,
        weaknessScore: summary.weaknessScore,
        needsWork: summary.weaknessScore >= minScore,
        seenCount: summary.seenCount,
        incorrectCount: summary.incorrectCount,
        partialCount: summary.partialCount,
        slowCorrectCount: summary.slowCorrectCount,
        fastCorrectCount: summary.fastCorrectCount,
        averageTimeSeconds: summary.averageTimeSeconds,
        lastResult: summary.lastResult || row.last_result || null,
        lastReviewedAt: summary.lastReviewedAt || row.last_used_at || null,
      };
    })
    .filter((row) => row.weaknessScore >= minScore)
    .sort((a, b) => b.weaknessScore - a.weaknessScore || b.incorrectCount - a.incorrectCount)
    .slice(0, maxItems);
}

function isDueDate(dueAt) {
  if (!dueAt || typeof dueAt !== 'string') return true;
  const dueMs = Date.parse(dueAt);
  if (!Number.isFinite(dueMs)) return true;
  return dueMs <= Date.now();
}

function listDueSpacedReviewItems({ topicIds, limit } = {}) {
  const conn = ensureDbOpen();
  const validTopicIds = Array.isArray(topicIds)
    ? topicIds.filter((id) => typeof id === 'string' && id.length > 0)
    : [];

  const maxItems = Number.isInteger(limit) && limit > 0 ? limit : 200;

  const flashcardWhere = validTopicIds.length > 0
    ? `WHERE topic_id IN (${validTopicIds.map(() => '?').join(', ')})`
    : '';
  const flashcards = conn.prepare(`
    SELECT
      id,
      topic_id,
      front_rich_text,
      back_rich_text,
      reference_text,
      sr_state_json,
      due_at,
      review_count,
      lapse_count,
      last_reviewed_at
    FROM flashcards
    ${flashcardWhere}
    ORDER BY due_at ASC, id ASC
  `).all(...validTopicIds).filter((row) => isDueDate(row.due_at)).map((row) => ({
    contentType: 'flashcard',
    itemId: row.id,
    topicId: row.topic_id,
    promptHtml: row.front_rich_text,
    answerHtml: row.back_rich_text,
    explanationHtml: '',
    referenceText: row.reference_text || '',
    dueAt: row.due_at || null,
    srState: parseJsonOrNull(row.sr_state_json),
    reviewCount: row.review_count,
    lapseCount: row.lapse_count,
    lastReviewedAt: row.last_reviewed_at || null,
  }));

  const questionWhere = validTopicIds.length > 0
    ? `AND q.topic_id IN (${validTopicIds.map(() => '?').join(', ')})`
    : '';
  const shortAnswerRows = conn.prepare(`
    SELECT
      q.id,
      q.topic_id,
      q.stem_rich_text,
      q.model_answer_rich_text,
      q.main_explanation_rich_text,
      q.reference_text,
      q.adaptive_review_state_json
    FROM questions q
    WHERE q.question_type = 'short_answer'
    ${questionWhere}
    ORDER BY q.id ASC
  `).all(...validTopicIds);

  const shortAnswers = shortAnswerRows
    .map((row) => {
      const state = parseJsonOrNull(row.adaptive_review_state_json);
      return {
        contentType: 'question',
        itemId: row.id,
        topicId: row.topic_id,
        promptHtml: row.stem_rich_text,
        answerHtml: row.model_answer_rich_text || '',
        explanationHtml: row.main_explanation_rich_text || '',
        referenceText: row.reference_text || '',
        dueAt: state?.dueAt || null,
        srState: state,
        reviewCount: Number.isFinite(Number(state?.reviewCount)) ? Number(state.reviewCount) : 0,
        lapseCount: Number.isFinite(Number(state?.lapseCount)) ? Number(state.lapseCount) : 0,
        lastReviewedAt: state?.lastReviewedAt || null,
      };
    })
    .filter((row) => isDueDate(row.dueAt));

  const merged = [...flashcards, ...shortAnswers]
    .sort((a, b) => {
      if (!a.dueAt && !b.dueAt) return 0;
      if (!a.dueAt) return -1;
      if (!b.dueAt) return 1;
      return Date.parse(a.dueAt) - Date.parse(b.dueAt);
    })
    .slice(0, maxItems);

  return merged;
}

function getSpacedReviewDueCounts({ topicIds } = {}) {
  const dueItems = listDueSpacedReviewItems({ topicIds, limit: 5000 });
  let questionDue = 0;
  let flashcardDue = 0;

  for (const item of dueItems) {
    if (item.contentType === 'question') questionDue += 1;
    if (item.contentType === 'flashcard') flashcardDue += 1;
  }

  return {
    totalDue: dueItems.length,
    questionDue,
    flashcardDue,
  };
}

function recordSpacedReviewRating({ contentType, itemId, selfRating, result, timeSpentSeconds } = {}) {
  if (contentType !== 'question' && contentType !== 'flashcard') {
    throw new Error('contentType must be "question" or "flashcard".');
  }
  if (!itemId || typeof itemId !== 'string') {
    throw new Error('itemId is required.');
  }
  const rating = normalizeSelfRating(selfRating);
  if (!rating) {
    throw new Error('selfRating is required.');
  }

  const conn = ensureDbOpen();
  const reviewedAt = nowIso();

  if (contentType === 'flashcard') {
    const existing = conn.prepare(`
      SELECT id, sr_state_json, review_count, lapse_count
      FROM flashcards
      WHERE id = ?
    `).get(itemId);

    if (!existing) throw new Error(`Flashcard not found: ${itemId}`);

    const priorState = parseJsonOrNull(existing.sr_state_json);
    const nextState = computeNextSrState(priorState, rating);

    conn.prepare(`
      UPDATE flashcards
      SET
        sr_state_json = ?,
        due_at = ?,
        last_reviewed_at = ?,
        review_count = review_count + 1,
        lapse_count = lapse_count + CASE WHEN ? = 'Again' THEN 1 ELSE 0 END,
        updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(nextState),
      nextState.dueAt,
      nextState.lastReviewedAt || reviewedAt,
      rating,
      reviewedAt,
      itemId
    );

    conn.prepare(`
      INSERT INTO review_snapshots (
        id, entity_type, entity_id, reviewed_at, result, time_spent_seconds, self_rating, state_payload_json
      ) VALUES (?, 'flashcard', ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      itemId,
      reviewedAt,
      result || null,
      normalizeInteger(timeSpentSeconds),
      rating,
      JSON.stringify(nextState)
    );

    return {
      ok: true,
      contentType,
      itemId,
      selfRating: rating,
      dueAt: nextState.dueAt,
      state: nextState,
    };
  }

  const existing = conn.prepare(`
    SELECT id, question_type, adaptive_review_state_json
    FROM questions
    WHERE id = ?
  `).get(itemId);

  if (!existing) throw new Error(`Question not found: ${itemId}`);
  if (existing.question_type !== 'short_answer') {
    throw new Error('Only short_answer questions support spaced-review ratings.');
  }

  const priorState = parseJsonOrNull(existing.adaptive_review_state_json);
  const nextState = computeNextSrState(priorState, rating);

  conn.prepare(`
    UPDATE questions
    SET
      adaptive_review_state_json = ?,
      updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(nextState), reviewedAt, itemId);

  conn.prepare(`
    INSERT INTO review_snapshots (
      id, entity_type, entity_id, reviewed_at, result, time_spent_seconds, self_rating, state_payload_json
    ) VALUES (?, 'question', ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    itemId,
    reviewedAt,
    result || null,
    normalizeInteger(timeSpentSeconds),
    rating,
    JSON.stringify(nextState)
  );

  return {
    ok: true,
    contentType,
    itemId,
    selfRating: rating,
    dueAt: nextState.dueAt,
    state: nextState,
  };
}

function createBackup({ notes } = {}) {
  const conn = ensureDbOpen();
  const dbPath = getDatabasePath(conn);
  const backupDir = path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(backupDir, `classbank-backup-${stamp}.sqlite`);
  const escapedPath = filePath.replace(/'/g, "''");

  conn.exec(`VACUUM INTO '${escapedPath}'`);

  conn.prepare(`
    INSERT INTO backup_records (id, file_path, created_at, notes)
    VALUES (?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    filePath,
    nowIso(),
    notes == null ? null : String(notes)
  );

  return {
    ok: true,
    filePath,
    createdAt: nowIso(),
  };
}

const BACKUP_RESTORE_TABLES = [
  'courses',
  'units',
  'topics',
  'questions',
  'question_choices',
  'media_assets',
  'flashcards',
  'practice_sessions',
  'practice_session_items',
  'review_snapshots',
  'revision_snapshots',
  'app_settings',
  'backup_records',
];

function validateBackupSourceDb(filePath, requiredTables = BACKUP_RESTORE_TABLES) {
  let sourceDb = null;
  try {
    sourceDb = new Database(filePath, { readonly: true, fileMustExist: true });
  } catch (error) {
    throw new Error(`Backup file is not a readable SQLite database: ${error.message}`);
  }

  try {
    const integrityRow = sourceDb.prepare('PRAGMA integrity_check').get();
    const integrityValue = integrityRow && Object.values(integrityRow)[0];
    if (integrityValue !== 'ok') {
      throw new Error(`Backup integrity check failed: ${integrityValue || 'unknown error'}`);
    }

    const tableRows = sourceDb.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
    `).all();

    const available = new Set(tableRows.map((row) => row.name));
    const missing = requiredTables.filter((tableName) => !available.has(tableName));
    if (missing.length > 0) {
      throw new Error(`Backup schema mismatch, missing required tables: ${missing.join(', ')}`);
    }

    return {
      ok: true,
      tableCount: requiredTables.length,
    };
  } finally {
    if (sourceDb) {
      sourceDb.close();
    }
  }
}

function listBackups({ limit } = {}) {
  const conn = ensureDbOpen();
  const parsedLimit = Number.isFinite(Number(limit))
    ? Math.max(1, Math.min(500, Math.floor(Number(limit))))
    : 100;

  const rows = conn.prepare(`
    SELECT id, file_path, created_at, notes
    FROM backup_records
    ORDER BY created_at DESC
    LIMIT ?
  `).all(parsedLimit);

  return rows.map((row) => {
    const exists = fs.existsSync(row.file_path);
    let fileSizeBytes = null;
    if (exists) {
      try {
        fileSizeBytes = fs.statSync(row.file_path).size;
      } catch {
        fileSizeBytes = null;
      }
    }

    return {
      backupId: row.id,
      filePath: row.file_path,
      createdAt: row.created_at,
      notes: row.notes,
      exists,
      fileSizeBytes,
    };
  });
}

function restoreBackup({ filePath, confirmOverwrite } = {}) {
  if (!confirmOverwrite) {
    throw new Error('restoreBackup requires confirmOverwrite=true.');
  }
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('filePath is required.');
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Backup file does not exist: ${resolvedPath}`);
  }
  const sourceStat = fs.statSync(resolvedPath);
  if (!sourceStat.isFile()) {
    throw new Error(`Backup path is not a file: ${resolvedPath}`);
  }

  const conn = ensureDbOpen();
  const escapedPath = resolvedPath.replace(/'/g, "''");
  validateBackupSourceDb(resolvedPath, BACKUP_RESTORE_TABLES);
  const rowCounts = {};

  conn.pragma('foreign_keys = OFF');
  try {
    conn.exec(`ATTACH DATABASE '${escapedPath}' AS restore_src`);
    conn.exec('BEGIN IMMEDIATE');

    for (const tableName of BACKUP_RESTORE_TABLES) {
      const sourceRow = conn.prepare(`SELECT COUNT(*) AS count FROM restore_src.${tableName}`).get();
      rowCounts[tableName] = sourceRow ? sourceRow.count : 0;
      conn.exec(`DELETE FROM ${tableName}`);
      conn.exec(`INSERT INTO ${tableName} SELECT * FROM restore_src.${tableName}`);
    }

    conn.exec('COMMIT');
    conn.exec('DETACH DATABASE restore_src');
  } catch (error) {
    try {
      conn.exec('ROLLBACK');
    } catch {
      // no-op
    }
    try {
      conn.exec('DETACH DATABASE restore_src');
    } catch {
      // no-op
    }
    throw error;
  } finally {
    conn.pragma('foreign_keys = ON');
  }

  return {
    ok: true,
    filePath: resolvedPath,
    restoredAt: nowIso(),
    tableCount: BACKUP_RESTORE_TABLES.length,
    rowCounts,
  };
}

module.exports = {
  initializeDatabase,
  closeDatabase,
  getCourses,
  getUnits,
  getTopics,
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  getQuestionReviewStats,
  listSessionHistory,
  getSessionHistoryDetail,
  getStatsDashboardSummary,
  saveSession,
  createCourse,
  updateCourse,
  deleteCourse,
  createUnit,
  updateUnit,
  deleteUnit,
  createTopic,
  updateTopic,
  deleteTopic,
  getFlashcards,
  getFlashcardById,
  createFlashcard,
  updateFlashcard,
  getItemCountsByTopic,
  searchItems,
  deleteQuestion,
  deleteFlashcard,
  duplicateQuestion,
  duplicateFlashcard,
  moveItems,
  updateItemFlags,
  listDueSpacedReviewItems,
  getSpacedReviewDueCounts,
  recordSpacedReviewRating,
  recordAdaptiveMcqResult,
  listAdaptiveWeakQuestions,
  createBackup,
  listBackups,
  restoreBackup,
};
