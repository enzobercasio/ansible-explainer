/**
 * Facts, conditionals, register and loops.
 *
 * Facts are what Ansible learns about a host before it changes anything;
 * when: uses them to pick the right task per host. register captures a
 * task's result so a later task can react to it, and loop repeats one task
 * over a list.
 *
 * Frame shapes:
 *   facts:    { gathered, task, results: { host: '' | 'changed' | 'skip' | 'ok' }, pk, note, badge, focus }
 *   register: { item, users, reg, debug, note, badge, focus }
 */
import { box, zone, arrow, packet, seg, label, stamp, legend } from './lib/draw.js';

const MODES = [
  { id: 'facts', label: 'Facts and when:',
    caption: 'One playbook, mixed operating systems: facts decide which task applies to which host' },
  { id: 'register', label: 'loop and register',
    caption: 'Repeat a task over a list, capture what happened, and act on the result' },
];

const HOSTS = [
  { id: 'rhel1', os: 'RedHat', dist: 'RHEL 9', y: 40 },
  { id: 'ubuntu1', os: 'Debian', dist: 'Ubuntu 24.04', y: 128 },
  { id: 'rhel2', os: 'RedHat', dist: 'RHEL 10', y: 216 },
];

function factsFrames() {
  const f = [];
  const none = { rhel1: '', ubuntu1: '', rhel2: '' };
  const push = (o) => f.push({ gathered: false, task: '', results: { ...none }, pk: null, fresh: false, ...o });
  push({ note: 'Three hosts, two operating-system families',
    badge: 'RHEL installs packages with dnf, Ubuntu with apt. One playbook should handle both.' });
  push({ task: 'facts', pk: 'out', focus: ['gather_facts: true'],
    note: 'Gathering Facts runs the setup module on every host',
    badge: 'It collects OS, kernel, CPU, memory, disks, network interfaces — hundreds of values per host.' });
  push({ task: 'facts', gathered: true, pk: 'back', fresh: true,
    note: 'Each host reports back; the facts are stored per host',
    badge: 'They are available as ansible_facts, for example ansible_facts[\'os_family\'].' });
  push({ gathered: true, task: 'dnf', focus: ['ansible.builtin.dnf:', "== 'RedHat'"],
    note: 'Task: install httpd with dnf — when os_family is RedHat',
    badge: 'when: is evaluated per host, before the module is sent anywhere.' });
  push({ gathered: true, task: 'dnf', results: { rhel1: 'changed', ubuntu1: 'skip', rhel2: 'changed' }, fresh: true,
    note: 'The RHEL hosts install it. Ubuntu reports skipping',
    badge: 'Skipping is not a failure — the condition was false, so the task simply did not apply.' });
  push({ gathered: true, task: 'apt', results: { rhel1: 'changed', ubuntu1: 'skip', rhel2: 'changed' },
    focus: ['ansible.builtin.apt:', "== 'Debian'"],
    note: 'Task: install apache2 with apt — when os_family is Debian',
    badge: 'Same idea, mirrored. Ubuntu reports Debian as its os_family.' });
  push({ gathered: true, task: 'apt', results: { rhel1: 'skip', ubuntu1: 'changed', rhel2: 'skip' }, fresh: true,
    note: 'Now only Ubuntu acts; the RHEL hosts skip',
    badge: 'Every host got exactly one install. ansible.builtin.package can hide this difference entirely, when package names match.' });
  return f;
}

function registerFrames() {
  const f = [];
  const all = ['alice', 'bob', 'carol'];
  const push = (o) => f.push({ item: -1, users: ['alice'], reg: [], debug: false, ...o });
  push({ focus: ['loop:'],
    note: 'Ensure three users exist — alice already does',
    badge: 'loop: repeats the same task once per item. The current item is {{ item }}.' });
  push({ item: 0, reg: [['alice', 'ok']], focus: ['name: "{{ item }}"'],
    note: 'Item 1: alice — already present, ok',
    badge: 'Each iteration is checked independently, so idempotency still holds inside a loop.' });
  push({ item: 1, users: ['alice', 'bob'], reg: [['alice', 'ok'], ['bob', 'changed']],
    note: 'Item 2: bob — created, changed',
    badge: 'The task’s overall result is changed if any iteration changed.' });
  push({ item: 2, users: [...all], reg: [['alice', 'ok'], ['bob', 'changed'], ['carol', 'changed']],
    note: 'Item 3: carol — created, changed',
    badge: 'Three iterations, one task, one entry in the recap.' });
  push({ users: [...all], reg: [['alice', 'ok'], ['bob', 'changed'], ['carol', 'changed']], focus: ['register: created'],
    note: 'register: saves the whole result in a variable called created',
    badge: 'For a loop, created.results is a list with one entry per item, each with its own changed flag.' });
  push({ users: [...all], reg: [['alice', 'ok'], ['bob', 'changed'], ['carol', 'changed']], debug: true,
    focus: ['when: created.changed', 'selectattr'],
    note: 'A later task reads the registered variable and reports the new accounts',
    badge: 'register plus when: is how tasks react to each other — notify only if created, fail if output looks wrong.' });
  return f;
}

