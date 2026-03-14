# Issue #4 — Phase 2: Library Screen
## Implementation & Testing Plan

---

## 1. Context and Current State

| Issue | Status |
|---|---|
| #1 Electron shell | Done |
| #2 SQLite persistence | Done |
| #3 Session write-back | Done |
| **#4 Library screen** | **This plan** |

Currently blocked by this issue:
- **AT-001** — course/unit/topic creation flow
- **AT-002** (partial) — question list and preview, before authoring

Existing capabilities this issue builds on:
- `getCourses`, `getUnits`, `getTopics`, `getQuestions` are fully operational
- `better-sqlite3` is wired through IPC via `contextBridge`
- Schema has full CASCADE delete, indexes, and all content fields
- Sample fixture data is seeded on first run

---

## 2. Deliverables Checklist

- [ ] New DB functions in `db/index.js` (hierarchy CRUD + content mutations + queries)
- [ ] New IPC handlers in `main.js`
- [ ] New `preload.js` entries
- [ ] `library/index.html` — three-pane layout
- [ ] `library/css/library.css` — layout + component styles
- [ ] `library/js/library.js` — bootstrap and event wiring
- [ ] `library/js/state/library-state.js` — state container
- [ ] `library/js/components/hierarchy-tree.js`
- [ ] `library/js/components/item-list.js`
- [ ] `library/js/components/preview-panel.js`
- [ ] `library/js/components/toolbar.js`
- [ ] Shared navigation bar included in `library/index.html` and `practice-setup/index.html`
- [ ] `tests/library-db.test.mjs` — DB-level unit tests
- [ ] Smoke tests extended in `temp/pw-runner/electron-db-smoke.mjs`
- [ ] AT-001 unblocked and passing in `temp/pw-runner/interactive-at-runner.mjs`

---

## 3. DB Layer

All new functions go in `db/index.js` and are added to `module.exports`.

IDs are generated with `crypto.randomUUID()` (Node 14.17+ built-in, available in Electron).

### 3.1 Hierarchy CRUD

#### `createCourse({ name, code })`
```sql
INSERT INTO courses (id, name, code, created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
```
Returns the inserted row shape: `{ courseId, courseName, courseCode, createdAt, updatedAt }`.  
Validates: `name` is a non-empty string.

#### `updateCourse({ courseId, name, code })`
```sql
UPDATE courses SET name = ?, code = ?, updated_at = ? WHERE id = ?
```
Validates: `courseId` exists (throw on 0 rows changed).

#### `deleteCourse(courseId)`
```sql
DELETE FROM courses WHERE id = ?
```
CASCADE in schema removes all units → topics → questions/choices/flashcards. Validates row exists.

#### `createUnit({ courseId, name })`
```sql
INSERT INTO units (id, course_id, name, sort_order, created_at, updated_at)
VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order),0)+1 FROM units WHERE course_id = ?), ?, ?)
```
Returns inserted row. Validates `courseId` non-empty string.

#### `updateUnit({ unitId, name })`
```sql
UPDATE units SET name = ?, updated_at = ? WHERE id = ?
```

#### `deleteUnit(unitId)`
```sql
DELETE FROM units WHERE id = ?
```
CASCADE removes topics and their content.

#### `createTopic({ unitId, name })`
```sql
INSERT INTO topics (id, unit_id, name, sort_order, created_at, updated_at)
VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order),0)+1 FROM topics WHERE unit_id = ?), ?, ?)
```

#### `updateTopic({ topicId, name })`
```sql
UPDATE topics SET name = ?, updated_at = ? WHERE id = ?
```

#### `deleteTopic(topicId)`
```sql
DELETE FROM topics WHERE id = ?
```
CASCADE removes questions/choices/flashcards for that topic.

---

### 3.2 Content Queries

