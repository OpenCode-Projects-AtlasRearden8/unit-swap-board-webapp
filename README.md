# Unit Swap Board

A warm, tiny, **education-only** web app that helps nurses organize shift swaps **within their own squad** — like a shared notebook that lives in your browser.

Built in plain HTML/JS/CSS. Zero dependencies, no build step, no logins, no cloud. Everything is stored in your browser's `localStorage` only.

> **Important disclaimers**
> This is an education and self-organization aid only.
> - It is **never** a scheduling-of-record or official scheduling system.
> - It is **not medical advice** of any kind.
> - Every swap must follow your **facility's official process** and get the required sign-off. The printable "swap-confirm notes" are personal worksheets for keeping track and following through — not official records.

## What it does

- **Squad roster** — add the nurses you trade with (first names/nicknames are plenty; no personal data required).
- **Shift grid** — a 7-day × 3-shift (Day / Evening / Night) grid you can pencil people into, with day labels you can edit and a "need coverage" toggle per slot.
- **Requests & offers** — sticky-card style board:
  - a *request* asks for coverage of a slot ("I need Tue Day covered"),
  - an *offer* says a nurse can cover a slot, optionally naming a **trade-back slot** for an even swap.
- **Offer matching** — the board pairs each request with the next open offer on the same slot for a *different* nurse. Matches never reuse the same offer twice.
- **Coverage thumbs-up flow** — each nurse gives their own card a thumbs-up when they've genuinely agreed. A match can only be recorded as *covered* once **both** people have thumbs-upped. Everyone writes the agreement down themselves; the board just helps organize it.
- **Fairness counter** — a running tally per nurse: shifts **given** (covered for someone), shifts **received** (someone covered for you), and the **net** balance. Even swaps net out to zero; pickups credit the coverer.
- **Printable swap-confirm notes** — one click builds print-friendly notes with facility/unit blanks, both nurses' names, shifts, and signature/sign-off lines, plus a reminder to follow your facility's official procedure. Use your browser's print dialog.
- **Data stays local** — auto-saves to `localStorage`, with JSON export and import so you can back up or move your board. "Erase everything" wipes it.

## How to run it

No install, no server, no dependencies required by the app itself.

1. Download or clone this folder.
2. Open `index.html` in any modern browser (double-click it, or use `File > Open`).

That's it. For the nicest experience (and to avoid any `file://` quirks), you can serve it locally first:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

Click **Load example squad** to see a filled-in board end to end, then edit or erase everything and start your own.

## Running the tests

The offer-matching logic lives inside `index.html` (single source of truth) and is exercised by a zero-dependency Node test harness that extracts it:

```sh
node tests/run-tests.js
```

Requires Node (no packages). The suite covers matching rules (same slot, different nurses, no offer reuse, done cards skipped), the both-thumbs gating before a swap is recorded, purity/no-mutation guarantees, slot application (pickup vs. even swap), fairness tallying, state sanitization, and the note text's safety wording.

## Privacy

- No accounts, no analytics, no network calls.
- All board data lives in your browser's `localStorage` on your own device.
- Export/import files stay wherever you put them.
- Please don't put more personal detail in than you'd write on a sticky note.

## Known limits

See [STATUS.md](STATUS.md) for the current status and known gaps.

## License

MIT — see [LICENSE](LICENSE).

**Unit Swap Board** is an education-only tool by **Asdale Dynamics, LLC** (Copyright (c) 2026 Asdale Dynamics, LLC). Included in the practical-tools collection alongside beginner-friendly AI manuals and guides at dylanasdale.github.io.
