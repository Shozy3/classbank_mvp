# Open-Source UWorld-Inspired Practice Platform — Local macOS MVP Software Specification

## 1. Document Overview

**Document purpose**  
This document defines the product, functional behavior, UX rules, data model, user stories, use cases, acceptance tests, and non-functional requirements for the **local personal desktop MVP** of an offline university question-bank and practice platform.

**Primary goal of this version**  
Build a **single-user, fully offline, local macOS application** that lets one student:
- create and edit their own course questions and flashcards,
- organize them by course and topic,
- practice them in a high-quality UWorld-inspired study interface,
- review explanations,
- run timed/free/custom sessions,
- and use spaced repetition / adaptive review to revisit weak material.

**Important scope constraint**  
This specification covers **only the “Now” version**: the local personal desktop app. Multi-user web features are explicitly out of scope for this version except where mentioned as future-facing design constraints.

**Product statement**  
A local-first, offline, UWorld-inspired practice platform for university courses that supports personal question authoring, rich explanations, and review workflows for long-term learning.

---

## 2. Product Vision and Positioning

### 2.1 Product Vision
Provide a polished personal study tool that feels as efficient and focused as premium exam platforms, while allowing the user to create and study **their own** course-specific content.

### 2.2 Positioning Statement
An open-source UWorld-style practice platform for university courses, starting as a personal local study application.

### 2.3 Design Philosophy
This MVP should not behave like a generic flashcard toy or a duct-taped note app. It should feel like a serious study product with:
- high visual polish,
- fast interaction,
- disciplined content structure,
- rich explanations,
- and strong practice ergonomics.

---

## 3. Product Goals and Non-Goals

### 3.1 Goals
1. Allow the user to create high-quality question content for university courses.
2. Support rich educational content including images, math, tables, and code.
3. Provide a UWorld-inspired practice experience with question navigation and side-panel explanations.
4. Support both grind-style free practice and retention-focused review.
5. Operate fully offline with all data stored locally.
6. Be structured cleanly enough that future web-platform UI patterns can grow from it.

### 3.2 Non-Goals for MVP
1. No accounts or authentication.
2. No syncing across devices.
3. No cloud storage.
4. No collaboration or shared libraries.
5. No moderation system.
6. No public content publishing.
7. No AI-generated content workflows.
8. No auto-grading for short-answer questions.
9. No complex analytics requirement beyond a basic streak-oriented stats view.
10. No web deployment in this phase.

---

## 4. Platform and Operating Constraints

### 4.1 Platform
- macOS desktop application

### 4.2 User Model
- Single user only
- No login
- No role management in MVP

### 4.3 Connectivity
- Fully offline
- No internet dependency for core workflows

### 4.4 Data Storage
- All data stored locally
- Local embedded database required
- Recommended storage model: **SQLite** as the primary local database

### 4.5 Backup Requirement
The system shall support basic local backup and restore so that the user can preserve and recover their study data.

---

## 5. Information Architecture

The local MVP shall expose the following primary sections:

1. **Library**
2. **Authoring**
3. **Practice Setup**
4. **Practice Session**
5. **Review History**
6. **Stats Dashboard**

### 5.1 Navigation Model
The application shall provide persistent high-level navigation between the primary sections. The active section shall be visually obvious.

---

## 6. Content Hierarchy

The content hierarchy for MVP is:

**Course → Unit / Module → Topic → Question**

Flashcards are a separate content type but still belong to:

**Course → Unit / Module → Topic → Flashcard**

### 6.1 Hierarchy Rules
- A question belongs to exactly one topic in MVP.
- A flashcard belongs to exactly one topic in MVP.
- Each topic belongs to exactly one unit/module.
- Each unit/module belongs to exactly one course.

### 6.2 Required Content Organization Features
- Create course
- Create unit/module under course
- Create topic under unit/module
- Create question or flashcard under topic
- Move content within hierarchy
- Rename hierarchy nodes
- Delete hierarchy nodes with confirmation behavior