#### `getFlashcards(topicId)`
Mirrors the shape of `getQuestions` but for flashcards:
```sql
SELECT id, topic_id, front_rich_text, back_rich_text, reference_text,
       is_bookmarked, is_flagged, review_count, lapse_count,
       due_at, last_reviewed_at, created_at, updated_at, last_edited_at
FROM flashcards
WHERE topic_id = ?
ORDER BY id ASC
```
Returns array of `{ flashcardId, topicId, frontHtml, backHtml, referenceText, isBookmarked, isFlagged, reviewCount, lapseCount, dueAt, lastReviewedAt, createdAt, updatedAt, lastEditedAt }`.

Validates `topicId` non-empty string.

#### `getItemCountsByTopic(topicIds)`
Batch query for showing counts in hierarchy rows:
```sql
SELECT topic_id,
  COUNT(*) FILTER (WHERE content_type = 'question') AS question_count,
  COUNT(*) FILTER (WHERE content_type = 'flashcard') AS flashcard_count
FROM (
  SELECT topic_id, 'question' AS content_type FROM questions WHERE topic_id IN (...)
  UNION ALL
  SELECT topic_id, 'flashcard' AS content_type FROM flashcards WHERE topic_id IN (...)
)
GROUP BY topic_id
```
Returns `[{ topicId, questionCount, flashcardCount }]`. Validates `topicIds` is a non-empty array of strings.

#### `searchItems({ query, topicId, courseId, unitId, type })`
Scope filtering: if `topicId` given, restrict to that topic. If `unitId`, join through topics. If `courseId`, join units + topics.

```sql
-- questions
SELECT 'question' AS content_type, q.id, q.title, q.stem_rich_text AS preview_text,
       q.question_type, q.difficulty, q.is_bookmarked, q.is_flagged,
       q.last_edited_at, q.topic_id
FROM questions q
[JOIN topics t ON q.topic_id = t.id [JOIN units u ON t.unit_id = u.id]]
WHERE (q.title LIKE ? OR q.stem_rich_text LIKE ?)
  [AND scope filter]

UNION ALL

-- flashcards
SELECT 'flashcard' AS content_type, f.id, NULL AS title, f.front_rich_text AS preview_text,
       'flashcard' AS question_type, NULL AS difficulty, f.is_bookmarked, f.is_flagged,
       f.last_edited_at, f.topic_id
FROM flashcards f
[JOIN topics t ON f.topic_id = t.id [JOIN units u ON t.unit_id = u.id]]
WHERE f.front_rich_text LIKE ?
  [AND scope filter]

ORDER BY last_edited_at DESC
LIMIT 200
```
LIKE pattern: `'%' + query.replace(/%_/g, '\\$&') + '%'` — sanitized against injection.  
Validates `query` non-empty string (min 2 chars to prevent full-table scan).

---

### 3.3 Content Mutations

#### `deleteQuestion(questionId)`
```sql
DELETE FROM questions WHERE id = ?
```
CASCADE removes `question_choices`. Validates `questionId` non-empty string.

#### `deleteFlashcard(flashcardId)`
```sql
DELETE FROM flashcards WHERE id = ?
```

#### `duplicateQuestion(questionId)`
1. Read original question row + its choices.
2. Insert new question row with `crypto.randomUUID()` ID, `title = (original.title || 'Question') + ' (copy)'`, `times_seen=0`, `times_correct=0`, `times_incorrect=0`, `last_result=null`, `last_used_at=null`, same topic.
3. Insert cloned choices with new IDs.
4. Returns new question object (same shape as `getQuestions`).

#### `duplicateFlashcard(flashcardId)`
1. Read original flashcard row.
2. Insert new row with `crypto.randomUUID()` ID, `sr_state_json=null`, `due_at=null`, `review_count=0`, `lapse_count=0`, same topic.
3. Returns new flashcard object.

#### `moveItems({ itemIds, targetTopicId, contentType })`
Validate `targetTopicId` exists in `topics` table.
```sql
-- for questions:
UPDATE questions SET topic_id = ?, updated_at = ? WHERE id IN (...)
-- for flashcards:
UPDATE flashcards SET topic_id = ?, updated_at = ? WHERE id IN (...)
```
Both types can be passed in one call by splitting `itemIds` by type.

