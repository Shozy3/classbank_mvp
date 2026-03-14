# Screen Spec — Home

## Purpose

Serve as the default landing screen for the local MVP and route users quickly into core study workflows.

## Primary jobs
- provide clear first action choices
- show high-level content footprint
- show immediate spaced-review demand

## Layout

### Persistent sidebar
Shared with all top-level screens, with Home marked active.

### Main content panels
- quick actions
- content summary
- due-for-review summary

## Visual priority
1. quick actions
2. due-now signal
3. content footprint metrics

## Required data
- total courses
- total units
- total topics
- total questions
- due spaced-review total
- due question count
- due flashcard count

## Key actions
- open Library
- open Authoring
- open Practice Setup
- open Review History
- open Stats Dashboard

## Empty states
- no courses yet
- no due spaced-review items

## Error states
- summary metrics unavailable
- due count query unavailable

## Interaction notes
- Home should stay lightweight and fast
- refresh action should requery summary data without full page reload
- content should remain readable on desktop and mobile widths
