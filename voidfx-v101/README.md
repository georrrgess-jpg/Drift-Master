# voidfx studio 2: transfer copy (v101 THE LESS YOU KNOW, v102 LET GO)

This folder holds Studio 2's work for the **`georrrgess-jpg/voidfx`** repository, not for Drift Master. It's here because this session can't push to voidfx: attaching voidfx with push access was refused by the session's permission check. Nothing in this folder touches the game.

| Path | What it is |
|---|---|
| `voidfx-v101.bundle` | A git bundle with Studio 2's two commits, **rebased onto Studio 1's `claude/gallant-planck-pqpczp` at `daff0de`** (v9 NIGHT BLOOM and the approved v9 text standard). Commit 1: the v101 and v102 edit folders, `tools/lipcheck.py`, the YuNet download fix, and the two songs in the manifest. Commit 2: Studio 2's reviews and catalogue notes added to Studio 1's docs. Studio 2's duplicates were dropped: its S4 pack catalogue (Studio 1's `p9 = pack9_s4_best`, `p10 = pack10_s4_24p` stands) and its version of the §5a gate (Studio 1's stands). |
| `docs/`, `tools/` | Browsable copies of the voidfx docs and tools as they are in the bundle. |
| `v101/` | The v101 edit folder (Dexter × Tame Impala). The owner largely disliked the style and the narrated line shown as spoken. |
| `v102/` | The v102 edit folder (The Flash × Ark Patrol "Let Go"): good and complete, but lacklustre. |
| `out/` (not in git) | The rendered MP4s and the master MOV, kept in the session only. They contain copyrighted footage and music. |

## Moving it into voidfx

From a clone of `georrrgess-jpg/voidfx` whose `claude/gallant-planck-pqpczp` is at `daff0de`:

```bash
git fetch /path/to/voidfx-v101.bundle claude/beautiful-volta-wjki7k:studio2/v101-v102
git checkout claude/gallant-planck-pqpczp && git merge --ff-only studio2/v101-v102   # a fast-forward: no conflicts
git push origin claude/gallant-planck-pqpczp
```

To rebuild an edit, run `bash tools/setup_studio.sh`, add the songs listed in `studio/src_manifest.json` (`less_i_know.mp3`, `let_go.mp3`), then run `bash tools/build.sh 101|102 prep audio video qc`.
