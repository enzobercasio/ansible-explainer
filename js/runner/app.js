/**
 * Playbook Runner UI.
 *
 * Holds a chapter and a history of fired actions, asks the engine to replay
 * them into frames, and paints one frame at a time: the file and line being
 * executed, the fleet, and the terminal. Nothing here simulates Ansible -
 * see engine.js for that.
 *
 * URL: #chapter-id/action.action.action/step
 */
import { chapters } from './chapters.js';
import { replay } from './engine.js';

const el = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const state = {
  ch: null,
  history: [],
  frames: [],
  runs: [],
  i: 0,
  timer: null,
  speed: 1500,
  viewFile: null,   // a tab the presenter clicked; cleared when the frame moves to another file
};

/* ------------------------------------------------------------------ */
/* Chapters and actions                                                */
/* ------------------------------------------------------------------ */

function buildSidebar() {
  el('chapters').innerHTML = chapters.map((c, n) =>
    `<li><button data-id="${c.id}"><span class="num">${String(n + 1).padStart(2, '0')}</span>${esc(c.title)}</button></li>`).join('');
  el('chapters').querySelectorAll('button').forEach((b) => { b.onclick = () => selectChapter(b.dataset.id); });
}

function selectChapter(id, history = [], step) {
  stop();
  state.ch = chapters.find((c) => c.id === id) || chapters[0];
  state.history = history.filter((h) => state.ch.actions.some((a) => a.id === h));
  state.viewFile = null;
  el('title').textContent = state.ch.title;
  el('summary').textContent = state.ch.summary;
  el('chapters').querySelectorAll('button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.id === state.ch.id)));
  el('notes-body').innerHTML = state.ch.notes.map((b) => (b.ask
    ? `<p class="ask">${esc(b.ask)}</p>` : `<h3>${esc(b.heading)}</h3><p>${esc(b.text)}</p>`)).join('');
  rebuild();
  state.i = clamp(step === undefined ? 0 : step);
  render();
}

function rebuild() {
  const { frames, runs } = replay(state.ch, state.history);
  state.frames = frames;
  state.runs = runs;
  el('scrub').max = String(frames.length - 1);
  buildActions();
}

/* The suggested next action is the next script entry not yet taken, in
   order. Once the presenter goes off-script, nothing is suggested. */
function suggested() {
  const s = state.ch.script || [];
  const h = state.history;
  for (let k = 0; k < h.length; k += 1) if (s[k] !== h[k]) return null;
  return s[h.length] || null;
}

function buildActions() {
  const next = suggested();
  el('actions').innerHTML = state.ch.actions.map((a, n) =>
    `<button class="action kind-${a.kind}${a.id === next ? ' suggested' : ''}" data-id="${a.id}" title="${esc(a.note)}">`
    + `<span class="key">${n + 1}</span><span class="lbl">${esc(a.label)}</span></button>`).join('');
  el('actions').querySelectorAll('button').forEach((b) => { b.onclick = () => fire(b.dataset.id); });
  el('history').innerHTML = state.history.length
    ? `history: ${state.history.map((id) => `<b>${esc(state.ch.actions.find((a) => a.id === id).label)}</b>`).join(' → ')}`
    : 'history: nothing run yet';
}

function fire(id, keepPlaying = true) {
  state.history = [...state.history, id];
  rebuild();
  state.i = state.runs[state.runs.length - 1];
  state.viewFile = null;
  render();
  if (keepPlaying) play(true);
}

function resetChapter() { selectChapter(state.ch.id, []); }

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

const clamp = (n) => Math.max(0, Math.min(state.frames.length - 1, Number.isNaN(+n) ? 0 : +n));

function render() {
  const f = state.frames[state.i];
  const prev = state.frames[state.i - 1];
  renderCode(f);
  renderFleet(f, prev);
  renderTerm(f);
  el('note').textContent = f.note || '';
  el('badge').textContent = f.badge || '';
  el('scrub').value = String(state.i);
  el('counter').textContent = `${state.i + 1} / ${state.frames.length}`;
  writeHash();
}

function renderCode(f) {
  const files = Object.keys(f.files);
  const shown = state.viewFile && f.files[state.viewFile] !== undefined ? state.viewFile : f.file;
  el('tabs').innerHTML = files.map((n) =>
    `<button role="tab" data-file="${esc(n)}" aria-selected="${n === shown}" class="${n === f.file && f.hl ? 'active-file' : ''}">${esc(n)}</button>`).join('');
  el('tabs').querySelectorAll('button').forEach((b) => {
    b.onclick = () => { state.viewFile = b.dataset.file; renderCode(state.frames[state.i]); };
  });
  const sel = el('tabs').querySelector('[aria-selected="true"]');
  if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });

  const hl = shown === f.file ? f.hl : null;
  const lines = (f.files[shown] || '').split('\n');
  el('code').innerHTML = lines.map((l, n) => {
    const on = hl && n >= hl[0] && n <= hl[1];
    return `<span class="cl${on ? ' hl' : ''}${on && n === hl[0] ? ' first' : ''}"><span class="gut"></span><span class="ln">${n + 1}</span><span>${highlight(l, shown)}</span></span>`;
  }).join('');
  if (hl) {
    const first = el('code').children[hl[0]];
    const box = el('code');
    const target = first.offsetTop - box.clientHeight / 3;
    box.scrollTop = Math.max(0, target);
  }
}

