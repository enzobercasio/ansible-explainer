/**
 * AAP 2.7 System Map UI.
 *
 * Paints the fixed map, the active journey's path across it, and the same
 * steps as a sequence diagram. State is (journey, topology, failed, step);
 * the model turns the first three into steps and this file only draws.
 *
 * URL: #journey/topology/failed,failed/step   (failed is "-" when none)
 */
import { NODES, PLATFORM, TOPOLOGIES, JOURNEYS, INFO, nodeView, reach, buildJourney } from './model.js';

const el = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const state = {
  journey: JOURNEYS[0].id,
  topo: 'growth',
  failed: [],
  steps: [],
  i: 0,            // frame index: 0 is the overview, step k is frame k + 1
  sel: null,
  failing: false,
  timer: null,
  speed: 1700,
};

const NOTES = {
  login: [
    { heading: 'Point at', text: 'The browser never talks to the controller. Every arrow out of a client ends at the gateway.' },
    { heading: 'The line that lands', text: '2.7 makes this mandatory: direct component API calls return 401, and component-level basic auth and tokens are gone. Scripts that call the controller host directly must move to the gateway path before upgrading.' },
    { ask: 'Which scripts or integrations in your estate call the controller API directly today?' },
  ],
  launch: [
    { heading: 'Point at', text: 'The Receptor hop to the execution node is the one step that is not HTTP and does not touch the gateway.' },
    { heading: 'The line that lands', text: 'The SSH step at the end is exactly what Part 1 showed — AAP wraps that engine in identity, scheduling, content and audit.' },
    { ask: 'Where would your execution nodes need to sit to be close to the hosts they manage?' },
  ],
  eda: [
    { heading: 'Point at', text: 'EDA calls back through the gateway like any other client. It decides; the controller acts.' },
    { heading: 'The line that lands', text: 'The remediation is an ordinary, audited job — the same playbook a human would have run, minus the wait for a page.' },
    { ask: 'Which alert in your monitoring today always ends in the same manual fix?' },
  ],
  remote: [
    { heading: 'Point at', text: 'The arrow from the hop node to the remote execution node: that connection was opened from the remote side.' },
    { heading: 'The line that lands', text: 'One controller can manage many sites without inbound firewall rules at each one.' },
    { ask: 'How many network zones would need a hop node in your environment?' },
  ],
  ee: [
    { heading: 'Point at', text: 'Push and pull both go to the gateway host — the registry is part of the platform front door.' },
    { heading: 'The line that lands', text: 'The image you test with ansible-navigator is byte-for-byte the image the job runs.' },
    { ask: 'Who in your team would own building and versioning execution environments?' },
  ],
};

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

function rebuild(step) {
  state.steps = buildJourney(state.journey, state.topo, state.failed);
  el('scrub').max = String(state.steps.length);
  state.i = clamp(step === undefined ? 0 : step);
}

function selectJourney(id, step) {
  stop();
  state.journey = JOURNEYS.some((j) => j.id === id) ? id : JOURNEYS[0].id;
  const j = JOURNEYS.find((x) => x.id === state.journey);
  el('title').textContent = j.title;
  el('summary').textContent = j.summary;
  el('journeys').querySelectorAll('button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.id === state.journey)));
  el('notes-body').innerHTML = NOTES[state.journey].map((b) => (b.ask
    ? `<p class="ask">${esc(b.ask)}</p>` : `<h3>${esc(b.heading)}</h3><p>${esc(b.text)}</p>`)).join('');
  rebuild(step);
  render();
}

function selectTopo(id) {
  state.topo = TOPOLOGIES.some((t) => t.id === id) ? id : 'growth';
  el('topos').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === state.topo)));
  el('topo-caption').textContent = TOPOLOGIES.find((t) => t.id === state.topo).caption;
  const keep = state.i;
  rebuild(keep);
  render();
}

