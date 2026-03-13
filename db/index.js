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

module.exports = {
  initializeDatabase,
  closeDatabase,
  getCourses,
  getUnits,
  getTopics,
  getQuestions,
};
