/**
 * Inventories: hosts, groups, patterns, variables, and dynamic sources.
 *
 * The inventory answers "which machines?" for every run. Three modes build it
 * up: grouping and host patterns, where a variable's value actually comes
 * from, and an inventory that is generated from a cloud API rather than
 * written by hand.
 *
 * Frame shapes:
 *   groups:  { show: { groups, prod, all }, sel: [hostIds], pattern }
 *   vars:    { layer, values: { web1, web2, db1 }, from: { ... } }
 *   dynamic: { vms, known, query, built, run }  - known is what the inventory has discovered
 */
import { box, zone, arrow, packet, seg, label, legend } from './lib/draw.js';

const MODES = [
  { id: 'groups', label: 'Hosts, groups, patterns',
    caption: 'Hosts belong to groups, groups nest, and a play’s hosts: line selects from them' },
  { id: 'vars', label: 'Where a variable comes from',
    caption: 'group_vars and host_vars layer on top of each other — the most specific value wins' },
  { id: 'dynamic', label: 'Dynamic inventory',
    caption: 'An inventory plugin asks the cloud API on every run, so new machines appear without editing a file' },
];

/* ------------------------------------------------------------------ */
/* Frames                                                              */
/* ------------------------------------------------------------------ */

function groupsFrames() {
  const f = [];
  const push = (o) => f.push({ show: { groups: true, prod: true, all: true }, sel: [], pattern: '', ...o });
  push({ show: { groups: false, prod: false, all: false },
    note: 'Start with four hosts and nothing else',
    badge: 'An inventory can be as simple as a list of hostnames, one per line.' });
  push({ show: { groups: true, prod: false, all: false }, focus: ['[web]', '[db]'],
    note: 'Group them by role: web and db',
    badge: 'A group is just a name in square brackets. A host can sit in as many groups as you like.' });
  push({ show: { groups: true, prod: true, all: false }, focus: ['[prod:children]'],
    note: 'Groups can contain groups: prod is made of web and db',
    badge: 'The :children suffix nests groups — handy for environments, regions and data centres.' });
  push({ focus: ['jump1.example.com'],
    note: 'Two groups always exist: all, and ungrouped',
    badge: 'jump1 is in no group you defined, so it lands in ungrouped. Every host is in all.' });
  push({ sel: ['web1', 'web2'], pattern: 'hosts: web',
    note: 'hosts: web selects the two web servers',
    badge: 'This is the pattern on the play from the previous animation.' });
  push({ sel: ['web1', 'web2', 'db1'], pattern: 'hosts: prod',
    note: 'hosts: prod pulls in both child groups',
    badge: 'Target an environment without listing every role inside it.' });
  push({ sel: ['db1'], pattern: 'hosts: prod:!web',
    note: 'Patterns combine: prod:!web means prod, but not web',
    badge: 'Use : for union, :& for intersection and :! for exclusion.' });
  push({ sel: ['web2'], pattern: 'hosts: web  +  --limit web2',
    note: '--limit narrows any run further from the command line',
    badge: 'Common for a canary: run the real playbook against one host before the rest.' });
  return f;
}

function varsFrames() {
  const f = [];
  const v = (a, b, c) => ({ web1: a, web2: b, db1: c });
  const push = (o) => f.push(o);
  push({ layer: '', values: v('—', '—', '—'), from: v('', '', ''),
    note: 'The template needs http_port. Which value does each host get?',
    badge: 'Variables live beside the inventory, in group_vars/ and host_vars/ directories named after groups and hosts.' });
  push({ layer: 'all', values: v('80', '80', '80'), from: v('all', 'all', 'all'),
    focus: ['group_vars/all.yml', 'http_port: 80'],
    note: 'group_vars/all.yml sets a default of 80 for everyone',
    badge: 'The all group is the place for organisation-wide defaults.' });
  push({ layer: 'web', values: v('8080', '8080', '80'), from: v('web', 'web', 'all'),
    focus: ['group_vars/web.yml', 'http_port: 8080'],
    note: 'group_vars/web.yml overrides it to 8080 for the web group',
    badge: 'A child group beats its parent. db1 is not in web, so it keeps 80.' });
  push({ layer: 'host', values: v('8080', '9090', '80'), from: v('web', 'host', 'all'),
    focus: ['host_vars/web2.yml', 'http_port: 9090'],
    note: 'host_vars/web2.yml sets 9090 for that one host',
    badge: 'Host variables beat group variables. Use them sparingly — they are exceptions, not structure.' });
  push({ layer: 'extra', values: v('7000', '7000', '7000'), from: v('-e', '-e', '-e'),
    focus: ['-e http_port=7000'],
    note: 'An extra var on the command line beats everything',
    badge: '-e always wins. Treat it as an override for one run, not a place to keep configuration.' });
  push({ layer: '', values: v('8080', '9090', '80'), from: v('web', 'host', 'all'),
    note: 'Without -e, each host resolves to its most specific value',
    badge: 'Most general to most specific: all → child group → host → extra vars. Full order has more layers; this is the core of it.' });
  return f;
}