function toggleFailed(id) {
  if (nodeView(id, state.topo).absent) return;
  state.failed = state.failed.includes(id) ? state.failed.filter((x) => x !== id) : [...state.failed, id];
  state.sel = id;
  stop();
  rebuild(0);
  render();
}

const clamp = (n) => Math.max(0, Math.min(state.steps.length, Number.isNaN(+n) ? 0 : +n));

/* ------------------------------------------------------------------ */
/* Map                                                                 */
/* ------------------------------------------------------------------ */

const center = (n) => [n.x + n.w / 2, n.y + n.h / 2];

/** Point where the ray from the box centre towards (tx, ty) leaves the box. */
function border(n, tx, ty, pad = 3) {
  const [cx, cy] = center(n);
  const dx = tx - cx; const dy = ty - cy;
  const sx = dx ? (n.w / 2 + pad) / Math.abs(dx) : Infinity;
  const sy = dy ? (n.h / 2 + pad) / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return [cx + dx * s, cy + dy * s];
}

function edgeGeom(a, b, offset) {
  const na = nodeView(a, state.topo); const nb = nodeView(b, state.topo);
  const [bx, by] = center(nb); const [ax, ay] = center(na);
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const ox = (-(by - ay) / len) * offset; const oy = ((bx - ax) / len) * offset;
  const p1 = border(na, bx + ox, by + oy); const p2 = border(nb, ax + ox, ay + oy);
  return [[p1[0] + ox, p1[1] + oy], [p2[0] + ox, p2[1] + oy]];
}

function nodeStatus(id, cur, visited, inJourney) {
  const v = nodeView(id, state.topo);
  if (v.absent) return 'absent';
  const r = reach(id, state.topo, state.failed);
  const recoveredAt = state.steps.findIndex((s) => s.kind === 'recover' && s.to === id);
  if (cur && cur.kind === 'recover' && cur.to === id) return 'recover';
  if (!r.ok) return 'down';
  if (state.topo === 'operator' && state.failed.includes(id) && (recoveredAt < 0 || recoveredAt > state.i - 1)) return 'down';
  if (cur && (cur.from === id || [].concat(cur.to).includes(id))) return 'hot';
  if (visited.has(id)) return 'visited';
  if (inJourney.has(id)) return 'future';
  return v.optional ? 'optional' : 'idle';
}

