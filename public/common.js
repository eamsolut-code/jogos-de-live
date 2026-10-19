// Motor comum dos jogos: tela, efeitos, som, frutas humanoides e ligação com a live.
const W = 540, H = 960;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');
try { if (params.get('user')) localStorage.setItem('jogosUser', params.get('user')); } catch (e) {}
const LIVE_USER = params.get('user') || (() => { try { return localStorage.getItem('jogosUser') || ''; } catch (e) { return ''; } })();

let scale = 1, offX = 0, offY = 0;
// Parte visível do jogo (em unidades do jogo) quando a tela corta as laterais; usada pelos painéis.
let VL = 8, VR = W - 8;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  scale = Math.max(cv.width / W, cv.height / H);
  offX = (cv.width - W * scale) / 2; offY = (cv.height - H * scale) / 2;
  const cut = Math.max(0, (W - cv.width / scale) / 2);
  VL = cut + 8; VR = W - cut - 8;
}
addEventListener('resize', resize); resize();
const st = document.createElement('style');
st.textContent = `html,body{margin:0;height:100%;background:#0b0a1a;overflow:hidden;touch-action:manipulation}
canvas{display:block;width:100vw;height:100vh;height:100dvh}
#demo{position:fixed;left:8px;bottom:8px;display:flex;gap:6px;flex-wrap:wrap;z-index:5;font:12px system-ui,sans-serif;max-width:70vw}
#demo button{background:#ffffff22;color:#fff;border:1px solid #ffffff55;border-radius:8px;padding:8px 10px;font:inherit}
#demo button:active{background:#ffffff55}`;
document.head.appendChild(st);

// ---------- utilidades ----------
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function tierOf(coins) { return coins >= 1000 ? 4 : coins >= 199 ? 3 : coins >= 30 ? 2 : coins >= 5 ? 1 : 0; }
function txt(t, x, y, size, color = '#fff', align = 'center', stroke = true) {
  ctx.font = `800 ${size}px system-ui, "Segoe UI", sans-serif`;
  if (align === 'center') { const w = ctx.measureText(t).width, room = (Math.min(x - VL, VR - x)) * 2; if (w > room && room > 60) { size = Math.floor(size * room / w); ctx.font = `800 ${size}px system-ui, "Segoe UI", sans-serif`; } }
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = '#000b'; ctx.lineJoin = 'round'; ctx.strokeText(t, x, y); }
  ctx.fillStyle = color; ctx.fillText(t, x, y);
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }


// Toque em qualquer lugar entra em tela cheia (some a barra do navegador na live).
function goFullscreen() {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    else if (!document.fullscreenElement && el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch (e) {}
}
if (!params.has('semtelacheia')) addEventListener('pointerdown', goFullscreen);

// ---------- som ----------
let ac = null;
function beep(freq, dur = 0.08, type = 'square', vol = 0.04, slide = 0) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + dur);
    g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
  } catch (e) {}
}
addEventListener('pointerdown', () => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); } catch (e) {} }, { once: true });

