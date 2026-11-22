# Emberwood Village

(Formerly "Fun Village". The repo and file names stay `fun-village`.)

A cozy, dense, slightly magical pixel village for pure fun, drawn on a single 480x360 world view
(scaled to fit the window in quarter steps, backing store at 2-3x so it stays sharp).

## Round 9 stage 3: inside Merrick's tower
- **Tap the tower door** to fade into a separate painted room: Merrick's round study, with bookshelves, a hearth, a spiral stair, a window, a telescope, a crystal ball, an orrery, potions and a desk with an open spellbook. To go back outside, tap the door mat, the **◀ Village** button or Esc. `?room=tower` opens the room straight away for testing.
- **Characters inside are drawn 3x their village size.** Their sheets are scaled crisply: a nearest-neighbour upscale, then one smooth step down. The room uses its own walk area, standing spots and foreground pieces (near wall, desk, potion table, crystal-ball stand, telescope, stair post), so the bigger figures fit the furniture.
- **The room mirrors the village.** Merrick (and Finn on a visit) appears inside while their village self is "inside" the tower door. The room decides when they walk back out, and the village keeps running underneath while you watch.
- **Merrick's day:** reads at the desk, gazes into the crystal ball, uses the telescope, browses the shelves, finds old scrolls, tends the hearth and brews at the potion table. **At night** (after 9:30 PM ET) he heads home, does a last look through the telescope, climbs the stair and sleeps upstairs until 6:15 AM.
- **Finn's apprentice visits:** 2 or 3 daytime windows each Eastern day, only while Merrick is home. Finn practises on the rug (now and then a misfire), watches over Merrick's shoulder and helps with the potions. The two chat now and then.
- **Taps inside:** Merrick and Finn answer you. The crystal ball, orrery, spellbook, telescope, hearth and stair each have a small reaction.
- **Night** crossfades a night painting by the same Eastern-time night level as the village. The characters inside are tinted by the nearest light, and the flames flicker live.
- Other villagers no longer pick the tower door when they go "into a house". It is Merrick's home now, and Finn only goes in for lessons.
- Test hooks:
  - `FV.trigger('room','tower'|'village',instant)`
  - `FV.trigger('tower','in','merrick'|'finn',node)`
  - `FV.trigger('tower','act',who,node,teleport)`
  - `FV.trigger('tower','bed'|'wake'|'out')`
  - `FV.trigger('tower','ball'|'orrery'|'book'|'scope'|'hearth')`
  - `FV.room`, `FV.validateRoom()` (empty list = every node and edge stays on the room floor), `FV.apprSlots()`
  - `?debug` inside the room shows the walk area, nodes, edges and foreground baselines.
- Assets: `tower_bg.webp`, `tower_bg_night.webp` and `tower_occ.webp` (foreground pieces, day and night side by side).

## Round 9: standing still, little activities, Linky's adventures
- **Standing poses**: everyone who isn't walking (all villagers, Juniper and the evening elf) now uses a real feet-together standing frame
  for every facing instead of the walk's contact frame. A walker held up for a moment also stands instead of freezing mid-stride.
- **Idle life**: blinks every 2-5 s, a drawn breathing frame, occasional glances or head turns and weight shifts (`<id>stand_sheet.png`,
  3 rows x 8 columns: stand, blink, half-blink, breathe, glance/turn L, R, weight shift L, R). Sir Helm doesn't blink (closed helmet).
- **Activity poses** (`<id>act_sheet.png`): Rosie stirs a little cauldron, Theo crouches to tend the beds, Merrick raises his staff,
  Finn casts in practice, Mabel sweeps the path (new activity), Juniper serves with a potion and waves to customers and passers-by. Chatters
  gesture while they talk (side view).
- **Linky** (`linkyact_sheet.png`, 120x112 cells, same centre and feet): grass cuts with his sword mixed in with the pokes (a find still
  ends in a gem), the gem held overhead (replaces the cheer bounce), a sword-practice drill, a silent ocarina tune with floating notes, and
  clay pots by the houses that he lifts, carries a few steps and throws; they shatter, sometimes hide a gem, and come back after a while.
  Tapping Linky makes him show off his sword combo; tapping a pot sends him to it.
- Test hooks: `FV.trigger('stir'|'tend'|'staff'|'practice'|'sweep'|'serve'|'wave'|'grass'|'gemhold'|'combo'|'drill'|'ocarina'|'pot'|'potreset'|'place')`.

## Round 6: new faces, livelier movement
- **Renamed** to Emberwood Village (title, header, README). Repo and file names are unchanged.
- **Movement**: walkers ease in and out of each stride, keep a smooth heading around corners, bob in step with the walk
  frames and squash briefly when they turn. Villagers who meet on the path may stop, face each other and trade a few
  short lines in small pixel speech bubbles. Some of them also walk to a plaza bench and sit for a while (hand-drawn
  seated poses for Merrick, Rosie, Theo, Mabel, Finn, Lady Luthien and Linky).
- **New villagers** (same sprite style and scale as the cast, stored at 4 px per world px): Sir Helm (knight, patrols the
  bridge and courtyard), Linky (hero of the wild, pokes the grass and sometimes finds a gem) and Lady Luthien (lady in
  waiting, strolls and chats). **Goldwing the griffin** flies over now and then with a shadow on the ground, and
  sometimes lands on the courtyard edge or on Merrick's tower for a while.
- A few hidden surprises are tucked into the village. Find them yourself.
- Everything is still standalone (no trackers, no status links). `FV.trigger('griffin'|'chat'|'sit'|'fireworks'|...)`
  are test hooks.

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
  `?hour=H` fixes the time of day. `window.FV` exposes `trigger('wish'|'portal'|'cast'|'flame'|'talk'|'misfire'|'fly'|'griffin'|'chat'|'sit'|'fireworks')`
  and `validateGraph()` for tests.
- Pure client-side. Not connected to Bot Hollow or any status.json.

Open `index.html` in a browser (or run `python3 -m http.server`). Desktop and mobile friendly.

Note: GitHub Pages caches JS and images for a few minutes after a push. Hard-refresh if the old scene shows.