function renderMap() {
  const steps = state.steps;
  const k = state.i - 1;                       // current step index, -1 on the overview
  const cur = steps[k];
  const ids = (s) => [s.from, ...[].concat(s.to)];
  const inJourney = new Set(steps.flatMap(ids));
  const visited = new Set(steps.slice(0, Math.max(0, k)).flatMap(ids));
  let out = '';

  // topology boundaries and network zones
  if (state.topo === 'growth') out += boundary(280, 26, 356, 366, 'one RHEL VM · Podman');
  if (state.topo === 'operator') out += boundary(280, 26, 356, 366, 'OpenShift cluster · AAP operator');
  if (state.topo === 'enterprise') out += `<text class="blabel" x="290" y="20">two of each component, separate VMs</text>`;
  out += zone(842, 48, 150, 158, 'managed hosts');
  out += zone(660, 218, 154, 72, 'DMZ');
  out += zone(660, 312, 336, 80, 'branch site');

  // edges: one per component pair, in its most important state
  const rank = { future: 0, done: 1, blocked: 2, active: 3 };
  const edges = new Map();
  steps.forEach((s, n) => {
    if (s.kind !== 'call' && s.kind !== 'blocked') return;
    [].concat(s.to).forEach((t) => {
      const st = n === k ? (s.kind === 'blocked' ? 'blocked' : 'active') : n < k ? 'done' : 'future';
      const key = `${s.from}>${t}`;
      const prev = edges.get(key);
      if (!prev || rank[st] > rank[prev.st]) edges.set(key, { a: s.from, b: t, st, label: n === k ? s.label : prev && prev.label });
    });
  });
  const drawn = [...edges.values()].sort((x, y) => rank[x.st] - rank[y.st]);
  drawn.forEach((e) => {
    const both = edges.has(`${e.b}>${e.a}`);
    const [p1, p2] = edgeGeom(e.a, e.b, both ? 5 : 0);
    const mk = { future: 'm-idle', done: 'm-done', active: 'm-active', blocked: 'm-blocked' }[e.st];
    out += `<path class="edge ${e.st}" d="M${p1[0].toFixed(1)} ${p1[1].toFixed(1)} L${p2[0].toFixed(1)} ${p2[1].toFixed(1)}" marker-end="url(#${mk})"/>`;
  });

  // nodes
  Object.keys(NODES).forEach((id) => {
    const v = nodeView(id, state.topo);
    const st = nodeStatus(id, cur, visited, inJourney);
    if (st === 'absent') return;
    const sel = state.sel === id ? ' selected' : '';
    const cx = v.x + v.w / 2;
    const tall = v.h > 80;
    const ty = tall ? v.y + v.h / 2 - 8 : v.y + (v.sub ? v.h / 2 - 7 : v.h / 2);
    out += `<g class="node ${st}${v.optional ? ' optional' : ''}${sel}" data-id="${id}" tabindex="0" role="button" aria-label="${esc(v.title)}">`
      + `<rect class="box" x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" rx="9"/>`
      + `<text class="t" x="${cx}" y="${ty}" text-anchor="middle" dominant-baseline="central">${esc(v.title)}</text>`
      + (v.sub ? `<text class="s" x="${cx}" y="${ty + 16}" text-anchor="middle" dominant-baseline="central">${esc(v.sub)}</text>` : '');
    if (state.topo === 'enterprise' && v.pair) {
      const onB = cur && cur.inst === 'b' && [].concat(cur.to).includes(id);
      const aDown = state.failed.includes(id);
      const px = v.x + v.w - 48; const py = tall ? v.y + v.h - 22 : v.y - 8;
      out += pill(px, py, 'a', aDown ? 'down' : '') + pill(px + 21, py, 'b', onB ? 'on' : '');
    }
    out += '</g>';
  });

  // the current step's motion and label
  if (cur) {
    if (cur.kind === 'call' || cur.kind === 'blocked') {
      const tos = [].concat(cur.to);
      tos.forEach((t) => {
        const both = edges.has(`${t}>${cur.from}`);
        const [p1, p2] = edgeGeom(cur.from, t, both ? 5 : 0);
        if (cur.kind === 'call') out += `<g class="packet" style="offset-path: path('M${p1[0].toFixed(1)} ${p1[1].toFixed(1)} L${p2[0].toFixed(1)} ${p2[1].toFixed(1)}')"><circle r="6"/></g>`;
        else out += xmark(p2[0], p2[1]);
      });
      const [p1, p2] = edgeGeom(cur.from, tos[0], 0);
      const [lx, ly] = labelSpot(p1, p2, cur.label, [cur.from, ...tos]);
      out += elabel(lx, ly, cur.label, cur.kind === 'blocked' ? 'blocked' : '');
    } else {
      const v = nodeView(cur.to, state.topo);
      const cx = v.x + v.w / 2;
      const lw = Math.max(40, cur.label.length * 6.7 + 14);
      const cy = v.y + v.h / 2;
      const [lx, ly] = bestSpot([[cx, v.y - 13], [cx, v.y + v.h + 13], [v.x + v.w + lw / 2 + 8, cy], [v.x - lw / 2 - 8, cy], [cx, v.y - 26], [cx, v.y + v.h + 26]], cur.label, [cur.to]);
      out += elabel(lx, ly, cur.label, cur.kind === 'recover' ? 'recover' : 'local');
    }
  }

  el('map-scene').innerHTML = out;
  el('map-scene').querySelectorAll('.node').forEach((g) => {
    const act = () => (state.failing ? toggleFailed(g.dataset.id) : select(g.dataset.id));
    g.addEventListener('click', act);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter') act(); });
  });
}

/* Slide the label along its edge until it no longer covers a component it
   is not about; fall back to the midpoint. */
