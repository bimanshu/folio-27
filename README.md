# folio-27

A little 3D version of my room for the top of the portfolio: "HEY, THERE 👋 — a small fun brief of myself".

It's drawn in a soft "clay" style: rounded blocks, matte colours and soft shadows. The room has the poster wall wrapped in fairy lights, the desk with the monitor, a console with a little panda on top, plants, books, a candle and a mushroom lamp. Around it are a beige sofa, a single bed with a navy sheet, and a window with grey curtains.

- **A day in the room.** The avatar (white FOG Essentials tee, baggy denim, Blazer Mids) doesn't just sit there. He works at the desk, reads on the sofa sitting up or lying down, waters the plants, wipes the desk, vacuums, and scrolls his phone in bed.
- **Light mode is daytime.** Sun comes through the window and leaves a bright patch on the floor.
- **Dark mode is a time-lapse, not a switch.**
  1. The sun sets: the light patch slides across the floor and turns gold on the sofa, the sky in the window turns orange, and the lamps and fairy lights come on.
  2. The evening plays out for about 6½ minutes, with him still busy.
  3. Night falls, stars and the moon come out, and he goes to bed to scroll reels.
  4. About 4 minutes later he dozes off under the blanket. The lamp goes off and the fairy lights stay on as a night light.
- **Waking him.** Click the desk or the sofa while he's in bed. He yawns, stretches and goes back to work, then the evening cycle repeats until he's back in bed. Switching to light mode runs the clock on to sunrise.
- **Click things.** Each of these sends him off to do it: the sofa, bed, plants, watering can, vacuum or books. Clicking the window draws the curtains, and clicking him gets a wave. The lamp, candle, monitor, fairy lights and panda do their own thing.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
npm run preview  # serve the build
```

## Make it yours

| What | Where |
| --- | --- |
| Skin, hair and outfit colours | `AVATAR` in `src/scene/character.js` |
| Hover labels and one-liners | `src/content.js` |
| Furniture positions, walking spots | `src/scene/layout.js` |
| Sky and light at each time of day | `KEYS` in `src/scene/daylight.js` |
| Evening length (6½ min) | `EVENING_SECONDS` in `src/scene/world.js` |
| Phone-in-bed time (4 min), awake-at-night time | `src/scene/life.js` |
| What he does and how often | `next()` in `src/scene/life.js` |
| Posters, rug, tee/shoe textures | `src/scene/textures.js` |

## How it's built

- `src/scene/layout.js`: room size and where everything stands
- `src/scene/room.js`: walls, floor, rug, poster wall, window, curtains and fairy lights. It also has invisible occluders that only the sun's shadow sees, so daylight gets in through the window only.
- `src/scene/props.js`, `furniture.js` and `plants.js`: everything in the room, including the bed, sofa, vacuum, watering can, book and phone
- `src/scene/character.js`: the blocky avatar, with poses for standing, sitting and lying, a walk cycle, held items and blinking
- `src/scene/life.js`: what he does next. Plans are generators of small steps such as walk, sit, pour or wipe. A click interrupts the current plan, puts things away and starts a new one.
- `src/scene/nav.js`: walking routes around the furniture
- `src/scene/daylight.js` and `sky.js`: the time-of-day keys (sun or moon direction, colours, sky) and the painted view out of the window
- `src/scene/world.js`: the renderer, camera framing, the day → sunset → evening → night → sunrise phases, lights and clicks
- `src/main.js`: page wiring for resizing, hover and tap, the speech bubble, the clock and the theme toggle

Everything is procedural: there are no model or image files to load apart from the fonts.
