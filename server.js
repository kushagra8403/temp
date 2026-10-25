const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const PROMPTS = require('./prompts');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const WRITE_MS = +process.env.WRITE_MS || 60_000;
const VOTE_MS = +process.env.VOTE_MS || 30_000;
const REVEAL_MS = +process.env.REVEAL_MS || 9_000;
const ROUNDS = 5;
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 12;
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;

const rooms = new Map();

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function newCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += letters[crypto.randomInt(letters.length)];
    if (!rooms.has(c)) return c;
  }
}

function createRoom() {
  const room = {
    code: newCode(),
    phase: 'lobby', // lobby | write | vote | reveal | final
    players: new Map(), // id -> {id,name,score,ws,connected}
    hostId: null,
    round: 0,
    deck: shuffle(PROMPTS.slice()),
    current: null, // {q, a}
    bluffs: new Map(), // playerId -> text
    options: [], // [{id,text,authorIds:[],real:bool}]
    votes: new Map(), // playerId -> optionId
    results: null,
    deadline: null,
    timer: null,
    touched: Date.now()
  };
  rooms.set(room.code, room);
  return room;
}

function setTimer(room, ms, fn) {
  clearTimeout(room.timer);
  room.deadline = ms ? Date.now() + ms : null;
  room.timer = ms ? setTimeout(fn, ms) : null;
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

// Build the state a particular player is allowed to see.
function viewFor(room, pid) {
  const players = [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    connected: p.connected,
    done:
      room.phase === 'write' ? room.bluffs.has(p.id)
      : room.phase === 'vote' ? room.votes.has(p.id) || isOwnerOnly(room, p.id)
      : false
  }));
  const v = {
    type: 'state',
    code: room.code,
    phase: room.phase,
    you: pid,
    hostId: room.hostId,
    round: room.round,
    rounds: ROUNDS,
    minPlayers: MIN_PLAYERS,
    deadline: room.deadline,
    now: Date.now(),
    players
  };
  if (room.current && room.phase !== 'lobby' && room.phase !== 'final') v.question = room.current.q;
  if (room.phase === 'write') v.youWrote = room.bluffs.has(pid);
  if (room.phase === 'vote') {
    v.options = room.options.map((o) => ({ id: o.id, text: o.text, mine: o.authorIds.includes(pid) }));
    v.youVoted = room.votes.has(pid);
  }
  if (room.phase === 'reveal') v.results = room.results;
  return v;
}

function isOwnerOnly(room, pid) {
  // A player who authored every option can't vote meaningfully; never true in practice but keeps the game from stalling.
  return room.options.length > 0 && room.options.every((o) => o.authorIds.includes(pid));
}

function broadcast(room) {
  room.touched = Date.now();
  for (const p of room.players.values()) send(p.ws, viewFor(room, p.id));
}

function connectedIds(room) {
  return [...room.players.values()].filter((p) => p.connected).map((p) => p.id);
}

function startRound(room) {
  if (room.round >= ROUNDS || room.deck.length === 0) return endGame(room);
  room.round++;
  room.current = room.deck.pop();
  room.bluffs = new Map();
  room.options = [];
  room.votes = new Map();
  room.results = null;
  room.phase = 'write';
  setTimer(room, WRITE_MS, () => startVote(room));
  broadcast(room);
}

function startVote(room) {
  const real = norm(room.current.a);
  const byText = new Map(); // normalized text -> option
  for (const [pid, text] of room.bluffs) {
    const key = norm(text);
    if (!key || key === real) continue; // handled at submit time; defensive
    if (byText.has(key)) byText.get(key).authorIds.push(pid);
    else byText.set(key, { text, authorIds: [pid], real: false });
  }
  const opts = [...byText.values()];
  opts.push({ text: room.current.a, authorIds: [], real: true });
  room.options = shuffle(opts).map((o, i) => ({ ...o, id: i }));
  room.phase = 'vote';
  setTimer(room, VOTE_MS, () => startReveal(room));
  broadcast(room);
  maybeAdvanceVote(room);
}

function startReveal(room) {
  const gains = new Map();
  const add = (pid, n) => gains.set(pid, (gains.get(pid) || 0) + n);
  const optionResults = room.options.map((o) => ({
    text: o.text,
    real: o.real,
    authors: o.authorIds.map((id) => room.players.get(id)?.name),
    voters: []
  }));
  for (const [voter, optId] of room.votes) {
    const o = room.options[optId];
    if (!o) continue;
    optionResults[optId].voters.push(room.players.get(voter)?.name);
    if (o.real) add(voter, 500);
    else for (const a of o.authorIds) if (a !== voter) add(a, 250);
  }
  for (const [pid, g] of gains) {
    const p = room.players.get(pid);
    if (p) p.score += g;
  }
  room.results = {
    answer: room.current.a,
    options: optionResults,
    gains: [...gains].map(([id, g]) => ({ name: room.players.get(id)?.name, gain: g }))
  };
  room.phase = 'reveal';
  setTimer(room, REVEAL_MS, () => startRound(room));
  broadcast(room);
}

function endGame(room) {
  room.phase = 'final';
  room.current = null;
  setTimer(room, 0);
  broadcast(room);
}

function maybeAdvanceWrite(room) {
  if (room.phase !== 'write') return;
  const ids = connectedIds(room);
  if (ids.length && ids.every((id) => room.bluffs.has(id))) startVote(room);
}

function maybeAdvanceVote(room) {
  if (room.phase !== 'vote') return;
  const ids = connectedIds(room);
  if (ids.every((id) => room.votes.has(id) || isOwnerOnly(room, id))) startReveal(room);
}

