# UI Specification

## Design target

Near-production quality UI spec with high polish.

The app should feel:
- premium
- dense but readable
- fast
- calm
- serious
- optimized for long study sessions

Not a toy. Not a note app wearing a fake moustache.

## Global design principles

1. Content comes first.
2. Practice flow must feel fast.
3. Navigation should never feel lost.
4. Explanations should be immediately useful.
5. Dark mode is first-class.
6. Heavy content must remain visually calm.

## Global layout

The app contains these main sections:
- Library
- Authoring
- Practice Setup
- Practice Session
- Review History
- Stats Dashboard

High-level navigation should be persistent and visually obvious.

---

## 1. Library

### Purpose
Browse, search, filter, and manage all study content.

### Layout
- Left sidebar: Course → Unit → Topic hierarchy
- Main pane: list/grid of questions and flashcards
- Optional right preview pane: selected item preview
- Top toolbar: search, filters, create, bulk actions

### Core components
- hierarchy tree
- item list
- item type badges
- bookmark indicator
- flag indicator
- filter controls
- bulk action controls
- preview panel

### Actions
- create course/unit/topic
- create question
- create flashcard
- search/filter
- duplicate item
- bulk edit
- delete item
- move item

### Empty states
- no courses yet
- no items in selected topic
- no search results

### Error states
- failed save
- invalid move
- corrupt item content

---

## 2. Authoring

### Purpose
Create and edit questions and flashcards.

### Layout
- Header action bar: Save, Duplicate, Delete
- Main editor body
- Structured sections stacked vertically or in tabs:
  - metadata
  - stem/front
  - choices
  - main explanation
  - per-choice explanations
  - model answer or back
  - references

### Required capabilities
- choose content type
- assign course/unit/topic
- rich WYSIWYG editing
- insert images
- insert tables
- insert code blocks
- insert LaTeX
- add/edit answer choices
- mark correct choices
- save draft
- duplicate
- delete

### States
- clean
- unsaved changes
- saving
- save success
- validation error

### Validation rules
- MCQ must have at least one choice
- single-best-answer must have exactly one correct choice
- multi-select must have at least one correct choice
- short-answer must have model answer
- flashcard must have front and back
- topic assignment required

---

## 3. Practice Setup

### Purpose
Generate a study session using filters.

### Layout
- Left column: filters
- Right column: mode settings and session summary
- Bottom primary action: Start Session

### Filters
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

### Session settings
- mode:
  - Free Practice
  - Timed Block
  - Review Incorrect
  - Spaced Repetition Review
- shuffle questions
- shuffle answer choices
- timer mode:
  - none
  - per block
  - per question
  - both where applicable

### Empty / warning states
- no matching items
- fewer items than requested
- no due SR items

---

## 4. Practice Session

### Purpose
Core answering and review experience.

### Non-negotiable layout
- Left panel: question interaction
- Right panel: explanation panel
- Navigator: persistent question navigation

### Layout behavior
- Right panel is hidden until reveal
- Left panel expands when right panel is hidden
- Once revealed, explanation panel appears without feeling abrupt
- Navigator must remain quickly accessible

### Left panel content
- question stem
- image/media if present
- answer choices or short-answer input
- action controls:
  - previous
  - next
  - reveal/submit
  - skip
  - bookmark
  - flag
  - strikeout interaction
- timer display where applicable

### Right panel content
- correctness result
- main explanation
- per-choice explanation
- references
- optional images/figures
- model answer for short-answer
- self-rating controls for SR content

### Navigator states
- unseen
- current
- answered
- skipped
- flagged
- bookmarked
- correct (review mode)
- incorrect (review mode)

### Practice interaction rules
- user may change answer before reveal
- user may skip and return
- question order shuffled by default
- choice order shuffled by default
- explanation hidden until reveal

### Summary screen
At minimum show:
- score
- time used
- button to review incorrect only

---

## 5. Review History

### Purpose
Show previous sessions and quick access to outcomes.

### Layout
- session list
- selected session details
- quick relaunch actions when appropriate

### Minimum data shown
- mode
- date/time
- item count
- score if applicable
- duration

---

## 6. Stats Dashboard

### Purpose
Lightweight progress overview.

### Day-one requirement
- streak display

### Optional later cards
- recent sessions
- due review count
- total answered
- weak topics

---

## Dark mode rules

Dark mode must:
- maintain strong contrast
- preserve distinction between states
- avoid muddy grays that make long study sessions feel like reading through soup
- keep syntax/code/math legible

---

## Component state requirements

Every major interactive component should specify:
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
- hidden explanation
- revealed explanation
- unanswered
- skipped