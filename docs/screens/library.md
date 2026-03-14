# Screen Spec — Library

## Purpose

Browse and manage all questions and flashcards by course structure.

## Primary jobs
- navigate the course hierarchy
- find content quickly
- preview items
- perform content management actions

## Layout

### App shell
Uses the shared persistent sidebar navigation used by all top-level screens.

### Left pane
Course → Unit → Topic hierarchy

### Main pane
Item list for the selected topic or filtered result set

### Optional right pane
Preview of selected question/flashcard

### Top toolbar
- search
- item type filter
- bookmark/flag filters
- create actions
- bulk actions

## Visual priority
1. selected hierarchy location
2. item list
3. create/manage actions
4. preview details

## Required item row info
- item title or generated label
- type
- difficulty if present
- bookmark state
- flag state
- last edited or recent activity if useful

## Key actions
- create course/unit/topic
- create question
- create flashcard
- duplicate item
- move item
- delete item
- bulk edit
- search/filter

## Empty states
- no courses yet
- no items in topic
- no matching search results

## Error states
- failed deletion
- invalid move
- preview render failure

## Interaction notes
- hierarchy selection should update list quickly
- item selection should not feel laggy
- preview should be helpful but not mandatory
- bulk actions appear only when selection exists