function resetToLobby(room) {
  setTimer(room, 0);
  room.phase = 'lobby';
  room.round = 0;
  room.deck = shuffle(PROMPTS.slice());
  room.current = null;
  for (const p of room.players.values()) p.score = 0;
  // drop players who left while the game ran
  for (const [id, p] of room.players) if (!p.connected) room.players.delete(id);
  if (!room.players.has(room.hostId)) room.hostId = room.players.keys().next().value || null;
  broadcast(room);
}

function handle(ws, ctx, msg) {
  const room = ctx.room;
  switch (msg.type) {
    case 'create': {
      const name = clean(msg.name, 14);
      if (!name) return send(ws, { type: 'error', message: 'Enter a name first.' });
      const r = createRoom();
      return join(ws, ctx, r, name, null);
    }
    case 'join': {
      const r = rooms.get(String(msg.code || '').toUpperCase().trim());
      if (!r) return send(ws, { type: 'error', message: 'No room with that code.' });
      const name = clean(msg.name, 14);
      return join(ws, ctx, r, name, msg.playerId);
    }
  }
  if (!room) return;
  const me = room.players.get(ctx.pid);
  if (!me) return;

  switch (msg.type) {
    case 'start':
      if (me.id !== room.hostId || room.phase !== 'lobby') return;
      if (connectedIds(room).length < MIN_PLAYERS)
        return send(ws, { type: 'error', message: `Need at least ${MIN_PLAYERS} players.` });
      room.deck = shuffle(PROMPTS.slice());
      for (const p of room.players.values()) p.score = 0;
      return startRound(room);
    case 'bluff': {
      if (room.phase !== 'write' || room.bluffs.has(me.id)) return;
      const text = clean(msg.text, 40);
      if (!text) return;
      if (norm(text) === norm(room.current.a))
        return send(ws, { type: 'error', message: "That's the real answer! Try a fake one." });
      room.bluffs.set(me.id, text);
      broadcast(room);
      return maybeAdvanceWrite(room);
    }
    case 'vote': {
      if (room.phase !== 'vote' || room.votes.has(me.id)) return;
      const o = room.options[msg.option];
      if (!o || o.authorIds.includes(me.id)) return;
      room.votes.set(me.id, o.id);
      broadcast(room);
      return maybeAdvanceVote(room);
    }
    case 'again':
      if (me.id === room.hostId && room.phase === 'final') resetToLobby(room);
      return;
    case 'kick': {
      if (me.id !== room.hostId || room.phase !== 'lobby') return;
      const t = room.players.get(msg.id);
      if (!t || t.id === me.id) return;
      send(t.ws, { type: 'kicked' });
      room.players.delete(t.id);
      return broadcast(room);
    }
  }
}

function join(ws, ctx, room, name, playerId) {
  let p = playerId && room.players.get(playerId);
  if (p) {
    // reconnect
    if (p.ws && p.ws !== ws) try { p.ws.close(); } catch {}
    p.ws = ws;
    p.connected = true;
  } else {
    if (room.phase !== 'lobby') return send(ws, { type: 'error', message: 'That game already started.' });
    if (!name) return send(ws, { type: 'error', message: 'Enter a name first.' });
    if (room.players.size >= MAX_PLAYERS) return send(ws, { type: 'error', message: 'Room is full.' });
    if ([...room.players.values()].some((x) => x.name.toLowerCase() === name.toLowerCase()))
      return send(ws, { type: 'error', message: 'That name is taken in this room.' });
    p = { id: crypto.randomBytes(8).toString('hex'), name, score: 0, ws, connected: true };
    room.players.set(p.id, p);
    if (!room.hostId) room.hostId = p.id;
  }
  ctx.room = room;
  ctx.pid = p.id;
  send(ws, { type: 'joined', playerId: p.id, code: room.code });
  broadcast(room);
}

function onClose(ctx, ws) {
  const room = ctx.room;
  const p = room && room.players.get(ctx.pid);
  if (!p || p.ws !== ws) return;
  p.connected = false;
  if (room.phase === 'lobby') {
    // in the lobby, leaving removes you
    room.players.delete(p.id);
    if (room.hostId === p.id) room.hostId = room.players.keys().next().value || null;
  } else if (room.hostId === p.id) {
    const next = [...room.players.values()].find((x) => x.connected);
    if (next) room.hostId = next.id;
  }
  broadcast(room);
  maybeAdvanceWrite(room);
  maybeAdvanceVote(room);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/healthz') return res.end('ok');
  const file = path.join(PUBLIC, url === '/' ? 'index.html' : path.normalize(url).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(PUBLIC)) { res.statusCode = 403; return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) {
      // any unknown path (e.g. /?room=ABCD or /ABCD) serves the app
      return fs.readFile(path.join(PUBLIC, 'index.html'), (e2, d2) => {
        if (e2) { res.statusCode = 404; return res.end('Not found'); }
        res.setHeader('Content-Type', MIME['.html']);
        res.end(d2);
      });
    }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 2048 });
wss.on('connection', (ws) => {
  const ctx = { room: null, pid: null };
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;
    try { handle(ws, ctx, msg); } catch (e) { console.error(e); }
  });
  ws.on('close', () => onClose(ctx, ws));
});

// keep connections alive through proxies and drop dead sockets
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
  const now = Date.now();
  for (const [code, r] of rooms) {
    const anyone = [...r.players.values()].some((p) => p.connected);
    if ((!anyone && now - r.touched > 10 * 60_000) || now - r.touched > ROOM_TTL_MS) {
      clearTimeout(r.timer);
      rooms.delete(code);
    }
  }
}, 25_000).unref();

if (require.main === module) {
  server.listen(PORT, () => console.log(`Bluff Party listening on :${PORT}`));
}
module.exports = { server, rooms };
