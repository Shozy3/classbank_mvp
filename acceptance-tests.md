# Acceptance Tests

## AT-001 Create course hierarchy

### Steps
1. Create a course
2. Create a unit inside the course
3. Create a topic inside the unit

### Expected
- hierarchy is saved correctly
- hierarchy remains after app restart

---

## AT-002 Create rich MCQ

### Steps
1. Create a new single-best-answer question
2. Add rich text in the stem
3. Add an image
4. Add a code block
5. Add LaTeX/math
6. Add choices
7. Add main explanation
8. Add per-choice explanations
9. Add reference text
10. Save

### Expected
- content saves successfully
- content renders correctly when reopened
- no major formatting loss

---

## AT-003 Create multi-select question with partial credit

### Steps
1. Create a multi-select question with multiple correct answers
2. Save it
3. Open it in practice
4. Select some but not all correct answers
5. Reveal answer

### Expected
- partial credit is recorded
- explanation renders correctly
- result state is visually distinct from fully correct/incorrect

---

## AT-004 Create short-answer item

### Steps
1. Create a short-answer question
2. Add prompt, model answer, explanation, and reference
3. Save
4. Open in spaced review
5. Enter an answer
6. Reveal
7. Self-rate

### Expected
- model answer appears
- explanation appears
- Again / Hard / Good / Easy is available
- review state updates

---

## AT-005 Create flashcard

### Steps
1. Create flashcard
2. Add front and back content
3. Add reference text
4. Save
5. Open spaced review
6. Reveal
7. Rate recall

### Expected
- flashcard is scheduled
- due state updates after rating

---

## AT-006 Generate filtered free-practice session

### Steps
1. Open Practice Setup
2. Filter by course, topic, and question type
3. Set random sample size
4. Start Free Practice

### Expected
- only matching items are included
- question order is shuffled by default
- answer choices are shuffled by default

---

## AT-007 Skip and return within block

### Steps
1. Start a timed block
2. Skip a question
3. Move to later questions
4. Return to skipped question

### Expected
- skipped status appears in navigator
- user can answer later in same block

---

## AT-008 Reveal explanation panel

### Steps
1. Start a practice session
2. View a question
3. Do not reveal yet
4. Reveal answer

### Expected
- explanation panel is hidden before reveal
- explanation panel opens after reveal
- correctness and explanations are shown

---

## AT-009 Change answer before reveal

### Steps
1. Open an MCQ
2. Select one option
3. Change selection before reveal
4. Reveal answer

### Expected
- final submitted selection is the one used for scoring
- user is not locked too early

---

## AT-010 Bookmark and flag semantics

### Steps
1. Bookmark one item
2. Flag another item
3. Filter by bookmarked
4. Filter by flagged

### Expected
- bookmarked and flagged states persist separately
- filtering behaves correctly

---

## AT-011 Incorrect-only review

### Steps
1. Complete a practice session with at least one incorrect answer
2. Start review incorrect flow

### Expected
- only previously missed items appear

---

## AT-012 Edit reviewed flashcard resets SR history

### Steps
1. Review a flashcard
2. Edit the flashcard
3. Save

### Expected
- spaced repetition state resets

---

## AT-013 Edit reviewed short-answer resets SR history

### Steps
1. Review a short-answer item
2. Edit the question
3. Save

### Expected
- spaced repetition state resets

---

## AT-014 Backup and restore

### Steps
1. Create a local backup
2. Modify or delete content
3. Restore from backup

### Expected
- restored data matches backup contents
- restore warns before overwrite

---

## AT-015 Dark mode usability

### Steps
1. Use library, authoring, and practice session in dark mode

### Expected
- contrast remains readable
- correct/incorrect/partial states remain distinguishable
- no major visual breakage

---

## AT-016 Review history browsing

### Steps
1. Complete at least one practice session with revealed items
2. Open Review History
3. Select the most recent session row

### Expected
- most recent session appears first
- selecting a row opens detail pane
- detail pane includes mode, duration, and outcome counts

---

## AT-017 Stats dashboard streak and summary

### Steps
1. Complete sessions on at least two days
2. Open Stats Dashboard

### Expected
- primary streak card is visible
- supporting summary cards render (recent sessions and answered metrics)
- dashboard handles partial data without crashing