// ---------- audiência: quem comentou há pouco + mural de comentários ----------
const AUD = { seen: new Map(), feed: [], chats: 0, gifts: 0 };
function audActive() { const now = performance.now(); let n = 0; for (const [u, t] of AUD.seen) { if (now - t < 60000) n++; else AUD.seen.delete(u); } return n; }
// Com poucas pessoas na live, cada comentário vale mais, para o jogo responder mesmo com 1 espectador.
function audMul() { return clamp(20 / Math.max(1, audActive()), 1, 15); }
function audNote(m, kind) {
  AUD.seen.set(m.user, performance.now());
  if (kind === 'chat') { AUD.chats++; AUD.feed.push({ t: performance.now(), s: `${String(m.nick || m.user).slice(0, 12)}: ${String(m.text || '').slice(0, 22)}` }); }
  else { AUD.gifts++; AUD.feed.push({ t: performance.now(), s: `🎁 ${String(m.nick || m.user).slice(0, 10)}: ${m.name || 'presente'}`, gift: true }); }
  if (AUD.feed.length > 4) AUD.feed.shift();
}
function drawFeed() {
  const now = performance.now(); const x = VL + 4; let y = H - 132;
  ctx.globalAlpha = 1;
  for (let i = AUD.feed.length - 1; i >= 0; i--) {
    const f = AUD.feed[i], age = (now - f.t) / 1000; if (age > 12) continue;
    ctx.globalAlpha = Math.min(1, (12 - age) / 3);
    ctx.font = '700 13px system-ui, sans-serif'; const w = Math.min(VR - x, ctx.measureText(f.s).width + 14);
    rr(x, y - 11, w, 22, 11); ctx.fillStyle = f.gift ? '#a0207acc' : '#000000aa'; ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(f.s, x + 7, y, w - 10);
    y -= 26;
  }
  ctx.globalAlpha = 1;
  txt(`${AUD.chats} comentários · ${audActive()} jogando`, VR - 4, H - 118, 12, '#ffffffcc', 'right', false);
}

