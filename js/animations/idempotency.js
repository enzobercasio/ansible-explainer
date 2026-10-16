/**
 * Idempotency: run it twice, get the same result.
 *
 * The same playbook is run three times against one host. Declarative modules
 * change things on the first run, report ok on the second, and repair only
 * what drifted on the third. A shell one-liner does not know what "already
 * done" means, so it changes something on every run - the anti-pattern mode -
 * and lineinfile is the fix.
 *
 * Frame shape:
 *   { run, task, grid: [[result per run] per task], host: { key: [state, text] }, fresh, note, badge, focus }
 *   result: '' | 'ok' | 'changed' ;  fresh: [taskIndex, runIndex] of the cell that just landed
 */
import { box, zone, label, legend, arrow, packet, seg } from './lib/draw.js';

const MODES = [
  { id: 'declarative', label: 'Desired state, run three times',
    caption: 'Run 1 builds it, run 2 finds nothing to do, run 3 repairs only what drifted' },
  { id: 'shell', label: 'shell: echo >>', antiPattern: true,
    caption: 'A command that appends a line has no idea whether the line is already there' },
  { id: 'lineinfile', label: 'The fix: lineinfile',
    caption: 'Describe the line that should exist — the module works out whether to add it' },
];

const TASKS = {
  declarative: ['dnf: nginx present', 'template: nginx.conf', 'service: started'],
  shell: ['shell: echo … >> motd'],
  lineinfile: ['lineinfile: banner line'],
};

function declarativeFrames() {
  const f = [];
  const grid = [['', '', ''], ['', '', ''], ['', '', '']];
  const host = { pkg: ['bad', 'nginx: absent'], conf: ['bad', 'nginx.conf: missing'], svc: ['bad', 'nginx: stopped'] };
  const snap = (o) => f.push({ run: -1, task: -1, fresh: null, grid: grid.map((r) => [...r]), host: { ...host }, ...o });

  snap({ note: 'A fresh host: nginx is not installed, configured or running',
    badge: 'Each task describes an end state. None of them says "run this command".' });
  const results1 = [['pkg', 'nginx: installed'], ['conf', 'nginx.conf: v1'], ['svc', 'nginx: running']];
  const focus = [['state: present'], ['dest: /etc/nginx/nginx.conf'], ['state: started']];
  results1.forEach(([k, v], t) => {
    grid[t][0] = 'changed'; host[k] = ['term', v];
    snap({ run: 0, task: t, fresh: [t, 0], focus: focus[t],
      note: `Run 1 · ${TASKS.declarative[t]} → changed`,
      badge: t === 0 ? 'The module checks: is nginx installed? No — so it installs it and reports changed.' : t === 1 ? 'The rendered file differs from what is on disk (nothing), so it is written.' : 'The service is stopped, so it is started.' });
  });
  Object.keys(host).forEach((k) => { host[k] = ['run', host[k][1]]; });
  [0, 1, 2].forEach((t) => {
    grid[t][1] = 'ok';
    snap({ run: 1, task: t, fresh: [t, 1],
      note: `Run 2 · ${TASKS.declarative[t]} → ok`,
      badge: t === 0 ? 'Same playbook, same host. nginx is already installed — nothing to do.' : t === 2 ? 'Run 2 changed nothing. That is idempotency: safe to run again, any time.' : 'The checksum matches what is on disk, so the file is left alone.' });
  });
  host.svc = ['bad', 'nginx: stopped'];
  snap({ run: -1, task: -1, focus: ['state: started'],
    note: 'Someone logs in and stops nginx by hand',
    badge: 'Configuration drift. The playbook still describes the state you actually want.' });
  [0, 1, 2].forEach((t) => {
    grid[t][2] = t === 2 ? 'changed' : 'ok';
    if (t === 2) host.svc = ['run', 'nginx: running'];
    snap({ run: 2, task: t, fresh: [t, 2],
      note: `Run 3 · ${TASKS.declarative[t]} → ${t === 2 ? 'changed' : 'ok'}`,
      badge: t === 2 ? 'Only the drifted piece is repaired. Run it on a schedule and drift heals itself.' : 'Still matches — untouched.' });
  });
  return f;
}

