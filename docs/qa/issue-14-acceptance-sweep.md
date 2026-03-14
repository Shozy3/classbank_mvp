# Issue 14 Acceptance Sweep

Date: 2026-03-14
Issue: #14 Acceptance test sweep for MVP

## Objective

Execute a full acceptance sweep and track outcomes against `acceptance-tests.md` before MVP declaration.

## Preconditions

1. Start a local static server from repo root:

```bash
python3 -m http.server 8741
```

2. Run acceptance suite from repo root:

```bash
npm run at:interactive
npm run at:validate-report
npm run at:signoff-check
```

`npm run at:interactive` executes the complete chain through `scripts/interactive-at-runner.mjs`:
- interactive sweep
- report schema/coverage validation
- strict zero-fail/zero-blocked signoff check

The standalone validation commands remain available for targeted reruns.

3. Optional core verification gate:

```bash
npm run verify:core
```

## Evidence Sources

- Acceptance report: `temp/at-report.json`
- Interactive runner: `scripts/interactive-at-runner.mjs`
- Local issue ledger: `github-issues.md`

## Latest Recorded Result

- Report timestamp: `2026-03-14T20:17:01.208Z`
- Totals: pass=19, fail=0, blocked=0, total=19
- Acceptance IDs covered: AT-001 through AT-017
- Additional runner checks: AT-SR-001, SMOKE-UI-ERRORS

## Sign-off Criteria

1. Full sweep command runs successfully with documented prerequisites.
2. `temp/at-report.json` includes complete totals and per-test status details.
3. Acceptance contract IDs AT-001 through AT-017 are all present.
4. No unexplained FAIL or BLOCKED outcomes in latest run.
5. Result summary is reflected in `github-issues.md` and posted to remote issue notes.

## Rerun Checklist

1. Ensure server is reachable at `http://127.0.0.1:8741`.
2. Run `npm run at:interactive`.
3. Run `npm run at:validate-report` for schema and count validation.
4. Run `npm run at:signoff-check` for strict zero-fail/zero-blocked gate.
5. Confirm `temp/at-report.json` timestamp changed.
6. Confirm totals and pass matrix are coherent.
7. Re-run `npm run verify:core` if harness or supporting scripts changed.