// ---------- efeitos ----------
const FX = { shake: 0, flash: 0, floaters: [], particles: [], banners: [] };
function floatText(x, y, text, color = '#fff', size = 20, life = 1) { FX.floaters.push({ x, y, text, color, size, life, max: life }); }
function burst(x, y, color, n = 14, speed = 220) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(40, speed);
    FX.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 0.9), color, r: rand(2, 5) });
  }
}
const TIER_COLORS = ['#ff7aa8', '#ffd24d', '#4dd2ff', '#ff4d6d', '#c06bff'];
function addBanner(text, sub, tier) { FX.banners.push({ text, sub, tier, life: 2.4, max: 2.4 }); if (FX.banners.length > 4) FX.banners.shift(); }
function updateFx(dt) {
  for (let i = FX.floaters.length - 1; i >= 0; i--) { const f = FX.floaters[i]; f.life -= dt; f.y -= 40 * dt; if (f.life <= 0) FX.floaters.splice(i, 1); }
  for (let i = FX.particles.length - 1; i >= 0; i--) { const p = FX.particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; if (p.life <= 0) FX.particles.splice(i, 1); }
  for (let i = FX.banners.length - 1; i >= 0; i--) { FX.banners[i].life -= dt; if (FX.banners[i].life <= 0) FX.banners.splice(i, 1); }
  FX.shake = Math.max(0, FX.shake - dt * 40); FX.flash = Math.max(0, FX.flash - dt * 1.6);
}
function beginFrame() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0a1a'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(scale, 0, 0, scale, offX, offY);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  if (FX.shake > 0) ctx.translate(rand(-FX.shake, FX.shake) / 2, rand(-FX.shake, FX.shake) / 2);
}
function endFrame() {
  for (const p of FX.particles) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.r, p.r); }
  ctx.globalAlpha = 1;
  for (const f of FX.floaters) { ctx.globalAlpha = Math.max(0, f.life / f.max); txt(f.text, f.x, f.y, f.size, f.color); }
  ctx.globalAlpha = 1;
  ctx.restore();
  FX.banners.slice(-3).forEach((b, i) => {
    ctx.globalAlpha = Math.min(1, b.life / 0.4, (b.max - b.life) / 0.2 + 0.2);
    txt(b.text, W / 2, 500 + i * 62, 28 + b.tier * 3, TIER_COLORS[b.tier]);
    txt(b.sub, W / 2, 500 + i * 62 + 28, 18, '#fff');
    ctx.globalAlpha = 1;
  });
  if (FX.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${FX.flash * 0.6})`; ctx.fillRect(0, 0, W, H); }
  drawFeed();
  ctx.font = '700 15px system-ui, sans-serif';
  const tw = ctx.measureText(connState).width + 24, live = connState.startsWith('ao vivo');
  rr(W / 2 - tw / 2, H - 92, tw, 28, 14); ctx.fillStyle = live ? '#0a7a3aee' : '#000000bb'; ctx.fill();
  txt(connState, W / 2, H - 78, 15, '#fff', 'center', false);
  if (!document.fullscreenElement && !document.webkitFullscreenElement) txt('Toque na tela para ficar em tela cheia', W / 2, H - 46, 14, '#ffe14d', 'center', false);
}

// ---------- frutas humanoides ----------
const FRUITS = [
  { n: 'maçã',     body: '#e83a3a', dark: '#a82020', top: 'leaf',  deco: 'none' },
  { n: 'banana',   body: '#ffd83a', dark: '#c9a21a', top: 'stem',  deco: 'none', slim: true },
  { n: 'laranja',  body: '#ff9a2e', dark: '#c96a10', top: 'leaf',  deco: 'dots' },
  { n: 'morango',  body: '#ff4a6a', dark: '#b82040', top: 'leaf2', deco: 'seeds' },
  { n: 'uva',      body: '#8e5bd6', dark: '#5e34a0', top: 'stem',  deco: 'grapes' },
  { n: 'melancia', body: '#3fae56', dark: '#1f7a35', top: 'none',  deco: 'stripes' },
  { n: 'abacaxi',  body: '#f3c63a', dark: '#b8921a', top: 'crown', deco: 'diamonds' },
  { n: 'limão',    body: '#c8e83a', dark: '#8fae1a', top: 'leaf',  deco: 'none' },
];
function fruitFor(user) { return FRUITS[hash(user) % FRUITS.length]; }
// (x, y) = centro do corpo. o: s escala, t tempo, walk, arm (braços pra cima), stun, sad, open, flip, look
function drawFruit(x, y, f, o = {}) {
  const s = o.s || 1, t = o.t || 0, c = ctx;
  c.save(); c.translate(x, y + (o.bob || 0) * s); c.scale(s * (o.flip ? -1 : 1), s);
  const sw = o.walk ? Math.sin(t * 9) * 7 : 0;
  c.strokeStyle = '#222'; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-6, 15); c.lineTo(-7 + sw, 29); c.moveTo(6, 15); c.lineTo(7 - sw, 29); c.stroke();
  c.fillStyle = '#222'; c.beginPath(); c.ellipse(-8 + sw, 31, 6, 3, 0, 0, 7); c.ellipse(8 - sw, 31, 6, 3, 0, 0, 7); c.fill();
  // braços
  const up = o.arm ? 1 : 0, wv = Math.sin(t * 10) * 4;
  c.strokeStyle = f.dark; c.lineWidth = 4;
  c.beginPath();
  if (up) { c.moveTo(-12, 0); c.lineTo(-22, -18 + wv); c.moveTo(12, 0); c.lineTo(22, -18 - wv); }
  else { const a = o.walk ? Math.sin(t * 9) * 6 : 0; c.moveTo(-12, 2); c.lineTo(-21, 12 - a); c.moveTo(12, 2); c.lineTo(21, 12 + a); }
  c.stroke();
  // corpo
  const rx = f.slim ? 11 : 15, ry = 17;
  c.save(); if (f.n === 'banana') c.rotate(-0.25);
  c.fillStyle = f.body; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, 7); c.fill();
  c.save(); c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, 7); c.clip();
  c.fillStyle = f.dark; c.globalAlpha = 0.5;
  if (f.deco === 'dots') { for (const [dx, dy] of [[-8, -8], [7, -10], [9, 6], [-6, 9], [0, 0]]) { c.beginPath(); c.arc(dx, dy, 1.6, 0, 7); c.fill(); } }
  if (f.deco === 'seeds') { c.fillStyle = '#ffe98a'; c.globalAlpha = 0.9; for (const [dx, dy] of [[-9, -2], [8, -5], [10, 8], [-5, 10], [1, 12], [-10, 6]]) { c.beginPath(); c.ellipse(dx, dy, 1.3, 2, 0, 0, 7); c.fill(); } }
  if (f.deco === 'grapes') { c.fillStyle = '#b48cf0'; c.globalAlpha = 0.5; for (const [dx, dy] of [[-8, -8], [6, -8], [-2, 4], [8, 8], [-9, 8]]) { c.beginPath(); c.arc(dx, dy, 5, 0, 7); c.fill(); } }
  if (f.deco === 'stripes') { c.strokeStyle = '#176d2c'; c.lineWidth = 3; c.globalAlpha = 0.7; for (const dx of [-9, -3, 3, 9]) { c.beginPath(); c.moveTo(dx, -17); c.quadraticCurveTo(dx * 1.3, 0, dx, 17); c.stroke(); } }
  if (f.deco === 'diamonds') { c.strokeStyle = '#b8921a'; c.lineWidth = 1.4; c.globalAlpha = 0.8; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 8 - 20, -20); c.lineTo(i * 8 + 20, 20); c.moveTo(i * 8 + 20, -20); c.lineTo(i * 8 - 20, 20); c.stroke(); } }
  c.restore();
  c.fillStyle = '#fff'; c.globalAlpha = 0.25; c.beginPath(); c.ellipse(-rx * 0.45, -ry * 0.45, 3, 6, -0.5, 0, 7); c.fill(); c.globalAlpha = 1;
  c.restore();
  // topo
  c.fillStyle = '#3aa84a'; c.strokeStyle = '#6a4a22';
  if (f.top === 'leaf') { c.beginPath(); c.ellipse(5, -ry - 2, 7, 3.5, -0.6, 0, 7); c.fill(); c.lineWidth = 2; c.beginPath(); c.moveTo(0, -ry + 2); c.lineTo(0, -ry - 4); c.stroke(); }
  if (f.top === 'leaf2') { for (const a of [-0.8, 0, 0.8]) { c.beginPath(); c.ellipse(Math.sin(a) * 6, -ry - 1, 3, 6, a, 0, 7); c.fill(); } }
  if (f.top === 'stem') { c.lineWidth = 3; c.beginPath(); c.moveTo(1, -ry + 2); c.lineTo(3, -ry - 7); c.stroke(); }
  if (f.top === 'crown') { for (const a of [-0.7, -0.35, 0, 0.35, 0.7]) { c.beginPath(); c.moveTo(Math.sin(a) * 6 - 3, -ry + 3); c.lineTo(Math.sin(a) * 14, -ry - 15 + Math.abs(a) * 6); c.lineTo(Math.sin(a) * 6 + 3, -ry + 3); c.fill(); } }
  // rosto
  const lk = (o.look || 0) * 1.6;
  if (o.stun) {
    c.strokeStyle = '#222'; c.lineWidth = 2;
    for (const ex of [-5, 5]) { c.beginPath(); c.moveTo(ex - 3, -7); c.lineTo(ex + 3, -1); c.moveTo(ex + 3, -7); c.lineTo(ex - 3, -1); c.stroke(); }
  } else {
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-5, -4, 4.6, 0, 7); c.arc(5, -4, 4.6, 0, 7); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(-5 + lk, -3.5, 2.2, 0, 7); c.arc(5 + lk, -3.5, 2.2, 0, 7); c.fill();
  }
  c.strokeStyle = '#222'; c.lineWidth = 2; c.beginPath();
  if (o.open) { c.fillStyle = '#400'; c.ellipse(0, 7, 4, 5, 0, 0, 7); c.fill(); }
  else if (o.sad || o.stun) c.arc(0, 10, 4.5, Math.PI * 1.15, Math.PI * 1.85);
  else c.arc(0, 5, 5, 0.15 * Math.PI, 0.85 * Math.PI);
  c.stroke();
  c.restore();
}

// ---------- robôs humanoides ----------
const ROBOTS = [
  { n: 'Azulão',  body: '#4da3ff', dark: '#1f64b8', eye: '#7dffea', ant: '#ff4d6d' },
  { n: 'Ferrugem', body: '#d98a4a', dark: '#8f5426', eye: '#ffe14d', ant: '#7dffea' },
  { n: 'Verdão',  body: '#4ddc7a', dark: '#1f8f4a', eye: '#fff', ant: '#ffe14d' },
  { n: 'Rosinha', body: '#ff7ac0', dark: '#b8408a', eye: '#fff', ant: '#7dffea' },
  { n: 'Cromo',   body: '#c9d3df', dark: '#7a8696', eye: '#4dd2ff', ant: '#ff4d6d' },
  { n: 'Solar',   body: '#ffd24d', dark: '#b8901a', eye: '#ff4d6d', ant: '#4dd2ff' },
  { n: 'Roxo',    body: '#a77bff', dark: '#5e3ab8', eye: '#ffe14d', ant: '#7dffea' },
  { n: 'Vermelhão', body: '#ff5a5a', dark: '#a82a2a', eye: '#fff', ant: '#ffe14d' },
];
function robotFor(user) { return ROBOTS[hash(user) % ROBOTS.length]; }
// (x, y) = centro do corpo. o: s escala, t tempo, walk, arm (braços pra cima), stun, sad, flip, look, bob
function drawRobot(x, y, r, o = {}) {
  const s = o.s || 1, t = o.t || 0, c = ctx;
  c.save(); c.translate(x, y + (o.bob || 0) * s); c.scale(s * (o.flip ? -1 : 1), s);
  const sw = o.walk ? Math.sin(t * 9) * 6 : 0;
  c.lineCap = 'round'; c.strokeStyle = '#333'; c.lineWidth = 5;
  c.beginPath(); c.moveTo(-7, 14); c.lineTo(-8 + sw, 29); c.moveTo(7, 14); c.lineTo(8 - sw, 29); c.stroke();
  c.fillStyle = r.dark; c.fillRect(-14 + sw, 28, 12, 5); c.fillRect(2 - sw, 28, 12, 5);
  const wv = Math.sin(t * 10) * 4; c.strokeStyle = r.dark; c.lineWidth = 5; c.beginPath();
  if (o.arm) { c.moveTo(-14, 0); c.lineTo(-25, -18 + wv); c.moveTo(14, 0); c.lineTo(25, -18 - wv); }
  else { const a = o.walk ? Math.sin(t * 9) * 6 : 0; c.moveTo(-14, 2); c.lineTo(-23, 13 - a); c.moveTo(14, 2); c.lineTo(23, 13 + a); }
  c.stroke(); c.fillStyle = '#333'; c.beginPath();
  if (o.arm) { c.arc(-25, -18 + wv, 3.5, 0, 7); c.arc(25, -18 - wv, 3.5, 0, 7); } else { c.arc(-23, 13, 3.5, 0, 7); c.arc(23, 13, 3.5, 0, 7); }
  c.fill();
  c.fillStyle = r.body; c.beginPath(); c.roundRect(-14, -8, 28, 26, 6); c.fill();
  c.fillStyle = r.dark; c.beginPath(); c.roundRect(-8, 0, 16, 10, 3); c.fill();
  c.fillStyle = r.eye; c.globalAlpha = 0.9; c.beginPath(); c.arc(-3, 5, 1.8, 0, 7); c.arc(3, 5, 1.8, 0, 7); c.fill(); c.globalAlpha = 1;
  c.fillStyle = r.body; c.beginPath(); c.roundRect(-13, -30, 26, 22, 6); c.fill();
  c.fillStyle = '#10142a'; c.beginPath(); c.roundRect(-10, -26, 20, 12, 5); c.fill();
  const lk = (o.look || 0) * 1.5;
  if (o.stun) { c.strokeStyle = r.eye; c.lineWidth = 2; for (const ex of [-4, 4]) { c.beginPath(); c.moveTo(ex - 2.5, -23); c.lineTo(ex + 2.5, -17); c.moveTo(ex + 2.5, -23); c.lineTo(ex - 2.5, -17); c.stroke(); } }
  else { c.fillStyle = r.eye; c.beginPath(); c.arc(-4 + lk, -20, o.sad ? 2 : 2.8, 0, 7); c.arc(4 + lk, -20, o.sad ? 2 : 2.8, 0, 7); c.fill(); }
  c.strokeStyle = '#333'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, -30); c.lineTo(0, -38); c.stroke();
  c.fillStyle = r.ant; c.beginPath(); c.arc(0, -40, 3.5 + (Math.sin(t * 6) > 0.5 ? 1 : 0), 0, 7); c.fill();
  c.restore();
}

// ---------- ligação com a live ----------
let connState = DEMO ? 'modo demo' : 'conectando...';
function startLive(o) {
  const c0 = o.onChat, g0 = o.onGift;
  o = { ...o, onChat: (m) => { audNote(m, 'chat'); c0 && c0(m); }, onGift: (m) => { audNote(m, 'gift'); g0 && g0(m); } };
  if (DEMO) buildDemo(o); else connectWS(o);
}
function connectWS(o) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const u = LIVE_USER;
  const ws = new WebSocket(`${proto}://${location.host}/ws${u ? '?user=' + encodeURIComponent(u) : ''}`);
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.t === 'chat' && o.onChat) o.onChat(m);
    else if (m.t === 'gift' && o.onGift) o.onGift(m);
    else if (m.t === 'like' && o.onLike) o.onLike(m);
    else if (m.t === 'status') connState = m.connected ? `ao vivo: @${m.user}` : (m.denied ? 'usuário não permitido neste servidor' : m.user ? `aguardando live de @${m.user}...` : 'faltou ?user=seu_usuario no endereço');
  };
  ws.onopen = () => { connState = 'servidor ok'; };
  ws.onclose = () => { connState = 'reconectando...'; setTimeout(() => connectWS(o), 2000); };
}
const DEMO_NAMES = ['ana','beto','carla','davi','eli','fabi','gus','hana','igor','julia','kleber','lia','marcos','nina','otavio','paula','quico','rita','saulo','tati'];
function buildDemo(o) {
  const box = document.createElement('div'); box.id = 'demo';
  const mk = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => fn(b); box.appendChild(b); return b; };
  const fakeUser = () => pick(DEMO_NAMES) + Math.floor(Math.random() * 25);
  const fakeChat = () => { const u = fakeUser(); o.onChat && o.onChat({ user: u, nick: u, text: pick(o.demoTexts || ['oi']) }); };
  const gift = (c, n) => { const u = pick(DEMO_NAMES); o.onGift && o.onGift({ user: u, nick: u, name: n, coins: c }); };
  [[1, 'Rosa'], [5, 'Rosquinha'], [30, 'Coração'], [199, 'Leão'], [1000, 'Galáxia']].forEach(([c, n]) => mk(`${n} (${c})`, () => gift(c, n)));
  mk('+20 comentários', () => { for (let i = 0; i < 20; i++) setTimeout(fakeChat, i * 60); });
  let auto = null;
  mk('Auto: desligado', (b) => {
    if (auto) { clearInterval(auto); auto = null; b.textContent = 'Auto: desligado'; }
    else { auto = setInterval(() => { fakeChat(); if (Math.random() < 0.04) gift(pick([1, 1, 5, 30, 199]), 'Rosa'); }, 170); b.textContent = 'Auto: ligado'; }
  });
  document.body.appendChild(box);
}

// ---------- laço principal ----------
function runGame(update, draw) {
  let last = performance.now();
  (function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); updateFx(dt); draw();
    requestAnimationFrame(loop);
  })(last);
}
