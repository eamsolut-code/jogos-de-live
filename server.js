// Ponte entre a sua live do TikTok e os jogos.
//
// No computador:   node server.js @seu_usuario
// Hospedado:       abra  https://SEU-APP/chefao.html?user=seu_usuario   (o servidor conecta na hora)
//
// Variáveis opcionais:
//   PORT            porta (a hospedagem define sozinha)
//   TIKTOK_USER     usuário padrão quando a URL não tem ?user=
//   ALLOWED_USERS   lista separada por vírgula; só esses @ podem usar o servidor (recomendado quando público)
//   EULER_API_KEY   chave do Euler Stream, deixa a conexão mais estável em hospedagem na nuvem

const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');

const PORT = process.env.PORT || 3000;
const DEFAULT_USER = clean(process.argv[2] || process.env.TIKTOK_USER || '');
const EULER_KEY = process.env.EULER_API_KEY || undefined;
const ALLOWED = (process.env.ALLOWED_USERS || '').split(',').map(clean).filter(Boolean);
const IDLE_CLOSE_MS = 60000;

function clean(u) { return String(u || '').replace(/^@/, '').trim().toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 40); }

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/status', (_req, res) => res.json({ hubs: [...hubs.values()].map((h) => ({ user: h.user, connected: h.connected, viewers: h.clients.size })) }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const hubs = new Map(); // user -> { user, clients, conn, connected, retry, timer, closeTimer, stopped }

function broadcast(hub, msg) {
  const data = JSON.stringify(msg);
  for (const ws of hub.clients) if (ws.readyState === 1) ws.send(data);
}

function startHub(hub) {
  const connect = () => {
    if (hub.stopped) return;
    const conn = new TikTokLiveConnection(hub.user, { signApiKey: EULER_KEY, enableExtendedGiftInfo: false });
    hub.conn = conn;

    conn.on(WebcastEvent.CHAT, (d) => broadcast(hub, {
      t: 'chat', user: d.user?.uniqueId || 'anon', nick: d.user?.nickname || d.user?.uniqueId || 'anon', text: d.comment || '',
    }));
    conn.on(WebcastEvent.GIFT, (d) => {
      // Presentes em sequência: só conta quando a sequência termina.
      if (d.giftDetails?.giftType === 1 && !d.repeatEnd) return;
      const unit = d.giftDetails?.diamondCount ?? d.extendedGiftInfo?.diamond_count ?? 1, count = d.repeatCount || 1;
      broadcast(hub, {
        t: 'gift', user: d.user?.uniqueId || 'anon', nick: d.user?.nickname || d.user?.uniqueId || 'anon',
        name: d.giftDetails?.giftName || d.extendedGiftInfo?.name || 'Presente', coins: unit * count, count,
      });
    });
    conn.on(WebcastEvent.LIKE, (d) => broadcast(hub, { t: 'like', user: d.user?.uniqueId || 'anon', nick: d.user?.nickname || 'anon', count: d.likeCount || 1 }));
    conn.on(ControlEvent.ERROR, ({ info }) => console.log(`[@${hub.user}] erro: ${info || ''}`));

    let handled = false;
    const reconnect = (why) => {
      if (handled || hub.stopped) return; handled = true;
      hub.connected = false; broadcast(hub, { t: 'status', connected: false, user: hub.user });
      hub.retry += 1;
      const wait = Math.min(30000, 3000 * hub.retry);
      console.log(`[@${hub.user}] ${why} Tentando de novo em ${wait / 1000}s...`);
      hub.timer = setTimeout(connect, wait);
    };
    conn.on(WebcastEvent.STREAM_END, () => reconnect('A live terminou.'));
    conn.on(ControlEvent.DISCONNECTED, () => reconnect('Desconectado.'));

    conn.connect().then((s) => {
      hub.retry = 0; hub.connected = true;
      console.log(`[@${hub.user}] conectado (sala ${s.roomId}).`);
      broadcast(hub, { t: 'status', connected: true, user: hub.user });
    }).catch((err) => reconnect(`Não consegui conectar (${err.message || err}). Você está ao vivo?`));
  };
  connect();
}

function stopHub(hub) {
  hub.stopped = true; clearTimeout(hub.timer);
  try { hub.conn && hub.conn.disconnect(); } catch (e) {}
  hubs.delete(hub.user); console.log(`[@${hub.user}] ninguém assistindo, conexão encerrada.`);
}

function joinHub(user, ws) {
  let hub = hubs.get(user);
  if (!hub) { hub = { user, clients: new Set(), conn: null, connected: false, retry: 0, timer: null, closeTimer: null, stopped: false }; hubs.set(user, hub); startHub(hub); }
  clearTimeout(hub.closeTimer);
  hub.clients.add(ws);
  ws.send(JSON.stringify({ t: 'status', connected: hub.connected, user }));
  ws.on('close', () => {
    hub.clients.delete(ws);
    if (hub.clients.size === 0) hub.closeTimer = setTimeout(() => stopHub(hub), IDLE_CLOSE_MS);
  });
}

wss.on('connection', (ws, req) => {
  ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
  const q = new URL(req.url, 'http://x').searchParams;
  const user = clean(q.get('user')) || DEFAULT_USER;
  if (!user) { ws.send(JSON.stringify({ t: 'status', connected: false, user: null })); return; }
  if (ALLOWED.length && !ALLOWED.includes(user)) { ws.send(JSON.stringify({ t: 'status', connected: false, user: null, denied: true })); ws.close(); return; }
  joinHub(user, ws);
});

// Mantém as conexões vivas em hospedagens que derrubam conexões ociosas.
setInterval(() => {
  for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch (e) {} }
}, 25000);

server.listen(PORT, () => {
  console.log(`Jogos em http://localhost:${PORT}/  (demo: /?demo=1  ·  live: /?user=seu_usuario)`);
  if (DEFAULT_USER) console.log(`Usuário padrão: @${DEFAULT_USER}`);
  if (ALLOWED.length) console.log(`Usuários permitidos: ${ALLOWED.map((u) => '@' + u).join(', ')}`);
});