#### `updateItemFlags({ itemId, contentType, isBookmarked, isFlagged })`
```sql
-- questions:
UPDATE questions SET is_bookmarked = ?, is_flagged = ?, updated_at = ? WHERE id = ?
-- flashcards:
UPDATE flashcards SET is_bookmarked = ?, is_flagged = ?, updated_at = ? WHERE id = ?
```
Validates `contentType` is `'question'` or `'flashcard'`. Used by the preview panel's toggle actions.

---

## 4. IPC Layer

### 4.1 New `ipcMain.handle` registrations in `main.js`

```js
ipcMain.handle('db:createCourse',         withDbHandler('createCourse',         (p) => createCourse(p)));
ipcMain.handle('db:updateCourse',         withDbHandler('updateCourse',         (p) => updateCourse(p)));
ipcMain.handle('db:deleteCourse',         withDbHandler('deleteCourse',         (id) => deleteCourse(id)));
ipcMain.handle('db:createUnit',           withDbHandler('createUnit',           (p) => createUnit(p)));
ipcMain.handle('db:updateUnit',           withDbHandler('updateUnit',           (p) => updateUnit(p)));
ipcMain.handle('db:deleteUnit',           withDbHandler('deleteUnit',           (id) => deleteUnit(id)));
ipcMain.handle('db:createTopic',          withDbHandler('createTopic',          (p) => createTopic(p)));
ipcMain.handle('db:updateTopic',          withDbHandler('updateTopic',          (p) => updateTopic(p)));
ipcMain.handle('db:deleteTopic',          withDbHandler('deleteTopic',          (id) => deleteTopic(id)));
ipcMain.handle('db:getFlashcards',        withDbHandler('getFlashcards',        (topicId) => getFlashcards(topicId)));
ipcMain.handle('db:getItemCountsByTopic', withDbHandler('getItemCountsByTopic', (ids) => getItemCountsByTopic(ids)));
ipcMain.handle('db:searchItems',          withDbHandler('searchItems',          (p) => searchItems(p)));
ipcMain.handle('db:deleteQuestion',       withDbHandler('deleteQuestion',       (id) => deleteQuestion(id)));
ipcMain.handle('db:deleteFlashcard',      withDbHandler('deleteFlashcard',      (id) => deleteFlashcard(id)));
ipcMain.handle('db:duplicateQuestion',    withDbHandler('duplicateQuestion',    (id) => duplicateQuestion(id)));
ipcMain.handle('db:duplicateFlashcard',   withDbHandler('duplicateFlashcard',   (id) => duplicateFlashcard(id)));
ipcMain.handle('db:moveItems',            withDbHandler('moveItems',            (p) => moveItems(p)));
ipcMain.handle('db:updateItemFlags',      withDbHandler('updateItemFlags',      (p) => updateItemFlags(p)));
```

Import all new functions at the top of `main.js`.

### 4.2 New `preload.js` entries

```js
createCourse:         (p) => ipcRenderer.invoke('db:createCourse', p),
updateCourse:         (p) => ipcRenderer.invoke('db:updateCourse', p),
deleteCourse:         (id) => ipcRenderer.invoke('db:deleteCourse', id),
createUnit:           (p) => ipcRenderer.invoke('db:createUnit', p),
updateUnit:           (p) => ipcRenderer.invoke('db:updateUnit', p),
deleteUnit:           (id) => ipcRenderer.invoke('db:deleteUnit', id),
createTopic:          (p) => ipcRenderer.invoke('db:createTopic', p),
updateTopic:          (p) => ipcRenderer.invoke('db:updateTopic', p),
deleteTopic:          (id) => ipcRenderer.invoke('db:deleteTopic', id),
getFlashcards:        (topicId) => ipcRenderer.invoke('db:getFlashcards', topicId),
getItemCountsByTopic: (ids) => ipcRenderer.invoke('db:getItemCountsByTopic', ids),
searchItems:          (p) => ipcRenderer.invoke('db:searchItems', p),
deleteQuestion:       (id) => ipcRenderer.invoke('db:deleteQuestion', id),
deleteFlashcard:      (id) => ipcRenderer.invoke('db:deleteFlashcard', id),
duplicateQuestion:    (id) => ipcRenderer.invoke('db:duplicateQuestion', id),
duplicateFlashcard:   (id) => ipcRenderer.invoke('db:duplicateFlashcard', id),
moveItems:            (p) => ipcRenderer.invoke('db:moveItems', p),
updateItemFlags:      (p) => ipcRenderer.invoke('db:updateItemFlags', p),
```