---

## 7. Supported Content Types

### 7.1 Question Types
The system shall support the following question types in MVP:
1. Single best answer MCQ
2. Multi-select MCQ
3. True/false
4. Short answer
5. Image-based questions
6. Flashcards

### 7.2 Type Behavior Notes
- “Image-based” is not a separate grading model; it is a content capability supported across question surfaces.
- Flashcards shall be modeled separately from standard questions because their practice and scheduling flows differ.
- Short-answer questions shall use manual self-check in MVP.

---

## 8. Rich Content Requirements

The authoring and rendering system shall support the following content elements:
- rich text
- inline formatting
- images
- tables
- code blocks
- LaTeX / math equations
- plain text reference field

### 8.1 Rich Content Surfaces
The following surfaces shall support rich content:
- question stem
- answer choices
- main explanation block
- per-choice explanation block
- model answer for short-answer questions
- flashcard front/back content

### 8.2 Image Storage Rule
Images shall be embedded in the local database for MVP to keep the app self-contained.

---

## 9. Question Data Model (Logical)

## 9.1 Core Entities
- Course
- Unit
- Topic
- Question
- QuestionChoice
- Flashcard
- PracticeSession
- PracticeSessionItem
- ReviewHistory
- Bookmark
- Flag
- BackupRecord (optional local metadata only)

## 9.2 Course
- course_id
- course_name
- course_code (optional)
- created_at
- updated_at

## 9.3 Unit
- unit_id
- course_id
- unit_name
- sort_order
- created_at
- updated_at

## 9.4 Topic
- topic_id
- unit_id
- topic_name
- sort_order
- created_at
- updated_at

## 9.5 Question
- question_id
- topic_id
- question_type
- title (optional internal label)
- stem_rich_text
- difficulty
- main_explanation_rich_text
- reference_text
- created_at
- updated_at
- last_edited_at
- is_bookmarked
- is_flagged
- times_seen
- times_correct
- times_incorrect
- last_result
- last_used_at
- adaptive_review_state_json

## 9.6 QuestionChoice
- choice_id
- question_id
- label
- choice_rich_text
- is_correct
- choice_explanation_rich_text
- sort_order

## 9.7 Short-Answer Question Extension
For short-answer questions, the question record shall also store:
- model_answer_rich_text

## 9.8 Flashcard
- flashcard_id
- topic_id
- front_rich_text
- back_rich_text
- reference_text
- created_at
- updated_at
- last_edited_at
- sr_state_json
- due_at
- last_reviewed_at
- review_count
- lapse_count
- is_bookmarked
- is_flagged

## 9.9 PracticeSession
- session_id
- session_type
- created_at
- started_at
- completed_at
- timer_mode
- total_time_seconds
- course_filter
- unit_filter
- topic_filter
- question_type_filter
- difficulty_filter
- flagged_filter
- bookmarked_filter
- incorrect_only_filter
- unseen_only_filter
- random_sample_size
- shuffle_questions
- shuffle_choices

## 9.10 PracticeSessionItem
- session_item_id
- session_id
- content_type (question / flashcard)
- question_id or flashcard_id
- presented_order
- was_answered
- submitted_at
- time_spent_seconds
- response_payload_json
- is_correct
- partial_credit
- was_revealed
- was_skipped
- was_bookmarked_during_session
- was_flagged_during_session
- self_rating (Again/Hard/Good/Easy when applicable)

## 9.11 Revision Snapshot
Simple last-edited snapshots shall be stored for questions and flashcards.

Fields:
- snapshot_id
- entity_type
- entity_id
- snapshot_payload_json
- created_at

---

## 10. Authoring Requirements

## 10.1 General Authoring
The system shall provide a rich WYSIWYG editor for question and flashcard creation.

