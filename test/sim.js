// Plays a full 5-round game with bot players over real WebSockets.
process.env.REVEAL_MS = '150';
const assert = require('assert');
const WebSocket = require('ws');
const { server, rooms } = require('../server');

function bot(port, name) {
  const ws = new WebSocket(`ws://localhost:${port}`);
  const b = { name, ws, state: null, id: null, errors: [], kicked: false };
  b.ready = new Promise((r) => ws.on('open', r));
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.type === 'joined') b.id = m.playerId;
    if (m.type === 'state') b.state = m;
    if (m.type === 'error') b.errors.push(m.message);
  });
  b.send = (o) => ws.send(JSON.stringify(o));
  return b;
}
const until = (fn, ms = 5000) => new Promise((res, rej) => {
  const t0 = Date.now();
  const iv = setInterval(() => {
    let ok = false; try { ok = fn(); } catch {}
    if (ok) { clearInterval(iv); res(); }
    else if (Date.now() - t0 > ms) { clearInterval(iv); rej(new Error('timeout waiting for: ' + fn)); }
  }, 20);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const names = ['Ann', 'Bo', 'Cy', 'Di'];
  let bots = names.map((n) => bot(port, n));
  await Promise.all(bots.map((b) => b.ready));

  bots[0].send({ type: 'create', name: 'Ann' });
  await until(() => bots[0].state);
  const code = bots[0].state.code;
  assert.strictEqual(code.length, 4);

  // join validation
  bots[1].send({ type: 'join', code, name: 'ann' });
  await until(() => bots[1].errors.length);
  assert(/taken/.test(bots[1].errors[0]));
  bots[1].errors.length = 0;
  bots[1].send({ type: 'join', code: 'ZZZZ', name: 'X' });
  await until(() => bots[1].errors.length);

  bots.forEach((b, i) => i && b.send({ type: 'join', code, name: names[i] }));
  await until(() => bots[0].state.players.length === 4);

  bots[1].send({ type: 'start' }); // non-host ignored
  await sleep(100);
  assert.strictEqual(bots[0].state.phase, 'lobby');

  bots[0].send({ type: 'start' });
  for (let round = 1; round <= 5; round++) {
    await until(() => bots.every((b) => b.state && b.state.phase === 'write' && b.state.round === round));
    const room = rooms.get(code);
    assert(!JSON.stringify(bots[0].state).includes(room.current.a), 'answer leaked in write phase');

    bots[0].errors.length = 0;
    bots[0].send({ type: 'bluff', text: room.current.a.toUpperCase() });
    await until(() => bots[0].errors.length);

    // Cy and Di submit the same bluff; it should merge into one option
    bots.forEach((b, i) => b.send({ type: 'bluff', text: i >= 2 ? 'Same Thing' : 'fake ' + b.name }));
    await until(() => bots.every((b) => b.state.phase === 'vote'));
    const opts = bots[0].state.options;
    assert.strictEqual(opts.length, 4);
    assert(opts.every((o) => !('real' in o)), 'real flag leaked');

    const realId = room.options.find((o) => o.real).id;
    const ownId = bots[1].state.options.find((o) => o.mine).id;
    bots[1].send({ type: 'vote', option: ownId }); // self-vote must be ignored
    await sleep(80);
    assert.strictEqual(bots[1].state.phase, 'vote');
    assert(!bots[1].state.youVoted);

    // Ann fools nobody; Bo is fooled by Ann; others find the truth
    const annOpt = bots[0].state.options.find((o) => o.mine).id;
    bots[0].send({ type: 'vote', option: realId });
    bots[1].send({ type: 'vote', option: bots[3].state.options.find((o) => o.mine).id });
    bots[2].send({ type: 'vote', option: realId });
    if (round === 2) { // Di drops mid-vote; game must not stall
      const id = bots[3].id; bots[3].ws.close();
      await until(() => !bots[0].state.players.find((p) => p.id === id).connected);
    } else bots[3].send({ type: 'vote', option: annOpt });

    await until(() => bots.slice(0, 3).every((b) => b.state.phase === 'reveal'));
    assert.strictEqual(bots[0].state.results.answer, room.current.a);

    if (round === 2) { // reconnect with saved playerId
      const id = bots[3].id;
      const nb = bot(port, 'Di'); await nb.ready;
      nb.send({ type: 'join', code, playerId: id, name: 'Di' });
      await until(() => nb.state && nb.state.you === id);
      nb.id = id; bots[3] = nb;
    }
  }
  await until(() => bots.every((b) => b.state.phase === 'final'));
  const scores = Object.fromEntries(bots[0].state.players.map((p) => [p.name, p.score]));
  console.log('final scores', scores);
  assert(scores.Ann > 0 && scores.Cy > 0);

  bots[1].send({ type: 'again' }); // non-host ignored
  await sleep(80);
  assert.strictEqual(bots[0].state.phase, 'final');
  bots[0].send({ type: 'again' });
  await until(() => bots[0].state.phase === 'lobby' && bots[0].state.players.every((p) => p.score === 0));

  // late joiner blocked once a game is underway
  bots[0].send({ type: 'start' });
  await until(() => bots[0].state.phase === 'write');
  const late = bot(port, 'Late'); await late.ready;
  late.send({ type: 'join', code, name: 'Late' });
  await until(() => late.errors.length);
  assert(/already started/.test(late.errors[0]));

  console.log('ALL TESTS PASSED');
  process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
