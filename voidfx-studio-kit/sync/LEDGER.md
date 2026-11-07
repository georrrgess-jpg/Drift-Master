# Handoff ledger

Every handoff between the two voidfx studios, in order. "Out" means sent from the Dexter studio; "In" means received from the other studio.

| Date | Dir | Edit | Verdict | File | Adopted by the receiver |
|---|---|---|---|---|---|
| 2026-11-07 | Out | DEV: pipeline v2 WP2 items 1–3 (grade by lookup, contiguous scheduling, shot-render cache) | DEV (PR #1 into `dev/pipeline-v2`) | `handoffs/2026-11-07_dexter_DEV_WP2-1.md` (also in voidfx `sync/handoffs/`) | pending review. Results: golden v11 max 1/255, v105 0/255 (all 1,378 raw frames identical); v11 render CPU −25%; full render 698 → 623 s, peak 11.1 GB. The x264 encodes (~1,000 CPU-s) now limit it, so the ≤ 6 min target needs item 7 too |
| 2026-11-07 | Out | DEV: pipeline v2 WP0 (one code base) + WP1 (golden frames, metrics) | DEV | `handoffs/2026-11-07_dexter_DEV_WP0-WP1.md` (also in voidfx `sync/handoffs/`) | pending (merged on `dev/pipeline-v2`: `a09772a`, `5957c88`) |
| 2026-11-07 | In | Pipeline v2 plan (Flash studio) | plan (DEV) | `PIPELINE_V2_PLAN.md` (copy; the original is in voidfx `sync/`) | yes: the Dexter studio leads development; the owner approved the voidfx repo as the code base and the merge of both branches |
| 2026-11-07 | Out | v105 DRACULA (Dexter × Tame Impala) | standard | `handoffs/2026-11-07_dexter_v105_DRACULA_standard.md` (reissued in the shared 9-section format) | pending (the Flash studio has adopted the shared format and agreed the engine split) |
| 2026-11-07 | In | v10 LET IT HAPPEN (Flash × Tame Impala) | standard | `handoffs/2026-11-07_flash_v10_LET_IT_HAPPEN_standard.md` | yes: the motion-pass numbers, onsets via pitch + onsets, the loop as a set piece (no plain rewind), lacklustre = motion; v10 notes into the handbook; techniques into the toolkit |
| 2026-11-07 | In | v11 BOP (Flash × DaBaby) | standard | `handoffs/2026-11-07_flash_v11_BOP_standard.md` | yes: flare peak ≤ ~110 mean luma (now in QC 7b), nothing on faces, 4K-labelled packs are 720p, two titles for explicit lyrics; v11 notes into the handbook; techniques into the toolkit |
| 2026-11-07 | In | v10 + v11, reissued in the shared format (replace the files above) | standards | same two files | yes: engine split agreed (Dexter from v105, Flash from v11); 'transform the picture, not an overlay'; labels unknown until probed; no white-out runs; sr_prep timing; next-Dexter-edit notes; Dexter restyle ideas into the toolkit |
| 2026-11-07 | In | the Flash studio's procedure | — | `FLASH_STUDIO_EXCHANGE.md` | yes: the shared 9-section format, roles, conflict rule |
| (earlier, before this workflow) | In | v10 LET IT HAPPEN, v11 BOP (Flash) | standards | recorded from the owner's pasted notes into `repo/CLAUDE.md` and the handbook (no handoff file) | yes (2026-11-05) |