---

## 5. Frontend Structure

```
library/
  index.html
  css/
    library.css           # layout grid + all Library component styles
  js/
    library.js            # DOMContentLoaded bootstrap + global event wiring
    state/
      library-state.js    # singleton state store with pub/sub
    components/
      hierarchy-tree.js   # left pane course/unit/topic tree
      item-list.js        # center pane list + toolbar
      preview-panel.js    # right pane item preview
      toolbar.js          # top bar breadcrumb + global create actions
```

Shared navigation bar: a `<nav class="app-nav">` strip embedded inline in each page's HTML (no shared import needed for MVP). Links: **Library** | **Practice** | eventually **Authoring**.

---

## 6. Layout Spec

Three-column grid, full-height:

```
┌─────────────────────────────────────────────────────────┐
│ [AppNav: Library | Practice]                             │
├──────────────┬───────────────────────────┬──────────────┤
│ HierarchyTree│ ItemList                  │ PreviewPanel │
│ 240px fixed  │ flex: 1                   │ 320px fixed  │
│              │                           │  (hidden if  │
│ + Course     │ [Toolbar]                 │   no sel.)   │
│ ▸ Course A   │ ┌──────────────────────┐  │              │
│   ▸ Unit 1   │ │ item row             │  │  Stem/Front  │
│     • Topic X│ │ item row             │  │  preview     │
│     • Topic Y│ │ item row             │  │              │
│   ▸ Unit 2   │ └──────────────────────┘  │  [Duplicate] │
│              │                           │  [Move...]   │
│              │                           │  [Delete]    │
└──────────────┴───────────────────────────┴──────────────┘
```

CSS approach:
- Outer layout: `display: grid; grid-template-columns: 240px 1fr 320px`
- Use `--color-*` tokens from `practice-session/css/tokens.css` (import or duplicate)
- All panels: `overflow-y: auto; height: 100vh - nav height`
- Preview panel: `display: none` until an item is selected

---

## 7. Component Specifications

### 7.1 `library-state.js`

```js
// Singleton state with event emitter pattern
const state = {
  // hierarchy cache
  courses: [],
  units: {},          // courseId → Unit[]
  topics: {},         // unitId → Topic[]
  expanded: {
    courses: new Set(),
    units: new Set(),
  },

  // selected context
  selectedCourseId: null,
  selectedUnitId: null,
  selectedTopicId: null,

  // items for current topic
  items: [],          // merged questions + flashcards
  isLoadingItems: false,

  // filters (applied client-side)
  searchQuery: '',
  typeFilter: 'all',          // 'all' | 'question' | 'flashcard'
  statusFilter: 'all',        // 'all' | 'bookmarked' | 'flagged'

  // selection
  selectedItemId: null,
  selectedItemType: null,      // 'question' | 'flashcard'
  bulkSelectedIds: new Set(),

  // modal state
  confirmDeleteModal: null,    // { type, id, name } | null
  moveModal: null,             // { itemIds, contentType } | null
};
```

Exposes:
- `subscribe(key, handler)` / `dispatch(key, value)` for reactive updates
- `getFilteredItems()` — pure compute from `items` + filters

### 7.2 `hierarchy-tree.js`

**Rendering:**
- Each node: `<div class="tree-node [course|unit|topic] [selected] [expanded]">`
- Expand/collapse chevron toggle
- Node label (truncated to ~24 chars with `title` tooltip)
- Right-side "+" add-child button (visible on hover)
- "⋮" menu button (hover) → Rename / Delete

