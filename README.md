# Fun Village

A cozy pixel village for pure fun, drawn on a single dense 480x320 canvas view
(scaled up by a whole-number factor to fit the window).

- Scene: pixel-art houses, trees, a central fountain, a well, a market stall and a pond
  (PNG sprites with real transparency in `assets/`, stored at 2x and drawn at half size
  times the canvas scale), sorted by bottom edge for depth.
- Ground: a fixed, seeded grass-and-path pattern built once, so nothing flickers.
- Characters (round 2): five villagers (Rosie the baker, Theo the farmer, Mabel the elder, Finn the kid,
  Juniper the shopkeeper), a cat (Biscuit), a dog (Pepper) and three ducks on the pond. Sprite sheets are
  `assets/<name>_sheet.png` (4 columns x 3 rows: front, back, side-left; stored at 4 px per world px).
- Behaviour: villagers walk a small waypoint graph (the dirt paths are drawn from the same graph), visit houses,
  queue at the stall, draw water at the well; animals wander, nap and follow villagers; ducks swim and dip.
  Props and characters are depth-sorted by feet y; ground and props are pre-scaled once per resize.
- Testing flags: `?debug` shows obstacles and the path graph, `?speed=N` fast-forwards the simulation.
- Next: day/night, weather, events and more scenarios.
- Pure client-side. Not connected to Bot Hollow or any status.json.

Open `index.html` in a browser (or run `python3 -m http.server`). Desktop and mobile friendly.

Note: GitHub Pages caches JS and images for a few minutes after a push. Hard-refresh if the old scene shows.