function buildFrames(modeId) {
  return modeId === 'register' ? registerFrames() : factsFrames();
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

const TASK_LABEL = {
  facts: ['Gathering Facts', 'setup module'],
  dnf: ['dnf: name=httpd', "when: os_family == 'RedHat'"],
  apt: ['apt: name=apache2', "when: os_family == 'Debian'"],
};

function renderFacts(frame) {
  let out = '';
  out += zone(16, 22, 300, 168, 'ansible_facts (per host)');
  HOSTS.forEach((h, i) => {
    const y = 56 + i * 42;
    out += box(28, y, 276, 34, {
      state: frame.gathered ? 'run' : 'off', titleCls: 'mono',
      title: frame.gathered ? `${h.id}: os_family=${h.os}` : `${h.id}: (not gathered)`,
      cls: frame.gathered && frame.fresh && frame.task === 'facts' ? 'appear' : '',
    });
  });

  if (frame.task) {
    const [t, w] = TASK_LABEL[frame.task];
    out += box(16, 214, 300, 64, { state: 'hot', title: t, sub: w, titleCls: 'mono' });
  } else {
    out += box(16, 214, 300, 64, { state: 'pend', title: 'playbook', sub: 'waiting to start' });
  }

  out += zone(420, 22, 244, 274, 'managed nodes');
  HOSTS.forEach((h) => {
    const r = frame.results[h.id];
    const st = r === 'changed' ? 'term' : r === 'skip' ? 'off' : frame.task === 'facts' ? 'hot' : 'pend';
    out += box(436, h.y + 16, 150, 52, { state: st, title: h.id, sub: h.dist });
    out += stamp(624, h.y + 46, r, { fresh: frame.fresh });
    const from = [318, 246];
    const to = [432, h.y + 42];
    const live = frame.pk || (frame.task && frame.task !== 'facts' && r && r !== 'skip' && frame.fresh);
    out += arrow(from[0], from[1], to[0], to[1], { state: live ? 'active' : 'idle' });
    if (frame.pk === 'out') out += packet(seg(from, to), 'setup');
    if (frame.pk === 'back') out += packet(seg(to, [318, 120]), 'facts');
  });
  out += legend('Facts are gathered once per play and reused by every task that follows.', 318);
  return out;
}

function renderRegister(frame) {
  let out = '';
  out += label(20, 40, 'loop:', { cls: 'mono on-node' });
  ['alice', 'bob', 'carol'].forEach((u, i) => {
    out += box(20, 50 + i * 46, 120, 36, { state: frame.item === i ? 'hot' : 'pend', title: u, sub: frame.item === i ? '{{ item }}' : '' });
  });
  out += box(180, 104, 150, 50, { state: frame.item >= 0 ? 'hot' : 'pend', title: 'user module', sub: 'state: present', titleCls: 'svg-title' });
  if (frame.item >= 0) {
    const y = 68 + frame.item * 46;
    out += arrow(142, y, 176, 129, { state: 'active' });
    out += packet(seg([142, y], [176, 129]));
  }

  out += zone(380, 22, 284, 132, 'host: app1  /etc/passwd');
  frame.users.forEach((u, i) => {
    const fresh = frame.item === i && u !== 'alice';
    out += box(394 + i * 90, 64, 80, 40, { state: 'run', title: u, cls: fresh ? 'appear' : '' });
  });
  out += arrow(332, 129, 376, 100, { state: frame.item >= 0 ? 'active' : 'idle' });

  out += zone(16, 196, 400, 110, 'register: created  →  created.results');
  frame.reg.forEach(([u, r], i) => {
    out += box(28 + i * 128, 230, 116, 50, { state: r === 'changed' ? 'term' : 'run', title: `item: ${u}`, sub: `changed: ${r === 'changed'}`, titleCls: 'svg-sub', cls: frame.item === i ? 'appear' : '' });
  });

  out += box(450, 214, 214, 74, { state: frame.debug ? 'hot' : 'pend', title: 'debug', sub: frame.debug ? 'new users: bob, carol' : 'when: created.changed' });
  if (frame.debug) out += arrow(418, 251, 446, 251, { state: 'active' });
  out += legend('The registered variable lives for the rest of the play, per host.', 330);
  return out;
}

function renderSVG(frame) {
  return frame.results ? renderFacts(frame) : renderRegister(frame);
}

function metrics(frame) {
  if (frame.results) {
    const v = Object.values(frame.results);
    return [
      { label: 'Facts gathered', value: frame.gathered ? '3 hosts' : 'not yet', tone: frame.gathered ? 'ok' : '' },
      { label: 'changed', value: v.filter((x) => x === 'changed').length },
      { label: 'skipping', value: v.filter((x) => x === 'skip').length },
    ];
  }
  return [
    { label: 'Loop item', value: frame.item >= 0 ? `${frame.item + 1} / 3` : '—' },
    { label: 'Users on host', value: frame.users.length },
    { label: 'Iterations changed', value: frame.reg.filter(([, r]) => r === 'changed').length },
  ];
}

/* ------------------------------------------------------------------ */
/* Config column                                                       */
/* ------------------------------------------------------------------ */

const YAML = {
  facts: `- name: Install a web server on any OS family
  hosts: all
  become: true
  gather_facts: true
  tasks:
    - name: Install httpd (RHEL family)
      ansible.builtin.dnf:
        name: httpd
        state: present
      when: ansible_facts['os_family'] == 'RedHat'

    - name: Install apache2 (Debian family)
      ansible.builtin.apt:
        name: apache2
        state: present
      when: ansible_facts['os_family'] == 'Debian'`,
  register: `- name: Users exist
  ansible.builtin.user:
    name: "{{ item }}"
    state: present
  loop:
    - alice
    - bob
    - carol
  register: created

- name: Report new accounts
  ansible.builtin.debug:
    msg: >-
      {{ created.results | selectattr('changed')
         | map(attribute='item') | list }}
  when: created.changed`,
};

const FEATURES = {
  facts: [
    { name: 'ansible_facts', kind: 'variable', what: 'Everything the setup module discovered about the host: OS, network, hardware, mounts and more.' },
    { name: 'gather_facts', kind: 'play keyword', what: 'On by default. Turn it off for speed when no task needs facts; use fact caching for large estates.' },
    { name: 'when:', kind: 'task keyword', what: 'A Jinja2 expression evaluated per host. False means the task is skipped for that host.' },
    { name: 'ansible.builtin.package', kind: 'module', what: 'A generic package module that picks dnf, apt and so on for you, when the package name is the same.' },
  ],
  register: [
    { name: 'loop:', kind: 'task keyword', what: 'Runs the task once per list item; the current element is {{ item }}.' },
    { name: 'register:', kind: 'task keyword', what: 'Stores the task result. For loops, .results holds one entry per item.' },
    { name: 'Filters', kind: 'Jinja2', what: 'selectattr, map and friends reshape data — here, picking only the items that changed.' },
    { name: 'debug', kind: 'module', what: 'Prints a message or variable. Indispensable while writing a playbook.' },
  ],
};

const NOTES = {
  facts: [
    { heading: 'Point at', text: 'The skipping stamps. The same task list ran everywhere; the conditions decided what applied.' },
    { heading: 'The line that lands', text: 'Facts let one playbook describe a mixed estate instead of one script per platform.' },
    { ask: 'How many OS versions does your team manage today, and how many separate scripts does that imply?' },
  ],
  register: [
    { heading: 'Point at', text: 'The three result cards: one ok, two changed, all inside one registered variable.' },
    { heading: 'The line that lands', text: 'register is how one task’s outcome becomes the next task’s decision.' },
    { ask: 'Where in your runbooks does a step depend on what the previous step printed?' },
  ],
};

export default {
  id: 'facts-conditionals',
  title: 'Facts, conditionals, loops and register',
  summary: 'Ansible learns about each host before acting, picks the right task per host with when:, repeats with loop:, and remembers results with register:.',
  description: 'Facts are gathered from RHEL and Ubuntu hosts and used to install with dnf or apt; then a loop creates users and a registered result drives a follow-up task.',
  viewBox: '0 0 680 340',
  modes: MODES,
  buildFrames,
  renderSVG,
  metrics,
  speakerNotes: (m) => NOTES[m],
  yaml: (m) => YAML[m],
  features: (m) => FEATURES[m],
};