**Load strategy:**
- On mount: call `window.api.getCourses()`, render all courses collapsed
- On course expand: call `window.api.getUnits(courseId)`, render units
- On unit expand: call `window.api.getTopics(unitId)`, render topics
- Cache results in `state.units[courseId]` / `state.topics[unitId]`

**Inline rename:**
- Double-click → replace label `<span>` with `<input>` with current name
- `blur` or `Enter` → call `updateCourse/Unit/Topic`
- `Escape` → revert without saving

**Delete flow:**
- Click Delete in menu → set `state.confirmDeleteModal = { type, id, name }`
- Confirm → DB delete → remove from local state cache → re-render

**Create flow:**
- Click "+" on course row → prompt inline input at bottom of course's unit list → `createUnit`
- Click "+" on unit row → prompt inline input at bottom of unit's topic list → `createTopic`
- Top "Create Course" button → inline input at bottom of course list

### 7.3 `item-list.js`

**Toolbar** (top of center pane):
- Search input `<input type="search">` → updates `state.searchQuery` → client-side filter (no DB call)
- Type filter pills: `All` / `MCQ` / `True/False` / `Short Answer` / `Flashcard`
- Status filter pills: `All` / `Bookmarked` / `Flagged`
- "Create Question" button (disabled, tooltip: "Open authoring to create content") — wired in Issue #5
- Item count: `N items`

**Row spec** (per item):
```
[ □ ] [TypeBadge] [Title/stem text, truncated 1 line]   [●●○○○] [🔖] [⚑] [last edited]
```
- Checkbox: for bulk selection
- TypeBadge: `MCQ` / `TF` / `SA` / `Flash` — colored pill, 12px semibold
- Title: `question.title` if present, else first 80 chars of stripped `stem_rich_text`
- Difficulty dots: 5 dots, filled per `difficulty` value; gray if null
- Bookmark icon: filled if `isBookmarked`; click → `updateItemFlags`
- Flag icon: filled if `isFlagged`; click → `updateItemFlags`
- Last edited: relative date, 12px muted
- Hover: reveals inline Duplicate / Delete icons on far right

**Bulk actions bar** (appears when `bulkSelectedIds.size > 0`):
```
[X selected] [Duplicate] [Move to…] [Delete]
```

**Empty states:**
- No topic selected: `<p class="empty-state">Select a topic to view its content.</p>`
- Topic selected but empty: `<p class="empty-state">No items yet.</p>` with "Create Question" and "Create Flashcard" links (disabled for now)
- Filtered to zero: `<p class="empty-state">No items match your filters.</p>`

**Item click:** set `state.selectedItemId` + `state.selectedItemType` → trigger preview panel render.

**Sorting:** questions first, then flashcards, alphabetically by display title COLLATE NOCASE. (No user-sortable columns for MVP.)

### 7.4 `preview-panel.js`

Hidden (`display: none`) until an item is selected.

**For question:**
```
[TypeBadge]  [Difficulty ●●●○○]
[Bookmark icon]  [Flag icon]

Stem (stripped HTML, max ~300 chars, "..." if truncated)

Choices (if MCQ, up to 5 rows):
  A. Choice text (truncated)
  B. Choice text

Last edited: [date]   Topic: [name]
──────────────────
[Duplicate]  [Move to…]  [Delete]
```

**For flashcard:**
```
[Flashcard badge]  [Bookmark icon]  [Flag icon]

Front: (stripped HTML, truncated)
Back:  (stripped HTML, truncated)

Last edited: [date]   Topic: [name]
──────────────────
[Duplicate]  [Move to…]  [Delete]
```

HTML stripping: use a simple regex `/<[^>]*>/g` to remove tags for preview display — this is sufficient for a read-only abbreviated preview in the MVP.

**Actions:**
- **Duplicate**: call `duplicateQuestion` or `duplicateFlashcard` → refresh item list → select new item
- **Move to…**: open `MoveItemModal` → on confirm, call `moveItems` → refresh + close
- **Delete**: open `ConfirmDeleteModal` → on confirm, call `deleteQuestion` or `deleteFlashcard` → refresh item list → clear preview

### 7.5 Modals

