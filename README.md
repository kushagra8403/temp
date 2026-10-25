# Bluff Party

A multiplayer word-bluff game. No logins, no installs. One player creates a room, everyone else joins with the 4-letter code (or the invite link) on their phone or laptop.

**How it plays (3-12 players, 5 rounds):**
1. Everyone sees a fill-in-the-blank fact and writes a believable fake answer.
2. All answers (plus the real one) are shuffled. Everyone votes for the one they think is true.
3. Finding the truth earns 500 points. Each player you fool earns you 250.

Identical bluffs are merged, you can't submit the real answer, and you can't vote for your own bluff.

## Run locally
```
npm install
npm start        # http://localhost:3000
npm test         # simulated 4-player game over real WebSockets
```

## Keeping screens in sync
The server owns all game state. Clients only send intents (`bluff`, `vote`, `start`) and receive a full per-player snapshot after every change, so nobody can drift out of sync. Answers stay on the server until the reveal. Refreshing or dropping connection rejoins you as the same player (id kept in localStorage), and a disconnected player never stalls a round.

## Deploy (needs a host that supports WebSockets and a long-running process)
**Render:** New > Blueprint > pick this repo (uses `render.yaml`). You get a public `https://bluff-party-xxxx.onrender.com` URL. The free tier sleeps when idle, so the first load can take ~30s. Rooms live in memory and reset on restart.
**Fly/Railway/anything with Docker:** use the included `Dockerfile` (listens on `$PORT`).

Share `https://<your-url>/?room=ABCD` to drop friends straight into a room.

## Add prompts
Edit `prompts.js`: `{ q: "Question with ____.", a: "real answer" }`.
