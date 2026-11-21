# Research: bare floor art (PixelLab) and less boring music (OB-9)

Research only, 21 Nov 2026. No code changed, 0 generations spent. get_balance: 1656 of 2000 used, 344 left, resets 18 Dec.
Sources: PixelLab search_help (create_tiles_pro, create_topdown_tileset, create_image_pro_from_style), a web search (no PixelLab-specific community tips exist; general AI-texture advice only), the repo audio code (client/src/audio) and the floor ledger in docs/PLAN-PIXELLAB-ART.md.

---------------------------------------------------------------------------------------------
## TASK 1: A GOOD SEAMLESS DARK WARM TAVERN FLOOR
---------------------------------------------------------------------------------------------

### What we learned about the tools (facts from the tool docs)

- `create_tiles_pro` shape mode: up to 16 INDEPENDENT tiles per call, 10 gens at 16 to 64 px (15 only for a flat `top-down` view at 64 px). Numbered prompt ("1). ... 2). ...") gives the best control. It does NOT guarantee edge-matching: the tiles are independent pictures. `tile_view` must be `top-down` for flat ground (low top-down squashes rows). `outline_mode="segmentation"` draws tiles with NO dark outline or rim, "the surface runs cleanly to the tile edge, which is what you want for ground that should not show a grid". Our earlier floors probably had the default inner outline, which reads as a grid of boxes: a likely cause of "ugly".
- `create_tiles_pro` style mode (`style_images`): copies style AND size of the reference, shape controls ignored; the cell is the style image's own size (48 px style = 10 gens). Still independent tiles, not seamless.
- `tile_feature="tileset"` (corner transitions) and `create_topdown_tileset` (standard 1 gen, pro 15 gens): these give truly connectable Wang tiles, but only for a TRANSITION between two terrains. A flat set (transition_size 0) with both terrains the same family (e.g. "dark oak planks" lower, "dark oak planks with worn lighter boards" upper) gives tiles that all connect, and the all-lower tile is a clean base tile. Pro costs 15 (<=32 px) or 25; standard costs 1 and is the cheapest probe. Pro takes `view` (use `low top-down` to match our look, our floor is flat so `high top-down` is also fine), palette or max_colors.
- `create_image_pro_from_style`: 1 to 4 style images, returns a SET of candidates for ONE call. 16 to 32 px side: 10 gens for 64 candidates; 48 px: 10 gens for 25; 64 px: 10 gens for 16. Canvas = the largest style image side (square). No seamless option. Best for "many candidates cheaply, then pick the one that tiles".
- No MCP tool has a seamless/wrap switch. The only documented "Create Texture" (single self-repeating texture, canvas exactly 16x16) is an Aseprite/Pixelorama extension, not an MCP tool.
- Web (general AI-texture advice, not PixelLab-specific): say "seamless" and "top-down" in the prompt, describe a SURFACE not a scene, ask for flat even lighting, no vignette, no border, no perspective, no gradient from centre to edge (vignette is the main cause of visible seams), name the grid size, and verify by tiling 3x3. Pixelblog (Slynyrd) top-down tile advice: low-contrast ground, break the repeat with a few rare variants, keep the ground darker and less saturated than the objects on it.

### Why our floors probably look ugly (diagnosis to confirm, cheap)

1. High-contrast planks with a dark outline on every board = a loud grid under every piece of furniture. The furniture art (honey oak bar, stools) fights it. A floor must be the LOWEST contrast thing in the room.
2. One 64 px texture tiled everywhere: the repeat is visible. Use 3 to 4 near-identical variants chosen per cell by a hash (cell coordinates), so the pattern never repeats on a 2-cell beat.
3. A palette that forces flat near-black (FLOORWALL2 waste) and "scene" words ("tavern") that make the model draw a picture of a room instead of a surface.
4. Maybe too saturated / too bright against the approved dark indoor lighting look.

### THE RECIPE (do this, in order)

