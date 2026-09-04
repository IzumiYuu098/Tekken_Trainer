# Notation Lab — Fighting Game Combo Trainer (v2)

A browser-based input trainer for practicing fighting-game notation and
combos on keyboard **or** a DualShock 4 (or any "standard"-mapped gamepad),
with a per-character combo library, a beginner→advanced training roadmap,
and precise, structured input diagnostics. 100% original code and visual
design. No backend, no build step, no account, no external dependencies.

This is a from-the-architecture-up rewrite of the input-recognition engine.
If you used the previous version, your old saved combos are **not** lost —
see [Upgrading from v1](#upgrading-from-v1) below.

---

## What changed in v2 (highlights)

- **Fixed the input-history bug at the architecture level.** A new chord
  "settle window" recognizer replaces the old signature-change logging, so
  `D`, `F`, `1` pressed within a few milliseconds of each other now produce
  exactly one `DF+1` history event — never a flood of intermediate states.
- **New default keyboard layout:** `W/A/S/D` for directions, `U/I/J/K` for
  attacks 1–4.
- **Tekken-style letter notation** (`U`/`D`/`B`/`F`, `DF`/`DB`/`UF`/`UB`,
  `1`–`4`, joined with `+`) instead of arrow glyphs.
- **DualShock 4 / gamepad support**, feeding the exact same input pipeline as
  the keyboard — there is one authoritative combo engine, not two.
- **Per-character combo library** with a flexible notation editor that
  accepts real inputs, movement macros (`DASH`, `BACKDASH`), and
  unverifiable stance/movement **labels** (`WS`, `FC`, `BT`, `DEW`, ...) side
  by side.
- **Precision modes** (Relaxed / Normal / Strict / Perfect) with structured
  diagnostics: `WRONG BUTTON`, `MISSING BUTTON`, `EXTRA INPUT`,
  `TIMING ERROR` — not just a generic "wrong".
- **A 10-level training roadmap** with real, measurable skill tracking
  (`NOT_STARTED → LEARNING → PRACTICING → CONSISTENT → MASTERED`).
- **Daily Practice** session generator, **Export/Import** your whole library
  as JSON, and a **Debug mode** showing raw input → state → normalized event.

---

## Features

- Keyboard input engine with an auto-repeat guard, held-key tracking, and
  automatic clearing of all inputs on focus loss.
- Gamepad engine polling via `requestAnimationFrame` (only while a pad is
  connected), with connect/disconnect handling and a press-to-calibrate
  remapping UI.
- SOCD (opposing-direction) handling with three selectable, documented
  policies: Neutral, Last Input Priority, First Input Priority.
- A chord-window input-event recognizer (configurable 20/30/40/50ms) that
  turns raw presses into meaningful, normalized events — see
  [How the input engine works](#how-the-input-engine-works).
- A long, numbered, scrollable input history (10/20/30/50/100 entries) with
  auto-scroll and pause toggles, and the most recent input visually
  emphasized.
- A live "Current Input" readout with **zero added latency** — only the
  history log is debounced, never the on-screen feedback.
- Character profiles (starts with "Lili" — an empty profile you fill in
  yourself, not fabricated move data) and a per-character combo library.
- A flexible combo notation editor: type `F DF+1 WS+4 BT DASH` and it's
  parsed into real inputs, a macro expansion, and unverifiable labels.
- Practice mode with structured, per-step diagnostics and a rich feedback
  line, not just "correct/wrong".
- A 10-level Beginner → Mastery training roadmap with real tracked stats.
- Daily Practice session generator; Random Challenge generator (Easy →
  Expert); Statistics; JSON export/import; four visual themes; synthesized
  audio feedback; a Debug panel.

---

## Folder structure

```
fighting-game-trainer/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js               composition root — wires every module together
│   ├── input-engine.js      raw keyboard capture (repeat guard, focus loss)
│   ├── gamepad-engine.js    raw gamepad capture (rAF poll loop, calibration)
│   ├── key-mapper.js        physical key <-> logical action bindings
│   ├── gamepad-mapper.js    physical gamepad button <-> logical action
│   ├── controller-state.js  the ONE shared state, fed by every input source
│   ├── notation.js          state -> Tekken-style notation (SOCD, pure fns)
│   ├── input-events.js      chord/settle-window meaningful-event recognizer
│   ├── input-history.js     the log (thin — no timing logic lives here)
│   ├── combo-notation.js    free-text combo parser (inputs/macros/labels)
│   ├── combo-system.js      live combo builder/recorder + random generator
│   ├── characters.js        character + combo library (persisted, v1 migration)
│   ├── trainer.js           ComboMatcher: structured comparison + diagnostics
│   ├── progression.js       10-level roadmap, skill tracking, daily practice
│   ├── movement-training.js Movement tab's drill list
│   ├── timing.js            performance.now()-based timing utilities
│   ├── statistics.js        persisted performance statistics
│   ├── audio.js             synthesized Web Audio feedback tones
│   ├── storage.js           versioned localStorage wrapper + export/import
│   └── ui.js                all DOM wiring (the only file that touches the DOM)
├── assets/icons/
└── README.md
```

---

## Running it locally

ES modules need to be served over `http(s)://`, not opened directly as a
`file://` path (most browsers block module imports there). From the folder:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open the printed local address in Chrome, Firefox, Edge, or Safari.

---

## Putting it on GitHub so your friends can use it (no downloads needed)

**GitHub Pages** is the right tool here — once it's live, your friends just
open a URL in their browser. No Python, no Node, no cloning, no local
server. Only *you* need to do the one-time setup below.

1. **Create a repository.** On github.com, click **New repository**, give it
   a name (e.g. `notation-lab`), keep it **Public** (GitHub Pages on a free
   account requires a public repo, or a private one on a paid plan), and
   create it without a README (you already have one).
2. **Upload the files.** Easiest path with no git experience: on the new
   repo's page, click **Add file → Upload files**, drag in this entire
   `fighting-game-trainer` folder's *contents* (`index.html`, `css/`, `js/`,
   `assets/`, `README.md` — not a zip, the actual files/folders), and commit.
   (If you're comfortable with git: `git init`, `git add .`,
   `git commit -m "v2"`, `git remote add origin <your repo URL>`,
   `git push -u origin main`.)
3. **Enable Pages.** In the repo, go to **Settings → Pages**. Under
   "Build and deployment", set **Source** to **Deploy from a branch**, pick
   the `main` branch and the `/ (root)` folder, then **Save**.
4. **Wait ~1 minute, then get the URL.** Reload Settings → Pages; GitHub
   shows a live link like `https://yourname.github.io/notation-lab/`. That's
   the link to send your friends.
5. **Updating later:** any time you push new files to the repo (or upload
   changed files through the web UI), Pages redeploys automatically within
   a minute or two.

Nothing else is required — GitHub Pages serves static files over HTTPS,
which is exactly what this trainer needs and solves the local-server
requirement above permanently.

---

## Keyboard controls (default)

| Action          | Key |
|-----------------|-----|
| Up              | `W` |
| Down            | `S` |
| Left (Back)     | `A` |
| Right (Forward) | `D` |
| Button 1        | `U` |
| Button 2        | `I` |
| Button 3        | `J` |
| Button 4        | `K` |

Fully remappable in **Settings → Keyboard Mapping**.

## Gamepad (DualShock 4) setup

Plug in the controller (wired, or paired over Bluetooth if your OS/browser
supports it) and press any button — Settings shows "Connected" once the
browser detects it. Default mapping assumes the browser reports the
Gamepad API's **"standard"** mapping (true for DS4 on Chrome/Firefox/Edge in
the large majority of cases): D-pad on buttons 12–15, the four face buttons
on 0–3. If your buttons don't match, recalibrate any binding in
**Settings → Gamepad**: click it, then press the physical button you want.

