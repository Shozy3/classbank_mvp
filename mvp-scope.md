# MVP Scope

## Product

A local, offline, single-user study application for creating and practicing custom university-course questions in a UWorld-inspired interface.

## In Scope

### Platform
- macOS desktop application (Electron)
- fully offline
- SQLite via `better-sqlite3` in the Electron main process
- renderer ↔ main communication via `contextBridge` IPC (`window.api`)
- single-user only

### Content structure
- Course
- Unit / Module
- Topic
- Question
- Flashcard

### Supported content types
- Single best answer MCQ
- Multi-select MCQ
- True/False
- Short answer
- Image-based questions
- Flashcards

### Authoring
- Rich WYSIWYG editor
- Rich text
- Images
- Tables
- Code blocks
- LaTeX / math
- Main explanation block
- Per-choice explanation blocks
- Plain-text references
- Create / edit / duplicate / delete
- Simple revision snapshots
- Bulk edit

### Practice modes
- Free Practice
- Timed Block
- Review Incorrect
- Spaced Repetition Review

### Session features
- Question navigator
- Skip and return
- Shuffle questions
- Shuffle answer choices
- Reveal explanation after answer
- Bookmark
- Flag
- Strikeout on answer choices
- Dark mode

### Review systems
- Flashcards: explicit Anki-style rating
- Short-answer: explicit Anki-style rating
- MCQs: separate adaptive review tracking based on correctness and timing

### Persistence
- local save
- local backup/restore

## Out of Scope

- web app
- multi-user collaboration
- accounts or login
- cloud sync
- public question sharing
- moderation workflows
- comments/discussion
- reputation systems
- course verification
- advanced analytics
- AI question generation
- copyrighted textbook content ingestion
- web migration/export strategy

## Core user loop

1. Create course hierarchy
2. Add questions or flashcards
3. Build a practice session from filters
4. Answer or reveal content
5. Review explanation
6. Update review state
7. Revisit weak material later

## MVP success criteria

The MVP is successful if:
- the user can create rich educational content quickly
- the practice session feels polished and fast
- explanations are easy to review
- spaced repetition works for flashcards and short-answer
- the app is stable and fully usable offline