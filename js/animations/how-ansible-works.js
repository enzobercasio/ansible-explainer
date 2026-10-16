/**
 * How Ansible works: control node, managed nodes, and the push over SSH.
 *
 * The anchor animation. Everything later assumes the audience has seen a
 * module travel out over SSH, run once, report back as JSON and disappear -
 * that round trip is what "agentless" actually means.
 *
 * Frame shape:
 *   { hl, conn, pk: null | 'out' | 'back', hosts: { web1, web2, db1 }, stamps, note, badge, focus }
 *   host values are box states: 'pend' | 'run' | 'term' | 'hot' | 'off'
 */
import { box, zone, arrow, packet, seg, label, stamp, legend } from './lib/draw.js';

const MODES = [
  { id: 'adhoc', label: 'Ad-hoc command',
    caption: 'ansible all -m ping — one module, every host, no playbook' },
  { id: 'playbook', label: 'Running a playbook',
    caption: 'ansible-playbook site.yml — the same round trip, driven by a file you keep in Git' },
];

const HOSTS = [
  { id: 'web1', name: 'web1', group: 'web', y: 52 },
  { id: 'web2', name: 'web2', group: 'web', y: 142 },
  { id: 'db1', name: 'db1', group: 'db', y: 232 },
];

const CTRL = [242, 200];
const hostIn = (h) => [478, h.y + 28];

function buildFrames(modeId) {
  const f = [];
  const all = (s) => ({ web1: s, web2: s, db1: s });
  const push = (o) => f.push({ stamps: {}, conn: false, pk: null, hl: '', ...o });

  if (modeId === 'adhoc') {
    push({ hosts: all('pend'),
      note: 'One control node, three managed nodes',
      badge: 'Ansible is installed only on the control node. The managed nodes run sshd and Python — nothing else.' });
    push({ hl: 'inventory', hosts: all('pend'), focus: ['[web]', '[db]'],
      note: 'Ansible reads the inventory to learn which hosts exist',
      badge: 'The pattern "all" matches every host in every group — web1, web2 and db1.' });
    push({ hl: 'engine', conn: true, hosts: all('hot'), focus: ['ansible all'],
      note: 'It opens SSH connections to all three, in parallel',
      badge: 'Parallelism is governed by forks (default 5). No agent is listening — this is plain SSH.' });
    push({ hl: 'engine', conn: true, pk: 'out', hosts: all('hot'),
      focus: ['-m ansible.builtin.ping'],
      note: 'The ping module is copied to each host as a small Python file',
      badge: 'Modules are units of work. ping does not use ICMP — it proves SSH login and Python both work.' });
    push({ conn: true, hosts: all('term'),
      note: 'Each host executes the module locally with its own Python',
      badge: 'The work happens on the managed node, not on the control node.' });
    push({ conn: true, pk: 'back', hosts: all('run'), stamps: { web1: 'ok', web2: 'ok', db1: 'ok' },
      focus: ['"ping": "pong"'],
      note: 'Each module returns JSON — here, "ping": "pong"',
      badge: 'Every module reports back in the same structured shape: changed, failed, plus its own data.' });
    push({ hosts: all('run'), stamps: { web1: 'ok', web2: 'ok', db1: 'ok' },
      note: 'The temporary module file is deleted. Nothing is left running',
      badge: 'Between runs there is no Ansible process on the managed nodes at all. That is "agentless".' });
  } else {
    push({ hosts: all('pend'),
      note: 'Same control node, same three hosts — now driven by a playbook',
      badge: 'A playbook is a YAML file describing the state you want, checked into Git like any other code.' });
    push({ hl: 'inventory', hosts: all('pend'), focus: ['[web]', 'web1.example.com', 'web2.example.com'],
      note: 'The inventory says which hosts exist and how they are grouped',
      badge: 'web1 and web2 are in the web group; db1 is in the db group.' });
    push({ hl: 'playbook', hosts: { web1: 'hot', web2: 'hot', db1: 'off' }, focus: ['hosts: web'],
      note: 'The play targets hosts: web — so db1 is simply not part of this run',
      badge: 'The play’s hosts line is a pattern matched against the inventory. db1 is never contacted.' });
    push({ hl: 'engine', conn: true, hosts: { web1: 'hot', web2: 'hot', db1: 'off' }, focus: ['become: true'],
      note: 'SSH to web1 and web2, then become root to install packages',
      badge: 'become: true escalates privilege on the managed node, by default with sudo.' });
    push({ hl: 'engine', conn: true, pk: 'out', hosts: { web1: 'hot', web2: 'hot', db1: 'off' },
      focus: ['ansible.builtin.dnf:', 'name: nginx', 'state: present'],
      note: 'The dnf module and its arguments are shipped to each web host',
      badge: 'You describe the end state — nginx present — not the commands to get there.' });
    push({ conn: true, hosts: { web1: 'term', web2: 'term', db1: 'off' },
      note: 'nginx is not installed yet, so the module installs it',
      badge: 'The module checks current state first and only acts on the difference.' });
    push({ conn: true, pk: 'back', hosts: { web1: 'run', web2: 'run', db1: 'off' },
      stamps: { web1: 'changed', web2: 'changed' },
      note: 'Both hosts report changed: true',
      badge: 'changed means the module had to do something. The next animation shows why that matters.' });
    push({ hosts: { web1: 'run', web2: 'run', db1: 'off' }, stamps: { web1: 'changed', web2: 'changed' },
      focus: ['ansible-playbook -i inventory.ini site.yml'],
      note: 'PLAY RECAP: web1 changed=1, web2 changed=1 — and nothing left behind',
      badge: 'Same mechanism as the ad-hoc command. The playbook just makes it repeatable and reviewable.' });
  }
  return f;
}

