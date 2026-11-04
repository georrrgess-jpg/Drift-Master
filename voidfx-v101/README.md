# voidfx v101: THE LESS YOU KNOW (transfer copy)

This folder holds the editable project for the voidfx edit **v101 THE LESS YOU KNOW** (Dexter × Tame Impala "The Less I Know The Better"). It belongs to the **`georrrgess-jpg/voidfx`** repository, not to Drift Master.

It is here because the session that made the edit could not push to voidfx: attaching voidfx with push access was refused by the session's permission check. Nothing in this folder touches the game.

| Path | What it is |
|---|---|
| `voidfx-v101.bundle` | A git bundle with the v101 commit for voidfx: the edit, engine fixes and doc updates. It builds on voidfx `claude/gallant-planck-pqpczp` (f1ea39d). |
| `v101/` | A plain, browsable copy of the edit folder: EDL, renderer, look/transitions source, sound design, QC, shot lists, transcripts, face tracks, the Fraunces font. `v101/README.md` has the full write-up. |
| `out/` (not in git) | The rendered TikTok upload MP4 and the CRF 11 master MOV, kept in the session only. They contain copyrighted footage and music, so they stay out of git like every voidfx edit. |

## Moving it into voidfx

From a clone of `georrrgess-jpg/voidfx` that has `claude/gallant-planck-pqpczp`:

```bash
git fetch /path/to/voidfx-v101.bundle claude/beautiful-volta-wjki7k:studio2/v101-less-i-know
git push -u origin studio2/v101-less-i-know      # then open a PR into the main studio branch
```

Then rebuild locally with `bash tools/setup_studio.sh`. Add `src/less_i_know.mp3` (the uploaded Tame Impala audio, listed in `studio/src_manifest.json`) and then run `bash tools/build.sh 101 prep audio video qc`.