**Step 0, free: audit and a rendering fix before any generation.**
- Build a free "tiling sheet" script (Node, `tools/`, no gens): takes a PNG, writes a 4x4 tiled copy and a "wrapped seam" copy (the image shifted by half its size in x and y, so the old edges lie in the middle: any seam is then a visible cross). This is the SEAMLESS CHECK: if the shifted image shows no cross, it is seamless. `tools/tile-seamless.mjs` exists already (made walls x-seamless); extend it with the 4x4 and half-shift previews. Look at the current bare.png this way first: if its seam shows, that alone is "ugly".
- Free fix candidates in code (0 gens): darken and desaturate the floor texture 15 to 25% in the loader, and cut the plank edge contrast (pixel edit via `pixelart_workbench`, free). Floors are procedural now (tools/gen-floor-planks.mjs): compare with the AI floors using the same tiling sheet.

**Step 1: tool and size.**
- PRIMARY: `create_tiles_pro` (shape mode, NOT style mode), `tile_type="square_topdown"`, `tile_view="top-down"` (or `tile_view_angle=90`), `tile_size=32`, `outline_mode="segmentation"`, 16 numbered tiles in ONE call = 10 gens. 32 px is "best value", and our floor texture is 64x64 = 2x2 of these, which also gives a free 4-way variant (combine four 32 px tiles into a 64 px texture, picking tiles that agree at the edges, see seam check). Tile size 64 is also 10 gens ("unless flat top-down view = 15"), so 64 top-down costs 15: stay at 32 and compose, or use `tile_view_angle=89` to stay at 10 (untested trick, cost is the "receipt" line before the call: read `cost:` on the submit receipt and cancel is NOT free, so only try it once).
- SECONDARY, best seam odds: `create_topdown_tileset` standard (1 gen!) with `tile_size` 32, `transition_size=0`, lower = "dark oak floor planks, worn", upper = "dark oak floor planks, slightly lighter, worn". Wang tiles connect by construction. Take the pure all-lower tile as the base and the all-upper tile as the variant; and the 14 mixed tiles are free patches (worn/lighter boards) to scatter. Cost 1 gen per try, so we can afford ~8 tries. If the look is good in standard, ONE pro run (15) for the final.
- TERTIARY (candidate fountain): `create_image_pro_from_style` with `couch.png` at 64 px side if the reference is 64 (else 32/48; side must equal the reference, canvas is the largest style image side) = 16 candidates for 10 gens. no_background=False (it is a surface, not an object). Use it to harvest the DARK warm palette and grain of the couch art, then pick the candidates that tile.

**Step 2: style reference.** `art-src/pixellab/refs/couch.png` (+ statue.png) as `style_images` only on the secondary/tertiary route (style mode of `create_tiles_pro` ignores shape controls and uses the reference size, so avoid it for the floor: the couch is 96 or 128 px wide and a "cell" that size means 15 gens for 9 tiles). With `style_options` JSON: `{"color_palette": true, "outline": false, "detail": true, "shading": true}`. outline false: the whole point is no dark box around a tile. Do NOT pass `palette` (it already flattened a floor to near-black); instead post-process: map to Endesga 32 colours with a free quantize (pixelart_workbench or tools/) and clamp to the floor ramp below.

**Step 3: floor ramp (Endesga 32, all names from shared/palette.ts, hex only there).** Target 4 steps, low contrast, dark and warm: 181425 (darkest, only in gaps and knots) / 3e2731 / 733e39 / b86f50 (rare grain highlight, 3 to 5% of pixels). Dominant tone 3e2731 to 733e39. Keep the brightest value under the furniture's mid tone so the bar, table and stools pop. This also suits the approved dark warm indoor light layer.

**Step 4: seamless check (free, mandatory before wiring).** 4x4 tile preview + half-shift preview (Step 0). A tile passes if the shifted preview shows no visible cross and no repeating blotch at 4x4. For 32 px tiles from `create_tiles_pro`, also try all 16 tiles laid in a 4x4 grid in order and shuffled: independent tiles with the same prompt and segmentation often share the colour field and tile acceptably; fix remaining edge pixels with `tools/tile-seamless.mjs` (it blends the wrap seam) and the free pixel workbench.

**Step 5: wiring.** Keep 3 to 4 variants (bare, bare_b, bare_c exist in art-src/pixellab/floorwall) and pick by a cell hash (renderer currently tiles ONE texture: needs a small hook in roomView, out of scope here).