/* A readability aid, not a parser: comments, keys, list markers, Jinja and
   INI section headers. Anything else stays plain. */
function highlight(line, file) {
  if (!line) return '&nbsp;';
  if (file.endsWith('.ini')) {
    return /^\s*\[.*\]/.test(line) ? `<span class="yk">${esc(line)}</span>` : esc(line);
  }
  const jinja = (s) => esc(s).replace(/\{\{(.*?)\}\}/g, '<span class="yj">{{$1}}</span>');
  const c = line.match(/^(\s*)(#.*)$/);
  if (c) return `${esc(c[1])}<span class="yc">${esc(c[2])}</span>`;
  const kv = line.match(/^(\s*)(- )?([\w.\/'\[\]-]+)(:)(.*)$/);
  if (kv) {
    const [, ind, dash, key, colon, rest] = kv;
    const tc = rest.match(/^(.*?)(\s+#.*)$/);
    const val = tc ? tc[1] : rest;
    return `${esc(ind)}${dash ? '<span class="ym">- </span>' : ''}<span class="yk">${esc(key)}</span>${colon}${jinja(val)}${tc ? `<span class="yc">${esc(tc[2])}</span>` : ''}`;
  }
  const li = line.match(/^(\s*)(- )(.*)$/);
  if (li) return `${esc(li[1])}<span class="ym">- </span>${jinja(li[3])}`;
  return jinja(line);
}

const STATUS_WORD = {
  idle: '', targeted: 'targeted', excluded: 'not targeted', busy: 'running', ok: 'ok',
  changed: 'changed', failed: 'failed', skipped: 'skipping', drift: 'drifted',
};

function renderFleet(f, prev) {
  el('fleet').innerHTML = f.hosts.map((h) => {
    const before = prev && prev.hosts.find((p) => p.name === h.name);
    const status = h.act && !['ok', 'changed', 'failed', 'skipped'].includes(h.status) ? 'busy' : h.status;
    const word = STATUS_WORD[status];
    const rows = h.rows.map(([k, v, tone]) => {
      const was = before && before.rows.find((r) => r[0] === k);
      const flip = was && was[1] !== v ? ' flip' : '';
      return `<dt>${esc(k)}</dt><dd class="${tone}${flip}" title="${esc(v)}">${esc(v)}</dd>`;
    }).join('');
    const act = h.act ? `<div class="act" aria-hidden="true"><span>ssh</span><span>${esc(h.act)}</span><span>json</span></div>` : '';
    return `<article class="host ${status}" aria-label="${esc(h.name)} ${esc(word)}">`
      + `${word ? `<span class="status">${esc(word)}</span>` : ''}`
      + `<div class="host-head"><span class="host-name">${esc(h.name)}</span><span class="host-os">${esc(h.os)}</span></div>`
      + `<div class="chips">${h.groups.map((g) => `<span class="chip">${esc(g)}</span>`).join('')}</div>`
      + `<dl class="rows">${rows}</dl>${act}</article>`;
  }).join('');
}

function renderTerm(f) {
  const n = f.term.length;
  const freshFrom = n - f.fresh;
  const gap = Math.min(110, (state.speed * 0.55) / Math.max(1, f.fresh));
  el('term').innerHTML = f.term.map((l, k) => {
    const isNew = k >= freshFrom;
    const style = isNew ? ` style="animation-delay:${Math.round((k - freshFrom) * gap)}ms"` : '';
    return `<span class="tl t-${l.c}${isNew ? ' new' : ''}"${style}>${esc(l.t) || ' '}</span>`;
  }).join('') + '<span class="caret" aria-hidden="true"></span>';
  const t = el('term');
  t.scrollTop = t.scrollHeight;
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

function step(d) { stop(); state.i = clamp(state.i + d); state.viewFile = null; render(); }
function jump(v) { stop(); state.i = clamp(v); state.viewFile = null; render(); }

function stop() {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  el('btn-play').textContent = '▶';
}

/* Play runs to the end of the frames. At the end, if the chapter script has a
   next action, play fires it - so a presenter can just keep pressing Space. */
function play(force) {
  if (state.timer && !force) { stop(); return; }
  if (state.timer) clearInterval(state.timer);
  if (state.i >= state.frames.length - 1) {
    const next = suggested();
    if (!next) { stop(); return; }
    fire(next, false);
  }
  el('btn-play').textContent = '❙❙';
  state.timer = setInterval(() => {
    if (state.i >= state.frames.length - 1) { stop(); return; }
    state.i += 1;
    state.viewFile = null;
    render();
  }, state.speed);
}

function setSpeed(ms) {
  state.speed = ms;
  document.documentElement.style.setProperty('--frame-ms', `${ms}ms`);
  if (state.timer) play(true);
}

/* ------------------------------------------------------------------ */
/* Deep links                                                          */
/* ------------------------------------------------------------------ */

let suppress = false;
function writeHash() {
  suppress = true;
  location.replace(`#${state.ch.id}/${state.history.join('.') || '-'}/${state.i}`);
  setTimeout(() => { suppress = false; }, 0);
}

function readHash() {
  const [id, hist, s] = decodeURIComponent(location.hash.slice(1)).split('/');
  if (!id || !chapters.some((c) => c.id === id)) return false;
  selectChapter(id, hist && hist !== '-' ? hist.split('.') : [], s);
  return true;
}

/* ------------------------------------------------------------------ */
/* Chrome                                                              */
/* ------------------------------------------------------------------ */

function toggleTheme() {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch (e) { /* private mode */ }
}
function toggleNotes(force) {
  const p = el('notes-panel');
  const open = force !== undefined ? force : p.hidden;
  p.hidden = !open;
  el('btn-notes').setAttribute('aria-pressed', String(open));
}
function togglePresent(force) {
  const on = force !== undefined ? force : !document.body.classList.contains('presenting');
  document.body.classList.toggle('presenting', on);
  el('btn-present').setAttribute('aria-pressed', String(on));
}
function toggleHelp(force) { el('help').hidden = force !== undefined ? !force : !el('help').hidden; }

function wire() {
  el('btn-play').onclick = () => play();
  el('btn-prev').onclick = () => step(-1);
  el('btn-next').onclick = () => step(1);
  el('scrub').oninput = (e) => jump(e.target.value);
  el('speed').onchange = (e) => setSpeed(parseInt(e.target.value, 10));
  el('btn-reset').onclick = resetChapter;
  el('btn-theme').onclick = toggleTheme;
  el('btn-notes').onclick = () => toggleNotes();
  el('btn-present').onclick = () => togglePresent();
  el('btn-help').onclick = () => toggleHelp(true);
  el('help-close').onclick = () => toggleHelp(false);
  el('help').onclick = (e) => { if (e.target === el('help')) toggleHelp(false); };
  window.addEventListener('hashchange', () => { if (!suppress) readHash(); });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea') || e.metaKey || e.ctrlKey) return;
    const k = e.key;
    if (k === ' ') { e.preventDefault(); play(); return; }
    if (k === 'ArrowRight') { step(1); return; }
    if (k === 'ArrowLeft') { step(-1); return; }
    if (k === 'Home') { jump(0); return; }
    if (k === 'End') { jump(state.frames.length - 1); return; }
    if (/^[1-9]$/.test(k)) { const a = state.ch.actions[+k - 1]; if (a) fire(a.id); return; }
    const l = k.toLowerCase();
    if (l === 'r') { resetChapter(); return; }
    if (l === 'n') { toggleNotes(); return; }
    if (l === 't') { toggleTheme(); return; }
    if (l === 'f') { togglePresent(); return; }
    if (k === '?') { toggleHelp(true); return; }
    if (k === 'Escape') {
      if (!el('help').hidden) toggleHelp(false);
      else togglePresent(false);
      return;
    }
    if (l === 'j' || l === 'k') {
      const idx = chapters.findIndex((c) => c.id === state.ch.id);
      const next = (l === 'k' ? idx + 1 : idx - 1 + chapters.length) % chapters.length;
      selectChapter(chapters[next].id);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

(function boot() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved) document.documentElement.dataset.theme = saved;
    else if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.dataset.theme = 'dark';
  } catch (e) { /* ignore */ }
  buildSidebar();
  wire();
  setSpeed(state.speed);
  if (!readHash()) selectChapter(chapters[0].id);
}());