Only the digital D-pad is used for directions (not the analog stick) —
this is intentional: the brief prioritizes precise, verifiable digital input
over an analog stick's deadzone/threshold guesswork.

Set **Settings → Input Source** to Keyboard only / Gamepad only / Both.
"Both" (the default) lets either device drive the same trainer at once.

---

## How the input engine works

Five layers, in order, and there is exactly **one** instance of each — the
keyboard and the gamepad both feed the same `ControllerState` through the
same `press()`/`release()` calls, so there is no separate combo logic per
device:

```
KEYBOARD ──┐
           ├─> raw press/release ──> CONTROLLER STATE (the one shared object)
GAMEPAD ───┘                              │
                                    SOCD resolution (Neutral/Last/First)
                                           │
                              INPUT EVENT ENGINE (chord "settle window")
                                     │                    │
                          'current' (instant)      'event' (debounced)
                                     │                    │
                          live "Current Input"      INPUT HISTORY log
                                                           │
                                                    COMBO BUILDER /
                                                    TRAINER (ComboMatcher)
```

**The chord/settle-window algorithm**, in plain terms: every raw press or
release restarts a short timer (the "chord window", default 40ms). Rapid
bursts of activity (e.g. `D`, `F`, `1` pressed within a few ms of each other)
keep pushing that timer forward, so nothing gets evaluated until the state
goes quiet. When it finally does, the engine looks at what's *actually* held
at that instant and compares it to the last logged event:

- If everything is neutral, there's nothing to log — the gesture ended
  cleanly.
- If the **direction changed** to a new value, that's a new event — even a
  "smaller" one (e.g. releasing the forward key while still holding down
  turns `DF` into `D`, which is logged, because that's a real, meaningful
  transition).
- Otherwise, if a **new button appears** that wasn't part of the last logged
  event, that's a new event too (e.g. adding `+2` while still holding `DF`).
- Otherwise (only buttons were *released*, direction unchanged), nothing is
  logged — releasing a button isn't a new performed input, it's the tail end
  of the input that was already logged.

This is what turns "`D`, `DF`, `DF`, `DF+1`, `DF`, `F`" into one clean
`DF+1` — without a crude fixed debounce delay on the whole pipeline. Only
the *history log* is debounced this way; the live "Current Input" readout
updates instantly on every raw change, with zero added latency.

Holding a key never spams repeats: the keyboard engine's auto-repeat guard
means a genuine "hold" only ever produces one press event in the first
place; the gamepad engine's poll loop only fires a press when a button
transitions from up to down.

---

## How SOCD (opposing directions) is handled

Holding Left and Right together (or Up and Down) is a real possibility on a
keyboard or leverless controller. Three selectable policies (Settings →
Input Recognition), applied *before* notation is computed:

- **Neutral** (default): opposing directions cancel out on that axis.
- **Last Input Priority**: whichever direction was pressed most recently
  wins.
- **First Input Priority**: whichever direction was pressed first keeps
  winning until released.

No policy claims to reproduce any specific game's or physical controller's
SOCD behavior exactly — these are the three documented, common approaches,
and the raw key state is never lost regardless of which is selected.

---

## How notation works

Standard Tekken-style command notation: `U`/`D`/`B`/`F` for the four
cardinal directions (Back/Forward are relative to a character always facing
right — the universal convention combo videos and guides are written in),
`DB`/`DF`/`UB`/`UF` for diagonals, `N` for neutral, and `1`–`4` for the four
attack buttons. Multiple simultaneous elements join with `+`, always in this
order: direction, then buttons in numeric order — e.g. `DF+1+2`.

---

## The combo notation editor: inputs, macros, and labels

Type a combo as free text, separated by `→`, commas, or spaces — e.g.:

```
F DF+1 WS+4 BT DASH
```

Each token is classified independently:

- **Real inputs** (`F`, `DF+1`, `1+2`, ...) are parsed structurally and
  compared against your live play input-by-input, with precise diagnostics.
- **Movement macros** (`DASH`, `BACKDASH`) expand into real, verifiable
  inputs (`F F`, `B B`) — these ARE checked against live input like any
  other real input, since a dash is something the engine can actually see.
- **Everything else** (`WS`, `FC`, `BT`, `CH`, `DEW`, or any other term you
  type) becomes an unverifiable **label** — a training checkpoint. The
  browser cannot see your character's stance or position in the real game,
  so label steps are never matched against live input. During practice, the
  target pauses on a label with a **Confirm Step** button; you press it once
  you've actually performed that part in-game, and practice continues to the
  next real input.

This is a deliberate choice: the trainer evaluates your keyboard/gamepad
input and timing, not the game state, and it never pretends otherwise.

---

## Precision modes