Two lightweight inline modals rendered with a `<dialog>` element or a positioned overlay div.

**ConfirmDeleteModal:**
```
"Delete [name]?"
"This cannot be undone."
[Cancel]  [Delete]
```

**MoveItemModal:**
```
"Move [N item(s)] to:"
[Course dropdown → Unit dropdown → Topic dropdown]
 OR a nested tree picker (simpler: cascading selects)
[Cancel]  [Move]
```
Uses existing `getCourses` / `getUnits` / `getTopics` IPC calls to populate selects.

---

## 8. Navigation Integration

Add a `<header class="app-nav">` at the top of both `practice-setup/index.html` and the new `library/index.html`:

```html
<header class="app-nav">
  <span class="app-name">ClassBank</span>
  <nav>
    <a href="../library/index.html" class="nav-link [active]">Library</a>
    <a href="../practice-setup/index.html" class="nav-link [active]">Practice</a>
  </nav>
</header>
```

Nav bar height: 44px. Use `file://` relative hrefs; `main.js` already allows these (`will-navigate` handler passes them through).

Styles go in a shared `nav` block inside each screen's CSS file — no shared CSS file needed for MVP.

---

## 9. Testing Plan

### 9.1 DB Unit Tests — `tests/library-db.test.mjs`

Use a fresh in-memory `better-sqlite3` database per test (`:memory:`) initialized from `schema.sql`.

```
createCourse
  ✓ inserts row with correct name, code, timestamps
  ✓ returns correct shape { courseId, courseName, ... }
  ✓ throws if name is empty string

updateCourse
  ✓ changes name and updated_at
  ✓ throws if courseId does not exist

deleteCourse
  ✓ removes course row
  ✓ cascades to units, topics, questions, choices, flashcards
  ✓ throws if courseId does not exist

createUnit
  ✓ inserts with correct course_id
  ✓ auto-increments sort_order (second unit gets sort_order 2)
  ✓ throws if courseId is empty

deleteUnit
  ✓ removes unit and cascades to topics/questions/flashcards

createTopic
  ✓ inserts with correct unit_id
  ✓ auto-increments sort_order

deleteTopic
  ✓ removes topic and cascades questions and flashcards

getFlashcards
  ✓ returns all flashcards for given topicId
  ✓ returns correct shape (flashcardId, frontHtml, etc.)
  ✓ returns [] for topic with no flashcards
  ✓ throws if topicId is empty

getItemCountsByTopic
  ✓ returns correct question_count and flashcard_count per topic
  ✓ returns zeros for topics with no content
  ✓ only returns rows for requested topicIds

duplicateQuestion
  ✓ creates new row with new ID, same topic
  ✓ title gets " (copy)" suffix
  ✓ times_seen, times_correct, times_incorrect reset to 0
  ✓ duplicates all choice rows with new IDs
  ✓ choice fields (label, is_correct, sort_order) are preserved

duplicateFlashcard
  ✓ creates new row with new ID, same topic
  ✓ sr_state_json, due_at, review_count reset

moveItems
  ✓ updates topic_id for question(s)
  ✓ updates topic_id for flashcard(s)
  ✓ throws if targetTopicId does not exist
  ✓ mixed question+flashcard moves handled

deleteQuestion
  ✓ removes question row
  ✓ removes associated question_choices rows
  ✓ throws if questionId does not exist

deleteFlashcard
  ✓ removes flashcard row

updateItemFlags
  ✓ sets is_bookmarked on question
  ✓ sets is_flagged on flashcard
  ✓ throws on invalid contentType

searchItems
  ✓ returns questions matching stem text
  ✓ returns flashcards matching front text
  ✓ scopes results to topicId when provided
  ✓ scopes results to courseId when provided
  ✓ returns empty array for no matches
  ✓ throws if query is fewer than 2 characters
  ✓ LIKE pattern is correctly escaped (no injection via % or _)
```

**Test runner:** Node's built-in `node:test` module (available in Node 18+ / Electron 22+). No external test framework needed.

Run with: `node --test tests/library-db.test.mjs`

