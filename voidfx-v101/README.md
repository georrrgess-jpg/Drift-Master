# voidfx studio 2: transfer copy (v101 THE LESS YOU KNOW, v102 LET GO, v103 FOREVER, v104 THE PASSENGER, v105 DRACULA)

This folder holds Studio 2's work for the **`georrrgess-jpg/voidfx`** repository, not for Drift Master. It's here because this session can't push to voidfx: attaching voidfx with push access was refused by the session's permission check. Nothing in this folder touches the game.

| Path | What it is |
|---|---|
| `voidfx-v101.bundle` | A git bundle with Studio 2's commits (v101/v102, docs, **v103 FOREVER** with its revisions 2 to 5, **v104 THE PASSENGER**, **v105 DRACULA**, the two new Flash packs' catalogue entries, and their doc rows), **rebased onto Studio 1's `claude/gallant-planck-pqpczp` at `daff0de`** (v9 NIGHT BLOOM and the approved v9 text standard). Commit 1: the v101 and v102 edit folders, `tools/lipcheck.py`, the YuNet download fix, and the two songs in the manifest. Commit 2: Studio 2's reviews and catalogue notes added to Studio 1's docs. Studio 2's duplicates were dropped: its S4 pack catalogue (Studio 1's `p9 = pack9_s4_best`, `p10 = pack10_s4_24p` stands) and its version of the §5a gate (Studio 1's stands). |
| `docs/`, `tools/` | Browsable copies of the voidfx docs and tools as they are in the bundle, including the standards (handbook §0, CLAUDE.md), Studio 1's Flash benchmark and its rules (as recorded from the owner's notes), `tools/new_edit.py` (now scaffolds from v104) and `tools/lyrics.py` (lyric recognition). |
| `v101/` | The v101 edit folder (Dexter × Tame Impala). The owner largely disliked the style and the narrated line shown as spoken. |
| `v103/` | The v103 edit folder (Dexter × Foo Fighters "Everlong"), **approved as the standard** after rev 5. `v103/README.md` has the pre-render check, the song section, the review log and the checkpoints. |
| `v102/` | The v102 edit folder (The Flash × Ark Patrol "Let Go"): good and complete, but lacklustre. |
| `v105/` | The v105 edit folder (Dexter × Tame Impala "Dracula"): SUNDOWN, day turns to night on the drop (bat burst, blood moon, coffin, daybreak loop). `v105/README.md` has the pre-render check, the song section, the Flash-rule checklist, the review log and the checkpoint. |
| `v104/` | The v104 edit folder (Dexter × GLM-RST "still love you (super slowed + reverb)", the screen-recorded TikTok sound): THE PASSENGER, the SUMI ink look, **approved as the newest standard** (the scaffold starts from it). `v104/README.md` has the pre-render check, the song section, the review log and the checkpoint. |
| `out/` (not in git) | The rendered MP4s and the master MOV, kept in the session only. They contain copyrighted footage and music. |

## Moving it into voidfx

The bundle is based on `daff0de`. **Studio 1 has committed since then** (at least the Flash benchmark, recorded in its CLAUDE.md, handbook, toolkit and start prompt), so a fast-forward is no longer possible. Merge instead:

```bash
git fetch /path/to/voidfx-v101.bundle claude/beautiful-volta-wjki7k:studio2/work
git checkout claude/gallant-planck-pqpczp && git pull
git merge studio2/work        # expect conflicts in the shared docs (see below)
git push origin claude/gallant-planck-pqpczp
```

**Expected conflicts:**
- **The docs:** `CLAUDE.md`, `studio/VOIDFX_STUDIO.md`, `studio/START_PROMPT.md` and `docs/TOOLKIT.md` were edited by both studios. Keep both sides:
  - Studio 1's Flash benchmark, as written by Studio 1, rather than Studio 2's summary of the notes;
  - Studio 2's standards (§0: v104 THE PASSENGER and v103 FOREVER), its "no headspace" rule, and its v103/v104 rows and lessons.
- **The scaffold:** `tools/new_edit.py` and `tools/edl_template.py` may conflict if Studio 1 changed the scaffold. Decide with the owner which edit new work starts from (Studio 2 points it at v104).
- **`studio/SCENE_PACKS.md` and `studio/src_manifest.json`:** Studio 2 added the two Flash packs that came with the v105 brief (`flash_s4.mp4`, `reverse_flash.mp4`); keep both sides if Studio 1 added packs too.
- **No other conflicts expected:** the edit folders (`v101`–`v105`) are Studio 2-only.

To rebuild an edit, run `bash tools/setup_studio.sh`, add the songs listed in `studio/src_manifest.json` (`less_i_know.mp3`, `let_go.mp3`), then run `bash tools/build.sh 101|102|103|104|105 prep audio video qc` (v103 needs `everlong.mp3`; v104 needs `still_love_you_rec.wav`; v105 needs `dracula.mp3`, `scenepack3_24fps.mp4`, `pack6_s5.mp4` and `doakes.mp4`).
