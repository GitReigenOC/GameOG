YO so I'm making some game that's for entertainment purposes without the issue of getting white listed. So either it's going to be one game or a complete web page/site for this game thats all I have to say

(GAME IS IN DEVELOPMENT CURRENTLY SO EXPECT A BUNCH OF BUGS)

## Local development

The browser game is an ES-module application. `_layouts/default.html` supplies the Three.js import map and loads `main.js`; `game.js` remains as a compatibility entry point. The game uses procedural character and weapon models by default. To enable the optional rigged enemy, provide `assets/characters/soldier.glb` with an animated right-hand bone named `RightHand`, `hand_r`, or `mixamorigRightHand`. Optional weapon GLBs can be supplied under `assets/weapons/` as `rifle.glb`, `sniper.glb`, `shotgun.glb`, `smg.glb`, and `knife.glb`; built-in models are used when these files are absent.

The optional SQLite leaderboard API runs on loopback and uses only the Python standard library:

```powershell
python leaderboard_server.py
```

Serve the Jekyll site separately. The game calls `http://127.0.0.1:8765/api` by default; set `window.BLACKSITE_API_URL` before loading `main.js` to use a different API origin. The local API binds only to `127.0.0.1`; do not expose this development server directly to the public internet. Match results remain playable if the API is unavailable, and the leaderboard panel displays the connection status.

Run the backend tests with:

```powershell
python -m unittest test_leaderboard_server.py
```