function dynamicFrames() {
  const f = [];
  const push = (o) => f.push({ vms: 3, known: 3, query: false, built: false, run: false, ...o });
  push({ note: 'Three VMs in a cloud account, tagged by role',
    badge: 'They come and go with autoscaling. A hand-written file would be stale within the hour.' });
  push({ query: true, focus: ['plugin: amazon.aws.aws_ec2'],
    note: 'At the start of a run, the inventory plugin queries the cloud API',
    badge: 'The inventory source is a small YAML file that names a plugin, not a list of hosts.' });
  push({ query: true, built: true, focus: ['keyed_groups:', 'key: tags.role'],
    note: 'Groups are built from tags: role=web becomes role_web',
    badge: 'keyed_groups turns any instance attribute into a group — tags, region, instance type.' });
  push({ built: true, run: true, focus: ['prefix: role'],
    note: 'Playbooks target role_web exactly as if it were a static group',
    badge: 'Nothing in the playbook knows or cares that the inventory was generated.' });
  push({ vms: 4, built: true,
    note: 'Autoscaling adds a fourth web VM',
    badge: 'Nobody edits the inventory. The tag is the only thing that matters.' });
  push({ vms: 4, known: 4, query: true, built: true, run: true,
    note: 'The next run discovers it and includes it automatically',
    badge: 'The same plugins exist for Azure, GCP, VMware, OpenStack, Satellite, ServiceNow CMDB and more.' });
  return f;
}