/** Of several candidate centres, the first that covers no other component,
    else the one that covers least. */
function bestSpot(cands, text, skip) {
  const w = Math.max(40, text.length * 6.7 + 14); const h = 20;
  const boxes = Object.keys(NODES).filter((id) => !skip.includes(id) && !nodeView(id, state.topo).absent).map((id) => nodeView(id, state.topo));
  let best = null;
  for (const [x, y] of cands) {
    const o = boxes.reduce((sum, b) => {
      const ox = Math.min(x + w / 2, b.x + b.w) - Math.max(x - w / 2, b.x);
      const oy = Math.min(y + h / 2, b.y + b.h) - Math.max(y - h / 2, b.y);
      return sum + (ox > 0 && oy > 0 ? ox * oy : 0);
    }, 0);
    if (o === 0) return [x, y];
    if (!best || o < best[2]) best = [x, y, o];
  }
  return [best[0], best[1]];
}

function labelSpot(p1, p2, text, skip) {
  const cands = [];
  for (const f of [0.5, 0.35, 0.65, 0.22, 0.78, 0.1, 0.9]) {
    for (const dy of [-12, 12, -26, 26]) cands.push([p1[0] + (p2[0] - p1[0]) * f, p1[1] + (p2[1] - p1[1]) * f + dy]);
  }
  return bestSpot(cands, text, skip);
}

const boundary = (x, y, w, h, t) => `<rect class="boundary" x="${x}" y="${y}" width="${w}" height="${h}" rx="14"/><text class="blabel" x="${x + 12}" y="${y - 6}">${esc(t)}</text>`;
const zone = (x, y, w, h, t) => `<rect class="zone-r" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/><text class="blabel" x="${x + 8}" y="${y - 5}">${esc(t)}</text>`;
const pill = (x, y, t, cls) => `<g class="inst ${cls}"><rect x="${x}" y="${y}" width="18" height="15" rx="4"/><text x="${x + 9}" y="${y + 11}">${t}</text></g>`;
const xmark = (x, y) => `<path class="xmark" d="M${x - 7} ${y - 7} L${x + 7} ${y + 7} M${x + 7} ${y - 7} L${x - 7} ${y + 7}"/>`;
function elabel(x, y, t, cls) {
  const w = Math.max(40, t.length * 6.7 + 14);
  const cx = Math.min(1000 - w / 2 - 2, Math.max(w / 2 + 2, x));
  return `<g class="elabel ${cls}"><rect x="${(cx - w / 2).toFixed(1)}" y="${(y - 10).toFixed(1)}" width="${w.toFixed(1)}" height="20" rx="10"/>`
    + `<text x="${cx.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central">${esc(t)}</text></g>`;
}

/* ------------------------------------------------------------------ */
/* Sequence diagram                                                    */
/* ------------------------------------------------------------------ */

const LANE = {
  browser: 'Browser', cli: 'API / CLI', monitor: 'Monitoring', lb: 'LB', gateway: 'Gateway', controller: 'Controller',
  hub: 'Hub', eda: 'EDA', metrics: 'Metrics', postgres: 'PostgreSQL', redis: 'Redis', git: 'Git',
  exec1: 'Exec node', hop: 'Hop', exec2: 'Remote exec', web1: 'Hosts', web2: 'Hosts', db1: 'Hosts', edge1: 'edge1',
};
const laneOf = (id) => (['web1', 'web2', 'db1'].includes(id) ? 'hosts' : id);

