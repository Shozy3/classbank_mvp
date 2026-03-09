PRAGMA foreign_keys = ON;

-- =========================================================
-- Core hierarchy
-- =========================================================

CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS units (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_units_course_id ON units(course_id);

CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_topics_unit_id ON topics(unit_id);

-- =========================================================
-- Questions
-- =========================================================

CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (
        question_type IN ('single_best', 'multi_select', 'true_false', 'short_answer')
    ),
    title TEXT,
    stem_rich_text TEXT NOT NULL,
    model_answer_rich_text TEXT,
    main_explanation_rich_text TEXT,
    reference_text TEXT,
    difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
    is_bookmarked INTEGER NOT NULL DEFAULT 0 CHECK (is_bookmarked IN (0, 1)),
    is_flagged INTEGER NOT NULL DEFAULT 0 CHECK (is_flagged IN (0, 1)),
    times_seen INTEGER NOT NULL DEFAULT 0,
    times_correct INTEGER NOT NULL DEFAULT 0,
    times_incorrect INTEGER NOT NULL DEFAULT 0,
    last_result TEXT CHECK (last_result IN ('correct', 'incorrect', 'partial', 'unanswered')),
    last_used_at TEXT,
    adaptive_review_state_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_edited_at TEXT NOT NULL,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_questions_topic_id ON questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(question_type);
CREATE INDEX IF NOT EXISTS idx_questions_bookmarked ON questions(is_bookmarked);
CREATE INDEX IF NOT EXISTS idx_questions_flagged ON questions(is_flagged);

CREATE TABLE IF NOT EXISTS question_choices (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    label TEXT,
    choice_rich_text TEXT NOT NULL,
    is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
    choice_explanation_rich_text TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_question_choices_question_id ON question_choices(question_id);

-- =========================================================
-- Embedded images for questions / flashcards
-- One table keeps storage flexible across entity types.
-- =========================================================

CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('question', 'choice', 'flashcard')),
    entity_id TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_name TEXT,
    blob_data BLOB NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_assets_entity ON media_assets(entity_type, entity_id);

-- =========================================================
-- Flashcards
-- =========================================================

CREATE TABLE IF NOT EXISTS flashcards (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL,
    front_rich_text TEXT NOT NULL,
    back_rich_text TEXT NOT NULL,
    reference_text TEXT,
    sr_state_json TEXT,
    due_at TEXT,
    last_reviewed_at TEXT,
    review_count INTEGER NOT NULL DEFAULT 0,
    lapse_count INTEGER NOT NULL DEFAULT 0,
    is_bookmarked INTEGER NOT NULL DEFAULT 0 CHECK (is_bookmarked IN (0, 1)),
    is_flagged INTEGER NOT NULL DEFAULT 0 CHECK (is_flagged IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_edited_at TEXT NOT NULL,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_flashcards_topic_id ON flashcards(topic_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_due_at ON flashcards(due_at);

-- =========================================================
-- Practice sessions
-- =========================================================

CREATE TABLE IF NOT EXISTS practice_sessions (
    id TEXT PRIMARY KEY,
    session_type TEXT NOT NULL CHECK (
        session_type IN ('free_practice', 'timed_block', 'review_incorrect', 'spaced_review')
    ),
    timer_mode TEXT NOT NULL CHECK (
        timer_mode IN ('none', 'per_block', 'per_question', 'both')
    ),
    total_time_seconds INTEGER,
    shuffle_questions INTEGER NOT NULL DEFAULT 1 CHECK (shuffle_questions IN (0, 1)),
    shuffle_choices INTEGER NOT NULL DEFAULT 1 CHECK (shuffle_choices IN (0, 1)),
    random_sample_size INTEGER,
    filter_payload_json TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS practice_session_items (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('question', 'flashcard')),
    question_id TEXT,
    flashcard_id TEXT,
    presented_order INTEGER NOT NULL,
    was_answered INTEGER NOT NULL DEFAULT 0 CHECK (was_answered IN (0, 1)),
    submitted_at TEXT,
    time_spent_seconds INTEGER,
    response_payload_json TEXT,
    is_correct INTEGER CHECK (is_correct IN (0, 1)),
    partial_credit REAL CHECK (partial_credit >= 0.0 AND partial_credit <= 1.0),
    was_revealed INTEGER NOT NULL DEFAULT 0 CHECK (was_revealed IN (0, 1)),
    was_skipped INTEGER NOT NULL DEFAULT 0 CHECK (was_skipped IN (0, 1)),
    was_bookmarked_during_session INTEGER NOT NULL DEFAULT 0 CHECK (was_bookmarked_during_session IN (0, 1)),
    was_flagged_during_session INTEGER NOT NULL DEFAULT 0 CHECK (was_flagged_during_session IN (0, 1)),
    self_rating TEXT CHECK (self_rating IN ('Again', 'Hard', 'Good', 'Easy')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES practice_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (flashcard_id) REFERENCES flashcards(id) ON DELETE CASCADE,
    CHECK (
        (content_type = 'question' AND question_id IS NOT NULL AND flashcard_id IS NULL)
        OR
        (content_type = 'flashcard' AND flashcard_id IS NOT NULL AND question_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_session_items_session_id ON practice_session_items(session_id);
CREATE INDEX IF NOT EXISTS idx_session_items_question_id ON practice_session_items(question_id);
CREATE INDEX IF NOT EXISTS idx_session_items_flashcard_id ON practice_session_items(flashcard_id);

-- =========================================================
-- Review history / snapshots
-- =========================================================

CREATE TABLE IF NOT EXISTS review_snapshots (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('question', 'flashcard')),
    entity_id TEXT NOT NULL,
    reviewed_at TEXT NOT NULL,
    result TEXT,
    time_spent_seconds INTEGER,
    self_rating TEXT CHECK (self_rating IN ('Again', 'Hard', 'Good', 'Easy')),
    state_payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_review_snapshots_entity ON review_snapshots(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_review_snapshots_reviewed_at ON review_snapshots(reviewed_at);

CREATE TABLE IF NOT EXISTS revision_snapshots (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('question', 'flashcard')),
    entity_id TEXT NOT NULL,
    snapshot_payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revision_snapshots_entity ON revision_snapshots(entity_type, entity_id);

-- =========================================================
-- Lightweight app metadata / settings
-- =========================================================

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- =========================================================
-- Backup metadata (optional but useful)
-- =========================================================

CREATE TABLE IF NOT EXISTS backup_records (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    notes TEXT
);

-- =========================================================
-- Helpful view for question performance
-- =========================================================

CREATE VIEW IF NOT EXISTS question_performance_summary AS
SELECT
    q.id AS question_id,
    q.title,
    q.question_type,
    q.topic_id,
    q.times_seen,
    q.times_correct,
    q.times_incorrect,
    q.last_result,
    q.last_used_at,
    q.is_bookmarked,
    q.is_flagged
FROM questions q;