| Mode    | Timing tolerance | Stray input flagged? | Auto-restart on a wrong input that matches step 1? | Timing error fails the attempt? |
|---------|:---:|:---:|:---:|:---:|
| Relaxed | ±120ms | No | Yes | No |
| Normal  | ±60ms  | No | Yes | No |
| Strict  | ±30ms  | Yes | Yes | Yes |
| Perfect | ±15ms  | Yes | **No** | Yes |

Timing is only graded against a *reference* gap — either a combo you
recorded live (its real gaps are saved with it) or none at all (in which
case timing can't be graded and any correctly-content input just counts as
a plain success). Structured, per-step diagnostics: `WRONG INPUT` (wrong
direction entirely), `WRONG BUTTON`, `MISSING BUTTON`, `EXTRA INPUT`,
`TIMING ERROR`, `MISS` (timed out), `CONFIRM STEP` (a label is pending), and
`COMBO COMPLETE`.

---

## The training roadmap

**Progress** tab → 10 levels, Fundamentals through Mastery. Each skill is
either a real **drill** (tracked automatically from attempts) or a
**checklist** item for things this browser-based trainer genuinely can't
verify (sidestep, wall position, stance state) — marked practiced manually
rather than faked. Status is computed from real counts, never asserted
early:

- `NOT_STARTED` → `LEARNING` (any attempts) → `PRACTICING` (3+ attempts) →
  `CONSISTENT` (10+ successes at 80%+ success rate) → `MASTERED` (20+
  successes at 90%+ with 10+ perfect-timing runs).

**Daily Practice** generates a short varied session (fundamentals +
movement + timing + one of your own saved combos, if any exist, + a random
challenge). **Random Challenge** (also on the Progress tab) generates a
sequence at Easy/Normal/Hard/Expert and loads it into the Train tab.

---

## Statistics & mastery

Global stats (Progress tab): attempts, successes, failures, perfect
attempts, input errors, timing errors, success rate, best/average time,
fastest input, average input gap, current/best streak — all persisted.

Per-combo **Mastery %** (shown on every combo card) blends success rate
(60%) and perfect-timing rate (40%). This is a documented heuristic for
tracking your own improvement, not an objective claim about skill.

---

## Backup: Export / Import

Progress tab → **Export Data** downloads your entire library (characters,
combos, statistics, progression, settings) as one JSON file. **Import
Data** loads a previously exported file back in (the page reloads
afterward to apply it cleanly). Good practice before switching browsers/
computers, or before a big cleanup.

---

## Upgrading from v1

If you had combos saved in the previous version, they are **not deleted**.
The first time this version loads, it automatically converts your old
arrow-notation combos (`↘ 1`, etc.) into the new letter notation (`DF+1`)
and files them under a new "Unsorted (imported)" character so nothing is
lost — you can rename/re-file them under a real character afterward. This
happens once, automatically, the first time the page loads after updating.

Key bindings you had **explicitly customized** before are preserved as-is.
If you never changed them from the old defaults, the new defaults (`W/A/S/D`
+ `U/I/J/K`) apply automatically.

---

## Adding a new movement exercise

Edit `js/movement-training.js` and push an object onto `MOVEMENT_EXERCISES`
(see the file for the exact shape — `id`, `name`, `description`,
`sequence`, and an optional `skillId` to also credit a roadmap skill).

## Adding a new controller theme

Add a CSS block targeting `.virtual-controller.theme-your-name` in
`css/style.css`, then add a matching `<option>` to `#theme-select` in
`index.html`. The input engine is completely theme-agnostic.

---

## Notes and limitations

- This is an **input trainer**, not a game or a physics/frame-data
  simulator. It measures your real keyboard/gamepad input and timing —
  never claims to know your character's stance, position, or facing.
- No "frame-perfect" claims are made; timing precision is whatever
  `performance.now()` and the browser's event loop can genuinely provide,
  documented per precision mode above.
- Analog stick input is not implemented (digital D-pad only) — see
  [Gamepad setup](#gamepad-dualshock-4-setup).
- Uses `color-mix()` and other modern CSS; a recent Chrome/Firefox/Edge/
  Safari is recommended.
- Not affiliated with, endorsed by, or a reproduction of any commercial
  fighting game, controller manufacturer, or its assets.
