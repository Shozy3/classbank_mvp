# Review System

## Overview

The MVP uses two different review models:

1. **Spaced repetition** for:
   - flashcards
   - short-answer questions

2. **Adaptive review tracking** for:
   - MCQs
   - true/false
   - multi-select

Do not pretend these are the same. They are not. Retrieval practice and recognition-based question blocks behave differently.

---

## 1. Spaced repetition for flashcards and short-answer

### Rating buttons
- Again
- Hard
- Good
- Easy

### Flow for flashcards
1. Show front
2. Reveal back
3. User rates recall
4. Update scheduling state

### Flow for short-answer
1. Show prompt
2. User attempts answer
3. Reveal model answer + explanation
4. User rates recall
5. Update scheduling state

### Desired behavior
This should qualitatively behave like Anki:

- Again:
  - item was forgotten
  - very short next interval
  - may reappear soon in same session or near-future session

- Hard:
  - item was recalled weakly
  - small interval growth

- Good:
  - item was recalled adequately
  - normal interval growth

- Easy:
  - item was recalled strongly
  - larger interval growth

### Required properties
Each SR item should track:
- due date/time
- ease-like factor or similar stability measure
- interval
- review count
- lapse count
- last reviewed timestamp

### Reset rule
Editing a flashcard or short-answer item resets its SR state.

---

## 2. Adaptive review for MCQs

### Why separate?
MCQs are not the same as flashcards:
- correctness is influenced by recognition
- timing matters
- partial credit can matter
- many MCQs are better reviewed in blocks than in isolated prompt-response loops

So MCQs should use a separate weak-area/remediation model.

### Inputs
Track:
- correct / incorrect
- partial credit
- time spent
- recent history
- repeat misses
- slow corrects

### Desired behavior
- incorrect questions become more likely to appear in remediation-focused sessions
- slow correct questions are weaker than fast correct questions
- repeatedly missed questions should stay “hot”
- unseen questions should remain separately filterable
- incorrect-only review should be easy to generate

### Example heuristic direction
You do not need a mathematically fancy wizard robe here.

A question may accumulate a weakness score based on:
- incorrect answer: strong penalty
- partial credit: medium penalty
- slow correct: small penalty
- fast correct repeated over time: reduces weakness

### Suggested practical rule set
- incorrect:
  - add strong weakness weight
- partial credit:
  - add medium weakness weight
- correct but slow:
  - add small weakness weight
- correct and fast:
  - reduce weakness
- repeated correct performance:
  - reduce likelihood of resurfacing in remediation
- edited question:
  - reset adaptive review state

### Outputs
Adaptive review state should support:
- incorrect-only filtering
- weak-question pool generation
- review history display
- future “needs work” flags in stats or setup

---

## 3. Separate histories

The histories for SR items and MCQ adaptive review must remain separate.

Do not mix:
- flashcard SR intervals
- short-answer SR intervals
- MCQ weakness scoring

That would create nonsense behavior.

---

## 4. MVP implementation guidance

### Must-have
- explicit Again / Hard / Good / Easy flow for flashcards and short-answer
- persistent due-state tracking
- persistent MCQ result tracking
- incorrect-only review
- unseen-only review
- reset review state on content edit

### Nice later
- more refined interval tuning
- richer weakness analytics
- due forecasting
- buried/suspended items
- leech detection

---

## 5. User-facing expectations

The user should feel:
- flashcards and short-answer come back when memory is weak
- MCQs that were missed or slow are easy to revisit
- review state reacts to edits instead of clinging to stale history like cursed seaweed