function buildFrames(modeId) {
  if (modeId === 'vars') return varsFrames();
  if (modeId === 'dynamic') return dynamicFrames();
  return groupsFrames();
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

const G_HOSTS = [
  { id: 'web1', x: 72, y: 112 }, { id: 'web2', x: 72, y: 172 },
  { id: 'db1', x: 290, y: 142 }, { id: 'jump1', x: 506, y: 142 },
];

function renderGroups(frame) {
  let out = '';
  const s = frame.show;
  if (s.all) out += zone(20, 22, 640, 262, 'all', { cls: 'outline appear' });
  if (s.prod) out += zone(40, 50, 420, 222, 'prod (children: web, db)', { cls: 'outline appear' });
  if (s.groups) {
    out += zone(56, 80, 190, 176, 'web');
    out += zone(270, 80, 174, 176, 'db');
  }
  if (s.all) out += zone(486, 80, 158, 176, 'ungrouped');
  G_HOSTS.forEach((h) => {
    const hot = frame.sel.includes(h.id);
    const dim = frame.sel.length && !hot;
    out += box(h.x, h.y, h.id === 'db1' ? 136 : h.id === 'jump1' ? 120 : 158, 44,
      { state: hot ? 'hot' : dim ? 'off' : 'pend', title: h.id, sub: `${h.id}.example.com` });
  });
  if (frame.pattern) {
    out += label(340, 310, frame.pattern, { cls: 'mono on-node', anchor: 'middle' });
    out += label(340, 330, `${frame.sel.length} host${frame.sel.length === 1 ? '' : 's'} selected`, { cls: 'legend-text', anchor: 'middle' });
  } else {
    out += legend('Every host is in "all". A host can belong to many groups; groups can nest.', 320);
  }
  return out;
}

const LAYERS = [
  { id: 'all', file: 'group_vars/all.yml', val: '80', y: 44 },
  { id: 'web', file: 'group_vars/web.yml', val: '8080', y: 104 },
  { id: 'host', file: 'host_vars/web2.yml', val: '9090', y: 164 },
  { id: 'extra', file: '-e http_port=7000', val: '7000', y: 224 },
];
const V_HOSTS = [{ id: 'web1', y: 56 }, { id: 'web2', y: 136 }, { id: 'db1', y: 216 }];
const AFFECTS = { all: ['web1', 'web2', 'db1'], web: ['web1', 'web2'], host: ['web2'], extra: ['web1', 'web2', 'db1'] };

function renderVars(frame) {
  let out = '';
  out += label(20, 30, 'least specific', { cls: 'svg-tiny on-node' });
  LAYERS.forEach((l) => {
    out += box(20, l.y, 220, 46, { state: frame.layer === l.id ? 'hot' : 'pend', title: l.file, sub: `http_port: ${l.val}`, titleCls: 'mono' });
  });
  out += label(20, 290, 'most specific — wins', { cls: 'svg-tiny on-node' });

  V_HOSTS.forEach((h) => {
    out += box(340, h.y, 120, 50, { state: frame.layer && AFFECTS[frame.layer].includes(h.id) ? 'hot' : 'pend', title: h.id });
    const val = frame.values[h.id];
    out += box(490, h.y, 170, 50, { state: val === '—' ? 'off' : 'run', title: `http_port: ${val}`, sub: frame.from[h.id] ? `from ${frame.from[h.id]}` : 'unresolved', titleCls: 'mono' });
    out += arrow(462, h.y + 25, 488, h.y + 25, { state: val === '—' ? 'idle' : 'ok' });
  });

  if (frame.layer) {
    const l = LAYERS.find((x) => x.id === frame.layer);
    AFFECTS[frame.layer].forEach((id) => {
      const h = V_HOSTS.find((x) => x.id === id);
      out += arrow(242, l.y + 23, 336, h.y + 25, { state: 'active' });
      out += packet(seg([242, l.y + 23], [336, h.y + 25]));
    });
  }
  out += legend('Precedence, simplified: all < child group < host_vars < extra vars (-e).', 330);
  return out;
}

const VMS = [
  { id: 'i-01', role: 'web', y: 58 }, { id: 'i-02', role: 'web', y: 112 },
  { id: 'i-03', role: 'db', y: 166 }, { id: 'i-04', role: 'web', y: 220 },
];

function renderDynamic(frame) {
  let out = '';
  out += zone(20, 26, 200, 262, 'cloud account (EC2)');
  VMS.slice(0, frame.vms).forEach((v, i) => {
    out += box(36, v.y, 168, 42, { state: 'run', title: v.id, sub: `tag role=${v.role}`, cls: i === 3 && frame.vms === 4 && !frame.query ? 'appear' : '' });
  });

  out += box(270, 128, 150, 58, { state: frame.query ? 'hot' : 'pend', title: 'aws_ec2', sub: 'inventory plugin' });
  out += arrow(222, 157, 266, 157, { state: frame.query ? 'active' : 'idle' });
  if (frame.query) out += packet(seg([266, 150], [222, 150]), 'API');

  out += zone(462, 26, 198, 262, 'generated groups');
  if (frame.built) {
    out += arrow(422, 157, 458, 157, { state: frame.query ? 'active' : 'ok' });
    const webs = VMS.slice(0, frame.known).filter((v) => v.role === 'web');
    out += zone(474, 46, 174, 150, 'role_web');
    webs.forEach((v, i) => {
      const fresh = v.id === 'i-04';
      out += box(486, 70 + i * 40, 150, 32, { state: frame.run ? 'hot' : 'run', title: v.id, cls: fresh && frame.query ? 'appear' : '' });
    });
    out += zone(474, 206, 174, 70, 'role_db');
    out += box(486, 232, 150, 32, { state: 'run', title: 'i-03' });
  }
  out += frame.run
    ? label(340, 318, '- hosts: role_web', { cls: 'mono on-node', anchor: 'middle' })
    : legend('The inventory is computed at run time from the source of truth.', 318);
  return out;
}

function renderSVG(frame) {
  if (frame.layer !== undefined) return renderVars(frame);
  if (frame.vms !== undefined) return renderDynamic(frame);
  return renderGroups(frame);
}

function metrics(frame) {
  if (frame.layer !== undefined) {
    const vals = Object.values(frame.values).filter((x) => x !== '—');
    return [
      { label: 'Layer applied', value: frame.layer || (vals.length ? 'resolved' : 'none') },
      { label: 'Distinct values', value: String(new Set(vals).size) },
    ];
  }
  if (frame.vms !== undefined) {
    return [
      { label: 'VMs in cloud', value: frame.vms },
      { label: 'Hosts in role_web', value: frame.built ? VMS.slice(0, frame.known).filter((v) => v.role === 'web').length : 0 },
      { label: 'Files edited', value: '0', tone: 'ok' },
    ];
  }
  return [
    { label: 'Hosts in inventory', value: '4' },
    { label: 'Selected by pattern', value: frame.sel.length || '—' },
  ];
}

/* ------------------------------------------------------------------ */
/* Config column                                                       */
/* ------------------------------------------------------------------ */

const YAML = {
  groups: `# inventory.ini
jump1.example.com

[web]
web1.example.com
web2.example.com

[db]
db1.example.com

[prod:children]
web
db

# patterns
#   hosts: web            web1, web2
#   hosts: prod           web1, web2, db1
#   hosts: prod:!web      db1
#   ansible-playbook site.yml --limit web2`,
  vars: `# group_vars/all.yml
http_port: 80

# group_vars/web.yml
http_port: 8080

# host_vars/web2.yml
http_port: 9090

# templates/nginx.conf.j2
#   listen {{ http_port }};

$ ansible-playbook site.yml -e http_port=7000`,
  dynamic: `# inventory/aws_ec2.yml
plugin: amazon.aws.aws_ec2
regions:
  - us-east-1
filters:
  instance-state-name: running
keyed_groups:
  - key: tags.role
    prefix: role
hostnames:
  - private-dns-name

# $ ansible-inventory -i inventory/aws_ec2.yml --graph
# @all:
#   |--@role_web:
#   |--@role_db:`,
};

const FEATURES = {
  groups: [
    { name: 'Group', kind: 'inventory', what: 'A named set of hosts. Group by role, environment, location — a host can be in several at once.' },
    { name: ':children', kind: 'INI suffix', what: 'Makes a group of groups. In YAML inventories the same thing is a children: key.' },
    { name: 'all / ungrouped', kind: 'implicit groups', what: 'Always present. all contains every host; ungrouped holds hosts with no other group.' },
    { name: 'Host pattern', kind: 'hosts: / --limit', what: 'Selects hosts with union (:), intersection (:&) and exclusion (:!). --limit narrows a run further.' },
  ],
  vars: [
    { name: 'group_vars/', kind: 'directory', what: 'One file (or folder) per group. Loaded automatically for every host in that group.' },
    { name: 'host_vars/', kind: 'directory', what: 'One file per host. Overrides group values — keep it for genuine exceptions.' },
    { name: 'Extra vars', kind: '-e', what: 'Highest precedence of all. Useful for a one-off run; dangerous as a habit.' },
    { name: 'Jinja2', kind: 'templating', what: '{{ http_port }} in a template or task is replaced with the resolved value for that host.' },
  ],
  dynamic: [
    { name: 'Inventory plugin', kind: 'e.g. amazon.aws.aws_ec2', what: 'Builds the host list from an external source at run time. Plugins ship in collections.' },
    { name: 'keyed_groups', kind: 'plugin option', what: 'Creates groups from host attributes such as tags, so grouping follows your cloud metadata.' },
    { name: 'ansible-inventory', kind: 'CLI', what: '--graph or --list shows exactly what a source resolves to. Run it before trusting a new source.' },
    { name: 'Inventory source', kind: 'AAP', what: 'In Automation Platform the same plugin runs as a scheduled or on-launch inventory sync.' },
  ],
};

const NOTES = {
  groups: [
    { heading: 'Point at', text: 'The faded hosts on the pattern frames. A pattern is a filter over the inventory, nothing more.' },
    { heading: 'The line that lands', text: 'Good group design means playbooks never contain hostnames. You change who gets what by editing groups, not plays.' },
    { ask: 'How would you group your estate: by role, environment, location — or all three?' },
  ],
  vars: [
    { heading: 'Point at', text: 'web2 moving from 8080 to 9090 when host_vars arrives, while web1 stays put.' },
    { heading: 'The line that lands', text: 'The more specific source wins. If you are unsure where a value comes from, ansible-inventory --host web2 prints it.' },
    { ask: 'Where do environment-specific values live in your current scripts?' },
  ],
  dynamic: [
    { heading: 'Point at', text: 'The fourth VM appears in role_web with no file edited.' },
    { heading: 'The line that lands', text: 'Make the cloud, CMDB or virtualisation platform the source of truth and let the plugin read it.' },
    { ask: 'What is the real source of truth for your server list today?' },
  ],
};

export default {
  id: 'inventory',
  title: 'Inventories: hosts, groups and variables',
  summary: 'The inventory answers "which machines?" — grouped by role, selected with patterns, carrying the variables each host needs.',
  description: 'Hosts arranged into nested groups and selected by patterns; variables layered from group_vars and host_vars; and a cloud inventory plugin building groups from tags.',
  viewBox: '0 0 680 340',
  modes: MODES,
  buildFrames,
  renderSVG,
  metrics,
  speakerNotes: (m) => NOTES[m],
  yaml: (m) => YAML[m],
  features: (m) => FEATURES[m],
};