### Functional Requirements
- FR-AUTHOR-001: The user shall be able to create, edit, duplicate, and delete courses, units, topics, questions, and flashcards.
- FR-AUTHOR-002: The user shall be able to create a question through a structured authoring form.
- FR-AUTHOR-003: The user shall be able to create a flashcard through a structured authoring form.
- FR-AUTHOR-004: The editor shall support rich text formatting.
- FR-AUTHOR-005: The editor shall support embedded images.
- FR-AUTHOR-006: The editor shall support tables.
- FR-AUTHOR-007: The editor shall support code blocks.
- FR-AUTHOR-008: The editor shall support LaTeX/math equations.
- FR-AUTHOR-009: The editor shall support a plain text reference field.
- FR-AUTHOR-010: The system shall auto-save drafts at safe intervals and on key transitions where feasible.
- FR-AUTHOR-011: The system shall store created_at and last_edited_at timestamps.
- FR-AUTHOR-012: Editing a question shall reset its spaced-repetition history if the question participates in spaced repetition.
- FR-AUTHOR-013: Editing a flashcard shall reset its spaced-repetition history.
- FR-AUTHOR-014: The system shall store a simple revision snapshot on save.

## 10.2 Question-Type-Specific Authoring

### Single Best Answer MCQ
- Must support one correct choice.
- Must support per-choice explanations.
- Must support optional images and equations in choices.

### Multi-Select MCQ
- Must support multiple correct choices.
- Must support partial credit.
- Must support per-choice explanations.

### True/False
- May be represented as a simplified two-choice MCQ.

### Short Answer
- Must support question stem.
- Must support model answer.
- Must support main explanation.
- Must not auto-grade in MVP.

### Flashcards
- Must support front content.
- Must support back content.
- Must support references.
- Must participate in spaced repetition.

## 10.3 Bulk Editing
The system shall allow bulk edits for selected content items.

Minimum bulk actions:
- move items to another topic
- update difficulty
- bookmark/unbookmark
- flag/unflag
- delete selected items

---

## 11. Practice Modes

The system shall provide the following practice modes in MVP:

1. **Free Practice**
2. **Timed Block**
3. **Review Incorrect**
4. **Spaced Repetition Review**

### 11.1 Free Practice
A flexible mode for grinding questions without strict exam constraints.

Behavior:
- explanation available after reveal
- user may skip and return
- question order shuffled by default
- answer choices shuffled by default

### 11.2 Timed Block
A block-based mode intended to simulate more focused exam-style sessions.

Behavior:
- timer shall support both block-level and per-question timing
- explanation reveal behavior may be controlled by session settings
- user may skip and return within the block
- final summary shown at block completion

### 11.3 Review Incorrect
A session generated from previously missed questions.

Behavior:
- can be filtered by course/unit/topic
- explanation reveal behavior follows practice rules
- useful for focused remediation

### 11.4 Spaced Repetition Review
A session generated from due flashcards and due short-answer prompts.

Behavior:
- scheduled items only
- review produces explicit Again/Hard/Good/Easy rating
- due logic based on stored review state

---

## 12. Practice Setup Requirements

Before starting a session, the user shall be able to build a session using filters.

### 12.1 Supported Filters
The system shall support the following session filters in MVP:
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

### 12.2 Session Options
The system shall support the following session options:
- shuffle questions: default ON
- shuffle answer choices: default ON
- timer mode: none / per block / per question / both where applicable
- explanation behavior based on mode

### 12.3 Block Generation Rules
- Blocks shall be generated by filters rather than manual assembly.
- If the result set is smaller than requested sample size, the system shall inform the user and allow continuing with available items.

---

## 13. Practice Session UX and Behavior

## 13.1 Core Layout
The practice session shall use a high-polish, UWorld-inspired split layout:
- **Left panel**: question content and answer interaction
- **Right panel**: explanation panel
- **Question navigator**: persistent access to question numbers/status

