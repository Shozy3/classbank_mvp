# Component Inventory

## Global components

### App navigation
Used to switch between:
- Library
- Authoring
- Practice Setup
- Practice Session
- Review History
- Stats Dashboard

#### States
- default
- active
- hover
- focus

---

## Library components

### Hierarchy sidebar
Displays Course → Unit → Topic tree.

#### States
- collapsed
- expanded
- selected
- hover
- drag/move target (if supported later)

### Content list item
Represents a question or flashcard in the library.

#### States
- default
- selected
- bookmarked
- flagged
- hover

### Preview panel
Displays selected item summary.

#### States
- empty
- populated

### Bulk action toolbar
Used for batch operations.

#### States
- hidden (no selection)
- visible (selection active)
- disabled (invalid action)

---

## Authoring components

### Rich editor surface
Used for stem/front/back/explanations/model answer.

#### States
- empty
- editing
- focused
- invalid
- read-only preview (if used)

### Choice editor
Used for MCQ answer options.

#### States
- default
- correct
- incorrect
- selected for editing
- validation error

### Save bar
Contains Save / Duplicate / Delete.

#### States
- idle
- unsaved changes
- saving
- save success
- save error

---

## Practice Setup components

### Filter panel
Contains all session filters.

#### States
- default
- active filter
- disabled
- no results warning

### Mode selector
Selects practice mode.

#### States
- default
- selected

### Start session button
Primary action to generate a session.

#### States
- enabled
- disabled
- loading

---

## Practice Session components

### Question panel
Left-side main interaction area.

#### States
- default
- unanswered
- answered
- skipped
- revealed

### Explanation panel
Right-side panel shown after reveal.

#### States
- hidden
- revealed
- loading (if rendering heavy content)
- empty fallback

### Answer choice
MCQ option component.

#### States
- default
- hover
- selected
- strikeout
- correct
- incorrect
- partial-credit-related display
- disabled after reveal

### Short-answer input
Input area for manual response.

#### States
- empty
- focused
- filled
- revealed/read-only

### Flashcard card
Front/back review component.

#### States
- front
- back
- rated

### Navigator item
Question number or item indicator.

#### States
- unseen
- current
- answered
- skipped
- flagged
- bookmarked
- correct
- incorrect

### Session toolbar
Contains navigation and session actions.

#### Actions
- previous
- next
- skip
- reveal/submit
- bookmark
- flag

### Timer display
Shows block/per-question timing.

#### States
- running
- paused (if ever allowed later)
- expired

---

## Review and stats components

### Session history card
Represents one completed session.

#### States
- default
- selected
- hover

### Streak card
Stats dashboard component.

#### States
- default
- empty/new user

---

## Universal visual states to support

Every interactive component should account for:
- default
- hover
- focus
- active
- selected
- disabled
- correct
- incorrect
- partial credit
- flagged
- bookmarked
- hidden
- revealed
- unanswered
- skipped