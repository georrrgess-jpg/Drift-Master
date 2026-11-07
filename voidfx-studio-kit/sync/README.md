# voidfx two-studio sync

Two voidfx chats work as a coalition, and each learns from the other's edits:
- **the Dexter studio** (this chat, Studio 2): every Dexter edit, numbered v106 onward;
- **the other studio** (Studio 1): its own range, v12 onward.

After every verdict, the studio that made the edit writes a **handoff**: one self-contained markdown file covering what the edit was, how it was made, what the owner said, what made it good or bad, what changed between revisions, and the rules that come out of it. The owner sends that file to the other chat, which adopts the lessons. Both chats then learn at the same pace.

## The loop (Dexter studio)

1. **Brief.** The owner sends the song and, optionally, new scene packs, using `repo/studio/START_PROMPT.md` or a free-form brief.
2. **Build.** The edit goes through the full process: pre-build gate, render, QC, visual sign-off, delivery.
3. **Review.** The owner sends notes, and each revision applies every note in one pass with one render and one checkpoint.
4. **Verdict.** The owner says one of:
   - **"good / make it a standard"**: it's recorded as a standard, the scaffold moves to it, and its gripes become rules;
   - **"bad, because…"**: it's recorded as rejected, with the reasons turned into rules or bans.
5. **Handoff (the same turn as the verdict).** The studio:
   - writes `sync/handoffs/YYYY-MM-DD_dexter_vNNN_TITLE_<standard|rejected>.md` from `HANDOFF_TEMPLATE.md`;
   - adds the edit to `data/edits.json` and any new rules to `data/preferences.json`;
   - adds a line to `LEDGER.md`;
   - updates the handbooks in `repo/`;
   - commits and pushes;
   - sends the owner the handoff file.
6. **Send.** The owner gives the handoff file to the other chat, with the short message in `RECEIVE_PROMPT.md`.
7. **Receive (the other direction).** When the owner pastes or attaches a handoff from the other chat here, this studio:
   - files it in `sync/handoffs/`;
   - adds it to the ledger;
   - adopts its rules (updating `data/preferences.json` and the handbooks), noting which apply to Dexter edits;
   - commits and pushes;
   - confirms in one short reply what it adopted.

A verdict also triggers a handoff mid-revision. If the owner says "this part is bad because…" and it's a lasting lesson (not a one-off tweak), it goes into the next handoff's rules.

## What a handoff must contain (see `HANDOFF_TEMPLATE.md`)

- **Identity:** the edit number, title, show, song, window, length, verdict and date.
- **The owner's words, verbatim:** every note and the verdict.
- **The creative process:**
  - the concept and how it was found;
  - the look;
  - the structure against the song;
  - each set piece and transition, and how it was built;
  - the sound design;
  - the text.
- **The revision history:** for each round, the note, what was changed, why, and what was tried and failed.
- **What made it good, and what made it weak** (the owner's view first, then the studio's analysis).
- **Measured results:** QC numbers, seam, flashes, sharpness, density, headspace.
- **New rules:** numbered and phrased as instructions, each with its evidence (a quote and the edit).
- **Reusable assets:** each technique or transition, where its code is, and how to restyle it for another show.
- **Open questions** for the other studio.

Handoffs are self-contained: the other chat must be able to act on one without access to this repo.

## Files

| File | Purpose |
|---|---|
| `README.md` | This workflow. |
| `HANDOFF_TEMPLATE.md` | The structure every handoff follows (both studios). |
| `RECEIVE_PROMPT.md` | The message the owner pastes into the other chat with a handoff, and the instructions for that chat to write its own handoffs back. |
| `LEDGER.md` | Every handoff sent and received, in order. |
| `handoffs/` | The handoff files themselves. |
