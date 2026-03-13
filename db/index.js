const fs = require('fs');
const path = require('path');
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastEditedAt: row.last_edited_at,
    choices: choicesByQuestionId.get(row.id) || [],
  }));
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

module.exports = {
  initializeDatabase,
  closeDatabase,
  getCourses,
  getUnits,
  getTopics,
  getQuestions,
  getQuestionReviewStats,
  saveSession,
};
