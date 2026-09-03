# Notation Lab — Fighting Game Combo Trainer

A browser-based input trainer that turns your keyboard into a virtual leverless
controller so you can practice fighting-game directional notation and combos
without owning a game or a controller. 100% original code and visual design —
inspired by fighting-game training tools and Tekken-style numeric notation, but
not a copy of any specific game's assets, UI, or source code.

Runs entirely client-side: HTML5, CSS3, and vanilla ES6 modules. No backend, no
build step, no account, no external APIs, no dependencies.

---

## Features

- **Keyboard input engine** — clean keydown/keyup tracking with an auto-repeat
  guard (holding a key is one logical press, not a flood of repeats), held-key
  tracking, and automatic clearing of all inputs when the window loses focus.
- **Virtual leverless controller** — an 8-button-equivalent (4 directions + 4
  attacks) on-screen controller that lights up in real time and can also be
  clicked/tapped directly.
- **Fighting-game notation engine** — converts raw input into ↑ ↓ ← → ↖ ↗ ↙ ↘
  and 1/2/3/4 (with simultaneous presses like `1+2`), correctly collapsing
  simultaneous directions (e.g. left+down → `↙`, never `←` then `↓`).
- **Input history & combo recording** — a live, scrolling history of every
  input with type/notation/timestamp/duration, configurable length (10–50),
  and one-button combo recording.
- **Combo builder** — build a target combo by recording live input, clicking
  the virtual controller, or inserting notation tokens manually; save, load,
  rename, and delete named combos (persisted locally).
- **Practice mode** — compares your live input against a target combo and
  reports `PERFECT` / `SUCCESS` / `EARLY` / `LATE` / `WRONG INPUT` / `MISS` /
  `COMBO COMPLETE`, with a live timer and configurable timing tolerance.
- **Movement training** — a modular set of directional drills (dashes,
  backdashes, diagonals, transitional motions, KBD-style cycling, etc).
- **Random challenge system** — generates a fresh random sequence at four
  difficulty tiers (Easy/Normal/Hard/Expert), affecting length, diagonal
  frequency, and simultaneous-button frequency.
- **Statistics** — attempts, success rate, best/average time, fastest input,
  average input gap, current streak, and best streak, persisted locally.
- **Full remapping** — click any binding and press a new key; conflicting
  bindings are detected and flagged.
- **Four controller themes**, synthesized audio feedback (Web Audio API, no
  external sound files), and a responsive layout for desktop/tablet/mobile.

---

## Folder structure

```
fighting-game-trainer/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js               entry point — wires every module together
│   ├── input-engine.js      raw keyboard capture (repeat guard, focus loss)
│   ├── key-mapper.js        physical key <-> logical action bindings
│   ├── controller-state.js  unified state for keyboard + virtual controller
│   ├── notation.js          state -> fighting-game notation (pure functions)
│   ├── input-history.js     turns state changes into a discrete input log
│   ├── combo-system.js      combo builder/recorder + saved combo library
│   ├── trainer.js           ComboMatcher: target-vs-live comparison engine
│   ├── movement-training.js modular list of movement drills
│   ├── timing.js            performance.now()-based timing utilities
│   ├── statistics.js        persisted performance statistics
│   ├── audio.js             synthesized Web Audio feedback tones
│   ├── storage.js           localStorage read/write wrapper
│   └── ui.js                all DOM wiring (the only file that touches the DOM)
├── assets/
│   └── icons/                (reserved — the UI currently uses text/emoji glyphs)
└── README.md
```

---

## Running it locally

Because the app uses ES6 modules (`<script type="module">`), most browsers
block module loading over the bare `file://` protocol (CORS). Serve the folder
with any static file server:

```bash
# Option 1: Node (no install needed if you have npx)
npx serve fighting-game-trainer

# Option 2: Python 3
cd fighting-game-trainer
python3 -m http.server 8080

# Option 3: VS Code
# Right-click index.html -> "Open with Live Server"
```

Then open the printed local address (e.g. `http://localhost:8080`) in a
modern desktop browser (Chrome, Firefox, Edge, or Safari).

---

## Keyboard controls (default)

Directions use a "claw" layout so your left hand can reach every direction and
attack without moving:

| Action    | Key |
|-----------|-----|
| Left      | `Q` |
| Down      | `W` |
| Right     | `E` |
| Up        | `C` |
| Button 1  | `J` |
| Button 2  | `K` |
| Button 3  | `U` |
| Button 4  | `I` |

Every binding can be changed in **Settings → Key Mapping**: click a binding,
then press the key you want. Conflicting bindings (two actions sharing one
key) are detected and flagged — you decide which one to change.

---

## Architecture

Data flows in one direction, and no layer reaches "backwards" into a later one:

```
KEYBOARD
   ↓
INPUT ENGINE       (input-engine.js)   raw key codes, repeat-guarded, focus-safe
   ↓
KEY MAPPER         (key-mapper.js)     physical code -> logical action
   ↓
CONTROLLER STATE   (controller-state.js) the single boolean state object
   ↓  ↖ virtual controller clicks also feed in here directly
NOTATION           (notation.js)       pure state -> symbol functions
   ↓
INPUT HISTORY      (input-history.js)  state changes -> discrete logged entries
   ↓
COMBO SYSTEM       (combo-system.js)   builder/recorder + saved combo library
   ↓
TRAINER            (trainer.js)        ComboMatcher: live input vs. target
   ↓
TIMING             (timing.js)         gap classification, sequence stats
   ↓
STATISTICS         (statistics.js)     persisted aggregate performance
   ↓
UI                 (ui.js)             the only module that touches the DOM
```

`app.js` is the composition root: it creates one instance of each system,
wires the handful of cross-cutting subscriptions (e.g. "every finalized input
also feeds all three ComboMatcher instances"), and hands everything to
`initUI()`. Because the virtual controller and the keyboard both write into
the same `ControllerState` object, every other system (notation, history,
combo builder, practice mode, movement training) behaves identically no
matter which input source produced a press.

---

## How notation works

`notation.js` looks only at the eight booleans in a controller-state snapshot.
Directions are resolved per axis:

- vertical: `up` and `down` cancel each other out (neither wins)
- horizontal: `left` and `right` cancel each other out

The resulting (vertical, horizontal) pair maps to one of eight arrows or `N`
(neutral). Buttons 1–4 are joined with `+` in numeric order when several are
held (e.g. `1+2`). A direction and buttons combine as `"↘ 1"`.

**Opposite directions (e.g. holding left and right together) never crash the
system.** They simply resolve to neutral on that axis — the *notation* shows
`N`, but the *raw* controller state still remembers that both keys are
physically held. No specific game's SOCD (simultaneous-opposing-direction)
behavior is claimed or simulated; this is a deliberately simple, predictable
rule for a keyboard trainer.

---

## How combo detection works

`input-history.js` does not log on every keyboard event — it logs on every
**change of the combined notation signature**. Holding a direction for three
seconds produces exactly one history entry with a 3-second duration, never a
flood of repeated identical entries. This is also what makes the release/
transition behavior correct: e.g. holding Left, then pressing Down (→ `↙`),
then releasing Left while Down stays held (→ `↓`) produces three clean,
correctly-ordered history entries with accurate durations, entirely from
keyboard state — no special-casing required.

`trainer.js`'s `ComboMatcher` consumes that same stream of notated inputs and
walks a target sequence one token at a time:

- The first input that matches `target[0]` starts an attempt.
- Each subsequent input must match the next expected token exactly, or the
  attempt fails (`WRONG INPUT`) and resets — unless that "wrong" input happens
  to also match `target[0]`, in which case it starts a fresh attempt.
  immediately.
- If no input arrives for too long mid-attempt, the attempt times out
  (`MISS`).
- Completing every token fires `COMBO COMPLETE` with full timing data.

The same `ComboMatcher` class powers Practice mode, Movement Training, and the
Random Challenge system — they just create separate instances with different
targets and timing settings.

---

## How timing works

All timestamps come from `performance.now()` (sub-millisecond resolution).
When a combo was **recorded live** (via the "Record" button or captured while
building), the gaps between its original inputs are stored as `referenceGaps`
and saved with the combo. During practice, each new input's gap versus the
matching reference gap is classified as:

- **PERFECT** — within the timing window of the recorded gap
- **EARLY** / **LATE** — outside the window, faster/slower than the reference
- **SUCCESS** — correct input, but no reference timing exists to compare against

Timing windows are configurable in Settings:

| Level    | Tolerance |
|----------|-----------|
| Strict   | ±30ms     |
| Normal   | ±60ms     |
| Relaxed  | ±100ms    |

---

## How localStorage works

`storage.js` namespaces every key under `fgtrainer:` and wraps every read and
write in try/catch, so a disabled or full storage quota degrades gracefully to
sane defaults rather than crashing the app. Persisted data: key bindings,
selected theme, sound settings, timing difficulty, history length, saved
combos (with their per-combo stats), and global statistics.

---

## Adding a new movement exercise

Open `js/movement-training.js` and add an object to `MOVEMENT_EXERCISES`:

```js
{
  id: 'my-new-drill',              // unique, no spaces
  name: 'My New Drill',            // shown as the button label
  description: 'What it teaches.', // shown as the active-drill subtitle
  sequence: ['↓', '↙', '←']        // any notation tokens from notation.js
}
```

That's it — it will automatically appear in the Movement tab's exercise list.

---

## Adding a new controller theme

Themes are pure CSS. In `css/style.css`, add a new block targeting
`.virtual-controller.theme-your-theme-name` (and its `.vc-btn` descendants),
then add a matching `<option value="your-theme-name">` to the `#theme-select`
dropdown in `index.html`. The underlying input engine, notation, and state
management are completely theme-agnostic — only the visual presentation
changes.

---

## Notes and limitations

- This is an **input trainer**, not a game or a physics simulator. Movement
  drills judge directional *sequences and timing only* — they make no claim
  about simulating any specific game's movement, hitboxes, or frame data.
- Uses `color-mix()` and other modern CSS; a recent version of Chrome,
  Firefox, Edge, or Safari is recommended.
- Not affiliated with, endorsed by, or a reproduction of any commercial
  fighting game, controller manufacturer, or its assets.