function renderSeq() {
  const steps = state.steps;
  const k = state.i - 1;
  const lanes = [...new Set(steps.flatMap((s) => [s.from, ...[].concat(s.to)]).map(laneOf))]
    .sort((a, b) => {
      const na = NODES[a === 'hosts' ? 'web1' : a]; const nb = NODES[b === 'hosts' ? 'web1' : b];
      return na.x - nb.x || na.y - nb.y;
    });
  if (state.topo === 'operator') LANE.lb = 'Route';
  else LANE.lb = 'LB';
  const W = 760; const left = 26; const span = (W - left - 10) / lanes.length;
  const lx = (id) => left + span * (lanes.indexOf(laneOf(id)) + 0.5);
  const rowH = 30; const top = 6;
  const H = top + steps.length * rowH + 12;
  let out = '';
  let head = '';
  lanes.forEach((l) => {
    const x = left + span * (lanes.indexOf(l) + 0.5);
    const w = Math.min(span - 6, 90);
    out += `<line class="lane" x1="${x}" y1="0" x2="${x}" y2="${H - 6}"/>`;
    head += `<g class="lane-h"><rect x="${x - w / 2}" y="3" width="${w}" height="22" rx="6"/><text x="${x}" y="18">${esc(l === 'hosts' ? 'Hosts' : LANE[l])}</text></g>`;
  });
  const hs = el('seq-head');
  hs.setAttribute('viewBox', `0 0 ${W} 28`);
  hs.setAttribute('height', String(28 * (hs.clientWidth || W) / W));
  hs.innerHTML = head;
  steps.forEach((s, n) => {
    const y = top + n * rowH + rowH / 2;
    const cls = n === k ? 'cur' : n < k ? 'done' : 'future';
    out += `<g class="srow ${cls} ${s.kind}" data-row="${n}"><rect class="bg" x="0" y="${y - rowH / 2}" width="${W}" height="${rowH}" rx="4"/>`;
    out += `<text class="num" x="4" y="${y + 4}">${n + 1}</text>`;
    if (s.kind === 'call' || s.kind === 'blocked') {
      const x1 = lx(s.from); const x2 = lx([].concat(s.to)[0]);
      const dir = x2 >= x1 ? 1 : -1;
      out += `<line x1="${x1}" y1="${y + 5}" x2="${x2 - dir * 6}" y2="${y + 5}"/>`;
      out += `<path class="sa" d="M${x2} ${y + 5} L${x2 - dir * 8} ${y + 1} L${x2 - dir * 8} ${y + 9} z"/>`;
      out += `<text class="lbl" x="${(x1 + x2) / 2}" y="${y - 2}">${esc(s.label)}${s.inst === 'b' ? ' (b)' : ''}</text>`;
      if (s.kind === 'blocked') out += `<path class="xmark" d="M${x2 - 5} ${y} L${x2 + 5} ${y + 10} M${x2 + 5} ${y} L${x2 - 5} ${y + 10}"/>`;
    } else {
      const x = lx(s.to);
      const w = Math.min(Math.max(70, s.label.length * 6.2 + 12), span * 1.8);
      out += `<rect class="self" x="${x - w / 2}" y="${y - 9}" width="${w}" height="18" rx="5"/>`;
      out += `<text class="lbl" x="${x}" y="${y + 4}">${esc(s.label)}</text>`;
    }
    out += '</g>';
  });
  const svg = el('seq');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('height', String(H * (svg.clientWidth || W) / W));
  svg.innerHTML = out;
  const row = svg.querySelector('.srow.cur');
  const wrap = el('seq-wrap');
  if (row) {
    const ratio = (svg.clientWidth || W) / W;
    const y = (top + k * rowH) * ratio;
    wrap.scrollTop = Math.max(0, y - wrap.clientHeight / 2);
  } else wrap.scrollTop = 0;
}

/* ------------------------------------------------------------------ */
/* Narration, info card, failures                                      */
/* ------------------------------------------------------------------ */

function select(id) { state.sel = id; renderMap(); renderInfo(); }

function renderInfo() {
  const cur = state.steps[state.i - 1];
  const id = state.sel || (cur ? [].concat(cur.to)[0] : 'gateway');
  const v = nodeView(id, state.topo);
  const r = reach(id, state.topo, state.failed);
  el('info-title').textContent = v.title;
  const failedHere = state.failed.includes(id) || !r.ok;
  const word = v.absent ? 'not deployed' : !r.ok ? 'down' : r.inst === 'b' ? 'a down · b serving' : r.recover ? 'recreated by operator' : 'ok';
  el('info-state').textContent = word;
  el('info-state').className = `pill ${failedHere && !r.ok ? 'down' : 'ok'}`;
  el('info-body').textContent = INFO[id] + (v.absent ? ' Not part of the growth topology.' : '') + (r.ok ? '' : ` ${r.why}`);
}