### 13.2 Explanation Panel
- Hidden until reveal
- Opens after answer reveal or session review action
- Displays main explanation, per-choice explanation, references, and optional figures

### 13.3 Required MVP Session UI Features
- left question panel
- right explanation panel
- option highlight states
- question navigator
- strikeout on answer choices
- bookmark toggle
- flag toggle
- dark mode

### 13.4 Optional-but-Preferred MVP UX Features
- keyboard shortcuts
- smooth transitions
- autosave session progress
- persistent visual status indicators

## 13.5 Question Status in Navigator
Each question in the navigator shall indicate state such as:
- unseen
- current
- answered
- skipped
- flagged
- bookmarked
- correct (in review)
- incorrect (in review)

## 13.6 MCQ Interaction Rules
- User may select an answer.
- User may change the answer before reveal.
- User may skip and return later within the block.
- Choices and questions shall be shuffled by default.
- On reveal, the system shall show correctness status and explanation content.

## 13.7 Multi-Select Rules
- Partial credit shall be supported.
- Full correctness requires all correct options selected and no incorrect options selected.
- Partial credit model shall be visible in implementation detail but may be summarized simply in UI.

## 13.8 Short-Answer Session Rules
- User enters response.
- On reveal, the system shows model answer and explanation.
- User then self-rates the item using Again / Hard / Good / Easy.

## 13.9 Flashcard Session Rules
- Front shown first.
- User reveals back.
- User rates recall using Again / Hard / Good / Easy.

---

## 14. Review Algorithms

This MVP intentionally separates review logic for different content types.

## 14.1 Flashcards and Short-Answer Scheduling
Flashcards and short-answer items shall use an **Anki-inspired explicit-rating spaced repetition model**.

### Requirements
- FR-SR-001: The system shall schedule flashcards using explicit user ratings: Again, Hard, Good, Easy.
- FR-SR-002: The system shall schedule short-answer items using explicit user ratings: Again, Hard, Good, Easy.
- FR-SR-003: Each review shall update stored review state.
- FR-SR-004: Due items shall be selectable into spaced repetition review sessions.
- FR-SR-005: Editing an item shall reset its review state.

### Implementation Constraint
The exact formula may be implementation-specific, but it must preserve the qualitative behavior of Anki-style review:
- Again = short interval / relearn
- Hard = smaller interval growth
- Good = normal interval growth
- Easy = larger interval growth

## 14.2 MCQ Adaptive Review
MCQ blocks do not need strict flashcard-style spaced repetition. Instead, the system shall support a separate adaptive review state based on performance.

### Inputs
- correctness
- partial credit where applicable
- time to submit
- recent outcomes

### Requirements
- FR-ADAPT-001: The system shall track MCQ performance history.
- FR-ADAPT-002: The system shall mark questions as weak/needs review when repeatedly missed or slow.
- FR-ADAPT-003: The system shall support incorrect-only and unseen-only filtering.
- FR-ADAPT-004: The system shall preserve separate review tracking from spaced-repetition flashcard/short-answer data.

### Suggested Behavior
Questions answered incorrectly or unusually slowly should become more likely to appear in remediation-focused sessions such as Review Incorrect.

---

## 15. Review, Scoring, and Summaries

## 15.1 Post-Question Review
After revealing a question, the user shall see:
- whether the response was correct
- main explanation
- why correct choice(s) are right
- why wrong choice(s) are wrong
- references
- optional images/figures

## 15.2 End-of-Block Summary
At minimum, the block summary shall show:
- score
- time used
- incorrect-only review entry point

## 15.3 Review History
The system shall provide a review history screen showing recent sessions and their major outcomes.

---

## 16. Library Requirements

The Library section shall serve as the content browser and management hub.

### Functional Requirements
- FR-LIB-001: The user shall be able to browse content by course, unit, topic.
- FR-LIB-002: The user shall be able to search/filter questions and flashcards.
- FR-LIB-003: The user shall be able to see whether an item is bookmarked or flagged.
- FR-LIB-004: The user shall be able to duplicate content.
- FR-LIB-005: The user shall be able to bulk edit selected items.
- FR-LIB-006: The user shall be able to preview question content from the library.