### 9.2 Electron IPC Smoke Tests — extend `temp/pw-runner/electron-db-smoke.mjs`

Add a new `librarySmoke` test group:

```
db:createCourse     → { courseId, courseName }
db:getUnits         → returns empty array for new course
db:createUnit       → { unitId, unitName }
db:getTopics        → returns empty for new unit
db:createTopic      → { topicId, topicName }
db:getFlashcards    → returns [] for empty topic
db:getItemCountsByTopic → returns [{topicId, questionCount:0, flashcardCount:0}]
db:duplicateQuestion    → new item returned, different id
db:duplicateFlashcard   → new item returned, different id
db:moveItems            → question topicId changes
db:updateItemFlags      → is_bookmarked toggles correctly
db:deleteQuestion       → removed from subsequent getQuestions
db:deleteFlashcard      → removed from subsequent getFlashcards
db:deleteTopic          → topic gone from getTopics
db:deleteUnit           → unit gone from getUnits
db:deleteCourse         → course gone from getCourses
db:searchItems          → returns matching seeded question
db:updateCourse         → name updated in getCourses
db:updateUnit           → name updated in getUnits
db:updateTopic          → name updated in getTopics
```

Run with the Electron binary as currently done in the existing smoke test.

### 9.3 Playwright UI Acceptance Tests

These target the library screen via the existing Playwright runner at `temp/pw-runner/interactive-at-runner.mjs` (served at `http://127.0.0.1:8741`).

**AT-001** — now fully implementable:

```
AT-001a: Create a course
  1. Navigate to library/index.html
  2. Click "Create Course"
  3. Input name "Test Course" → confirm
  Expected: "Test Course" appears in hierarchy tree

AT-001b: Create a unit inside a course
  1. Expand "Test Course"
  2. Click "+" next to course → input "Unit 1" → confirm
  Expected: "Unit 1" nested under "Test Course"

AT-001c: Create a topic inside a unit
  1. Expand "Unit 1"
  2. Click "+" next to unit → input "Topic A" → confirm
  Expected: "Topic A" nested under "Unit 1"

AT-001d: Rename a unit
  1. Double-click "Unit 1" → type "Unit One" → Enter
  Expected: label updated to "Unit One"

AT-001e: Delete a topic
  1. Click "⋮" on "Topic A" → Delete
  2. Confirm in modal
  Expected: "Topic A" removed from hierarchy tree
```

New Library-specific acceptance tests to add:

```
LIB-001: Item list loads for selected topic
  1. Select any seeded topic
  Expected: item rows appear in center pane

LIB-002: Type filter filters correctly
  1. Select "MCQ" pill
  Expected: only MCQ-type rows visible; other types hidden

LIB-003: Search narrows list
  1. Type a word from a known seeded question stem
  Expected: only matching item(s) remain visible

LIB-004: Bookmark filter
  1. Bookmark an item via preview panel
  2. Select "Bookmarked" status filter
  Expected: only bookmarked items shown

LIB-005: Preview renders for selected item
  1. Click any item row
  Expected: preview panel appears with stem/front text

LIB-006: Duplicate question
  1. Click Duplicate in preview panel
  Expected: new row "(copy)" appears in item list

LIB-007: Delete question
  1. Click Delete in preview panel → confirm
  Expected: item removed from list; preview panel hidden

LIB-008: Move item to a different topic
  1. Open Move modal on an item
  2. Select different topic
  3. Confirm
  Expected: item no longer in original topic list

LIB-009: Empty topic empty state
  1. Select topic with no items
  Expected: "No items yet." message

LIB-010: Empty course empty state
  1. Delete all sample data or create fresh empty course
  Expected: "No courses yet." + Create Course prompt
```

### 9.4 Manual Testing Checklist

Before marking issue closed:

**Layout & navigation:**
- [ ] App starts, nav bar shows Library and Practice links
- [ ] Clicking Library navigates to `library/index.html` without error
- [ ] Clicking Practice navigates back to `practice-setup/index.html`
- [ ] Three-pane layout renders correctly; colums are correct widths
- [ ] Preview pane hidden when no item selected
- [ ] Window resize (narrower) doesn't break layout

