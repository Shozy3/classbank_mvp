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

## Local Execution Update (2026-03-14)

### Issue #14 Status
- In progress: acceptance test sweep execution and evidence tracking for MVP sign-off.
- Scope executed locally: full interactive acceptance sweep plus core verification reruns.

### Acceptance + Interactive Test Sweep

Source: `temp/at-report.json` (generated `2026-03-14T20:17:01.208Z`)

| Status | Count |
|---|---:|
| Pass | 19 |
| Fail | 0 |
| Blocked | 0 |
| Total | 19 |

Passed IDs:
- AT-001
- AT-002
- AT-003
- AT-004
- AT-005
- AT-006
- AT-007
- AT-008
- AT-009
- AT-010
- AT-011
- AT-012
- AT-013
- AT-014
- AT-015
- AT-016
- AT-017
- AT-SR-001
- SMOKE-UI-ERRORS

### Verification Commands Run
- `npm run at:interactive`
- `npm run at:validate-report`
- `npm run at:signoff-check`
- `npm run verify:core`

### Notes
- Acceptance contract in `acceptance-tests.md` is now fully covered by passing AT-001 through AT-017.
- `AT-SR-001` is an additional spaced-review coverage case included by the interactive runner.
- No blocked acceptance cases remain in the current local run set.

### Follow-up Recommendation
- Keep Issue #14 open until this run evidence is mirrored to remote issue tracking notes.
- Close Issue #14 once the latest pass matrix and command provenance are posted in the GitHub issue.