---

## 17. Authoring Screen UX Requirements

The Authoring section shall present structured forms with strong visual clarity.

### Required Capabilities
- create new question/flashcard
- choose question type
- assign course / unit / topic
- compose rich content
- add/edit choices
- mark correct choices
- add main explanation
- add per-choice explanations
- add references
- save / duplicate / delete

### Authoring Design Requirements
- clear hierarchy
- low clutter despite rich capability
- visible unsaved-change state
- accessible field grouping
- inline validation
- preview confidence before save

---

## 18. Stats Dashboard Requirements

The Stats Dashboard is intentionally lightweight in MVP.

### Day-One Requirement
- streak display

### Nice-to-Have but Not Mandatory for Day One
- total questions answered
- recent study sessions
- review due count
- simple topic weakness indicators

---

## 19. Bookmark and Flag Semantics

### Bookmark
Meaning: useful / save for later

### Flag
Meaning: revisit inside a block or because something is wrong

### Requirements
- FR-META-001: The user shall be able to bookmark a question or flashcard.
- FR-META-002: The user shall be able to flag a question or flashcard.
- FR-META-003: Bookmarked and flagged states shall be filterable.

---

## 20. Backup and Restore

### Functional Requirements
- FR-BACKUP-001: The system shall support creating a local backup of user data.
- FR-BACKUP-002: The system shall support restoring from a local backup.
- FR-BACKUP-003: The system shall warn before overwriting current data during restore.
- FR-BACKUP-004: The restore flow shall preserve data integrity or fail safely.

---

## 21. User Stories with Acceptance Criteria

## Epic A: Content Management

### US-CONT-001 Create a course structure
As a student, I want to create courses, units, and topics so that my content is organized cleanly.

**Acceptance Criteria**
- Given I am in the library or authoring area, when I create a course, then it appears in the hierarchy.
- Given a course exists, when I add a unit and topic, then they are nested correctly.

### US-CONT-002 Author an MCQ
As a student, I want to create a multiple-choice question with rich explanations so that I can study my course material effectively.

**Acceptance Criteria**
- Given I create a new MCQ, when I fill in the stem, choices, explanations, and references, then the question saves successfully.
- Given the question saves, when I open it later, then all rich content is preserved.

### US-CONT-003 Author a flashcard
As a student, I want to create flashcards with rich content so that I can review memory-heavy content efficiently.

**Acceptance Criteria**
- Given I create a flashcard with front and back content, when I save it, then it appears under the chosen topic.

### US-CONT-004 Edit a reviewed item
As a student, I want editing a reviewed item to reset its review state so that outdated history does not corrupt future scheduling.

**Acceptance Criteria**
- Given a flashcard or short-answer item has review history, when I edit and save it, then its spaced-repetition state resets.

## Epic B: Practice Setup

### US-SETUP-001 Build a custom practice block
As a student, I want to generate a practice session from filters so that I can focus on exactly what I need.

**Acceptance Criteria**
- Given I select course, topic, question type, and sample size, when I start a session, then the system generates a session from matching items.
- Given there are fewer items than requested, when I continue, then the system starts with the available items and informs me of the count.

## Epic C: Practice Experience

### US-PRAC-001 Practice in split view
As a student, I want to answer questions in a split layout with explanations on the side so that review feels fast and focused.

**Acceptance Criteria**
- Given a session is running, when I view a question, then the question appears in the left panel and the explanation panel remains hidden until reveal.
- Given I reveal the answer, when the right panel opens, then I see the explanation content.

### US-PRAC-002 Change answer before reveal
As a student, I want to change my answer before submitting/revealing so that I am not locked too early.

**Acceptance Criteria**
- Given I have selected an answer but not revealed it, when I change the selection, then the new answer is the active answer.