### Prompt principles (derived)
- Describe the SURFACE only: material, wear, colour words, "top-down, flat, orthographic". No "tavern", "room", "scene", "light from", "shadow", "vignette".
- Say what you DON'T want in positive words: "even lighting", "uniform", "low contrast", "no border", "no outline", "no perspective", "repeating".
- Number the 16 tiles so each is one variation of the same family (all "dark oak planks" with different details), not 16 different materials.
- Specify plank widths and the grain: "wide boards", "2 or 3 boards across", "tiny nail dots", "subtle", "few knots". Words like "worn", "scuffed", "stained with spilled ale", "dark honey oak", "aged" read well in dark warm tones.
- Avoid colour hex values in the text; use words: "dark brown, warm, desaturated".

### 3 candidate prompts (dark, calm, warm tavern floor)

All for `create_tiles_pro`: `tile_type=square_topdown`, `tile_size=32`, `tile_view=top-down`, `outline_mode=segmentation`, 10 gens each, numbered 16 variants of one family (write the same text with "1). ... 16). ..." variations by a word each: "straight boards", "one small knot", "a nail dot", "a faint dark stain", ...).

1. "seamless top-down pixel art floor texture, wide dark oak planks laid side by side, warm deep brown, low contrast, subtle wood grain, a few tiny nail dots, flat even lighting, no border, no outline, no perspective, repeating"
2. "seamless top-down pixel art floor texture, worn dark brown wooden boards with thin darker gaps, faint scuffs and old ale stains, muted warm tones, uniform lighting, very low contrast, no vignette, no outline"
3. "seamless top-down pixel art floor texture, aged tavern flagstone and plank mix: dark warm planks with a few smooth rounded dark stones, soft grain, muted reddish brown and charcoal, low contrast, flat, no outline, tileable" (use only if 1 and 2 fail: stone patches break the plank repeat)

For `create_topdown_tileset` standard probe (1 gen each): lower_description "dark oak floor planks, worn, low contrast", upper_description "dark oak floor planks, slightly lighter boards, worn", `transition_size=0`, `tile_size=32`.

### Cheap test plan (max 31 generations, stops early)

| # | what | cost | pass test |
|---|------|------|-----------|
| 0 | audit current bare.png and procedural floor with the free 4x4 + half-shift sheet; try free darken / desaturate / lower-contrast edit | 0 | decide if the problem is contrast rather than the pattern |
| 1 | `create_topdown_tileset` standard, 32 px, flat, planks vs lighter planks, 3 different seeds / wordings | 3 | all-lower tile passes the seam check and is calm |
| 2 | `create_tiles_pro` prompt 1, segmentation, 32 px | 10 | at least 3 of 16 pass 4x4 and half-shift |
| 3 | if 1 and 2 fail: `create_tiles_pro` prompt 2 | 10 | same |
| 4 | if the style feels off: `create_image_pro_from_style` couch.png, 16 candidates, "dark oak plank floor texture" | 10 | pick tileable candidates |
| 5 | final: compose 4 variants, quantize to the ramp, free seam blend, view in the room at 1x, 2x and in the dark lighting | 0 | owner look |
Stop rule: after step 3 without a pass, do not spend more; keep the procedural floor (free) with the contrast fix and plank-width variation by hash. Total hard cap 31 gens (3 + 10 + 10 + 10 minus anything skipped); the balance stays above 310.

---------------------------------------------------------------------------------------------
## TASK 2: MUSIC THAT DOES NOT SOUND LIKE "A TEXT FILE BEING PLAYED"
---------------------------------------------------------------------------------------------

### What the code does now (client/src/audio/music.ts, musicData.ts, sequencer.ts)
- Pure data tracks (string patterns), look-ahead scheduler (100 ms timer, 0.5 s window), one gain bus per track, crossfade.
- `note()`: ONE bare oscillator (square / triangle / sine) per note, gain envelope = 12 ms linear attack, 0.8x sustain until 60% of the hold, then exponential decay to 0.0001; NO filter, NO detune, NO vibrato, NO reverb or delay, notes start exactly on the grid (zero humanisation), every bar identical in volume, the same note length rule for every voice. Drums: filtered white noise only (kick = lowpassed noise at 160 Hz, which is a thud of noise, not a pitched kick). Melody and bass are monophonic; there is no chord/arp layer, no pads. This is exactly why it sounds like a sequencer reading text.

