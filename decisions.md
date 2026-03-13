# Decisions Log

## 2026-03-09 — Scope is local MVP only
**Decision**
Focus only on the local personal desktop app for now.

**Why**
Trying to spec the future web platform at the same time would bloat the MVP and slow actual development.

**Alternatives rejected**
- designing local + web together
- adding accounts early

---

## 2026-03-09 — Single-user, fully offline
**Decision**
No login, no accounts, no cloud features in MVP.

**Why**
The first real user is one person. Offline local use is the real requirement.

**Alternatives rejected**
- email/password auth
- local user profiles
- sync-first architecture

---

## 2026-03-09 — SQLite-style local database
**Decision**
Use a local embedded database model, with SQLite as the recommended fit.

**Why**
Single-user desktop app, offline, durable, simple, portable later.

**Alternatives rejected**
- JSON-only storage
- external local server
- cloud backend

---

## 2026-03-09 — Images embedded in DB
**Decision**
Store images in the local database for MVP.

**Why**
Keeps the app self-contained and easier to back up.

**Alternatives rejected**
- file-system asset folder
- mixed asset storage

---

## 2026-03-09 — Question hierarchy is fixed
**Decision**
Use Course → Unit/Module → Topic → Question/Flashcard.

**Why**
Clean enough for MVP and fits university course structure.

**Alternatives rejected**
- multi-topic membership
- looser tag-only organization

---

## 2026-03-09 — One topic per question in MVP
**Decision**
A question belongs to one topic only.

**Why**
Simplifies authoring, querying, and review behavior.

**Alternatives rejected**
- many-to-many topic mapping

---

## 2026-03-09 — WYSIWYG editor required
**Decision**
Use rich WYSIWYG authoring, not markdown-only.

**Why**
The product goal is high polish and easy authoring for rich educational content.

**Alternatives rejected**
- markdown + preview only
- plain text editor

---

## 2026-03-09 — Flashcards are in MVP
**Decision**
Flashcards are included from version 1.

**Why**
They fit the memory/review goal and pair naturally with spaced repetition.

**Alternatives rejected**
- MCQ-only MVP

---

## 2026-03-09 — Separate review systems
**Decision**
Use Anki-style explicit rating for flashcards and short-answer, and separate adaptive review for MCQs.

**Why**
MCQs and retrieval-style content do not behave the same.

**Alternatives rejected**
- one review algorithm for everything

---

## 2026-03-09 — Editing resets SR state
**Decision**
Editing flashcards or short-answer items resets spaced repetition history.

**Why**
Old review history becomes stale when content changes.

**Alternatives rejected**
- preserving SR history after edits

---

## 2026-03-09 — Explanations hidden until reveal
**Decision**
In practice sessions, the explanation panel stays hidden until answer reveal.

**Why**
Preserves test-like interaction and keeps the split layout meaningful.

**Alternatives rejected**
- explanation always visible
- explanation pre-expanded

---

## 2026-03-09 — Bookmark and flag have different meanings
**Decision**
Bookmark = useful/save for later. Flag = revisit or something is wrong.

**Why**
Different intents should not be mashed into one toggle blob.

**Alternatives rejected**
- one generic saved state

---

## 2026-03-09 — No copyrighted textbook content
**Decision**
The product should not rely on copied textbook or publisher material.

**Why**
Free/educational use is not a magic legal shield.

**Alternatives rejected**
- “it’s educational so it’s probably fine”
---

## 2026-03-10 — Electron for the application platform
**Decision**
Use Electron with `better-sqlite3` as the application wrapper.

**Why**
All existing UI is HTML/CSS/JS and works inside an Electron BrowserWindow without modification. `better-sqlite3` provides synchronous SQLite access from the Node.js main process. The renderer communicates with the database through a `contextBridge` IPC API (`window.api`). For a personal single-user local tool, the binary size overhead is irrelevant.

**Alternatives rejected**
- Tauri: adds a Rust language boundary for all DB access with no benefit for this use case
- Local Node.js + browser: no double-clickable .app, worse for daily use
- Swift + WKWebView: requires Swift knowledge and custom JS↔Swift IPC plumbing; no improvement on what matters for MVP