function renderSVG(frame) {
  let out = '';

  // control node
  out += zone(20, 40, 222, 232, 'control node');
  out += box(40, 70, 182, 44, { state: frame.hl === 'inventory' ? 'hot' : 'pend', title: 'inventory.ini', sub: 'which hosts' });
  out += box(40, 124, 182, 44, { state: frame.hl === 'playbook' ? 'hot' : 'pend', title: 'site.yml', sub: 'what to do' });
  out += box(40, 178, 182, 44, { state: frame.hl === 'engine' ? 'hot' : 'pend', title: 'ansible-core', sub: 'the engine' });
  out += label(131, 254, 'Python + SSH client', { cls: 'svg-tiny on-node', anchor: 'middle' });

  // managed nodes
  out += zone(458, 20, 204, 290, 'managed nodes');
  HOSTS.forEach((h) => {
    const s = frame.hosts[h.id];
    out += box(478, h.y, 164, 56, { state: s, title: h.name, sub: s === 'off' ? 'not targeted' : `group: ${h.group}` });
    out += stamp(560, h.y + 72, frame.stamps[h.id], { fresh: frame.pk === 'back' });
  });

  // connections
  HOSTS.forEach((h) => {
    const s = frame.hosts[h.id];
    if (s === 'off') return;
    const live = frame.conn;
    const [x2, y2] = hostIn(h);
    out += arrow(CTRL[0], CTRL[1], x2 - 2, y2, { state: live ? 'active' : 'idle', both: live && frame.pk === 'back' });
    if (live && frame.pk === 'out') out += packet(seg(CTRL, [x2, y2]), 'module');
    if (live && frame.pk === 'back') out += packet(seg([x2, y2], CTRL), 'JSON');
  });
  out += label(350, 116, 'SSH · port 22', { cls: 'flow-label', anchor: 'middle' });

  out += legend('No agent, no daemon: a managed node needs only SSH and Python. The control node pushes, runs, collects, cleans up.', 334);
  return out;
}