### Why it sounds mechanical (and what fixes each)
1. Flat dynamics and the same attack on every note: no accent, no swell.
2. Pure oscillators with no movement: no detune, no chorus, no filter envelope.
3. Dry: no reverb, no echo, so the "room" does not exist.
4. Metronome timing: every note exactly on the 16th grid.
5. No harmony: bass and lead only, no chords underneath; tunes only 16 bars with a literal loop.
6. Pitched drums are noise hits with no tone.

### A) Where to put the effects (a small audio graph, built once in `attach`)
`voice buses -> musicBus (gain) -> [dry 1.0] + [delay send] + [reverb send] -> out`. All created ONCE, not per note.
- **Reverb**: one `ConvolverNode` whose impulse response is generated in code (no files): 1.6 s stereo noise buffer, exponential decay `e^(-t * 3.2)` (about 60 dB at 1.6 s... tune 2.5 to 4), the left and right channel use different noise, a one-pole lowpass applied to the noise while decaying (fake damping: multiply later samples by smoothing coefficient 0.5 -> 0.9). Send level: lead 0.25, pad 0.35, bass 0.0, drums 0.10. Return gain 0.5. Tavern: shorter (1.0 s) and warmer (stronger damping); lakeside / dungeon / mine: longer (2.2 to 3.0 s), return 0.65. Pre-delay 20 ms (a `DelayNode` before the convolver) keeps the notes clear.
- **Delay (echo)**: `DelayNode` time = one dotted eighth at the track's bpm (60/bpm * 0.75 s), feedback 0.30 through a lowpass at 2400 Hz (each repeat darker), wet 0.18 on the lead only. Cap at feedback 0.4 to avoid washout. Optional ping-pong with two delays and a `StereoPannerNode` +/-0.4.
- **Master**: a gentle `DynamicsCompressorNode` (threshold -18 dB, knee 12, ratio 3, attack 0.01, release 0.2) on the music bus to glue it; a master lowpass 7 kHz on the music bus takes the digital fizz off the square.
- **Mobile cost**: 1 convolver + 1 delay + 1 compressor total is cheap. Keep one convolver for all tracks and swap the impulse on a track change.

### B) Better voices (per note, still cheap)
Note envelope ADSR in seconds, gain targets relative to the peak (use `setTargetAtTime` for the release so there are no clicks):
- **Lead (square/saw, "folk fiddle/whistle")**: two oscillators detuned +7 and -7 cents (`osc.detune.value`), gains 0.5 each; triangle one octave up at 0.15 for air. Lowpass (`BiquadFilter`, type lowpass, Q 1.2) with a cutoff envelope: start at 3200 Hz, fall to 1400 Hz over 0.35 s (`setTargetAtTime(1400, t+0.02, 0.12)`): the "pluck" brightness. Amp: A 0.015, D 0.12, S 0.55, R 0.18. Vibrato: LFO 5.2 Hz, depth 8 cents, faded in after 0.2 s (only notes longer than 0.3 s; a `GainNode` on the LFO ramps 0 -> 1 over 0.25 s). Square pulse width: use `PeriodicWave` with a 25% duty cycle for a more reedy "NES pulse" than a plain 50% square (build the coefficients from the Fourier series of a pulse: `b_n = (2/(n*pi)) * sin(n*pi*duty)`; 32 harmonics).
- **Bass (triangle + sine sub)**: triangle plus a sine one octave below at 0.5, amp A 0.008, D 0.18, S 0.6, R 0.10, lowpass 600 Hz. Accent the downbeat 1.0, other notes 0.75. Slightly shorter notes (staccato 70% of the slot) give the "plucked upright bass" feel of a tavern.
- **Pad (new, only under the melody)**: 3 sine/triangle oscillators of a chord, each detuned 0, +6, -6 cents; amp A 0.6 s, R 0.9 s; lowpass 1500 Hz; gain 0.25; slow filter LFO 0.15 Hz +/-300 Hz. One chord per bar or two. This is the single biggest change from "text file" to "music".
- **Arp / pluck (new)**: a triangle or short square at 16th or 8th notes cycling the chord tones (root, third, fifth, octave), amp A 0.003, D 0.09, S 0, R 0.05 (a pluck), lowpass 2500 Hz, gain 0.25, delay send 0.25. In the tavern a "mandolin": triple repeats of one note (D D D) then the next.
- **Drums (real)**: kick = sine oscillator with a pitch drop 150 -> 45 Hz over 0.12 s (`frequency.exponentialRampToValueAtTime`), amp 0.001 -> 1.0 in 0.003 s, decay to 0.0001 over 0.22 s; snare = bandpass noise (1800 Hz, Q 0.8) 0.12 s decay + a sine 190 Hz with 0.06 s decay (the body); hat = highpass 7 kHz noise, 0.03 s decay, accent the off beat 1.0 vs 0.55; an extra "shaker" for the tavern (noise through bandpass 5 kHz, A 0.02 / D 0.05 -> a soft "sh") and a soft "stomp" kick instead of a hard kick (folk). For dungeon: no snare, a slow low `tom` (sine 90 -> 55 Hz, 0.3 s).

