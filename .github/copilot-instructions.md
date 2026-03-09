# Copilot Instructions

This workspace is for the **local macOS MVP only** of a personal offline study application.

## Product purpose

Build a local-first, offline, UWorld-inspired practice platform for university courses.

## Hard constraints

- single-user only
- fully offline
- no login
- no accounts
- no cloud sync
- no web features
- no moderation systems
- no community workflows
- no AI question generation

## Priorities

1. Make the core study loop excellent:
   - create content
   - build session
   - answer/reveal
   - review explanation
   - track review state

2. Preserve UI polish and interaction quality.

3. Keep the architecture simple and local-first.

## Data/storage direction

- use a local embedded database model
- preserve structured hierarchy:
  - Course → Unit → Topic → Question/Flashcard
- images may be embedded in the database for MVP

## Review system rules

- flashcards and short-answer use explicit Again / Hard / Good / Easy rating
- MCQs use separate adaptive review tracking
- editing reviewed content resets review state where specified

## UX rules

- explanation panel hidden until reveal
- split layout in practice session is non-negotiable
- navigator must be fast and clear
- dark mode is required

## Implementation guidance

Prefer:
- clarity over cleverness
- stable local persistence over premature abstraction
- polished core loop over feature sprawl

Do not add:
- Supabase
- Firebase
- OAuth
- server backends
- multi-user models
- web deployment scaffolding
- analytics bloat

If a choice is unclear, follow the docs in `docs/` first.