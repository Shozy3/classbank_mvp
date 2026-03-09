# Layout Rules

## General layout principles

1. Prefer panel-based layouts over loose floating cards.
2. Use horizontal space well.
3. Keep actions in predictable locations.
4. Avoid giant whitespace deserts.
5. Favor structure over decoration.

## Page shell

The application shell should include:
- persistent main navigation
- stable page header area
- central workspace area

Do not make every screen feel like a completely different product.

## Width behavior

### Desktop-first mindset
The UI is for a desktop app. Do not design it like a stretched phone layout.

### General rules
- content areas should use the available width intelligently
- long reading content should still have line-length discipline
- sidebars should feel fixed and purposeful
- avoid full-width text rivers when explanations are shown

## Sidebar rules

### Navigation sidebar
- compact
- stable width
- icon + label or label-first if space allows
- visually quiet but always legible

### Hierarchy sidebar
- narrower than the main workspace
- enough room for nested course/unit/topic names
- should support selection clearly

## Panel rules

### Panels
Use panels to define working regions:
- hierarchy
- list/browser
- editor sections
- question area
- explanation area
- setup filters

Panels should:
- have consistent padding
- have quiet visual boundaries
- not all scream equally for attention

## Practice Session layout

This is the key layout in the product.

### Structure
- left question panel
- right explanation panel
- always-accessible navigator

### Priority
The left question panel is the priority surface before reveal.
After reveal, space must still allow comfortable reading in both panes.

### Behavior
- right explanation panel hidden until reveal
- when hidden, left panel expands
- reveal should not cause disorienting reflow
- navigator remains easy to access throughout the session

### Action placement
Core session actions should stay in stable locations:
- previous / next
- reveal / submit
- skip
- bookmark
- flag
- strikeout

Do not move core controls around based on state unless absolutely necessary.

## List density rules

Lists should be:
- compact
- scannable
- grouped with clear separators
- not giant padded cards

This applies to:
- library items
- history sessions
- hierarchy nodes
- navigator items

## Form layout rules

Authoring is structurally complex. The layout must reduce mental load.

Rules:
- group related fields together
- keep labels close to fields
- separate metadata from content editing
- use section headers clearly
- avoid one giant endless undifferentiated form slab

## Empty and warning states

Empty states should be:
- quiet
- helpful
- action-oriented

Warnings should:
- appear near the relevant context
- avoid modal spam
- not visually overpower the workspace