function lineFrames(modeId) {
  const f = [];
  const bad = modeId === 'shell';
  const grid = [['', '', '']];
  let lines = 0;
  const snap = (o) => f.push({ run: -1, task: -1, fresh: null, grid: grid.map((r) => [...r]), host: { motd: [lines > 1 ? 'bad' : lines ? 'run' : 'pend', `/etc/motd: ${lines} banner line${lines === 1 ? '' : 's'}`] }, ...o });

  snap({ focus: [bad ? 'ansible.builtin.shell:' : 'ansible.builtin.lineinfile:'],
    note: bad ? 'The goal: one "Authorized use only" line in /etc/motd' : 'Same goal, written as a desired state',
    badge: bad ? 'Written as a shell command that appends the line.' : 'lineinfile describes the line that must exist in the file.' });
  for (let r = 0; r < 3; r += 1) {
    if (bad || r === 0) lines += 1;
    grid[0][r] = bad || r === 0 ? 'changed' : 'ok';
    const n = r + 1;
    snap({ run: r, task: 0, fresh: [0, r], focus: bad ? (r === 0 ? ['echo'] : ['>> /etc/motd']) : (r === 0 ? ['line:'] : ['regexp:']),
      note: bad
        ? `Run ${n} → changed. The file now has ${lines} copies of the line`
        : `Run ${n} → ${r === 0 ? 'changed: the line is added' : 'ok: the line is already there'}`,
      badge: bad
        ? (r === 0 ? 'Looks fine after one run — which is why this pattern survives review.' : r === 1 ? 'shell and command always report changed: they cannot know what "done" looks like.' : 'Every scheduled run makes it worse, and the recap can never tell you whether anything really changed.')
        : (r === 0 ? 'The module reads the file first, finds no match, and appends.' : 'regexp finds the existing line. No edit, no changed — the recap is now trustworthy.') });
  }
  snap({ focus: bad ? ['creates:'] : ['state: present'],
    note: bad ? 'If you must use shell, tell Ansible how to know it is done' : 'Prefer a module over a command whenever one exists',
    badge: bad ? 'creates:/removes: skip the command when a file exists, and changed_when: describes what a change means. A purpose-built module is still better.' : 'Thousands of modules exist precisely so you do not have to script the "is it already done?" check yourself.' });
  return f;
}