function renderFailed() {
  el('failed').innerHTML = state.failed.length
    ? `failed: ${state.failed.map((f) => esc(NODES[f].title)).join(', ')} <button id="clear-failed">clear</button>`
    : '';
  const b = el('clear-failed');
  if (b) b.onclick = clearFailed;
}

function clearFailed() { state.failed = []; stop(); rebuild(0); render(); }

function render() {
  const cur = state.steps[state.i - 1];
  const j = JOURNEYS.find((x) => x.id === state.journey);
  const topo = TOPOLOGIES.find((t) => t.id === state.topo);
  if (cur) {
    el('note').textContent = cur.note;
    el('badge').textContent = cur.badge || '';
  } else {
    const blocked = state.steps.some((s) => s.kind === 'blocked');
    el('note').textContent = `${j.title} on ${topo.label}: ${state.steps.length} steps${state.failed.length ? `, with ${state.failed.map((f) => NODES[f].title).join(' and ')} failed` : ''}`;
    el('badge').textContent = blocked ? 'The faint path is the plan. Press play to see how far the request gets.' : 'The faint path shows every hop this journey will take. Press play to follow it.';
  }
  renderMap();
  renderSeq();
  renderInfo();
  renderFailed();
  el('scrub').value = String(state.i);
  el('counter').textContent = `${state.i} / ${state.steps.length}`;
  writeHash();
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

function step(d) { stop(); state.i = clamp(state.i + d); state.sel = null; render(); }
function jump(v) { stop(); state.i = clamp(v); state.sel = null; render(); }
function stop() { if (state.timer) clearInterval(state.timer); state.timer = null; el('btn-play').textContent = '▶'; }

/* At the end, play moves on to the next journey - Space all the way through. */
function play() {
  if (state.timer) { stop(); return; }
  if (state.i >= state.steps.length) {
    const n = JOURNEYS.findIndex((j) => j.id === state.journey);
    if (n === JOURNEYS.length - 1) { jump(0); return; }
    selectJourney(JOURNEYS[n + 1].id, 0);
  }
  el('btn-play').textContent = '❙❙';
  state.timer = setInterval(() => {
    if (state.i >= state.steps.length) { stop(); return; }
    state.i += 1; state.sel = null; render();
  }, state.speed);
}

function setSpeed(ms) {
  state.speed = ms;
  document.documentElement.style.setProperty('--frame-ms', `${ms}ms`);
  if (state.timer) { stop(); play(); }
}

/* ------------------------------------------------------------------ */
/* Deep links                                                          */
/* ------------------------------------------------------------------ */

let suppress = false;
function writeHash() {
  suppress = true;
  location.replace(`#${state.journey}/${state.topo}/${state.failed.join(',') || '-'}/${state.i}`);
  setTimeout(() => { suppress = false; }, 0);
}
function readHash() {
  const [j, t, f, s] = decodeURIComponent(location.hash.slice(1)).split('/');
  if (!j || !JOURNEYS.some((x) => x.id === j)) return false;
  state.failed = f && f !== '-' ? f.split(',').filter((x) => NODES[x]) : [];
  state.topo = TOPOLOGIES.some((x) => x.id === t) ? t : 'growth';
  syncTopoButtons();
  selectJourney(j, s);
  return true;
}
function syncTopoButtons() {
  el('topos').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === state.topo)));
  el('topo-caption').textContent = TOPOLOGIES.find((t) => t.id === state.topo).caption;
}

/* ------------------------------------------------------------------ */
/* Chrome and wiring                                                   */
/* ------------------------------------------------------------------ */

