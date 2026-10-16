/**
 * Shared SVG builders for the Ansible animations.
 *
 * Every helper returns a string and uses semantic classes only - no literal
 * colours - so light and dark both work. Attribute order on <rect>, <text>
 * and <line> is x, y, width, height / x1, y1, x2, y2 on purpose: that is the
 * order tools/check-bounds.mjs reads.
 *
 * Box states map onto the CSS ramps:
 *   run  - healthy / ok           term - changed / busy
 *   pend - idle / waiting         bad  - failed / refused
 *   hot  - the thing this frame is about
 *   off  - not deployed / not in play
 */

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** A state-carrying box with a centred title and optional sub line. */
export function box(x, y, w, h, { state = 'pend', title = '', sub = '', sub2 = '', cls = '', rx = 8, titleCls = 'svg-title' } = {}) {
  const cx = x + w / 2;
  const lines = [title, sub, sub2].filter(Boolean).length;
  const step = 15;
  let ty = y + h / 2 - ((lines - 1) * step) / 2;
  let out = `<g class="pod ${state} ${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;
  if (title) { out += `<text class="${titleCls}" x="${cx}" y="${ty}" text-anchor="middle" dominant-baseline="central">${esc(title)}</text>`; ty += step; }
  if (sub) { out += `<text class="svg-tiny" x="${cx}" y="${ty}" text-anchor="middle" dominant-baseline="central">${esc(sub)}</text>`; ty += step; }
  if (sub2) { out += `<text class="svg-tiny" x="${cx}" y="${ty}" text-anchor="middle" dominant-baseline="central">${esc(sub2)}</text>`; }
  return `${out}</g>`;
}

/** A dashed backdrop that groups boxes: a network zone, a host, a cluster. */
export function zone(x, y, w, h, label = '', { cls = '' } = {}) {
  let out = `<rect class="zone ${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>`;
  if (label) out += `<text class="zone-label" x="${x + 10}" y="${y + 16}">${esc(label)}</text>`;
  return out;
}

const MARK = { idle: 'arrow', active: 'arrow-active', blocked: 'arrow-blocked', ok: 'arrow-ok' };

/** A straight connector with an arrowhead. state: idle | active | blocked | ok */
export function arrow(x1, y1, x2, y2, { state = 'idle', label = '', lx, ly, anchor = 'middle', both = false } = {}) {
  const cls = state === 'idle' ? '' : state;
  const start = both ? ` marker-start="url(#${MARK[state]})"` : '';
  let out = `<line class="flow-line ${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#${MARK[state]})"${start}/>`;
  if (label) {
    const tx = lx ?? (x1 + x2) / 2;
    const ty = ly ?? (y1 + y2) / 2 - 6;
    out += `<text class="flow-label ${cls}" x="${tx}" y="${ty}" text-anchor="${anchor}">${esc(label)}</text>`;
  }
  return out;
}

/** An elbow or free-form connector from an SVG path string. */
export function route(d, { state = 'idle', label = '', lx = 0, ly = 0, anchor = 'middle' } = {}) {
  const cls = state === 'idle' ? '' : state;
  let out = `<path class="flow-line ${cls}" d="${d}" marker-end="url(#${MARK[state]})"/>`;
  if (label) out += `<text class="flow-label ${cls}" x="${lx}" y="${ly}" text-anchor="${anchor}">${esc(label)}</text>`;
  return out;
}

/** A dot (plus optional label) that travels a path once during the frame. */
export function packet(d, label = '') {
  const t = label ? `<text text-anchor="middle" dy="-10">${esc(label)}</text>` : '';
  return `<g class="packet" style="offset-path: path('${d}')"><circle r="6"/>${t}</g>`;
}

/** Straight-line path string helper, for packets that follow a connector. */
export const seg = (...pts) => `M${pts.map(([x, y]) => `${x} ${y}`).join(' L')}`;

export function label(x, y, s, { cls = 'svg-sub on-node', anchor = 'start' } = {}) {
  return `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${esc(s)}</text>`;
}

/** A small ok / changed / failed / skipping stamp, Ansible-recap style. */
/** fresh: true only on the frame it first shows - every frame repaints, so a
    fade on a persistent element would replay on every step. */
export function stamp(x, y, kind, { anchor = 'middle', fresh = false } = {}) {
  if (!kind) return '';
  const word = { ok: 'ok', changed: 'changed', failed: 'failed', skip: 'skipping', unreachable: 'unreachable' }[kind] || kind;
  const cls = kind === 'unreachable' ? 'failed' : kind;
  return `<text class="stamp ${cls}${fresh ? ' appear' : ''}" x="${x}" y="${y}" text-anchor="${anchor}">${esc(word)}</text>`;
}

export function legend(s, y = 330, x = 20) {
  return `<text class="legend-text" x="${x}" y="${y}">${esc(s)}</text>`;
}
