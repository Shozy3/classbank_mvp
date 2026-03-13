# GitHub Issues Snapshot

Date: 2026-03-13  
Repository: Shozy3/classbank_mvp  
Total issues: 14  
Open: 14  
Closed: 0

## Issue Details

| Issue | Title | State | Closed | Labels | Created | Updated | URL | Summary |
|---|---|---|---|---|---|---|---|---|
| #14 | Acceptance test sweep for MVP | Open | No | should-have, qa | 2026-03-11 | 2026-03-11 | https://github.com/Shozy3/classbank_mvp/issues/14 | Execute a full acceptance-test sweep and track pass/fail outcomes against acceptance-tests.md before declaring MVP complete. |
| #13 | Phase 10: UI polish and stability | Open | No | must-have, phase-10 | 2026-03-11 | 2026-03-11 | https://github.com/Shozy3/classbank_mvp/issues/13 | Run final UI polish and stability hardening to make MVP feel production-grade and durable. |
| #12 | Phase 9: Backup and restore | Open | No | must-have, phase-9 | 2026-03-11 | 2026-03-11 | https://github.com/Shozy3/classbank_mvp/issues/12 | Deliver complete local backup/restore workflows with validation, overwrite safeguards, and failure handling. |
| #11 | Reset review state on content edit | Open | No | must-have, phase-7 | 2026-03-11 | 2026-03-11 | https://github.com/Shozy3/classbank_mvp/issues/11 | Editing reviewed content must reset review state so stale review history does not survive substantive content changes. |
| #10 | Phase 7: Adaptive MCQ review engine | Open | No | must-have, phase-7 | 2026-03-11 | 2026-03-11 | https://github.com/Shozy3/classbank_mvp/issues/10 | Implement the adaptive review engine for MCQ/recognition-type questions, independent from SR scheduling. |
| #9 | Phase 7: Spaced repetition engine | Open | No | must-have, phase-7 | 2026-03-11 | 2026-03-11 | https://github.com/Shozy3/classbank_mvp/issues/9 | Implement a dedicated spaced-repetition scheduling engine for flashcards and short-answer items. |
| #8 | Phase 6: Practice Session completion | Open | No | must-have, phase-6 | 2026-03-11 | 2026-03-11 | https://github.com/Shozy3/classbank_mvp/issues/8 | Complete Practice Session core behaviors required by docs but not fully tracked in existing issues. |
| #7 | Phase 5: Practice Setup completion | Open | No | must-have, phase-5 | 2026-03-11 | 2026-03-11 | https://github.com/Shozy3/classbank_mvp/issues/7 | Complete Practice Setup so session generation uses persisted data and supports documented filters and modes. |
| #6 | Phase 4: Review History + Stats Dashboard | Open | No | phase-4, should-have | 2026-03-11 | 2026-03-11 | https://github.com/Shozy3/classbank_mvp/issues/6 | Build read-only screens for Review History and Stats Dashboard from persisted session data. |
| #5 | Phase 3: Authoring screen | Open | No | phase-3, must-have | 2026-03-11 | 2026-03-11 | https://github.com/Shozy3/classbank_mvp/issues/5 | Build the Authoring screen for creating and editing questions and flashcards. |
| #4 | Phase 2: Library screen | Open | No | phase-2, must-have | 2026-03-11 | 2026-03-11 | https://github.com/Shozy3/classbank_mvp/issues/4 | Build the Library screen for hierarchy navigation, preview, and content management. |
| #3 | Phase 1: Session persistence (write-back to DB) | Open | No | phase-1, must-have | 2026-03-11 | 2026-03-11 | https://github.com/Shozy3/classbank_mvp/issues/3 | Persist session results to DB including answers, flags, bookmarks, ratings, and review state. |
| #2 | Phase 1: SQLite persistence layer | Open | No | phase-1, must-have | 2026-03-11 | 2026-03-11 | https://github.com/Shozy3/classbank_mvp/issues/2 | Wire better-sqlite3 into Electron, initialize schema, and expose core IPC read/write methods. |
| #1 | Phase 1: Electron app shell | Open | No | phase-1, must-have | 2026-03-11 | 2026-03-11 | https://github.com/Shozy3/classbank_mvp/issues/1 | Bootstrap the macOS Electron shell with native windowing and IPC foundation. |

## Local Execution Update (2026-03-13)

### Issue #2 Status
- Implemented locally: SQLite persistence layer wired through Electron main process IPC.
- Scope completed: schema bootstrap, first-run seed path, read IPC handlers, renderer integration for setup/session loading.

### Acceptance + Interactive Test Sweep

Source: `temp/at-report.json`

| Status | Count |
|---|---:|
| Pass | 7 |
| Fail | 0 |
| Blocked | 9 |
| Total | 16 |

Passed IDs:
- AT-003
- AT-006
- AT-008
- AT-009
- AT-010
- AT-015
- SMOKE-UI-ERRORS

Blocked IDs and reasons:
- AT-001: Library/authoring hierarchy creation flow not implemented in current UI.
- AT-002: Authoring rich MCQ creation/editing UI not implemented.
- AT-004: Spaced review engine and short-answer SR rating persistence not implemented.
- AT-005: Flashcard authoring and spaced review scheduling not implemented.
- AT-007: Timed block mode is disabled in Practice Setup.
- AT-011: Incorrect-only flow depends on persisted review history not implemented yet.
- AT-012: Edit reviewed flashcard reset flow requires authoring and SR persistence.
- AT-013: Edit reviewed short-answer reset flow requires authoring and SR persistence.
- AT-014: Backup/restore workflow not implemented yet.

### Smoke Checks
- Electron DB smoke: pass (`temp/pw-runner/electron-db-smoke.mjs`)
- Session seed smoke: pass (`temp/session-seed-smoke.mjs`)

### Follow-up Recommendation
- Keep Issue #2 open until commit is pushed and issue tracker is updated remotely.
- Use this local update as handoff context for closing Issue #2 and scoping Issue #3.