function toggleFailing(force) {
  state.failing = force !== undefined ? force : !state.failing;
  el('btn-fail').setAttribute('aria-pressed', String(state.failing));
  document.body.classList.toggle('failing', state.failing);
}
function toggleTheme() {
  const r = document.documentElement;
  r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('theme', r.dataset.theme); } catch (e) { /* private mode */ }
}
function toggleNotes() { const p = el('notes-panel'); p.hidden = !p.hidden; el('btn-notes').setAttribute('aria-pressed', String(!p.hidden)); }
function togglePresent(force) {
  const on = force !== undefined ? force : !document.body.classList.contains('presenting');
  document.body.classList.toggle('presenting', on);
  el('btn-present').setAttribute('aria-pressed', String(on));
}
function toggleHelp(force) { el('help').hidden = force !== undefined ? !force : !el('help').hidden; }

function wire() {
  el('journeys').innerHTML = JOURNEYS.map((j, n) =>
    `<li><button data-id="${j.id}"><span class="num">${String(n + 1).padStart(2, '0')}</span>${esc(j.title)}</button></li>`).join('');
  el('journeys').querySelectorAll('button').forEach((b) => { b.onclick = () => selectJourney(b.dataset.id); });
  el('topos').innerHTML = TOPOLOGIES.map((t, n) =>
    `<button role="radio" data-id="${t.id}" aria-checked="false"><span class="key">${n + 1}</span>${esc(t.label)}</button>`).join('');
  el('topos').querySelectorAll('button').forEach((b) => { b.onclick = () => selectTopo(b.dataset.id); });

  el('btn-play').onclick = play;
  el('btn-prev').onclick = () => step(-1);
  el('btn-next').onclick = () => step(1);
  el('scrub').oninput = (e) => jump(e.target.value);
  el('speed').onchange = (e) => setSpeed(parseInt(e.target.value, 10));
  el('btn-fail').onclick = () => toggleFailing();
  el('btn-theme').onclick = toggleTheme;
  el('btn-notes').onclick = toggleNotes;
  el('btn-present').onclick = () => togglePresent();
  el('btn-help').onclick = () => toggleHelp(true);
  el('help-close').onclick = () => toggleHelp(false);
  el('help').onclick = (e) => { if (e.target === el('help')) toggleHelp(false); };
  window.addEventListener('hashchange', () => { if (!suppress) readHash(); });
  window.addEventListener('resize', () => renderSeq());

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea') || e.metaKey || e.ctrlKey) return;
    const k = e.key; const l = k.toLowerCase();
    if (k === ' ') { e.preventDefault(); play(); return; }
    if (k === 'ArrowRight') { step(1); return; }
    if (k === 'ArrowLeft') { step(-1); return; }
    if (k === 'Home') { jump(0); return; }
    if (k === 'End') { jump(state.steps.length); return; }
    if (/^[1-3]$/.test(k)) { selectTopo(TOPOLOGIES[+k - 1].id); return; }
    if (l === 'x') { toggleFailing(); return; }
    if (l === 'c') { clearFailed(); return; }
    if (l === 'n') { toggleNotes(); return; }
    if (l === 't') { toggleTheme(); return; }
    if (l === 'f') { togglePresent(); return; }
    if (k === '?') { toggleHelp(true); return; }
    if (k === 'Escape') { if (!el('help').hidden) toggleHelp(false); else if (state.failing) toggleFailing(false); else togglePresent(false); return; }
    if (l === 'j' || l === 'k') {
      const n = JOURNEYS.findIndex((j) => j.id === state.journey);
      selectJourney(JOURNEYS[(n + (l === 'k' ? 1 : JOURNEYS.length - 1)) % JOURNEYS.length].id);
    }
  });
}

(function boot() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved) document.documentElement.dataset.theme = saved;
    else if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.dataset.theme = 'dark';
  } catch (e) { /* ignore */ }
  wire();
  setSpeed(state.speed);
  syncTopoButtons();
  if (!readHash()) selectJourney(JOURNEYS[0].id);
}());
