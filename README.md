# Fun Village

A cozy pixel village for pure fun, drawn on a single dense 480x320 canvas view
(scaled up by a whole-number factor to fit the window).

- Scene: pixel-art houses, trees, a central fountain, a well, a market stall and a pond
  (PNG sprites with real transparency in `assets/`, stored at 2x and drawn at half size
  times the canvas scale), sorted by bottom edge for depth.
- Ground: a fixed, seeded grass-and-path pattern built once, so nothing flickers.
- Next: villagers and animals (character animation), then events and scenarios.
- Pure client-side. Not connected to Bot Hollow or any status.json.

Open `index.html` in a browser (or run `python3 -m http.server`). Desktop and mobile friendly.

Note: GitHub Pages caches JS and images for a few minutes after a push. Hard-refresh if the old scene shows.
