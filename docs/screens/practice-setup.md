# Screen Spec — Practice Setup

## Purpose

Build a study session from filters and mode settings.

## Primary jobs
- define what content to study
- choose a practice mode
- choose timing behavior
- generate a session confidently

## Layout

### App shell
Uses the shared persistent sidebar navigation used by all top-level screens.

### Left column
Filters:
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

### Right column
Mode and session settings:
- mode selection
- timer mode
- shuffle questions
- shuffle choices
- summary of matching items

### Bottom primary action
Start Session

## Visual priority
1. selected filters
2. chosen mode
3. item availability / session summary
4. start action

## Required states
- no matching items
- fewer items than requested
- no due spaced-review items
- valid session ready to start

## Interaction notes
- changing filters should update counts clearly
- warnings should be inline, not dramatic modals
- the screen should feel like setting up a serious study block, not filling a settings form
