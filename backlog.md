# Backlog

## Priority legend
- Must Have
- Should Have
- Nice to Have

---

## Phase 1 — App shell and persistence
**Priority: Must Have**

- Electron main process with BrowserWindow
- preload.js with contextBridge IPC API (`window.api`)
- app shell with persistent navigation
- section routes/views:
  - Library
  - Authoring
  - Practice Setup
  - Practice Session
  - Review History
  - Stats Dashboard
- SQLite setup via `better-sqlite3`
- schema initialization on first launch
- data access layer (main process query functions)
- basic backup/restore plumbing

**Milestone outcome**
The app launches, stores local data, and has stable section structure.

---

## Phase 2 — Content hierarchy management
**Priority: Must Have**

- create/edit/delete course
- create/edit/delete unit
- create/edit/delete topic
- hierarchy sidebar
- move content between topics
- basic search/filter in library

**Milestone outcome**
User can organize study content cleanly.

---

## Phase 3 — Authoring system
**Priority: Must Have**

- WYSIWYG editor
- create/edit/delete/duplicate question
- create/edit/delete/duplicate flashcard
- question type support:
  - single best answer
  - multi-select
  - true/false
  - short answer
  - flashcards
- main explanation
- per-choice explanation
- reference text
- image insertion
- code blocks
- tables
- LaTeX/math
- revision snapshots
- bulk edit basics

**Milestone outcome**
User can author real content.

---

## Phase 4 — Library polish
**Priority: Should Have**

- preview pane
- badges for item type
- bookmark/flag indicators
- bulk actions:
  - move
  - delete
  - bookmark/unbookmark
  - flag/unflag
  - update difficulty

**Milestone outcome**
Managing content no longer feels like wrestling a filing cabinet.

---

## Phase 5 — Practice setup
**Priority: Must Have**

- filter controls:
  - course
  - unit
  - topic
  - question type
  - difficulty
  - flagged
  - bookmarked
  - incorrect only
  - unseen only
  - random sample size
- mode selection
- timer selection
- shuffle toggles
- session generation

**Milestone outcome**
User can build useful sessions.

---

## Phase 6 — Practice session core
**Priority: Must Have**

- split-view session layout
- left question panel
- right explanation panel
- hidden explanation until reveal
- question navigator
- MCQ answering
- multi-select answering
- short-answer entry
- flashcard reveal
- change answer before reveal
- skip and return
- bookmark/flag in session
- strikeout support
- summary screen

**Milestone outcome**
Core study loop works.

---

## Phase 7 — Review systems
**Priority: Must Have**

### Spaced repetition
- Again / Hard / Good / Easy flow
- flashcard due state
- short-answer due state
- reset on edit

### Adaptive MCQ review
- store correctness
- store time spent
- store partial credit
- incorrect-only review
- unseen-only review
- weak-question state

**Milestone outcome**
The app actually helps memory instead of just looking handsome.

---

## Phase 8 — History and lightweight stats
**Priority: Should Have**

- review history list
- session detail summary
- streak tracking
- optional due-count card

**Milestone outcome**
User can see recent activity and study consistency.

---

## Phase 9 — Backup and restore polish
**Priority: Must Have**

- create backup
- restore backup
- validation and overwrite warning
- error handling

**Milestone outcome**
Data is safer.

---

## Phase 10 — UI polish and stability
**Priority: Must Have**

- dark mode polish
- component state consistency
- spacing/typography refinement
- empty states
- error states
- restart durability
- save reliability

**Milestone outcome**
App feels premium, not half-baked.

---

## Nice later, not now

- import formats beyond manual entry
- advanced analytics
- keyboard shortcut expansion
- Windows packaging
- export/migration tools
- web architecture
- multi-user systems
- moderation
- community content