### US-PRAC-003 Skip and return
As a student, I want to skip a question and return later in the block so that I can keep momentum.

**Acceptance Criteria**
- Given I skip a question, when I navigate elsewhere, then the skipped state is shown in the navigator.
- Given I return later, when I open the question again, then I can answer it normally.

### US-PRAC-004 Review incorrect questions
As a student, I want a quick way to revisit missed material so that I can patch weak spots.

**Acceptance Criteria**
- Given a session contains incorrect answers, when the session ends, then I can launch an incorrect-only review flow.

## Epic D: Spaced Review

### US-SR-001 Review due flashcards
As a student, I want due flashcards surfaced automatically so that I can keep up with spaced repetition.

**Acceptance Criteria**
- Given flashcards are due, when I open spaced repetition review, then due items are included.
- Given I rate an item Again/Hard/Good/Easy, when review completes, then the next due state updates.

### US-SR-002 Review short-answer prompts
As a student, I want short-answer items reviewed with self-rating so that I can practice retrieval rather than recognition only.

**Acceptance Criteria**
- Given I answer a short-answer item, when I reveal the model answer and explanation, then I can self-rate the item.

## Epic E: Metadata and Persistence

### US-META-001 Bookmark helpful content
As a student, I want to bookmark useful items so that I can return to them later.

### US-META-002 Flag questionable content
As a student, I want to flag items I should revisit or fix so that I can improve my personal bank over time.

### US-BACKUP-001 Back up my data
As a student, I want to create and restore local backups so that my study content is not lost if my machine misbehaves like a little gremlin.

---

## 22. Detailed Use Cases

### UC-001 Create a New MCQ
**Primary actor:** Student  
**Preconditions:** App is installed and local database available.

**Main flow**
1. User opens Authoring.
2. User chooses “New Question”.
3. User selects question type.
4. User assigns course, unit, topic.
5. User enters stem.
6. User adds answer choices.
7. User marks correct choice(s).
8. User adds main explanation.
9. User adds per-choice explanations.
10. User adds reference text.
11. User saves.
12. System stores question and revision snapshot.

**Postconditions**
- Question is available in library and practice generation.

### UC-002 Start Free Practice Session
**Primary actor:** Student

**Main flow**
1. User opens Practice Setup.
2. User selects filters.
3. User chooses Free Practice.
4. User sets sample size.
5. User starts session.
6. System generates session items and opens Practice Session.

### UC-003 Complete MCQ and Reveal Explanation
**Primary actor:** Student

**Main flow**
1. User reads question.
2. User selects answer.
3. User changes answer if needed.
4. User reveals/submits.
5. System scores response.
6. System opens explanation panel.
7. System displays correctness and explanations.

### UC-004 Complete Short-Answer Review
**Primary actor:** Student

**Main flow**
1. User reads prompt.
2. User enters answer.
3. User reveals model answer.
4. System shows explanation.
5. User self-rates Again/Hard/Good/Easy.
6. System updates scheduling state.

### UC-005 Review Flashcards
**Primary actor:** Student

**Main flow**
1. User opens Spaced Repetition Review.
2. System loads due flashcards.
3. User views front.
4. User reveals back.
5. User rates recall.
6. System updates due state.

### UC-006 Restore Backup
**Primary actor:** Student

**Main flow**
1. User opens backup/restore settings.
2. User chooses restore file.
3. System warns that current data may be overwritten.
4. User confirms.
5. System validates backup.
6. System restores data or fails safely.

---

## 23. Acceptance Test Suite (AT)

### AT-001 Create course hierarchy
**Steps**
1. Create a course.
2. Create a unit inside it.
3. Create a topic inside the unit.

**Expected**
- Hierarchy persists correctly.

### AT-002 Create rich MCQ
**Steps**
1. Create a new single-best-answer question.
2. Add rich text, image, code block, and math.
3. Add explanations and reference.
4. Save.

