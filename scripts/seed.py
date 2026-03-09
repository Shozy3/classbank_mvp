#!/usr/bin/env python3
"""
Seed the local SQLite database from fixtures/sample-course-data.json.

Usage:
    python scripts/seed.py --db app.db --schema schema.sql --fixture fixtures/sample-course-data.json
    python scripts/seed.py --db app.db --schema schema.sql --fixture fixtures/sample-course-data.json --reset
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any, Iterable


def read_text_file(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    return path.read_text(encoding="utf-8")


def read_json_file(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Fixture not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("Fixture root must be a JSON object.")
    return data


def execute_schema(conn: sqlite3.Connection, schema_path: Path) -> None:
    schema_sql = read_text_file(schema_path)
    conn.executescript(schema_sql)


def reset_database(conn: sqlite3.Connection) -> None:
    # Order matters because of foreign keys.
    statements = [
        "DELETE FROM question_choices;",
        "DELETE FROM media_assets;",
        "DELETE FROM practice_session_items;",
        "DELETE FROM practice_sessions;",
        "DELETE FROM review_snapshots;",
        "DELETE FROM revision_snapshots;",
        "DELETE FROM flashcards;",
        "DELETE FROM questions;",
        "DELETE FROM topics;",
        "DELETE FROM units;",
        "DELETE FROM courses;",
        "DELETE FROM backup_records;",
        "DELETE FROM app_settings;",
    ]
    for stmt in statements:
        conn.execute(stmt)


def upsert_course(conn: sqlite3.Connection, course: dict[str, Any]) -> None:
    conn.execute(
        """
        INSERT INTO courses (id, name, code, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            code = excluded.code,
            updated_at = excluded.updated_at
        """,
        (
            course["course_id"],
            course["course_name"],
            course.get("course_code"),
            course["created_at"],
            course["updated_at"],
        ),
    )


def upsert_unit(conn: sqlite3.Connection, unit: dict[str, Any], course_id: str) -> None:
    conn.execute(
        """
        INSERT INTO units (id, course_id, name, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            course_id = excluded.course_id,
            name = excluded.name,
            sort_order = excluded.sort_order,
            updated_at = excluded.updated_at
        """,
        (
            unit["unit_id"],
            course_id,
            unit["unit_name"],
            unit.get("sort_order", 0),
            unit["created_at"],
            unit["updated_at"],
        ),
    )


def upsert_topic(conn: sqlite3.Connection, topic: dict[str, Any], unit_id: str) -> None:
    conn.execute(
        """
        INSERT INTO topics (id, unit_id, name, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            unit_id = excluded.unit_id,
            name = excluded.name,
            sort_order = excluded.sort_order,
            updated_at = excluded.updated_at
        """,
        (
            topic["topic_id"],
            unit_id,
            topic["topic_name"],
            topic.get("sort_order", 0),
            topic["created_at"],
            topic["updated_at"],
        ),
    )


def normalize_question_type(question_type: str) -> str:
    allowed = {"single_best", "multi_select", "true_false", "short_answer"}
    if question_type not in allowed:
        raise ValueError(f"Unsupported question_type in fixture: {question_type}")
    return question_type


def upsert_question(conn: sqlite3.Connection, question: dict[str, Any], topic_id: str) -> None:
    question_type = normalize_question_type(question["question_type"])

    conn.execute(
        """
        INSERT INTO questions (
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
            times_seen,
            times_correct,
            times_incorrect,
            last_result,
            last_used_at,
            adaptive_review_state_json,
            created_at,
            updated_at,
            last_edited_at
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
        """,
        (
            question["question_id"],
            topic_id,
            question_type,
            question.get("title"),
            question["stem_rich_text"],
            question.get("model_answer_rich_text"),
            question.get("main_explanation_rich_text"),
            question.get("reference_text"),
            question.get("difficulty"),
            int(bool(question.get("is_bookmarked", False))),
            int(bool(question.get("is_flagged", False))),
            int(question.get("times_seen", 0)),
            int(question.get("times_correct", 0)),
            int(question.get("times_incorrect", 0)),
            question.get("last_result"),
            question.get("last_used_at"),
            json.dumps(question.get("adaptive_review_state_json"))
            if question.get("adaptive_review_state_json") is not None
            else None,
            question["created_at"],
            question["updated_at"],
            question["last_edited_at"],
        ),
    )

    # For deterministic reseeding, replace choices for this question.
    conn.execute("DELETE FROM question_choices WHERE question_id = ?", (question["question_id"],))

    for choice in question.get("choices", []):
        upsert_question_choice(conn, choice, question["question_id"])


def upsert_question_choice(conn: sqlite3.Connection, choice: dict[str, Any], question_id: str) -> None:
    conn.execute(
        """
        INSERT INTO question_choices (
            id,
            question_id,
            label,
            choice_rich_text,
            is_correct,
            choice_explanation_rich_text,
            sort_order
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            question_id = excluded.question_id,
            label = excluded.label,
            choice_rich_text = excluded.choice_rich_text,
            is_correct = excluded.is_correct,
            choice_explanation_rich_text = excluded.choice_explanation_rich_text,
            sort_order = excluded.sort_order
        """,
        (
            choice["choice_id"],
            question_id,
            choice.get("label"),
            choice["choice_rich_text"],
            int(bool(choice.get("is_correct", False))),
            choice.get("choice_explanation_rich_text"),
            int(choice.get("sort_order", 0)),
        ),
    )


def upsert_flashcard(conn: sqlite3.Connection, flashcard: dict[str, Any], topic_id: str) -> None:
    conn.execute(
        """
        INSERT INTO flashcards (
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
        """,
        (
            flashcard["flashcard_id"],
            topic_id,
            flashcard["front_rich_text"],
            flashcard["back_rich_text"],
            flashcard.get("reference_text"),
            json.dumps(flashcard.get("sr_state_json"))
            if flashcard.get("sr_state_json") is not None
            else None,
            flashcard.get("due_at"),
            flashcard.get("last_reviewed_at"),
            int(flashcard.get("review_count", 0)),
            int(flashcard.get("lapse_count", 0)),
            int(bool(flashcard.get("is_bookmarked", False))),
            int(bool(flashcard.get("is_flagged", False))),
            flashcard["created_at"],
            flashcard["updated_at"],
            flashcard["last_edited_at"],
        ),
    )


def seed_topic(conn: sqlite3.Connection, topic: dict[str, Any], unit_id: str) -> tuple[int, int]:
    upsert_topic(conn, topic, unit_id)

    question_count = 0
    flashcard_count = 0

    for question in topic.get("questions", []):
        upsert_question(conn, question, topic["topic_id"])
        question_count += 1

    for flashcard in topic.get("flashcards", []):
        upsert_flashcard(conn, flashcard, topic["topic_id"])
        flashcard_count += 1

    return question_count, flashcard_count


def seed_unit(conn: sqlite3.Connection, unit: dict[str, Any], course_id: str) -> tuple[int, int, int]:
    upsert_unit(conn, unit, course_id)

    topic_count = 0
    question_count = 0
    flashcard_count = 0

    for topic in unit.get("topics", []):
        qc, fc = seed_topic(conn, topic, unit["unit_id"])
        topic_count += 1
        question_count += qc
        flashcard_count += fc

    return topic_count, question_count, flashcard_count


def seed_course(conn: sqlite3.Connection, course: dict[str, Any]) -> tuple[int, int, int]:
    upsert_course(conn, course)

    unit_count = 0
    topic_count = 0
    question_count = 0
    flashcard_count = 0

    for unit in course.get("units", []):
        tc, qc, fc = seed_unit(conn, unit, course["course_id"])
        unit_count += 1
        topic_count += tc
        question_count += qc
        flashcard_count += fc

    return unit_count, topic_count, question_count, flashcard_count


def seed_fixture(conn: sqlite3.Connection, fixture: dict[str, Any]) -> dict[str, int]:
    courses: Iterable[dict[str, Any]] = fixture.get("courses", [])
    if not isinstance(courses, list):
        raise ValueError("'courses' must be a list.")

    totals = {
        "courses": 0,
        "units": 0,
        "topics": 0,
        "questions": 0,
        "flashcards": 0,
    }

    for course in courses:
        uc, tc, qc, fc = seed_course(conn, course)
        totals["courses"] += 1
        totals["units"] += uc
        totals["topics"] += tc
        totals["questions"] += qc
        totals["flashcards"] += fc

    return totals


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed local SQLite DB from fixture JSON.")
    parser.add_argument("--db", required=True, help="Path to SQLite database file.")
    parser.add_argument("--schema", required=True, help="Path to schema.sql.")
    parser.add_argument("--fixture", required=True, help="Path to fixture JSON.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing data before seeding.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    db_path = Path(args.db).expanduser().resolve()
    schema_path = Path(args.schema).expanduser().resolve()
    fixture_path = Path(args.fixture).expanduser().resolve()

    db_path.parent.mkdir(parents=True, exist_ok=True)

    fixture = read_json_file(fixture_path)

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        execute_schema(conn, schema_path)

        if args.reset:
            reset_database(conn)

        totals = seed_fixture(conn, fixture)
        conn.commit()

        print("Seed complete.")
        print(f"DB: {db_path}")
        print(f"Courses: {totals['courses']}")
        print(f"Units: {totals['units']}")
        print(f"Topics: {totals['topics']}")
        print(f"Questions: {totals['questions']}")
        print(f"Flashcards: {totals['flashcards']}")

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()