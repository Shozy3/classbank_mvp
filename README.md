# ClassBank MVP

A local-first, offline, UWorld-inspired practice platform for university courses — built for macOS as a single-user desktop application.

**Core study loop: create content → build session → answer/reveal → review explanation → track review state**

---

## Screenshots

### Practice Setup
Configure your session with cascading course/unit/topic filters, question type toggles, difficulty, bookmark/flag filters, and shuffle options.

| Initial state | Ready to start |
|---|---|
| ![Practice setup – initial](docs/screenshots/setup-initial.png) | ![Practice setup – ready to start](docs/screenshots/setup-ready.png) |

### Practice Session — Question types

| Single best answer (unanswered) | Revealed — correct |
|---|---|
| ![Session – unanswered MCQ](docs/screenshots/session-unanswered.png) | ![Session – revealed correct](docs/screenshots/session-revealed-correct.png) |

| Multi-select with per-choice explanations | Short answer revealed with rating |
|---|---|
| ![Session – per-choice explanation breakdown](docs/screenshots/session-explanation-breakdown.png) | ![Session – short answer revealed](docs/screenshots/session-shortanswer-revealed.png) |

### Per-choice explanation breakdown
![Session – per-choice explanations](docs/screenshots/session-per-choice-explanations.png)

### Question navigator
All navigator states — unanswered, correct, incorrect, skipped, bookmarked, flagged, current.

![Navigator – all states](docs/screenshots/navigator-states.png)

---

## What's built

| Screen | Status | Notes |
|---|---|---|
| Practice Setup | ✅ Working prototype | Full filter/mode UI, writes to `sessionStorage` |
| Practice Session | ✅ Working prototype | All 4 question types, reveal, strikeout, bookmark, flag, timer, navigator |
| Library | 🔲 Not started | Spec in [`docs/screens/library.md`](docs/screens/library.md) |
| Authoring | 🔲 Not started | Spec in [`docs/screens/authoring.md`](docs/screens/authoring.md) |
| Review History | 🔲 Not started | Spec in [`docs/screens/review-history.md`](docs/screens/review-history.md) |
| Stats Dashboard | 🔲 Not started | Spec in [`docs/screens/stats-dashboard.md`](docs/screens/stats-dashboard.md) |

**Persistence:** [`schema.sql`](schema.sql) is complete and ready. The UI currently runs against a hardcoded in-memory fixture. The Electron shell and SQLite wiring are the next milestone.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Electron main process                              │
│  ├── main.js          BrowserWindow + app lifecycle │
│  ├── preload.js       contextBridge → window.api    │
│  └── db/              better-sqlite3 IPC handlers   │
│       └── schema.sql  (complete, not yet wired)     │
└────────────────────┬────────────────────────────────┘
                     │ IPC (window.api)
┌────────────────────▼────────────────────────────────┐
│  Renderer (HTML/CSS/JS — no framework)              │
│  ├── practice-setup/index.html                      │
│  │    └── setup.js + course-data.js (fixture)       │
│  └── practice-session/index.html                    │
│       ├── session.js (orchestrator)                 │
│       ├── seed.js (reads sessionStorage or fixture) │
│       ├── session-state.js (in-memory)              │
│       └── components/                              │
│            navigator.js · question-panel.js        │
│            explanation-panel.js · session-toolbar.js│
└─────────────────────────────────────────────────────┘
```

**CSS stack:** `tokens.css` → `reset.css` → `layout.css` → `components.css`

---

## Supported question types

| Type | Selection | Strikeout | Reveal | Rating |
|---|---|---|---|---|
| Single best answer MCQ | Single choice | ✅ right-click / Option+click | ✅ | — |
| Multi-select MCQ | Multiple choices | ✅ | ✅ | — |
| True / False | Binary | — | ✅ | — |
| Short answer | Text input | — | ✅ | Again / Hard / Good / Easy |

---

## Practice modes (specced, setup UI complete)

- **Free Practice** — work through questions at your own pace
- **Timed Block** — fixed duration, timer counts down
- **Review Incorrect** — only questions you've previously answered wrong
- **Spaced Repetition Review** — due flashcards and short-answer questions

---

## Hard constraints

This is a **local macOS MVP only**. The following are permanent out-of-scope items:

- No web deployment
- No accounts or login
- No cloud sync
- No multi-user features
- No AI question generation
- No moderation or community systems

---

## Content structure

```
Course
└── Unit
    └── Topic
        ├── Questions  (single_best · multi_select · true_false · short_answer)
        └── Flashcards
```

---

## What's next

See the open GitHub issues for the full implementation roadmap:

1. **Electron app shell** — `main.js`, `preload.js`, contextBridge, persistent nav
2. **SQLite persistence layer** — wire `better-sqlite3`, initialize schema, expose `window.api` IPC
3. **Session persistence** — write results, bookmarks, flags, review state to DB
4. **Library screen** — three-pane content browser
5. **Authoring screen** — full rich-text question and flashcard editor
6. **Review History + Stats Dashboard** — session log and progress overview

---

## Docs

| Doc | Purpose |
|---|---|
| [`mvp-scope.md`](mvp-scope.md) | Full feature scope and constraints |
| [`backlog.md`](backlog.md) | Phased implementation plan |
| [`schema.sql`](schema.sql) | Complete SQLite schema |
| [`data-model.md`](data-model.md) | Data model reference |
| [`review-system.md`](review-system.md) | Review and spaced repetition rules |
| [`docs/screens/`](docs/screens/) | Per-screen UI specifications |
| [`docs/component-rules.md`](docs/component-rules.md) | Component patterns |
| [`docs/design-tokens.md`](docs/design-tokens.md) | Design tokens reference |