**Expected**
- Content saves and re-renders correctly.

### AT-003 Create multi-select with partial credit
**Steps**
1. Create multi-select question with multiple correct answers.
2. Save and practice it.
3. Select some but not all correct answers.

**Expected**
- Response receives partial credit and explanation renders correctly.

### AT-004 Create short-answer item
**Steps**
1. Create short-answer question with model answer and explanation.
2. Save.
3. Open in spaced review.

**Expected**
- Prompt displays.
- Model answer appears on reveal.
- Again/Hard/Good/Easy rating is available.

### AT-005 Create flashcard
**Steps**
1. Create flashcard with front/back content.
2. Save.
3. Open spaced repetition review.

**Expected**
- Flashcard is reviewable.
- Rating updates scheduling state.

### AT-006 Generate filtered free-practice session
**Steps**
1. Choose course/topic/question-type filters.
2. Set sample size.
3. Start Free Practice.

**Expected**
- Session includes only matching items.
- Questions and choices are shuffled by default.

### AT-007 Skip and return within block
**Steps**
1. Start timed block.
2. Skip a question.
3. Answer other questions.
4. Return to skipped question.

**Expected**
- Navigator shows skipped status.
- User can answer later in same block.

### AT-008 Reveal explanation panel
**Steps**
1. Open a question in practice.
2. Do not reveal answer.
3. Submit/reveal answer.

**Expected**
- Explanation panel remains hidden before reveal.
- Panel appears after reveal with correct content.

### AT-009 Bookmark and flag semantics
**Steps**
1. Bookmark one item.
2. Flag another item.
3. Filter by bookmarked and flagged.

**Expected**
- Bookmark and flag states persist and filter correctly.

### AT-010 Edit reviewed flashcard resets SR history
**Steps**
1. Review a flashcard.
2. Edit its content.
3. Save.

**Expected**
- Review state resets.

### AT-011 Incorrect-only review
**Steps**
1. Complete a session with at least one missed question.
2. Launch incorrect-only review.

**Expected**
- Only previously missed items appear.

### AT-012 Backup and restore
**Steps**
1. Create backup.
2. Delete or alter content.
3. Restore backup.

**Expected**
- Restored content matches backup.

### AT-013 Dark mode session usability
**Steps**
1. Use authoring and practice flows in dark mode.

**Expected**
- Text remains legible.
- States remain visually distinct.
- No broken contrast in core controls.

---

## 24. UI / UX Specification

## 24.1 General Design Goals
- professional, premium feel
- dense but readable information layout
- fast navigation
- minimal clutter
- high contrast and clear states in dark mode
- consistent spacing and typography
- polished transitions without visual gimmick overload

## 24.2 Visual Tone
The product should feel closer to a premium study/exam platform than to a generic note-taking app.

## 24.3 Design Principles
1. Content first
2. Explanations should feel immediately useful
3. Navigation should never feel lost
4. The app should reward momentum
5. Heavy educational content must stay visually calm

## 24.4 Core Layouts

### Library
- left hierarchy pane
- central content list/grid
- right preview pane optional
- toolbar for search/filter/actions

### Authoring
- structured multi-section editor
- top action bar: save, duplicate, delete
- rich editing surface
- clear separation between stem, answers, explanations, references

### Practice Setup
- filter panel
- mode selection
- sample size and timer controls
- session preview summary
- prominent start button

### Practice Session
- left question panel
- right explanation panel hidden until reveal
- bottom or side action controls
- top navigator and session progress indicators

### Review History
- session list
- detail panel with summary data
- reopen incorrect-only review where relevant

### Stats Dashboard
- streak card
- optional lightweight summary cards

## 24.5 Spacing and Density Guidance
- Use compact but breathable layouts.
- Avoid excessive whitespace that makes serious study feel toy-like.
- Maintain clear visual grouping between question stem, answer choices, and actions.
- Explanation content should be scannable with headings, emphasis, and sectioning.