function buildFrames(modeId) {
  return modeId === 'declarative' ? declarativeFrames() : lineFrames(modeId);
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

const RUN_X = [270, 356, 442];
const CELL = { ok: 'run', changed: 'term', '': 'pend' };

function renderSVG(frame) {
  let out = '';
  const rowsY = frame.grid.length === 3 ? [72, 128, 184] : [128];

  RUN_X.forEach((x, r) => out += label(x + 38, 56, `run ${r + 1}`, { cls: 'svg-title on-node', anchor: 'middle' }));
  frame.grid.forEach((row, t) => {
    const title = frame.grid.length === 3 ? TASKS.declarative[t] : frame.taskName;
    out += box(20, rowsY[t], 230, 42, { state: frame.task === t ? 'hot' : 'pend', title, titleCls: 'mono' });
    row.forEach((s, r) => {
      const fresh = frame.fresh && frame.fresh[0] === t && frame.fresh[1] === r;
      out += box(RUN_X[r], rowsY[t], 76, 42, { state: CELL[s], title: s, cls: fresh ? 'appear pulse' : '' });
    });
  });
  if (frame.run >= 0) {
    out += `<rect class="zone outline" x="${RUN_X[frame.run] - 6}" y="44" width="88" height="${rowsY[rowsY.length - 1] + 54 - 44}" rx="10"/>`;
  }

  // host state
  out += zone(540, 40, 124, 210, 'web1');
  const keys = Object.keys(frame.host);
  keys.forEach((k, i) => {
    const [st, text] = frame.host[k];
    const y = keys.length === 3 ? 64 + i * 58 : 120;
    const [a, b] = text.split(': ');
    out += box(550, y, 104, 46, { state: st, title: a, sub: b, titleCls: 'svg-sub' });
  });
  if (frame.task >= 0 && frame.run >= 0) {
    const y = rowsY[frame.task] + 21;
    out += arrow(RUN_X[2] + 80, y, 536, y, { state: 'active' });
    out += packet(seg([RUN_X[2] + 80, y], [536, y]));
  }

  const changed = frame.grid.flat().filter((x) => x === 'changed').length;
  out += legend(frame.grid.length === 3
    ? 'Green ok = already in the desired state. Amber changed = the module had to act.'
    : `changed results so far: ${changed}. An idempotent task reports changed once, then ok.`, 300);
  return out;
}

function metrics(frame) {
  const flat = frame.grid.flat();
  const last = frame.run >= 0 ? frame.grid.map((r) => r[frame.run]).filter(Boolean) : [];
  const ch = last.filter((x) => x === 'changed').length;
  return [
    { label: 'Current run', value: frame.run >= 0 ? `run ${frame.run + 1}` : '—' },
    { label: 'changed this run', value: ch, tone: ch ? 'warn' : 'ok' },
    { label: 'Total changed', value: flat.filter((x) => x === 'changed').length },
  ];
}

/* Task name for the single-row modes rides on the frame, so renderSVG stays a
   pure function of the frame it is given. */
function withNames(modeId, frames) {
  if (modeId === 'declarative') return frames;
  return frames.map((fr) => ({ ...fr, taskName: TASKS[modeId][0] }));
}

/* ------------------------------------------------------------------ */
/* Config column                                                       */
/* ------------------------------------------------------------------ */

const YAML = {
  declarative: `- name: Web server, described as a desired state
  hosts: web1
  become: true
  tasks:
    - name: nginx is installed
      ansible.builtin.dnf:
        name: nginx
        state: present

    - name: nginx.conf matches the template
      ansible.builtin.template:
        src: nginx.conf.j2
        dest: /etc/nginx/nginx.conf

    - name: nginx is running
      ansible.builtin.service:
        name: nginx
        state: started`,
  shell: `# ANTI-PATTERN: changed on every run
- name: Add login banner
  ansible.builtin.shell: >
    echo "Authorized use only" >> /etc/motd

# If a command is unavoidable, guard it:
#   args:
#     creates: /etc/motd.done
#   changed_when: false   # only if it truly changes nothing`,
  lineinfile: `- name: Login banner is present
  ansible.builtin.lineinfile:
    path: /etc/motd
    line: "Authorized use only"
    regexp: "^Authorized use only"
    state: present`,
};

const FEATURES = {
  declarative: [
    { name: 'Idempotency', kind: 'principle', what: 'Running a task again leaves the system unchanged once it is in the desired state.' },
    { name: 'changed vs ok', kind: 'result', what: 'changed means the module acted. ok means it checked and found nothing to do.' },
    { name: 'state:', kind: 'module argument', what: 'present, absent, started, stopped, latest — the vocabulary of desired state.' },
    { name: 'Drift remediation', kind: 'practice', what: 'Because reruns are safe, running a playbook on a schedule repairs manual changes.' },
  ],
  shell: [
    { name: 'shell / command', kind: 'modules', what: 'Run arbitrary commands. Always report changed unless told otherwise — Ansible cannot see what they did.' },
    { name: 'creates: / removes:', kind: 'command args', what: 'Skip the command when a path exists (or does not). The simplest way to make a command idempotent.' },
    { name: 'changed_when:', kind: 'task keyword', what: 'An expression that decides whether the task changed anything, e.g. based on registered output.' },
    { name: 'ansible-lint', kind: 'tool', what: 'Flags command-instead-of-module and no-changed-when issues before they reach production.' },
  ],
  lineinfile: [
    { name: 'lineinfile', kind: 'ansible.builtin', what: 'Ensures one line is present or absent. regexp finds an existing line to replace instead of duplicating it.' },
    { name: 'blockinfile', kind: 'ansible.builtin', what: 'The same idea for a marked multi-line block.' },
    { name: 'template', kind: 'ansible.builtin', what: 'When you own the whole file, render it from a template rather than editing line by line.' },
  ],
};

const NOTES = {
  declarative: [
    { heading: 'Point at', text: 'Column two is entirely green. Then only one amber cell in column three — the one that drifted.' },
    { heading: 'The line that lands', text: 'Idempotency is what makes "just run it again" a safe answer, and what turns a playbook into continuous compliance.' },
    { ask: 'What would it take to run your configuration on a schedule instead of on request?' },
  ],
  shell: [
    { heading: 'Point at', text: 'The banner count climbing with every run, and every result amber.' },
    { heading: 'The line that lands', text: 'If every run says changed, changed stops meaning anything — and you lose your best signal of real drift.' },
    { ask: 'How many shell: tasks are in your playbooks today, and how many have a module equivalent?' },
  ],
  lineinfile: [
    { heading: 'Point at', text: 'One amber, then green forever — compare directly with the previous tab.' },
    { heading: 'The line that lands', text: 'Look for a module first. Reach for shell only when none exists, and then guard it.' },
    { ask: 'Who on your team would benefit most from running ansible-lint in CI?' },
  ],
};

export default {
  id: 'idempotency',
  title: 'Idempotency: run it again, safely',
  summary: 'Modules describe an end state, so a second run changes nothing and a third repairs only what drifted. A raw shell command cannot do that.',
  description: 'One playbook run three times against a host: first run changed, second run ok, third run repairs a manually stopped service. Contrasted with a shell command that appends a duplicate line every run.',
  viewBox: '0 0 680 320',
  modes: MODES,
  buildFrames: (modeId) => withNames(modeId, buildFrames(modeId)),
  renderSVG,
  metrics,
  speakerNotes: (m) => NOTES[m],
  yaml: (m) => YAML[m],
  features: (m) => FEATURES[m],
};
