/**
 * Roles and collections: packaging automation for reuse.
 *
 * A role is a directory layout Ansible knows how to load - tasks, handlers,
 * defaults, templates - so a play can say "apply nginx" in one line. A
 * collection is the distribution format: roles, modules and plugins under a
 * namespace, installed from Galaxy or automation hub and called by their
 * fully qualified name.
 *
 * Frame shapes:
 *   role:       { hl: dirId | '', loaded: [dirIds], reuse, note, badge, focus }
 *   collection: { step, installed: [ids], fqcn: '' | 'ns' | 'coll' | 'mod' | 'all', note, badge, focus }
 */
import { box, zone, arrow, packet, seg, label, legend } from './lib/draw.js';

const MODES = [
  { id: 'role', label: 'Anatomy of a role',
    caption: 'A known directory layout: drop files in the right place and Ansible wires them up' },
  { id: 'collection', label: 'Collections and FQCNs',
    caption: 'Collections package roles, modules and plugins under a namespace you install and call by name' },
];

const DIRS = [
  { id: 'tasks', path: 'tasks/main.yml', what: 'the work' },
  { id: 'handlers', path: 'handlers/main.yml', what: 'restart on change' },
  { id: 'templates', path: 'templates/nginx.conf.j2', what: 'Jinja2 files' },
  { id: 'defaults', path: 'defaults/main.yml', what: 'overridable vars' },
  { id: 'vars', path: 'vars/main.yml', what: 'internal vars' },
  { id: 'files', path: 'files/', what: 'static files' },
  { id: 'meta', path: 'meta/main.yml', what: 'deps, platforms' },
];

function roleFrames() {
  const f = [];
  const loaded = [];
  const push = (o) => f.push({ hl: '', loaded: [...loaded], reuse: false, ...o });
  push({ focus: ['roles:'],
    note: 'A play that applies one role: nginx',
    badge: 'roles/nginx is a directory with a fixed layout. Ansible knows where to look in it.' });
  const steps = [
    ['tasks', ['# roles/nginx/tasks/main.yml'], 'tasks/main.yml is loaded as the role’s task list', 'The entry point. It can import other task files from the same folder.'],
    ['handlers', [], 'handlers/main.yml is registered automatically', 'Tasks in the role can notify these without any extra wiring.'],
    ['templates', ['src: nginx.conf.j2'], 'template: src: finds files in templates/ by name', 'No paths needed — the role’s own folders are searched first.'],
    ['defaults', ['# roles/nginx/defaults/main.yml', 'nginx_port: 80'], 'defaults/main.yml supplies values a caller can override', 'Lowest precedence of all variables: the role works out of the box, and inventory can change anything.'],
    ['meta', [], 'meta/main.yml declares dependencies and supported platforms', 'Also the metadata Galaxy and automation hub display.'],
  ];
  steps.forEach(([id, focus, note, badge]) => {
    loaded.push(id);
    push({ hl: id, focus: focus.length ? focus : undefined, note, badge });
  });
  push({ reuse: true, focus: ['nginx_port: 8443'],
    note: 'Reuse: the same role, two plays, different variables',
    badge: 'Write it once, test it once, apply it everywhere. ansible-galaxy role init nginx scaffolds the layout.' });
  return f;
}

function collectionFrames() {
  const f = [];
  const push = (o) => f.push({ step: '', installed: [], fqcn: '', ...o });
  push({ focus: ['collections:'],
    note: 'The playbook needs modules for Cisco IOS and for firewalld',
    badge: 'ansible-core ships only ansible.builtin. Everything else arrives as a collection.' });
  push({ step: 'install', focus: ['$ ansible-galaxy collection install -r'],
    note: 'ansible-galaxy reads requirements.yml and fetches each collection',
    badge: 'Sources are Ansible Galaxy (community) and Red Hat automation hub (certified and validated content).' });
  push({ step: 'done', installed: ['cisco.ios', 'ansible.posix'], focus: ['name: cisco.ios', 'name: ansible.posix'],
    note: 'Collections land in the collections path on the control node',
    badge: 'Pin versions in requirements.yml so every run — laptop, CI, AAP — uses the same content.' });
  push({ installed: ['cisco.ios', 'ansible.posix'], fqcn: 'ns', focus: ['cisco.ios.ios_config:'],
    note: 'A fully qualified collection name, part 1: the namespace',
    badge: 'cisco — the publisher. ansible, community, redhat, amazon, azure… are all namespaces.' });
  push({ installed: ['cisco.ios', 'ansible.posix'], fqcn: 'coll', focus: ['cisco.ios.ios_config:'],
    note: 'Part 2: the collection inside that namespace',
    badge: 'ios — one collection among several Cisco publishes (ios, nxos, iosxr…).' });
  push({ installed: ['cisco.ios', 'ansible.posix'], fqcn: 'mod', focus: ['cisco.ios.ios_config:'],
    note: 'Part 3: the module (or role, or plugin) itself',
    badge: 'ios_config. The full name cisco.ios.ios_config is unambiguous, even if another collection has a module called config.' });
  push({ installed: ['cisco.ios', 'ansible.posix'], fqcn: 'all', focus: ['ansible.posix.firewalld:'],
    note: 'Use FQCNs everywhere — ansible.builtin.copy, not copy',
    badge: 'It makes playbooks explicit about their dependencies, and ansible-lint enforces it.' });
  return f;
}

