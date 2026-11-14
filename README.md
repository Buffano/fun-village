# Fun Village

A cozy, dense, slightly magical pixel village for pure fun, drawn on a single 480x320 world view
(scaled to fit the window in quarter steps, backing store at 2-3x so it stays sharp).

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
  sources (tower window, lanterns, wisps, fountain, windows), and a moon/sun/stars chip. `?hour=H` (0-24)
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
