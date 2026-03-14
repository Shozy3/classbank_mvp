# Screen Spec — Review History

## Purpose

Show prior sessions and make recent study activity inspectable.

## Primary jobs
- browse past sessions
- inspect summary data
- relaunch useful review flows where appropriate

## Layout

### App shell
Uses the shared persistent sidebar navigation used by all top-level screens.

### Left/main list
Recent sessions in chronological or grouped order

### Right/detail pane
Selected session details:
- mode
- date/time
- duration
- score if applicable
- item counts
- quick follow-up action if available

## Visual priority
1. recent sessions
2. selected session detail
3. follow-up actions

## Required states
- no history yet
- selected session
- invalid/corrupt session record fallback

## UX notes
- keep it compact and readable
- this screen should feel useful, not over-analytical
- session rows should be information-dense, not giant cards
