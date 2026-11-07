# voidfx studio kit

Everything needed to develop a fully autonomous and manual editing studio for voidfx edits:
- the owner's preferences;
- every edit's notes and verdicts;
- the rules, the QC checkpoint and the transition catalogue;
- the complete working code and docs of both studios.

**Start with [`STUDIO_SPEC.md`](STUDIO_SPEC.md).** It consolidates the preferences, standards, per-edit notes, rules, pipeline and data contracts, and proposes an architecture for autonomous, manual and hybrid modes.

| Path | What it is |
|---|---|
| `STUDIO_SPEC.md` | The consolidated spec (read first). |
| `data/preferences.json` | The owner's rules as data: output format, hard rules, targets, style guidance, banned items, the looks already used, fresh looks, process. |
| `data/edits.json` | All 16 edits (v1–v11, v101–v105): verdict, quotes, strengths, owner notes, lessons, measurements, folder. |
| `data/qc_checkpoint.json` | The automated ship checkpoint with its thresholds, the visual sign-off gates, the pre-build gate. |
| `data/transitions.json` | Every transition in Studio 2's v105 engine (80) and Studio 1's v11 engine (91): timing, description, owner status. |
| `data/sources.json` | All 35 source files the studios used, with measured resolution, fps and bitrate (the media itself isn't included). |
| `data/owner_messages_studio2.md` | Every message the owner sent Studio 2, verbatim and in order: briefs, notes, approvals. |
| `sync/` | **The two-chat workflow:** the procedure (`README.md`), the handoff template, the message to paste into the other chat (`RECEIVE_PROMPT.md`), the ledger, and the handoffs themselves (`handoffs/`). |
| `repo/` | Studio 2's complete voidfx tree at `c512052`: every edit's engine, EDL, effects, sound design, QC, face tracks, transcripts and README; `tools/`; `studio/` (handbook, scene packs, start prompt, setup); `docs/TOOLKIT.md`; `CLAUDE.md`. |
| `studio1/` | Studio 1's files changed since the shared base `daff0de`, at `122013b`: the v10 and v11 edits (engine, EDL, QC, README), `tools/sr_prep.py` + `srnet.py` (source restoration), its scaffold and template, and its versions of the shared docs. |

**Not included:**
- source media and songs (copyrighted; listed in `data/sources.json`);
- models (downloaded by `repo/tools/setup_studio.sh`);
- rendered videos (the latest Dexter renders are in `../voidfx-v101/out/`, which isn't committed).

**To run the existing pipeline** (Studio 2):
1. Put the media in `src/` (names in `repo/studio/src_manifest.json`).
2. Run `bash tools/setup_studio.sh`.
3. Run `python3 tools/new_edit.py N SLUG "TITLE"`.
4. Run `bash tools/build.sh N prep auto audio video qc`.

The fast loop and its timings are in `STUDIO_SPEC.md` §6.

**Related:** `../voidfx-v101/` is the Studio 2 transfer copy: the git bundle for merging into the voidfx repo, the merge notes and the renders.