### C) Humanising the timing and level (pure helper in sequencer.ts, rng passed in; the music scheduler may use a seeded or Math.random-free rng: use a tiny mulberry32 inside the Music class, audio is not a game rule)
- Timing jitter: +/- 8 ms (uniform) on lead and arp, +/- 4 ms on bass, 0 on the kick. Drift never accumulates (jitter is applied to the start time only, not to the grid).
- Swing: for the 8th-note straight tracks (title, farm, lakeside): delay every second 8th by 8 to 12% of an eighth. The tavern is 6/8 already: lengthen the first note of every beat by 4% and shorten the third.
- Velocity: base peak x (0.85 + 0.15 * accent), accent on beat 1 (1.0), beat 3 (0.9), upbeats 0.75, plus random +/- 8% per note. Peak of a note must still stay under NOTE_PEAK so the bus does not clip.
- Length: legato for slurred notes (length x 1.0 for notes followed by a note within a step), staccato 70% for repeated notes.
- Pitch: +/- 3 cents of random detune per note on the lead (a "player" never plays exactly in tune).
- Fills and dropouts: every 4th bar, drop the drums on beat 1 or play a small fill; every 8th bar remove the bass for one bar then bring it back with a snare roll.

### D) Chords and structure (data additions to musicData.ts: a `chords` voice type and a `sections` array)
Add 3 voices to every track: pad (chord per bar), arp (chord tones), and keep lead and bass. Chord progressions (one chord per bar or half bar, degrees):
- **Tavern (D major jig, 6/8, 100 bpm)**: bars 1 to 8: D | G | D | A | D | G | D A | D, B part: Bm | D | G | A | Bm | A | G A | D. Add a "bar 4 turn": A7 for a lift, and every 16 bars play A part with the lead one octave up and drums louder (a "second time round" build). Use D, G, A, Bm, A7, E7 -> A (a secondary dominant) once per round for colour.
- **Title / hotel (C major, 80 bpm)**: C | Am | F | G | C | Am | Dm | G7, then Em | Am | F | G | C/E | F | Dm7 | G. Put the lead in rests half the time (breathing), add a soft bell (sine two octaves up, 1.2 s decay, A 0.002) on the first beat of each chord.
- **Dungeon (A minor, 70 bpm)**: i | i | VI | v | i | VI | iv | V (Am | Am | F | Em | Am | F | Dm | E7) with a low drone (sawtooth A1 through lowpass 200 Hz, filter LFO 0.1 Hz) and a rare dissonant sting (b2 = Bb) over a fourth bar; no drums except a heartbeat tom every 2 beats.
- **Mine (E minor, 60 bpm)**: i | VI | III | VII = Em | C | G | D, sparse bell drips (the existing sine), long reverb 3 s, low rumbling sub on E1.
- **Lakeside (G major, 72 bpm)**: I | vi | IV | V = G | Em | C | D, then I | iii | IV | V; arp the chord (G B D B) with a slow delay; no drums, a soft shaker only.
- **Farm (C major, 96 bpm)**: I | IV | I | V = C | F | C | G, plucked "banjo" arp (square with a short pluck and lowpass 3 kHz), a bouncy bass (root, fifth).
Rules: pick the chord tone on the strong beats for the lead, passing tones on the weak ones; end phrases on the chord third or fifth, not always the root; make A and B parts differ by at least 40% of the notes; make loops longer (16 bars) and add a 4-bar "variation" that swaps the lead by an octave or drops the drums (so the loop point is hidden). Dynamic arc: each 16-bar loop builds: bars 1 to 4 pad + bass only (volume 0.6), 5 to 8 add the lead, 9 to 12 add drums and the arp, 13 to 16 full plus a fill; the crossfade at the room change hides the join.
- **Volume ducking**: while a room is in a calm state, the music sits at ~60% of the current level; during UI toasts and the pour, duck 3 dB for 0.4 s (`setTargetAtTime`); music at the dungeon rises with danger (a higher arp density when an enemy is near, optional).