## 24.6 States to Specify in UI Hand-off
The next implementation agent must specify component states for:
- default
- hover
- focus
- active
- selected
- disabled
- correct
- incorrect
- partial credit
- bookmarked
- flagged
- hidden explanation
- revealed explanation
- unanswered
- skipped

## 24.7 Non-Negotiable Interaction Requirements
- Split question/explanation layout
- Explanation hidden until reveal
- Fast question navigation
- Dense, premium visual feel
- Dark mode support

---

## 25. Non-Functional Requirements

### 25.1 Performance
- NFR-PERF-001: App startup should feel fast on a normal modern Mac.
- NFR-PERF-002: Navigation between practice questions shall feel immediate.
- NFR-PERF-003: Rich content rendering shall remain responsive for normal educational content sizes.

### 25.2 Reliability
- NFR-REL-001: Local save operations shall be durable.
- NFR-REL-002: The app shall recover cleanly from restart after normal usage.
- NFR-REL-003: Autosave or safe-save behavior shall reduce content loss risk.

### 25.3 Offline Robustness
- NFR-OFF-001: All core features shall operate with no network connection.

### 25.4 Maintainability
- NFR-MAIN-001: Architecture shall remain stack-agnostic at the specification level.
- NFR-MAIN-002: Data model and UI flows should be reusable as the basis for future web patterns.

### 25.5 Usability
- NFR-UX-001: Dark mode shall be first-class, not an afterthought.
- NFR-UX-002: The product shall support long study sessions without visual fatigue.
- NFR-UX-003: Authoring complex questions must not feel like filling out tax forms designed by a sadist.

---

## 26. Error Handling and Edge Cases

The system shall account for at least the following edge cases:
- rich content save interrupted
- corrupted image blob reference
- backup restore file invalid
- requested session sample larger than available content
- deleted topic referenced by item during move/edit flow
- multi-select with no correct choices defined
- short-answer item missing model answer
- question edited after historical review data exists
- session abandoned mid-block
- dark mode rendering contrast issues for rich content

---

## 27. Open Product Decisions Deferred Beyond MVP

The following are intentionally deferred:
- import format strategy beyond manual authoring
- cross-platform Windows packaging
- sync/export for web migration
- advanced analytics dashboards
- keyboard shortcut scope
- advanced search grammar
- note-taking system
- comment/discussion system
- contributor workflow and moderation

---

## 28. Future Platform Considerations (Informational Only)

These are not MVP requirements, but the local app should avoid painting future development into a tiny damp corner.

Future platform ideas include:
- contributor submissions
- reviewer approval workflows
- curated official course libraries
- community review area
- public/open educational usage

These future ideas should not distort the current MVP into overengineering.

---

## 29. Definition of Ready

A feature is ready for implementation when:
- user flow is clearly described
- UI states are defined
- data impact is known
- acceptance criteria are testable
- edge cases are identified where important

## 30. Definition of Done

A feature is done when:
- functional behavior matches spec
- acceptance criteria pass
- local persistence works correctly
- dark mode is supported where applicable
- key UI states are implemented
- no critical data-loss bugs remain

---

## 31. Handoff Guidance for the Next Implementation Agent

The next agent should treat this spec as the baseline contract and should proceed in this order:

1. Define the desktop app architecture and navigation shell.
2. Implement the local SQLite data model.
3. Build the library and hierarchy management flows.
4. Build the WYSIWYG authoring system for questions and flashcards.
5. Build practice setup and session generation.
6. Build the split-view practice experience.
7. Implement flashcard/short-answer spaced repetition.
8. Implement MCQ adaptive review tracking.
9. Add backup/restore.
10. Polish dark mode, interaction density, and component states.

The implementation priority is not “most features fastest.” It is “make the core study loop feel excellent.”

That’s the real product. Everything else is decorative fungus until that loop is strong.

