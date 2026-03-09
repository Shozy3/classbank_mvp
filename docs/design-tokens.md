# Design Tokens

## Typography

### Font direction
Prefer:
- SF Pro on macOS if available
- otherwise Inter or a clean modern system sans

### Font sizes
- Page title: 22px / semibold
- Section title: 16px / semibold
- Primary body: 14px / regular
- Secondary body: 13px / regular
- Dense metadata: 12px / medium
- Choice labels / compact UI labels: 12px / semibold
- Monospace/code: 13px

### Line heights
- dense UI text: 1.3
- body text: 1.45 to 1.55
- explanation text: 1.55
- headings: 1.2 to 1.3

## Spacing scale

Base spacing scale:
- 4
- 8
- 12
- 16
- 20
- 24
- 32

Rules:
- 8 and 12 are the default working spacings
- 16 for section separation inside panels
- 20 or 24 only for larger container groupings
- 32 used sparingly for top-level page padding

## Radius

- Panel radius: 10px
- Input/button radius: 8px
- Small badges: 999px only when semantically useful
- Avoid overly rounded large containers

## Borders

- Use subtle 1px separators
- Prefer dividers and panel edges over heavy card outlines
- Border contrast should be visible but restrained

## Shadows

- Use minimal shadow
- Prefer layered surfaces and borders over deep drop shadows
- No floating-card carnival nonsense

## Color roles

Use semantic tokens rather than hardcoded colors in components.

### Background layers
- app background
- primary panel
- secondary panel
- elevated overlay
- input background

### Text roles
- primary text
- secondary text
- muted text
- inverse text

### Interactive roles
- hover background
- selected background
- focus ring
- active accent

### Semantic roles
- correct
- incorrect
- partial credit
- warning
- info
- flagged
- bookmarked

## Dark mode guidance

### General
Dark mode is the default first-class visual mode.

### Desired behavior
- high readability
- strong hierarchy
- no muddy low-contrast soup
- syntax and math remain legible
- selected/current states remain obvious

### Correctness colors
Correct/incorrect/partial states must be distinct even in peripheral vision.

Do not rely on subtle color differences alone. Use:
- border change
- icon/state marker
- background tint
- text treatment where appropriate

## Sizing guidance

### Inputs and controls
- standard control height: 32–36px
- compact toolbar controls: 28–32px
- navigator items: compact but easily scannable
- answer choices: enough height for dense technical content without looking bloated
