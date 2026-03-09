# Component Rules

## 1. Answer choice

### Purpose
Represents a selectable answer option in practice.

### Visual behavior
- rectangular, crisp, not bubbly
- supports dense text and rich content
- strong selected state
- unmistakable correct/incorrect states after reveal

### Required states
- default
- hover
- selected
- strikeout
- disabled after reveal
- correct
- incorrect
- partial-credit-related context where relevant

### Rules
- selected must be obvious before reveal
- strikeout must not destroy readability
- correct/incorrect states must not depend on color alone

## 2. Question navigator item

### Purpose
Represents question position and status inside a session.

### Required states
- unseen
- current
- answered
- skipped
- flagged
- bookmarked
- correct
- incorrect

### Rules
- compact but easy to scan
- current item must stand out immediately
- correctness states visible during review
- flagged/bookmarked indicators must not overpower status

## 3. Explanation panel

### Purpose
Displays the teaching side of the product.

### Rules
- hidden until reveal
- should feel like a purposeful study surface, not a drawer of leftovers
- explanation content must be well-sectioned
- references and per-choice explanations should be visually subordinate to the main explanation, but still easy to find

### Content order
1. correctness/result summary
2. main explanation
3. per-choice explanations
4. references
5. optional figures/images

## 4. Hierarchy row

### Purpose
Represents course/unit/topic nodes.

### Rules
- selected state must be clear
- nesting indentation must be subtle but legible
- do not overdecorate tree controls
- compact enough for large content libraries

## 5. Toolbar button

### Rules
- compact desktop control sizing
- strong hover and active treatment
- clear icon-label pairing where needed
- no giant padded buttons except primary start/save actions

## 6. Filter control

### Rules
- should feel like a serious query builder, not tag soup
- selected filters must be obvious
- disabled or empty states must be visually clear
- sample size input should align with the rest of the control language

## 7. Editor section

### Rules
- clear header
- clear field grouping
- rich editor should feel stable and readable
- choices/explanations/model answer sections must not visually blur together
- unsaved state must be noticeable but not alarming

## 8. Session toolbar

### Rules
- fixed and predictable placement
- compact actions
- reveal/submit action clearly emphasized
- previous/next and skip visually secondary but easy to reach

## 9. Status chips/badges

Use sparingly.

Allowed uses:
- question type
- difficulty
- flagged/bookmarked indicators if needed
- result labels in summaries

Do not turn the interface into a badge farm.
