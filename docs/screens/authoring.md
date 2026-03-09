# Screen Spec — Authoring

## Purpose

Create and edit questions and flashcards with rich educational content.

## Primary jobs
- choose content type
- assign it to course/unit/topic
- enter rich content
- define correct answers
- write explanations
- save safely

## Layout

### Header bar
- Save
- Duplicate
- Delete
- unsaved/saving status

### Main body sections
1. Metadata
2. Question stem or flashcard front
3. Choices (if applicable)
4. Main explanation
5. Per-choice explanations
6. Model answer or flashcard back
7. Reference field

## Visual priority
1. current editing surface
2. save state
3. structure and field grouping
4. metadata/context

## Authoring rules
- never show one giant undifferentiated wall of form fields
- choices should be easy to reorder and edit
- correct-answer assignment should be obvious
- explanation sections must feel distinct from answer-definition sections

## Validation states
- missing required topic
- invalid answer configuration
- missing model answer for short-answer
- empty flashcard front/back

## Required behaviors
- create
- edit
- duplicate
- delete
- autosave or safe-save behavior
- revision snapshot on save

## Error states
- save failed
- invalid content structure
- unsupported media/render issue

## UX notes
- dense but not overwhelming
- editing technical content should feel natural
- code blocks, tables, and math must not break the layout
