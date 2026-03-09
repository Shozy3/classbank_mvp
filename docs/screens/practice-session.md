# Screen Spec — Practice Session

## Purpose

This is the core study screen and the visual anchor for the entire product.

## Non-negotiable intent

The screen must feel:
- focused
- efficient
- premium
- calm
- highly usable in long sessions

This screen matters more than any other screen in the product.

## Core layout

### Left panel — Question surface
Contains:
- question stem
- images/figures if present
- answer choices or short-answer input
- local question actions
- navigation controls

### Right panel — Explanation surface
Contains:
- correctness/result summary
- main explanation
- per-choice explanation
- references
- optional figures
- model answer for short-answer
- Again/Hard/Good/Easy controls where relevant

### Navigator
Persistent access to item numbers and item states.

## Layout behavior

- explanation panel is hidden until reveal
- before reveal, the question panel gets priority width
- after reveal, both panels must remain readable
- reveal should not create chaotic layout shift
- navigator must remain accessible throughout

## Visual priority order
1. current question content
2. selected answer / current interaction state
3. reveal/submit action
4. navigator clarity
5. explanation content after reveal

## Required controls
- previous
- next
- skip
- reveal/submit
- bookmark
- flag
- strikeout
- timer display where applicable

## Question surface rules
- answer options must feel crisp and stable
- technical content must render cleanly
- selected answer state must be obvious
- user may change answer before reveal
- skip and return must feel frictionless

## Explanation surface rules
- hidden until reveal
- should feel like a teaching panel, not a collapsed junk drawer
- explanation must be sectioned clearly
- main explanation should dominate
- per-choice explanations should be scan-friendly
- references should be present but visually quiet

## Navigator rules
- compact, fast to scan
- current item unmistakable
- skipped and flagged states easy to identify
- review correctness states visible when relevant

## Summary view after block
At minimum:
- score
- time used
- clear entry point to incorrect-only review

## Dark mode rules
- no muddy contrast
- answer states still distinct
- selected/current states remain obvious
- explanation panel remains readable over long sessions

## What to avoid
- oversized cards
- soft toy-like answer pills
- modal-heavy navigation
- excessive animation
- hidden essential controls
- vague correct/incorrect state styling
