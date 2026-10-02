# folio-27

A pixel-art 3D room for the top of the portfolio: "HEY, THERE 👋 — a small fun brief of myself".

The avatar sits at the desk typing in a white FOG Essentials tee, baggy blue denim and white Nike Blazer Mids. Every so often the avatar swivels round on the chair and waves. The room is the real desk setup with the clutter removed. It has the poster wall wrapped in fairy lights, the gingham prints, the monitor, a console with a little panda on top, a poinsettia, a pink kalanchoe, succulents, a mushroom lamp, a candle and a stack of books. On the floor are a palm, a snake plant and a rug.

- **Light and dark mode.** Use the toggle in the top right. Your choice is saved, and it defaults to the OS setting. In dark mode the room goes to night: the fairy lights glow, the lamp switches on and the monitor lights up the desk.
- **Playground.** Drag to look around. Hover over anything to see its label, and click things:
  - click the avatar to get a wave, or the chair for a spin
  - the lamp and candle turn on and off
  - the monitor switches apps
  - the fairy lights do a light show, and clicking the console makes the panda hop
- **Pixel look.** The scene is rendered at low resolution, with outlines picked out from depth and normals. The chunkiness adapts to the screen size, so it stays readable and never gets too blocky.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
npm run preview  # serve the build
```

## Compare render styles

`npm run dev`, then open http://localhost:5173/variants.html. It's the same page with a picker at the top that switches between the current **Pixel** room and four smooth alternatives: **Clay**, **Toon**, **Ink** and **Studio**. Use the arrow keys or 1–5 to flip, and `?variant=toon` links straight to one.

To see it on a phone or tablet on the same Wi-Fi, run `npm run dev -- --host` and open the "Network" address it prints.

## Make it yours

| What | Where |
| --- | --- |
| Skin, hair and outfit colours | `AVATAR` in `src/scene/character.js` |
| Hover labels and one-liners | `src/content.js` |
| Day/night lighting | `THEMES` in `src/scene/world.js` |
| Pixel chunkiness | `setSize()` in `src/scene/world.js` (`width / 420`) |
| Camera angle | `VIEW` in `src/scene/world.js` |
| Posters, rug, prints, tee/shoe textures | `src/scene/textures.js` |

## How it's built

- `src/scene/room.js`: the walls, floor, rug, poster wall, gingham prints and fairy lights
- `src/scene/props.js`: the desk, the monitor (its screen is a live canvas), keyboard, console and panda, lamp, candle, books and chair
- `src/scene/plants.js`: the palm, snake plant, poinsettia, kalanchoe and succulents
- `src/scene/character.js`: the blocky avatar and its typing, swivel and wave animations
- `src/scene/PixelPass.js`: three.js's `RenderPixelatedPass`, changed so that glow sprites skip the outline pass and the background stays transparent
- `src/scene/world.js`: the renderer, camera framing, lights, theme blending and interactions
- `src/main.js`: page wiring for resizing, hover and tap, the speech bubble and the theme toggle

Everything is procedural: there are no model or image files to load apart from the fonts.