**Hierarchy tree:**
- [ ] All seeded courses/units/topics load
- [ ] Expanding a course loads its units
- [ ] Expanding a unit loads its topics
- [ ] Clicking a topic highlights it and loads items in center pane
- [ ] Create Course → new course appears at end of list
- [ ] Create Unit under existing course → appears under correct course
- [ ] Create Topic under existing unit → appears under correct unit
- [ ] Rename course (double-click) → name updates on blur
- [ ] Rename unit → name updates
- [ ] Rename topic → name updates
- [ ] Delete topic → confirm modal → removed from tree
- [ ] Delete unit → confirm modal → topic and items also removed
- [ ] Delete course → confirm modal → all children removed

**Item list:**
- [ ] Questions and flashcards for selected topic appear
- [ ] Row shows: type badge, title/stem preview, difficulty dots, bookmark, flag, last-edited date
- [ ] Flashcard rows show "Flash" badge; question rows show "MCQ" / "TF" / "SA"
- [ ] Search input filters list instantly without DB call
- [ ] Clearing search restores full list
- [ ] Type filter "MCQ" shows only MCQ questions
- [ ] Bookmark filter shows only bookmarked items
- [ ] Empty topic shows empty state message
- [ ] Clicking bookmark icon in row toggles bookmark state persistently (survives topic change)

**Preview panel:**
- [ ] Click a question → stem text visible, choices listed
- [ ] Click a flashcard → front and back text visible
- [ ] Difficulty dots match the item's difficulty value
- [ ] Clicking different row updates preview
- [ ] Duplicate action creates new item, new row selected in list
- [ ] Delete action removes item, preview hidden
- [ ] Move action opens modal, moves item to target topic

**Dark mode:**
- [ ] All backgrounds use design token colors (no hardcoded white)
- [ ] Text contrast is sufficient in all states
- [ ] Selected node in tree is clearly distinguished
- [ ] Type badges are readable
- [ ] Hover states are visible

**Persistence:**
- [ ] Quit and relaunch app — created courses/units/topics persist
- [ ] Created items persist
- [ ] Renamed nodes persist
- [ ] Deleted nodes are gone after restart

---

## 10. Implementation Order

| Step | File(s) | Notes |
|---|---|---|
| 1 | `db/index.js` | All hierarchy CRUD + content mutation functions |
| 2 | `main.js`, `preload.js` | Wire new IPC handlers + bridge entries |
| 3 | `tests/library-db.test.mjs` | DB tests (can run before UI exists) |
| 4 | `library/index.html`, `library/css/library.css` | Layout shell, three-pane grid, empty states |
| 5 | `library/js/state/library-state.js` | State store |
| 6 | `library/js/components/hierarchy-tree.js` | Read-only tree first (just loads + selects) |
| 7 | `library/js/components/item-list.js` | Read-only list + search/filter |
| 8 | `library/js/components/preview-panel.js` | Read-only preview |
| 9 | `library/js/library.js` | Bootstrap wires components together |
| 10 | Add hierarchy mutations (create/rename/delete) | Inline inputs + confirm modal |
| 11 | Add item mutations (duplicate/move/delete) | Preview panel actions + move modal |
| 12 | Bookmark/flag toggles in row and preview | |
| 13 | App nav bar in `library/index.html` + `practice-setup/index.html` | |
| 14 | Extend IPC smoke test | |
| 15 | AT-001 Playwright test | |

---

## 11. Out of Scope for Issue #4

These are explicitly deferred to later issues:

- **Rich text editing / authoring**: Issue #5
- **Rich text rendering in preview**: MVP preview uses stripped plain text only
- **Drag-to-reorder** hierarchy nodes or items (schema has `sort_order` for future use)
- **Timed block mode** in Practice Setup: Issue #7
- **Spaced repetition / flashcard SR rating**: Issues #9, #10
- **Review History / Stats Dashboard**: Issue #6
- **Backup / restore**: Issue #12