function metrics(frame) {
  const targeted = Object.values(frame.hosts).filter((s) => s !== 'off').length;
  const st = Object.values(frame.stamps);
  const changed = st.filter((s) => s === 'changed').length;
  const ok = st.filter((s) => s === 'ok').length;
  return [
    { label: 'Hosts targeted', value: `${targeted} / 3` },
    { label: 'Agents installed', value: '0', tone: 'ok' },
    { label: 'ok', value: ok, tone: ok ? 'ok' : '' },
    { label: 'changed', value: changed, tone: changed ? 'warn' : '' },
  ];
}

const YAML = {
  adhoc: `# inventory.ini
[web]
web1.example.com
web2.example.com

[db]
db1.example.com

# one module, run once, against a host pattern
$ ansible all -i inventory.ini \\
    -m ansible.builtin.ping

web1.example.com | SUCCESS => {
    "changed": false,
    "ping": "pong"
}`,
  playbook: `# inventory.ini
[web]
web1.example.com
web2.example.com

[db]
db1.example.com

# site.yml
- name: Install the web server
  hosts: web
  become: true
  tasks:
    - name: Install nginx
      ansible.builtin.dnf:
        name: nginx
        state: present

$ ansible-playbook -i inventory.ini site.yml`,
};

const FEATURES = {
  adhoc: [
    { name: 'Control node', kind: 'any Linux / macOS host', what: 'The one machine with ansible-core installed. It reads the inventory, connects out, and drives everything.' },
    { name: 'Managed node', kind: 'target', what: 'Any host Ansible configures. It needs SSH (WinRM for Windows) and Python — no agent to install or patch.' },
    { name: 'Module', kind: 'unit of work', what: 'A small program copied to the target, executed, and deleted. It returns JSON with changed and failed flags.' },
    { name: 'ansible', kind: 'CLI', what: 'Runs a single module ad hoc. Good for quick checks and one-off fixes; not something you keep.' },
  ],
  playbook: [
    { name: 'Inventory', kind: 'file or plugin', what: 'The list of hosts and groups. Next animation covers it in depth.' },
    { name: 'Playbook', kind: 'YAML file', what: 'An ordered list of plays. Each play maps a host pattern to a list of tasks.' },
    { name: 'hosts:', kind: 'play keyword', what: 'A pattern matched against the inventory. Hosts it does not match are never contacted.' },
    { name: 'become', kind: 'privilege escalation', what: 'Run tasks as another user, root by default, through sudo or a similar method.' },
    { name: 'ansible-playbook', kind: 'CLI', what: 'Runs a playbook and ends with a PLAY RECAP summarising ok, changed, failed and unreachable per host.' },
  ],
};

const NOTES = {
  adhoc: [
    { heading: 'Point at', text: 'The empty right-hand side between runs. Nothing is installed there and nothing stays running after the module returns.' },
    { heading: 'The line that lands', text: 'Agentless means there is nothing on the target to upgrade, monitor, or secure beyond the SSH you already run.' },
    { ask: 'How many agents are already installed on a typical server in your estate?' },
  ],
  playbook: [
    { heading: 'Point at', text: 'db1 goes grey on step three. The play pattern decides who is contacted — inventory membership alone does not.' },
    { heading: 'The line that lands', text: 'An ad-hoc command and a playbook use the exact same mechanism. The playbook simply turns it into reviewable code.' },
    { ask: 'Which manual runbook in your team would make the best first playbook?' },
  ],
};

export default {
  id: 'how-ansible-works',
  title: 'How Ansible works: control node to managed nodes',
  summary: 'Agentless push over SSH: Ansible copies a module to each host, runs it with the host’s own Python, collects JSON, and cleans up.',
  description: 'A control node holding an inventory, a playbook and ansible-core connects over SSH to three managed nodes, ships a module, and receives JSON results.',
  viewBox: '0 0 680 345',
  modes: MODES,
  buildFrames,
  renderSVG,
  metrics,
  speakerNotes: (m) => NOTES[m],
  yaml: (m) => YAML[m],
  features: (m) => FEATURES[m],
};
