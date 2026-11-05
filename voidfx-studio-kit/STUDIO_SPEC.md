# voidfx studio spec

**What this is:** everything the voidfx studios have learned about the owner's taste, every edit's verdict and lessons, the working pipeline, its data contracts, and a proposed architecture for a studio that can run fully autonomously or under manual control. It consolidates both studios:
- **Studio 1:** v1–v11, on branch `claude/gallant-planck-pqpczp`, read at `122013b`.
- **Studio 2:** v101–v105, on branch `claude/beautiful-volta-wjki7k`, at `c512052`.

| If you need… | Read |
|---|---|
| The rules as data (for an automated planner or checker) | `data/preferences.json`, `data/qc_checkpoint.json` |
| Every edit, its verdict, quotes and lessons | `data/edits.json` |
| The owner's exact words (Studio 2 session) | `data/owner_messages_studio2.md` |
| Every transition in both engines, with timing and status | `data/transitions.json` |
| The source library (measured resolution, fps, bitrate) | `data/sources.json` |
| The working code and docs | `repo/` (Studio 2, complete) and `studio1/` (Studio 1's v10/v11 work and its versions of the shared docs) |

The longer, original handbooks are `repo/studio/VOIDFX_STUDIO.md`, `repo/CLAUDE.md` and `repo/docs/TOOLKIT.md`, plus Studio 1's versions in `studio1/`. This spec summarises them and adds the architecture; where they differ in detail, the handbooks are the source.

---

## 1. Who the owner is and what they want

The owner makes **TikTok fan edits** under the **voidfx** brand. Most are of *Dexter*, some of *The Flash*. The goal of every edit is to be *"the best edit we have made so far"*. Each brief asks for the same things:
- a new, complete, professionally polished edit (not a plan);
- the strongest part of the song;
- precise timing to the music;
- a cohesive atmosphere;
- a compelling first 1–2 seconds;
- a deliberate ending and a loop;
- many creative animations, custom graphics and unique transitions;
- review and refinement before delivery.

The brief is reproduced in full in `data/owner_messages_studio2.md`.

**What reliably earns approval:**
1. **Transitions as the star.** Designed, physical moves *through* something from the character's world, where the viewer wonders "how did they do that". Each has its own sound. Density is welcome when every move is clean.
2. **A concept**, rooted in the character or the song's own words, carried through picture, grade, sound, text and loop:
   - SUNDOWN: "run from the sun like Dracula";
   - the Reverse-Flash rivalry from "Harrison";
   - the evidence pointing back at him.
3. **Signature set pieces:** multi-stage, on the drop, the hook and the loop, plus one focal piece the owner can point to.
4. **Music that drives the structure:** the biggest transition on the song's biggest moment, cuts on the beat grid, and the camera punching on the beat.
5. **Meaningful, beautiful text:** the v9 caption style ("it was perfect"), only on clearly sung or spoken words, with per-letter hero titles that act out their meaning.
6. **Graphics with depth and polish:** layers behind the person matte, light that sits behind the subject, halation, grain, a grade with a clear identity.
7. **Built-in review:** the studio catches its own problems, measures, and only ships when it's ready.

**What reliably draws a note:**
- the edit reads as "lacklustre" (fixed by the motion pass and real set pieces, not more effects);
- dead space or headspace;
- anything parked, random or drawn-looking;
- overlays on his face;
- text that pops on or isn't sung;
- soft source clips;
- light drawn *over* him;
- reusing an earlier edit's look.

The full lists, with evidence, are in sections 4 and 5.

## 2. Standards and benchmarks (newest first)

A new edit must **match or exceed all of these** and **must not copy their look**.

| Edit | Studio | What it is the reference for |
|---|---|---|
| **v11 BOP** (Flash × DaBaby) | 1 | A concept from the song's own words; a single focal set piece (THE RIFT); detailed lit graphics revealed on real objects (the emblem coin flip); a beat animation for every "just moving" shot; a loop that lands exactly on frame 0 (seam 0.11); flash discipline; few titles for explicit lyrics. Studio 1's base engine. |
| **v105 DRACULA** (Dexter × Tame Impala) | 2 | Concept-driven day/night split on the drop; light sources behind the subject; 27 designed transitions in 23 s; five set pieces including the ASHES TO SUN loop. Studio 2's base engine. The gripe: clip quality. |
| **v104 THE PASSENGER** (Dexter × GLM-RST) | 2 | One unified look over five seasons (SUMI ink); a self-drawing opening; the lit dark-side set piece; the rotation motif (the upside-down roll was the owner's favourite). The gripe: headspace. |
| **v103 FOREVER** (Dexter × Foo Fighters) | 2 | Lyric recognition; beat camera; motivated transitions (flashlight blind-out, eye dive, photo toss). The note: more animations and transitions. |
| **v10 LET IT HAPPEN** (Flash × Tame Impala) | 1 | Motion and finish: speed ramps with smooth slow motion on restored source, the beat camera, light rays, multi-stage set pieces, the AROUND ring loop. "Lacklustre" was fixed by the motion pass. |
| **v7 HIM ALL ALONG** (Dexter × Gunna) | 1 | Creative, well-animated, character-themed transitions (blood-slide box, plastic burst, zipper, blood on the lens, M99 blink, magnifier → pupil). |
| **v6 WARMPOP** (Dexter × George Clanton) | 1 | Amount and quality of transitions, animations and graphics; music correlation; the eased two-line captions. |
| **v4 SURPRISE** (Doakes × Migos) | 1 | A dialogue-led cold open as one continuous take; barrel → scope; pupil → iris loop. |

v9 NIGHT BLOOM isn't a benchmark overall, but **its text is the standard text style**.

## 3. Per-edit notes (summary; full records in `data/edits.json`)

| Edit | Verdict | The lesson it left |
|---|---|---|
| v1 THE MASK SLIPS, v2 THE DARK PASSENGER | early builds | — |
| v3 SURPRISE (first cut) | rejected in parts | Dialogue as one continuous take; no labels; text eases in; logo once, no outro. |
| v4 SURPRISE | **first standard** | Continuous-take cold open; fly through the logo's "o". |
| v5 FASTEST (Flash) | mixed | No generic bursts or title cards; cut odd footage; verify lyrics; lyric words act out their meaning. |
| v6 WARMPOP | **standard** | One concept; hero transition on the drop; 15+ designed transitions; depth graphics. No CJK subtitles, no timers. |
| v7 HIM ALL ALONG | **standard** | Physical themed transitions; one short line that sets up the hook; no gimmicks on the face; never restyle the logo; detailed themed text moments (the brass-plated slide box). |
| v8 WISH YOU WELL | liked ("did most things well") | The "Darling," freeze into a blood drop; the mirror loop; the good "basic" transitions. v8's thin editorial type was disliked. |
| v9 NIGHT BLOOM | good but **lacklustre**; text "perfect" | The concept came from the song title, not his world; too few set pieces; too few graphics. "Go above and beyond." |
| v10 LET IT HAPPEN (Flash) | **standard** | The motion pass fixed "lacklustre"; restore 720p sources. |
| v11 BOP (Flash) | **standard** (newest, Studio 1) | Concept from the song; focal set piece; lit hero graphics; beat moments; exact loop; flash discipline. |
| v101 THE LESS YOU KNOW | **style rejected** | Don't show narration as spoken; the 16 mm psychedelic look failed. |
| v102 LET GO (Flash) | good but **lacklustre** | Concept from his world; more set pieces; graphics that read at phone size. |
| v103 FOREVER | **standard** (after 5 revisions) | Text only on sung words. Props must be motivated, brief, physically lit and off the face (the ideas are fine; lingering, random or drawn-looking execution isn't). |
| v104 THE PASSENGER | **standard** (after 3) | No headspace (nothing over about 1 s without a beat); rotation motif. |
| v105 DRACULA | **standard** (after 3, newest Studio 2) | Light behind the subject (matte + light wrap); clip quality; restyle library transitions (they carry old looks); a creative loop (ASHES TO SUN). |

**How Studio 2's revisions went:** most owner notes were satisfied in one revision, by applying every note in one pass with one full render and checkpoint. The recurring asks:
- *"add more transitions, animations and graphics"*;
- *"get rid of the dead space"*;
- *"make it more creative and unique"*;
- *"ensure the edit is made with quality and efficiency"*.

## 4. Rules (as enforced; machine-readable in `data/preferences.json`)

**Hard rules (never ship if violated):**
- **Format:** 9:16, 1080×1920, 60 fps; 20–26 s; H.264 + AAC fast-start, plus a CRF 11 + PCM master.
- **Loudness:** −13 LUFS, true peak ≤ −2.5 dBTP, measured after AAC (aim for −3).
- **Faces:** centred (about 37% of the frame height), never cut off. Drop shots whose face is wider than the 9:16 window.
- **Loop:** seamless in picture and sound. Audio is built circularly, and both tracks are the same length. No outro card or title card.
- **Logo:** once, as a transition, unchanged. No watermark.
- **No labels:** no name tags, counters, timecodes, CJK subtitle lines, or stamps on captions.
- **Text:**
  - every word eases in (fade + rise + blur-to-sharp);
  - it stays in the 1240–1640 px band, clear of faces and TikTok's interface;
  - it appears only on clearly sung or spoken words, each on its own time;
  - a line is shown as spoken only if his lips match.
- **Transitions:** every one has its own sound; no plain hard cuts in quiet or dialogue sections.
- **Clean output:** no audio clicks; no more than 3 flashes in any second.
- **Review:** visual sign-off on the encoded file, then an honest report of what was verified, with a request to watch with sound.

**Targets:**
- **Density:** at least 24 designed transitions per ~24 s (best so far: 27).
- **No headspace:** nothing over about 1 s without a cut, transition or designed beat.
- **Set pieces:** three or more multi-stage set pieces (drop, hook, loop) plus one focal piece with layered sound.
- **Beat camera** through every section with drums; every "just moving" shot gets its own beat animation and sound.
- **Motion pass** on every hook shot (speed ramps; flow slow motion only where it stays clean).
- **Lyric recognition:** every clearly sung line captioned word by word, and at least 3 picture moments on sung words. When the lyrics are explicit, use a couple of designed titles instead.
- **Graphics** in every section.
- **Clip quality:**
  - restore the sources;
  - check sharpness before and after the render;
  - keep zoom at or under about 1.1 on 720p sources;
  - put hero shots on high-bitrate packs.
- **Flash discipline:** a flare keeps the picture; avoid long white-outs.
- **Hero transition** on the song's biggest moment.
- **Exact loop:** blurred seam difference ≤ 1, built from frame 0's own image.

**Banned (rejected by the owner):** see `preferences.json → banned`, with evidence in `edits.json`. The main ones:
- outro and title cards;
- a restyled logo;
- labels, counters and timecodes;
- gimmick overlays on the face;
- text that pops on;
- v8's thin editorial type;
- rapid single-word dialogue runs;
- exposition endings;
- generic starbursts;
- captions on unsung words;
- narration shown as spoken;
- lingering, random or drawn-looking props;
- the v101 16 mm psychedelic look.

**Taste guidance:** see `preferences.json → style`, the style bank of looks already used, and the list of fresh looks.

## 5. Craft lessons that matter most

- **Concept first:**
  - pick the sentence before the shots;
  - for Dexter, root it in his world (kill room, plastic, slides, tools, the Code, Harry, the Dark Passenger, victims, villains);
  - for The Flash, in lightning, the Speed Force, the emblem and the rivalries;
  - or find it in the song's own words.
- **Song:**
  - use the good part, where the full mix or bass returns (`tools/song_map.py`);
  - a breakdown or drop-out before the drop is the natural cold open;
  - a dead silence suits one line and a freeze;
  - splice on the beat grid when the hook is far from the drop.
- **Structure:**
  - a cold open of about 35–45%;
  - the hero transition on the drop;
  - a montage on the beat (a designed transition every 2–4 half-beats);
  - an ending motif that loops into the opening.
- **Transitions:**
  - motivated by something in the shot or lyric (the flashlight blinds the lens, his camera's flash takes the photo, the dive into his own eye);
  - a pre-roll of 6–15 frames and a post-roll of 8–18 frames;
  - a layered sound (whoosh + impact + material);
  - vary them, and restyle library transitions to the edit's look.
- **Text:** the v9 construction (Inter Display Black caps, a two-line keyline, red emphasis, a per-letter hero with the edit's own exit particles). Lyric times come from the Demucs vocal stem, not the full mix.
- **Graphics:**
  - procedural assets lit to the shot (height maps, bevels, specular), checked at full size;
  - depth layers behind the MODNet matte;
  - light sources behind the subject, with a light wrap;
  - particles that move fast and fade.
- **Sound:**
  - a drone and room tone across the wrap;
  - a sound for every transition;
  - tonal sounds in the song's key;
  - a riser and sub drop into the drop;
  - effects sit about 8–10 dB under a loudly mastered song (measure them);
  - duck the music under the big hits.
- **Pitfalls:**
  - packs hide cuts (use `check_sources.py`);
  - tight close-ups leave no room for text or particles;
  - 9:16 kills two-shots;
  - optical flow breaks on lighting flashes;
  - true peak rises 0.3–0.8 dB after AAC;
  - the last `render()` definition wins;
  - a library transition can bring an old edit's background (v6's cube grid, v9's jasmine);
  - the face detector reads huge close-ups as cut off, so frame them slightly off-centre (`face_x`).

## 6. The pipeline as built (both studios)

| Stage | Tool | Output | Time (4-core CPU) |
|---|---|---|---|
| Scaffold | `tools/new_edit.py N SLUG "TITLE"` (Studio 2 copies v105; Studio 1 copies v11) | `vN/work/{renderN, audioN, qcN, fxN, splice, facetrack, analyze, big}.py`, `edlN.py` | 1 s |
| Pack analysis | `vN/work/analyze.py src/PACK.mp4 TAG` | `shots_TAG.json`, contact sheets | ~1 min/pack |
| Song map | `tools/song_map.py src/SONG vN/work` | beat grid (half-beat k), drops, candidate windows | 3 s |
| Lyrics | `tools/lyrics.py vN SONG START END "published lyrics"` | word times on the Demucs vocal; QUIET or not-heard words excluded; a ready TEXT block | 2–3 min |
| Dialogue | `tools/transcribe.py`, `tools/lipcheck.py` | word times; whether lips move | 1–3 min |
| Plan | the EDL (`edlN.py`): shots, transitions, text, knobs; `fxN.py`: look, set pieces, frame | — | the creative work |
| Source check | `tools/check_sources.py N`, `tools/sharpness.py N --src` | ranges inside shots; SOFT, ZOOM and LOWBIT shots | seconds |
| Prep | `build.sh N prep` | YuNet face tracks (`tracksN.json`), MODNet mattes (`segN.npz`) | 2–4 min |
| Restore | `tools/sr_prep.py N` (Studio 1) | Real-ESRGAN compact 2× bands in `vN/sr/` | background |
| Review sheets | `build.sh N auto`; `big.py NAME COLS frames…` | 6 frames around every cut; big stills | ~1 min |
| Audio | `build.sh N audio` (`audioN.py`) | a circular mix mastered to −13 LUFS, checked after AAC | ~10 s |
| Render | `build.sh N video` | upload MP4 + master MOV | 12–18 min (1378 frames) |
| QC | `build.sh N qc` (`qcN.py`) | the 10–11 criterion ship checkpoint on the encoded MP4 | ~45 s |
| Sign-off | contact sheets from the MP4 (every cut, set pieces, flags, the seam) | human or agent judgement | minutes |

**Rendering model:**
- Python, NumPy and OpenCV, frame by frame, with a multiprocessing pool.
- Each frame is `render(f)`: base shot → transitions (`TR2`) → beat camera → text → finish.
- Sources play at their own cadence (`interp="hold"`) unless flow slow motion is chosen.
- The edit's own code lives in `fxN.py`, which `splice.py` pastes into `renderN.py` (the last definitions win).

## 7. Data contracts

**EDL (`edlN.py`), the single source of truth.** Worked example: `repo/v105/work/edl105.py`; template: `repo/tools/edl_template.py`.
- **Identity:** `VER`, `SLUG`, `SONG`, `FPS`, `W`, `H`, and `SRC = {key: (path, fps, w, h)}`.
- **Timing:**
  - `HB` (the grid unit in seconds), `HB_OFF`, `H0`/`H1` (the song window in grid units), `K_END`, `HDROP`, `PHR` (phrase starts);
  - helpers `st(h)`, `th(k)`, `fh(k)`, `sw(song_s)`;
  - `BASS`, `BEAT_PUNCH = [(k, strength)]`;
  - Studio 1's v11 adds `E_BEAT`, `E_DIP` and `E_LOOP`.
- **Shots:** `shot(name, src, k0, k1, a, b=None, **kw)`, in order and contiguous. The keys:

  | Key | What it sets |
  |---|---|
  | `tmap=[(u, src_s)]` | speed ramps |
  | `z=[(u, zoom)]` | zoom keyframes |
  | `face="largest"` or `None` | face tracking, or none (with `cx=(x0, x1)`) |
  | `face_x` | off-centre framing |
  | `interp` | `"hold"` or `"flow"` |
  | `tin` | the incoming transition |
  | `look` | the grade family |
  | `seg=True` | the MODNet matte |
  | `ev`, `con` | exposure and contrast |
  | `ghost`, `spin`, `redthr` | ghost trails, rotation, red-keep threshold |
  | edit-specific flags | `sun`, `motes`, `rim`, `fog`, `gather`, `flare`, `bloodmoon`, `daybreak` (v105) |

- **Text:** `TEXT = [dict(style="cap"|"hero", words=[(word, t, line)], end, emph=[...], band=(y0, y1), big=..., lines=[...], exit=...)]`. The times are edit seconds converted from song seconds through `sw()`.
- **Dialogue:** `VO = [(stem, a, b, at)]` and `VO_STEMS`.

**Transitions:** `TR2[name] = (fn(A, B, j, f, sa, sb), pre, post)`.
- A is the outgoing frame and B the incoming one, as float BGR arrays (H, W, 3) in 0–1.
- j is the frame offset from the cut (negative before it).
- sa and sb are the shot dicts.
- The incoming shot sets `tin=name`.
- There are 80 in Studio 2's v105 engine and 91 in Studio 1's v11, catalogued in `data/transitions.json`.

**Audio builder (`audioN.py`):**
- `music_track` builds the window, any splices and the pre-roll.
- `vo_track` builds the dialogue and the ducking.
- `fxN()` lays the sound design on the shot list (`place_w` wraps tails into frame 0).
- `main()` does the circular build, mastering on a wrapped copy, the AAC check and a level report.

**QC report (`qcN.py` → `vN/work/qc.log`):** the sections are format, faces, text vs faces, cuts/frozen/black, clicks, the seam, flashes (7b) and the SHIP verdict (`data/qc_checkpoint.json`).

**Edit README (`vN/README.md`):**
- the pre-render check (the §5a gate);
- the song section;
- the review log;
- each checkpoint table;
- what wasn't verified.

## 8. Proposed architecture: an autonomous + manual studio

The pipeline above already runs end to end from a brief. To turn it into a product, separate **what can be measured** from **what needs taste**, and let a human take control at any stage.

**Modules:**
1. **Library service.**
   - Ingests packs: probes them, detects shots (`analyze.py`), finds hidden cuts, runs restoration (`sr_prep`), measures sharpness and bitrate, and stores face tracks and mattes per shot.
   - Keeps the curated "proven shots" with tags (character, emotion, motion, light, framing room) from `SCENE_PACKS.md`.
   - Keeps media out of git and records rights and provenance.
2. **Song service.** The beat grid, sections, the drop and drop-out, candidate windows (`song_map`), Demucs stems, verified lyric word times (`lyrics.py` with published lyrics), and the key (for tonal sound design).
3. **Planner (the creative core).**
   - Produces a concept sentence, a section plan, set-piece designs, a shot list and the transition and text plan as an EDL draft, with the §5a pre-build gate filled in as structured data.
   - In autonomous mode, an LLM agent writes this from `preferences.json` + `edits.json` + the library and song analyses.
   - In manual mode, the same EDL is edited in a UI, which needs: a timeline on the beat grid; shot pickers with sharpness and face badges; a transition palette with previews; a text editor bound to the lyric word times.
4. **Effect library.** The transitions and graphics as versioned plug-ins with the `TR2` signature. Each has metadata: pre/post, sound, the motifs it suits, status (approved / rejected / restyle needed), and a thumbnail strip. The current engines are monolithic single files; split them into modules per effect so they can be shared between edits without old looks leaking in.
5. **Renderer.** A deterministic EDL → frames → MP4, with preview tiers:
   - stills (`big.py`);
   - cut sheets (`auto`);
   - a short clip with sound (`clip:A:B`);
   - a 30 fps / 540×960 preview;
   - the final render.
   Frames are pure functions of the EDL, so they cache and parallelise.
6. **Sound designer.** The circular mix, the effect layers per transition and set piece, ducking, and mastering checked after AAC.
7. **QC and sign-off.**
   - The automated checkpoint (`qc_checkpoint.json`), plus measured targets: density, the headspace span list, seam ≤ 1, flash luma, sharpness, effect level against the music.
   - A visual sign-off packet: contact sheets per cut and set piece, flagged frames and the seam.
   - In autonomous mode, an agent reviews the packet against the rules; in manual mode, the owner does.
8. **Feedback and preference store.**
   - Owner notes are parsed into changes ("remove", "change", "add", "keep") and into durable rules, as the handbook has done by hand: "no headspace" from v104, "clip quality" from v105, "light behind him" from v105.
   - Each rule records its evidence (the quote, the edit, the frame).
   - `preferences.json` and `edits.json` are the starting store.

**Modes:**
- **Autonomous:** brief → library/song analysis → plan + gate → (optional human approval of the concept) → build → review loop until QC passes and the agent's sign-off finds nothing weak → deliver with an honest report. Budget one full render per revision; iterate on stills and sheets.
- **Manual:** the same stages, each with an editor and a preview tier. A human can lock any decision, and the autonomous agent then works around the locks (for example "keep the upside-down roll", "the owner approved this loop").
- **Hybrid (recommended):**
  - the agent proposes the concept and the set-piece plan;
  - the human approves or adjusts;
  - the agent builds and self-reviews;
  - the human gives one round of notes;
  - the agent applies them in one pass.
  That's how every approved standard was reached (one to five revision rounds).

**Gates where taste matters (keep a human or a strong reviewer here):**
- the concept;
- set-piece design;
- whether a graphic "looks drawn";
- whether something is "lacklustre";
- whether a transition is "creative and unique".
The measurable gates (format, loudness, faces, text, clicks, seam, flashes, sharpness, density, headspace) can be fully automatic.

**Compute notes (from this box):**
- A full 23 s render takes 12–18 min on 4 cores with a 4-process pool and about 3 GB per worker.
- MODNet and YuNet prep takes minutes.
- Demucs takes about 2 min per song.
- faster-whisper large-v3 in int8 runs on the CPU.
- Real-ESRGAN: the large model took about 10 s a frame here; Studio 1's compact model through ONNX Runtime is practical on the CPU.
- A GPU would speed up restoration, mattes, flow and rendering.

**Inputs the studio needs from the owner:**
- songs (MP3, WAV or a screen recording of a TikTok sound);
- scene packs (1080p or 4K wherever possible: every current pack is 720p);
- the voidfx logo (`src/voidfx_logo.webp`);
- briefs and revision notes.
The media isn't in this kit; `data/sources.json` lists every file used, with its measured specs.

## 9. Open decisions and known gaps

- **Which engine is the base:** Studio 1 scaffolds from v11, Studio 2 from v105. They're separate files and can coexist. One option: Flash edits from v11, Dexter edits from v105. For the studio product, extract both into one shared effect library.
- **The branches aren't merged yet.** `repo/` is Studio 2's tree; `studio1/` holds Studio 1's changed files on top of their common base (`daff0de`). The merge notes are in `../voidfx-v101/README.md`.
- **v105's measured gaps against the newer v11 rules** (v105 is approved and unchanged): its seam (8.4 against ≤ 1) and its two white-outs.
- **Never verified by the studios:** watching and listening in real time. Everything was checked on frames and by measurement, and the owner watched.
- **Not in the kit:**
  - the media (copyrighted footage and music);
  - the models (downloaded at setup by `tools/setup_studio.sh`);
  - the rendered outputs;
  - Studio 1's session transcripts (only its committed docs and code).

## 10. Kit layout

```
voidfx-studio-kit/
  README.md                        how to use this kit
  STUDIO_SPEC.md                   this document
  data/
    preferences.json               rules: output, hard, targets, style, banned, style bank, process
    edits.json                     16 edits: verdicts, quotes, strengths, notes, lessons, measurements
    qc_checkpoint.json             automated checks + thresholds, visual gates, pre-build gate
    transitions.json               every transition in the v105 and v11 engines (timing, doc, status)
    sources.json                   35 source files with measured resolution, fps, bitrate
    owner_messages_studio2.md      the owner's messages to Studio 2, verbatim, in order
  repo/                            Studio 2's complete voidfx tree at c512052 (code, EDLs, tracks, transcripts, docs, tools)
  studio1/                         Studio 1's files changed since daff0de, at 122013b (v10, v11, sr_prep.py, srnet.py, its docs)
```