### E) Implementation order (small steps, each testable)
1. Master chain: reverb (generated IR) + compressor + lowpass; no data change. Biggest win for the least code.
2. Per-voice envelopes + detune + filter in `note()`; keep patterns as they are.
3. Humanise helper (jitter, accent, swing) in sequencer.ts (pure, with a seed argument, tests).
4. Real drum voices (kick sine drop, snare body, soft hats, shaker).
5. Chord pad + arp voice types in musicData.ts (`chords` pattern per bar: "D G D A ...") and bars generated by a pure `chordNotes(chord, octave)` function; sequencer tests check bar sums as now.
6. Longer forms (A/B/variation) and the dynamic arc.
Each step is audible on its own; the unit tests for steps 3 and 5 can run in Vitest (pure). Keep NOTE_PEAK headroom: with a pad and an arp added, lower each voice by ~25% so the sum stays under 0.9 (compressor helps).

### F) 5 cheap SFX ideas (code-made, no files, 10 to 40 lines each; sound.ts already has noise and gain helpers)
1. **Pour (the tap hold)**: bandpass noise 900 Hz Q 2 whose frequency rises 700 -> 1400 Hz and gain rises over `POUR_FULL_MS` (1400 ms) with a 12 Hz tremolo (a gurgle); a glassy "plink" sine 1760 Hz + 2637 Hz on a PERFECT pour (A 0.002, D 0.25).
2. **Coin ding**: two sines 1318 Hz and 1976 Hz (a fifth), A 0.001, exponential decay 0.35 s, plus a short noise tick at 6 kHz; pitch it up one semitone per coin in a combo (an order with a tip rises more).
3. **Footsteps on wood (avatar walk, per 2 frames)**: a 40 ms noise burst through lowpass 500 Hz plus a sine "thud" 90 Hz, random pitch +/-10% and gain +/-15% so no two steps are equal; alternate left/right with 3 dB difference; quieter on carpet/rugs, brighter on stone (cutoff 900 Hz).
4. **Door and bell**: a tiny shop bell when a guest enters: three high sines (2093, 3136, 4186 Hz) with 0.6 s decay and inharmonic detune (+3 cents each), delay send; a creak for the cellar door: sawtooth sweeping 140 -> 90 Hz with a bandpass at 400 Hz, 0.5 s, LFO jitter 18 Hz.
5. **Fire crackle on the stove + ready ding**: ambient loop is random small noise ticks (1 to 3 per 100 ms, highpass 2 kHz, 8 ms decay) plus a low rumble (noise lowpass 120 Hz, gain 0.05); the "ready" ding: a triangle 988 Hz then 1319 Hz (a rising pair, 0.12 s apart, 0.3 s decay). Bonus: mug clink = two bandpass noise bursts at 3 kHz and 4.2 kHz, 25 ms; chest open = a rising sweep with a sparkle.

---------------------------------------------------------------------------------------------
## Sources
- PixelLab tool references via search_help: create_tiles_pro, create_topdown_tileset, create_image_pro_from_style (free).
- Web search results (general AI texture tips, no PixelLab docs found): sorceress.games (tileset prompts), summerengine.com (pixel floor examples), sprite-ai.art (seam problem), Slynyrd Pixelblog 20 and 43 (top-down tiles).
- Repo: docs/PLAN-PIXELLAB-ART.md ledger (FLOOR+WALL, FLOORWALL2), client/src/audio/*.
