# Fun Village

A cozy, dense, slightly magical pixel village for pure fun, drawn on a single 480x360 world view
(scaled to fit the window in quarter steps, backing store at 2-3x so it stays sharp).

## Round 5: one painted scene
The environment was rebuilt from the ground up. Instead of separate house/tree/fountain stickers on generated grass, the
whole village is **one hand-painted pixel-art scene** (`assets/village_bg.webp`, 1152x864, 2.4 px per world px) in a soft,
warm, castle-courtyard style: a cobbled plaza with a carved fountain, worn edges where grass grows into the stones, cream
stone walls and balustrades, stone planters, lantern posts with purple banners, benches, cottages, Merrick's tower, the
market stall, the well and a willow. A **stream with an arched stone bridge** replaces the pond (ducks and Sir Ribbit live
in it); the portal stone is now a mossy carved arch on the south bank.
- The world is 480x360 (4:3). Characters, behaviours, day/night (real Eastern time), tooltips and zoom are unchanged; the
  character sprites are drawn at 0.82x so they match the painted door height. The sun/moon chip stays removed.
- Walkable areas and water come from an embedded 2 px/world-px mask (`pmaps.js`: R = feet may stand, G = water), so
  collision, the waypoint graph (`FV.validateGraph()`), ducks (water only) and the frog (lily pads) follow the real painting.
  `?debug` draws the mask (red = blocked, blue = water), graph, queue slots and light points on top of the painting.
- Foreground pieces cut out of the painting (banner posts, the lantern post, the willow canopy) live in
  `assets/village_occ.webp` and are depth-sorted with the characters, so they can walk behind them.
- Night: warm glows at windows, doors and lanterns, the tower window, stall potions, fountain, well and portal.
- Theo now tends the moonlit flower beds (the glowing mushrooms were part of the old sticker set).
- Removed all old prop PNGs (houses, trees, fountain, well, pond, tower, stall, mushrooms, crystals, flowers, portal, decor).

## Round 4: visual polish
- Ground is painted once (2 px per world px) in a palette sampled from the props: toned grass with tufts, clover and
  flowers, wide irregular dirt paths that follow the walking graph, a cobbled plaza and cobbled door/shop/well/portal
  aprons, darker forest-floor edges.
- Every prop gets a soft contact shadow plus a cast shadow (light from the top-left) baked into the cached ground layer.
- New decor props (bushes, hedges, fence, barrels, bench, lamp posts, planters) with walk-blocking footprints; lamp posts
  glow at night. Trees frame the edges; a gentle colour grade + vignette unifies the scene. Cutout halo pixels cleaned.

## Round 3: the fantasy upgrade
- **Villagers** are ~1.5x bigger (door height) with a clear stride-based walk cycle; animals scale with them.
  Everyone keeps their name but has a fantasy job: Rosie (potion brewer), Theo (glowing-mushroom grower),
  Mabel (hedge witch, short broom hops), Finn (apprentice mage who sometimes misfires), Juniper (magic shop),
  plus Merrick the Grey, a wizard who lives in the new tower and casts sparkle spells.
- **Creatures**: Ember the baby dragon (flutters, tiny flame puffs, naps), Sir Ribbit the talking frog
  (tap for a joke), fairies and wisps that glow at night, a cat, a dog and the ducks.
- **Magic props**: tower with a glowing window, glowing fountain with rising sparkles, a well that
  occasionally grants a wish, floating lanterns, a portal stone that flickers open, brooms that sweep by
  themselves, glowing mushrooms, crystals and magic flowers.
- **Day/night** follows real America/New_York time with smooth dawn/dusk tints, a night overlay with light
  sources (tower window, lanterns, wisps, fountain, windows). (The old sun/moon chip was removed in round 4: the tint alone shows day vs night.) `?hour=H` (0-24)
  forces a time for demos; the clock label then says "demo clock".
- **Zoom**: tap or click empty ground (or the + button) to zoom ~2x around that point, drag to pan,
  double-tap, the - button, or Esc to zoom out. Mouse wheel also zooms. Tapping characters still shows tooltips.
  The scene is re-rendered at 2x for zoom, so it stays crisp.

## Technical notes
- Assets in `assets/` are transparent PNGs, each under 100 KB. Sprite sheets are 4 columns x 3 rows
  (front, back, side-left) stored at 4 px per world px; props are stored at 2-4 px per world px.
- Villagers walk a waypoint graph (the dirt paths are drawn from the same graph), visit houses, queue at the
  magic shop, draw water at the well, brew, tend mushrooms, study the portal. Depth is sorted by feet y.
- Testing flags: `?debug` shows obstacles and the path graph, `?speed=N` fast-forwards the simulation,
  `?hour=H` fixes the time of day. `window.FV` exposes `trigger('wish'|'portal'|'cast'|'flame'|'talk'|'misfire'|'fly')`
  and `validateGraph()` for tests.
- Pure client-side. Not connected to Bot Hollow or any status.json.

Open `index.html` in a browser (or run `python3 -m http.server`). Desktop and mobile friendly.

Note: GitHub Pages caches JS and images for a few minutes after a push. Hard-refresh if the old scene shows.
