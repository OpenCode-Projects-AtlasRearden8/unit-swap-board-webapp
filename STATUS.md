# STATUS.md — Unit Swap Board

Last verified: 2026-10-28

## What was built

A single-file, zero-dependency, education-only web app (`index.html`) for nurses to organize shift swaps **within their own squad**, entirely in the browser:

- Squad roster with add/remove (removal cleans up affected cards and slots).
- 7-day × 3-shift pencil grid (editable day labels, per-slot assigned nurse, "need coverage" toggle, quick request/offer buttons).
- Request & offer cards with editable nurse, slot, optional trade-back slot (offers only), and note.
- Automated offer matching: same slot + different nurses, greedy one-to-one, open cards only.
- Coverage thumbs-up flow: a match can only be recorded as covered once **both** nurses thumbs-up their own cards; then it can be recorded as a *pickup* or an *even swap*.
- Written-down-yourself confirmations: covered trades are recorded locally, optionally written back onto the grid (idempotent).
- Fairness counter per nurse: given / received / net, updated from recorded trades.
- Printable swap-confirm notes (facility/unit blanks, both signatures, supervisor sign-off line, official-process reminder) via the browser print dialog — print all or one.
- Data: localStorage autosave, JSON export/import, "Erase everything".
- Prominent education-only disclaimers in-page and in print notes; no logins, no cloud, no network calls, no personal-data requirements.

## How to run it

- App: open `index.html` in a modern browser. Optional: `python3 -m http.server 8000` then visit `http://localhost:8000`.
- Tests: `node tests/run-tests.js` (plain Node, zero dependencies; extracts the tested logic from `index.html` so there is one source of truth).

## Verification results

- `node tests/run-tests.js` → **23 passed, 0 failed** (matching rules, both-thumbs gating, purity/no-mutation, pickup vs. swap grid application, idempotency, fairness tally, state sanitization, note wording, plus a compile-check of the UI script).
- Headless Chrome smoke test (`google-chrome --headless=new --dump-dom`): page loads with **zero JavaScript errors**; grid renders all 7 × 3 = 21 slot cells, empty-state hints render correctly.
- No external dependencies; only `node` and a browser are needed.

Known gaps / ideas for later
----------------------------

- Shift labels (Day/Evening/Night) are fixed; only day labels are editable. Custom shift columns would need a small persistence change (they were left fixed to keep `slotKey` keys stable).
- Matching is greedy and deterministic (first open offer wins). More clever fairness-aware ranking of candidate offers is possible.
- Reversing a recorded trade isn't one-click (delete the record and adjust cards manually).
- Import/export validates and sanitizes input, but there is no schema versioning/migration beyond a single `version: 1` field.
- No automated end-to-end UI tests (headless click-through); logic is thoroughly unit-tested and the UI was smoke-tested headlessly.
- Print styling is tested via the print stylesheet only; actual paper layout will vary a little by browser.

Out-of-scope by design (and stated in the UI/README): anything official — this app is never a scheduling-of-record system, never clinical, and never a substitute for a facility's official swap process. Not medical advice.

## Credits

An education-only, local-first tool by **Asdale Dynamics, LLC** — Copyright (c) 2026 Asdale Dynamics, LLC — MIT licensed (see `LICENSE`).