function buildFrames(modeId) {
  return modeId === 'collection' ? collectionFrames() : roleFrames();
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

function renderRole(frame) {
  let out = '';
  out += zone(16, 18, 280, 296, 'roles/nginx/');
  DIRS.forEach((d, i) => {
    const y = 40 + i * 38;
    const st = frame.hl === d.id ? 'hot' : frame.loaded.includes(d.id) ? 'run' : 'pend';
    out += `<g class="pod ${st}"><rect x="28" y="${y}" width="256" height="32" rx="6"/>`
      + `<text class="mono" x="40" y="${y + 16}" dominant-baseline="central">${d.path}</text>`
      + `<text class="svg-tiny" x="274" y="${y + 16}" text-anchor="end" dominant-baseline="central">${d.what}</text></g>`;
  });

  if (frame.reuse) {
    out += box(380, 40, 284, 70, { state: 'hot', title: 'play: hosts: web', sub: 'roles: [nginx]', sub2: 'nginx_port: 80 (default)' });
    out += box(380, 150, 284, 70, { state: 'hot', title: 'play: hosts: lb', sub: 'roles: [nginx]', sub2: 'nginx_port: 8443 (overridden)' });
    out += arrow(298, 160, 376, 75, { state: 'active' });
    out += arrow(298, 160, 376, 185, { state: 'active' });
    out += packet(seg([298, 160], [376, 75]));
    out += packet(seg([298, 160], [376, 185]));
  } else {
    out += box(380, 40, 284, 70, { state: 'pend', title: 'site.yml', sub: '- hosts: web', sub2: 'roles: [nginx]' });
    out += zone(380, 132, 284, 150, 'what the play now contains');
    frame.loaded.forEach((id, i) => {
      const d = DIRS.find((x) => x.id === id);
      const col = i % 2;
      const row = Math.floor(i / 2);
      out += box(392 + col * 136, 158 + row * 40, 126, 32, { state: frame.hl === id ? 'hot' : 'run', title: d.id, titleCls: 'svg-sub', cls: frame.hl === id ? 'appear' : '' });
    });
    if (frame.hl) {
      const i = DIRS.findIndex((x) => x.id === frame.hl);
      const y = 56 + i * 38;
      out += arrow(298, y, 376, 206, { state: 'active' });
      out += packet(seg([298, y], [376, 206]));
    }
  }
  out += legend('A role is convention over configuration: the folder name is the wiring.', 334);
  return out;
}

const SOURCES = [
  { id: 'galaxy', title: 'Ansible Galaxy', sub: 'community content', y: 40 },
  { id: 'hub', title: 'Automation hub', sub: 'certified · validated', y: 112 },
];
const COLLS = [
  { id: 'ansible.builtin', sub: 'ships with ansible-core' },
  { id: 'cisco.ios', sub: 'from automation hub' },
  { id: 'ansible.posix', sub: 'from Galaxy' },
];

function renderCollection(frame) {
  let out = '';
  out += zone(16, 18, 180, 170, 'sources');
  SOURCES.forEach((s) => {
    out += box(28, s.y, 156, 56, { state: frame.step === 'install' ? 'hot' : 'pend', title: s.title, sub: s.sub });
  });

  out += box(236, 76, 150, 60, { state: frame.step === 'install' ? 'hot' : 'pend', title: 'ansible-galaxy', sub: 'collection install', titleCls: 'mono' });
  out += arrow(186, 106, 232, 106, { state: frame.step === 'install' ? 'active' : 'idle' });
  if (frame.step === 'install') out += packet(seg([186, 106], [232, 106]), 'tar.gz');

  out += zone(426, 18, 238, 170, 'control node');
  COLLS.forEach((c, i) => {
    const on = c.id === 'ansible.builtin' || frame.installed.includes(c.id);
    out += box(438, 40 + i * 48, 214, 40, { state: on ? 'run' : 'off', title: c.id, sub: on ? c.sub : 'not installed', titleCls: 'mono', cls: frame.step === 'done' && c.id !== 'ansible.builtin' ? 'appear' : '' });
  });
  out += arrow(388, 106, 422, 106, { state: frame.step ? 'active' : 'idle' });

  // FQCN breakdown
  const parts = [['ns', 'cisco', 'namespace'], ['coll', 'ios', 'collection'], ['mod', 'ios_config', 'module']];
  const xs = [120, 260, 400];
  const ws = [110, 110, 160];
  out += label(340, 222, 'fully qualified collection name (FQCN)', { cls: 'zone-label', anchor: 'middle' });
  parts.forEach(([id, text, kind], i) => {
    const st = frame.fqcn === id || frame.fqcn === 'all' ? 'hot' : frame.fqcn ? 'pend' : 'off';
    out += box(xs[i], 236, ws[i], 40, { state: st, title: text, titleCls: 'mono' });
    out += label(xs[i] + ws[i] / 2, 294, kind, { cls: 'svg-tiny on-node', anchor: 'middle' });
    if (i < 2) out += label(xs[i] + ws[i] + 15, 260, '.', { cls: 'svg-title on-node', anchor: 'middle' });
  });
  out += legend('requirements.yml pins what to install; the FQCN says exactly which module a task calls.', 330);
  return out;
}

function renderSVG(frame) {
  return frame.fqcn !== undefined ? renderCollection(frame) : renderRole(frame);
}

function metrics(frame) {
  if (frame.fqcn !== undefined) {
    return [
      { label: 'Collections available', value: 1 + frame.installed.length },
      { label: 'Ambiguous module names', value: frame.fqcn === 'all' ? '0' : '—', tone: frame.fqcn === 'all' ? 'ok' : '' },
    ];
  }
  return [
    { label: 'Role parts loaded', value: `${frame.loaded.length} / ${DIRS.length}` },
    { label: 'Plays using the role', value: frame.reuse ? 2 : 1 },
  ];
}

/* ------------------------------------------------------------------ */
/* Config column                                                       */
/* ------------------------------------------------------------------ */

const YAML = {
  role: `# site.yml
- hosts: web
  roles:
    - nginx

- hosts: lb
  roles:
    - role: nginx
      vars:
        nginx_port: 8443

# roles/nginx/tasks/main.yml
- name: Render config
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
  notify: Restart nginx

# roles/nginx/defaults/main.yml
nginx_port: 80`,
  collection: `# collections/requirements.yml
collections:
  - name: cisco.ios
    version: ">=9.0.0"
  - name: ansible.posix

$ ansible-galaxy collection install -r \\
    collections/requirements.yml

# playbook tasks, using FQCNs
- name: Set the banner on a switch
  cisco.ios.ios_config:
    lines:
      - banner motd ^Authorized use only^

- name: Open https on a RHEL host
  ansible.posix.firewalld:
    service: https
    state: enabled
    permanent: true`,
};

const FEATURES = {
  role: [
    { name: 'Role', kind: 'directory layout', what: 'A reusable bundle of tasks, handlers, templates, files and variables, applied with roles: or include_role.' },
    { name: 'defaults/ vs vars/', kind: 'role variables', what: 'defaults are meant to be overridden by callers; vars are internal and hard to override.' },
    { name: 'meta/main.yml', kind: 'role metadata', what: 'Dependencies on other roles, supported platforms and Galaxy information.' },
    { name: 'ansible-galaxy role init', kind: 'CLI', what: 'Scaffolds the standard layout so every role in a team looks the same.' },
  ],
  collection: [
    { name: 'Collection', kind: 'distribution format', what: 'Modules, plugins, roles and playbooks packaged under namespace.collection, versioned together.' },
    { name: 'FQCN', kind: 'namespace.collection.name', what: 'The unambiguous name of a module or role. ansible.builtin.copy rather than copy.' },
    { name: 'requirements.yml', kind: 'file', what: 'Lists collections (and roles) with version constraints so installs are reproducible.' },
    { name: 'Automation hub', kind: 'Red Hat', what: 'Hosts Red Hat Certified and Validated Content; a private automation hub serves your own collections.' },
  ],
};

const NOTES = {
  role: [
    { heading: 'Point at', text: 'Each folder lighting up and appearing in the play without a single include line.' },
    { heading: 'The line that lands', text: 'Roles are how a playbook stays short: the play says what, the role holds how.' },
    { ask: 'Which configuration do your teams each write slightly differently today — and could be one role?' },
  ],
  collection: [
    { heading: 'Point at', text: 'The three FQCN parts. Every module name you see in the rest of this deck follows that shape.' },
    { heading: 'The line that lands', text: 'Collections decouple content from the engine: upgrade cisco.ios without touching ansible-core.' },
    { ask: 'Where does your team get Ansible content today, and who decides which versions are trusted?' },
  ],
};

export default {
  id: 'roles-collections',
  title: 'Roles and collections: packaging for reuse',
  summary: 'Roles give automation a standard shape; collections package roles and modules under a namespace you install and call by fully qualified name.',
  description: 'The folders of an nginx role being loaded into a play and reused with different variables; then collections installed from Galaxy and automation hub and a fully qualified collection name broken into its parts.',
  viewBox: '0 0 680 345',
  modes: MODES,
  buildFrames,
  renderSVG,
  metrics,
  speakerNotes: (m) => NOTES[m],
  yaml: (m) => YAML[m],
  features: (m) => FEATURES[m],
};
