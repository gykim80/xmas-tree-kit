# Design

English · [한국어](design.ko.md)

## What this is

Reusing the Christmas Town plaza tree (`src/tree.js`, `src/decor.js`, `src/wishes.js`) in another project meant copying files and stripping app-only code each time: the asset manifest, shared shader values, the reflection pass. This repository splits that part out so it works in three places:

1. three.js scenes and web games: `ChristmasTree` (a THREE.Group)
2. web pages: the `<xmas-tree>` web component, one script tag
3. other game engines: GLB export

## Projects this borrows from

| Project | What we took |
| --- | --- |
| [ez-tree](https://github.com/dgreenheck/ez-tree) | A tree class that extends `THREE.Group`, an options object with presets, library and editor in one repo, a Vite library build with three external, GLB/PNG export from the editor. The original tree already hung needle clusters on twigs as instances in the same way |
| [proctree.js](https://github.com/supereggbert/proctree.js) | One seed plus a flat options object always rebuilds the same tree |
| [model-viewer](https://github.com/google/model-viewer) | Web component attribute naming (kebab-case, boolean attributes are on when present), the names `camera-controls` and `auto-rotate`, `toBlob()`, one-script install |
| [glTF EXT_mesh_gpu_instancing](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_mesh_gpu_instancing) | Godot 4 can't read this extension yet (godot#112866 is open), so GLB export bakes instances by default and keeps the extension as an option, like Blender's "GPU Instances" export setting |
| [jsDelivr](https://www.jsdelivr.com/) | Serves files straight from a git tag (`cdn.jsdelivr.net/gh/user/repo@tag/file`), which is why `dist/` is committed |

## Layout

```
src/
  index.js              public API
  christmas-tree.js     ChristmasTree: options, presets, quality, rebuild scope, JSON, frame hook
  presets.js            7 presets, 4 quality levels
  tree/tree.js          fir generation (trunk, roots, branch and twig tubes, needle instances, crown envelope envAt)
  decor/decorate.js     auto decorations (ornaments, lights, garland, bead string, star, planter/skirt, presents)
  decor/ornaments.js    user-hung ornament layer (normalized spots, fly-in, picking, surface raycast)
  decor/shapes.js       6 ornament shapes
  materials.js          snow shader patch, twinkling light material, shared shader values
  textures.js           canvas textures (null without a DOM)
  prepass.js            needle depth prepass
  export.js             GLB export (baked or instanced)
  viewer.js             a ready-made view of one tree (lights, background, ground, snowfall, camera)
  element.js            <xmas-tree>
editor/                 Tree Maker
examples/               basic (code), embed (tag), game (first-person forest)
promo/                  vertical promo video, rendered frame by frame
test/                   Node unit tests, browser check helper
scripts/check.mjs       headless browser checks
```

## Decisions

**Design units.** The original tree's segment length, needle size and decoration spacing were tuned for height 20. Changing the height alone breaks those proportions. So trees always grow at height 20 and an inner box (`root`) is scaled to `size` meters. The user's own `tree.scale` is left alone. Point light intensity and range don't follow parent scale, so they're scaled separately by the square of the scale and by the scale.

**Frame hook.** If users must call something every frame, they'll forget. The bark mesh's `onBeforeRender` drives the clock, the minimum on-screen light size (`uPx`), ornament LOD, the star's facing and flying ornaments. It doesn't run when the tree isn't on screen. Call `tree.update(seconds)` to drive time yourself.

**Ornament spots.** Stored in world coordinates, ornaments would float or sink into branches when the tree changes. They are stored as height ratio `h`, angle `a` and radius ratio `r`, and re-placed using the crown envelope `envAt(y)` measured while growing. Clicks are raycast against an invisible surface of revolution built from that envelope.

**Rebuild scope.** `set()` compares old and new values and either updates shader values only (snow, glow, twinkle, size), rebuilds decorations only (palette, light count), or regrows the tree.

**Quality.** Shape values stay the same. Tiers, branches per tier, twigs, needle density and light count go down, and needle clusters get bigger to keep the silhouette. Values the user set are never reduced.

**Runs in Node.** Canvas textures return null without a DOM and materials fall back to plain colors, so generation, JSON and the export scene are covered by Node tests.

**Save format.** `{ format, version, preset, size, quality, tree?, decor?, snow?, ornaments }`. Only changes relative to the preset are stored. If the format changes, bump `version` and migrate in `fromJSON`.
