/**
 * AAP 2.7 at a glance: the platform components and the one front door.
 *
 * The opener for the AAP group. "layers" assembles the architecture one
 * component per frame and then sends a single request through it; "gateway"
 * is the 2.7 change that breaks old scripts - direct component API access is
 * gone and every call goes through the platform gateway.
 *
 * Frame shapes:
 *   layers:  { shown: string[], fresh, st: { key: state }, flow, note, badge, focus }
 *            flow: null | 'in' | 'route' | 'mesh' | 'ssh' | 'recap'
 *   gateway: { direct, via, target, pk, gw, comp: { controller, hub, eda },
 *              local, auth, refused, entries, fresh, note, badge, focus }
 *   box states: 'pend' | 'run' | 'term' | 'hot' | 'bad' | 'off'
 */
import { box, zone, arrow, route, packet, seg, label, legend } from './lib/draw.js';

const MODES = [
  { id: 'layers', label: 'Build it up',
    caption: 'One component per step: who calls in, what answers, where data lives, where jobs run' },
  { id: 'gateway', label: '2.7: one front door',
    caption: 'Direct component APIs are gone — every request is authenticated and routed by the gateway' },
];

/* ---------- layers ---------- */

// Every key a frame can introduce, in build order.
const ORDER = ['clients', 'gateway', 'controller', 'hub', 'eda', 'metrics', 'data', 'mesh', 'hosts'];
const SERVICES = [
  { id: 'controller', title: 'Controller', sub: 'jobs · inventories', y: 40 },
  { id: 'hub', title: 'Automation hub', sub: 'collections · EE images', y: 88 },
  { id: 'eda', title: 'EDA controller', sub: 'rulebook activations', y: 136 },
  { id: 'metrics', title: 'Metrics service', sub: 'mandatory in 2.7', y: 184 },
];
const CLIENTS = [
  { id: 'browser', title: 'Browser', sub: 'web UI', y: 60 },
  { id: 'api', title: 'API / CLI', sub: 'scripts', y: 118 },
  { id: 'hook', title: 'Webhook', sub: 'events in', y: 176 },
];
const HOSTS = [
  { id: 'web1', y: 44 }, { id: 'web2', y: 92 }, { id: 'db1', y: 140 }, { id: 'edge1', y: 188 },
];
const EXEC = [
  { id: 'exec1', title: 'Exec node 1', y: 110 },
  { id: 'exec2', title: 'Exec node 2', y: 176 },
];

// Path from the browser through gateway, controller, hop and exec node 1.
const P_IN = seg([96, 80], [124, 80]);
const P_ROUTE = seg([218, 60], [240, 60]);
const P_MESH = seg([408, 60], [438, 64], [498, 84], [498, 108]);

function buildLayers() {
  const f = [];
  const shown = [];
  const intro = (key, o) => { shown.push(key); f.push({ shown: [...shown], fresh: key, st: {}, flow: null, ...o }); };
  const push = (o) => f.push({ shown: [...ORDER], fresh: null, flow: null, ...o });

  intro('clients', { focus: ['# who calls in'],
    note: 'Start with who talks to the platform',
    badge: 'People in a browser, scripts and CI pipelines calling the API, and external systems sending webhooks or events.' });
  intro('gateway', { focus: ['gateway:'],
    note: 'The platform gateway: the single front door',
    badge: 'UI, API, authentication, RBAC and routing all live here. In 2.7 it is the <b>only</b> entry point — clients reach it on 443.' });
  intro('controller', { focus: ['automation_controller:'],
    note: 'Automation controller runs your automation',
    badge: 'Job templates, inventories, credentials, projects and schedules. Its task manager decides which job runs where.' });
  intro('hub', { focus: ['private_automation_hub:'],
    note: 'Private automation hub stores content',
    badge: 'Certified and internal collections, plus a container registry for execution environment images.' });
  intro('eda', { focus: ['eda_controller:'],
    note: 'Event-Driven Ansible reacts to events',
    badge: 'Rulebook activations listen to sources such as webhooks or Kafka and launch automation when a rule matches.' });
  intro('metrics', { focus: ['metrics_service:'],
    note: 'The metrics service is now a required component',
    badge: 'In 2.7 it is mandatory rather than optional — plan it into every topology.' });
  intro('data', { focus: ['postgresql:', 'redis:'],
    note: 'Shared state: PostgreSQL and Redis',
    badge: 'PostgreSQL (16 or 17) holds the platform state — jobs, events, RBAC. Redis handles caching and queues.' });
  intro('mesh', { focus: ['automation_mesh:', 'protocol: receptor'],
    note: 'Automation mesh carries jobs to execution nodes',
    badge: 'A Receptor overlay network over TLS on port 27199. Hop nodes relay; execution nodes run the jobs inside EE containers.' });
  intro('hosts', {
    note: 'Execution nodes reach the managed infrastructure',
    badge: 'Place execution nodes near what they manage — another datacenter, a cloud VPC, an edge site — and route to them through hops.' });

  push({ flow: 'in', st: { browser: 'hot', gateway: 'hot' },
    note: 'A user clicks Launch — the request goes to the gateway',
    badge: 'One URL for everything. The browser never talks to the controller host directly.' });
  push({ flow: 'route', st: { gateway: 'term', controller: 'hot', pg: 'term' },
    note: 'Gateway authenticates, checks RBAC, and routes to the controller',
    badge: 'The controller records a new job in PostgreSQL and its task manager picks capacity.' });
  push({ flow: 'mesh', st: { controller: 'term', hop: 'hot', exec1: 'hot' },
    focus: ['protocol: receptor'],
    note: 'The job travels the mesh: controller → hop → execution node',
    badge: 'Receptor routes the work unit across the overlay; the execution node starts an EE container to run it.' });
  push({ flow: 'ssh', st: { exec1: 'term', web1: 'term', web2: 'term' },
    note: 'The playbook runs against the hosts from the execution node',
    badge: 'SSH (or WinRM, or an API) from the node nearest the hosts. Events stream back over the mesh as it runs.' });
  push({ flow: 'recap', fresh: 'install', st: {}, focus: ['install:', '- containerized', '- operator'],
    note: 'The whole platform: one door, shared data, a mesh to where the work is',
    badge: 'Install it containerized on RHEL with Podman, or with the Operator on OpenShift. The RPM installer is gone in 2.7.' });
  return f;
}

function renderLayers(frame) {
  const has = (k) => frame.shown.includes(k);
  const recap = frame.flow === 'recap';
  const appear = (k) => (frame.fresh === k ? 'appear' : '');
  // Introduced this frame = hot; then idle grey; everything green on the recap.
  const st = (id, key = id) => frame.st[id] || (frame.fresh === key ? 'hot' : recap ? 'run' : 'pend');
  let out = '';

  if (has('clients')) {
    out += `<g class="${appear('clients')}">${zone(8, 30, 96, 196, 'clients')}`;
    CLIENTS.forEach((c) => {
      out += box(16, c.y, 80, 40, { state: st(c.id, 'clients'), title: c.title, sub: c.sub });
    });
    out += '</g>';
  }

  if (has('gateway')) {
    out += zone(116, 14, 302, 222, 'AAP 2.7 platform');
    out += box(126, 40, 92, 186, { state: st('gateway'), title: 'Gateway', sub: 'auth · RBAC', sub2: 'routing · 443', cls: appear('gateway') });
    if (has('clients')) {
      CLIENTS.forEach((c) => {
        const live = frame.flow === 'in' && c.id === 'browser';
        out += arrow(96, c.y + 20, 124, c.y + 20, { state: live ? 'active' : 'idle' });
      });
    }
  }
  if (frame.flow === 'in') out += packet(P_IN, 'launch');

  SERVICES.forEach((s) => {
    if (!has(s.id)) return;
    const live = frame.flow === 'route' && s.id === 'controller';
    out += arrow(218, s.y + 20, 240, s.y + 20, { state: live ? 'active' : 'idle' });
    out += box(242, s.y, 166, 40, { state: st(s.id), title: s.title, sub: s.sub, cls: appear(s.id) });
  });
  if (frame.flow === 'route') out += packet(P_ROUTE);

  if (has('data')) {
    const live = frame.flow === 'route';
    out += `<g class="${appear('data')}">`;
    out += zone(116, 252, 302, 74, 'data');
    out += box(126, 276, 136, 40, { state: st('pg', 'data'), title: 'PostgreSQL', sub: 'PG 16 / 17' });
    out += box(272, 276, 136, 40, { state: st('redis', 'data'), title: 'Redis', sub: 'cache · queues' });
    out += arrow(172, 228, 172, 274, { state: live ? 'active' : 'idle', both: true });
    out += arrow(325, 226, 325, 274, { both: true });
    out += label(248, 248, 'shared state', { cls: 'flow-label', anchor: 'middle' });
    out += '</g>';
  }

  if (has('mesh')) {
    const live = frame.flow === 'mesh';
    out += `<g class="${appear('mesh')}">`;
    out += zone(428, 14, 140, 222, 'automation mesh');
    out += box(440, 44, 116, 40, { state: st('hop', 'mesh'), title: 'Hop node', sub: 'receptor · 27199' });
    EXEC.forEach((e) => {
      out += box(440, e.y, 116, 44, { state: st(e.id, 'mesh'), title: e.title, sub: 'runs EEs' });
    });
    out += arrow(408, 60, 438, 64, { state: live ? 'active' : 'idle' });
    out += arrow(498, 84, 498, 108, { state: live ? 'active' : 'idle' });
    out += route('M556 64 L563 64 L563 198 L558 198');
    out += '</g>';
  }
  if (frame.flow === 'mesh') out += packet(P_MESH, 'job');

  if (has('hosts')) {
    out += `<g class="${appear('hosts')}">`;
    out += zone(580, 14, 92, 222, 'hosts');
    HOSTS.forEach((h, i) => {
      const from = i < 2 ? [557, 124] : [557, 210];
      const live = frame.flow === 'ssh' && i < 2;
      out += arrow(from[0], from[1], 588, h.y + 17, { state: live ? 'active' : 'idle' });
      out += box(590, h.y, 72, 34, { state: st(h.id, 'hosts'), title: h.id });
    });
    out += '</g>';
  }
  if (frame.flow === 'ssh') {
    out += packet(seg([557, 124], [588, 61]), 'SSH');
    out += packet(seg([557, 124], [588, 109]));
  }

  if (recap) {
    out += `<g class="appear">${zone(428, 252, 244, 74, 'installed as')}`;
    out += label(440, 286, 'Containerized · RHEL + Podman', { cls: 'svg-tiny on-node' });
    out += label(440, 302, 'Operator · OpenShift', { cls: 'svg-tiny on-node' });
    out += label(440, 318, 'RPM installer: removed in 2.7', { cls: 'svg-tiny on-node' });
    out += '</g>';
  }

  out += legend('Clients only ever see the gateway. Everything behind it shares one database and one mesh.', 354);
  return out;
}

/* ---------- gateway ---------- */

const COMP = [
  { id: 'controller', title: 'Controller', sub: 'controller.example.com', y: 58, path: '/api/controller/v2/' },
  { id: 'hub', title: 'Automation hub', sub: 'hub.example.com', y: 148, path: '/api/galaxy/' },
  { id: 'eda', title: 'EDA controller', sub: 'eda.example.com', y: 238, path: '/api/eda/v1/' },
];
const GW_OUT = { controller: [368, 150, 464, 98], hub: [368, 178, 464, 176], eda: [368, 206, 464, 260] };
const DIRECT = 'M64 150 L64 86 L462 86';

function buildGateway() {
  const f = [];
  const base = { direct: null, via: null, target: null, pk: false, gw: 'pend', local: false, fresh: null,
    comp: { controller: 'pend', hub: 'pend', eda: 'pend' }, auth: 0, refused: 0, entries: 1 };
  const push = (o) => f.push({ ...base, ...o, comp: { ...base.comp, ...(o.comp || {}) } });

  push({ entries: 4,
    note: 'A script that launches a job template',
    badge: 'Up to 2.6 it could talk to each component host directly — or through the gateway. Four doors in total.' });
  push({ direct: 'active', pk: true, entries: 4, comp: { controller: 'hot' },
    focus: ['# 2.6 and earlier', 'CTL=https://controller.example.com'],
    note: 'The old habit: POST straight to the controller host',
    badge: '<code>controller.example.com/api/v2/job_templates/7/launch/</code> with basic auth or a controller token.' });
  push({ direct: 'blocked', refused: 1, fresh: '401', comp: { controller: 'pend' },
    focus: ['# 2.7: 401 Unauthorized'],
    note: 'In 2.7 that request gets HTTP 401',
    badge: 'Direct API access to controller, hub and EDA was removed, along with the 2.5/2.6 compatibility layer. The script breaks.' });
  push({ direct: 'blocked', refused: 1, via: 'active', target: 'controller', pk: true, gw: 'hot',
    focus: ['GW=https://gateway.example.com', '$GW/api/controller/v2/'],
    note: 'Same call, sent to the gateway instead',
    badge: 'Only the path changes: <code>https://gateway.example.com/api/controller/v2/…</code>' });
  push({ direct: 'blocked', refused: 1, via: 'active', target: 'controller', gw: 'term', auth: 1,
    focus: ['Authorization: Bearer $TOKEN'],
    note: 'The gateway authenticates the caller and checks RBAC',
    badge: 'One token, issued by the gateway. One RBAC decision: may this identity execute template 7?' });
  push({ direct: 'blocked', refused: 1, via: 'ok', target: 'controller', pk: true, gw: 'run', auth: 1,
    comp: { controller: 'hot' },
    note: 'Then it proxies the request to the controller',
    badge: 'The controller receives an already-authenticated request. The job launches; the script gets its job id back.' });
  push({ direct: 'blocked', refused: 1, via: 'ok', target: 'hub', pk: true, gw: 'run', auth: 2,
    comp: { controller: 'run', hub: 'hot' }, focus: ['$GW/api/galaxy/'],
    note: 'Hub content: same door, /api/galaxy/',
    badge: 'Collection and EE image API calls that used to go to the hub host now go through the gateway too.' });
  push({ direct: 'blocked', refused: 1, via: 'ok', target: 'eda', pk: true, gw: 'run', auth: 3,
    comp: { controller: 'run', hub: 'run', eda: 'hot' }, focus: ['$GW/api/eda/v1/activations/'],
    note: 'Event-Driven Ansible: same door, /api/eda/v1/',
    badge: 'Rulebook activations, decision environments, event streams — all behind the gateway.' });
  push({ direct: 'blocked', refused: 1, gw: 'hot', auth: 3, local: true, fresh: 'local',
    comp: { controller: 'run', hub: 'run', eda: 'run' },
    note: 'Component basic auth and component tokens are gone',
    badge: 'No basic auth and no Personal Access Tokens at the component level. Authentication, tokens and RBAC live in one place.' });
  push({ refused: 1, gw: 'run', auth: 3, local: true,
    comp: { controller: 'run', hub: 'run', eda: 'run' }, focus: ['ansible.platform'],
    note: 'One front door: change the URL, keep the automation',
    badge: 'Audit scripts, CI jobs and config-as-code for component hostnames before you upgrade. ansible.platform targets the gateway API.' });
  return f;
}

function renderGateway(frame) {
  let out = '';

  // component hosts
  out += zone(448, 30, 220, 290, 'component hosts');
  COMP.forEach((c) => {
    out += box(466, c.y, 184, 56, { state: frame.comp[c.id], title: c.title, sub: c.sub,
      sub2: frame.local ? 'local auth removed' : '', cls: frame.local && frame.fresh === 'local' ? 'appear' : '' });
  });

  // the script
  out += box(16, 150, 96, 56, { state: frame.direct || frame.via ? 'hot' : 'pend', title: 'Script', sub: 'curl · CI job' });

  // the gateway
  out += label(306, 112, 'gateway.example.com', { cls: 'flow-label', anchor: 'middle' });
  out += box(244, 120, 124, 116, { state: frame.gw, title: 'Gateway', sub: 'authenticate', sub2: 'RBAC · proxy' });

  // direct path, drawn over the gateway
  if (frame.direct) {
    out += route(DIRECT, { state: frame.direct, label: 'controller.example.com/api/v2/', lx: 74, ly: 78, anchor: 'start' });
    if (frame.direct === 'active' && frame.pk) out += packet(DIRECT, 'POST');
    if (frame.direct === 'blocked') {
      out += box(366, 70, 76, 32, { state: 'bad', title: 'HTTP 401', cls: frame.fresh === '401' ? 'appear' : '' });
    }
  }

  // via the gateway
  const t = COMP.find((c) => c.id === frame.target);
  out += arrow(112, 178, 242, 178, { state: frame.via || 'idle', label: t ? t.path : '', lx: 176, ly: 170 });
  if (frame.via === 'active' && frame.pk) out += packet(seg([112, 178], [242, 178]), 'POST');
  COMP.forEach((c) => {
    const [x1, y1, x2, y2] = GW_OUT[c.id];
    const live = frame.target === c.id && frame.via === 'ok';
    out += arrow(x1, y1, x2, y2, { state: live ? 'ok' : 'idle' });
    if (live && frame.pk) out += packet(seg([x1, y1], [x2, y2]));
  });

  out += legend('2.7: requests to component hosts return 401. One URL, one token, one RBAC decision.', 340);
  return out;
}

/* ---------- module ---------- */

const buildFrames = (m) => (m === 'gateway' ? buildGateway() : buildLayers());
const renderSVG = (frame) => (frame.comp ? renderGateway(frame) : renderLayers(frame));

function metrics(frame) {
  if (frame.comp) {
    return [
      { label: 'Entry points', value: frame.entries, tone: frame.entries === 1 ? 'ok' : 'warn' },
      { label: 'Auth decisions at gateway', value: frame.auth, tone: frame.auth ? 'ok' : undefined },
      { label: 'Direct calls refused', value: frame.refused, tone: frame.refused ? 'bad' : undefined },
    ];
  }
  const platform = ['gateway', 'controller', 'hub', 'eda', 'metrics', 'data', 'mesh'];
  const pieces = { data: 2, mesh: 3 };
  const n = platform.filter((k) => frame.shown.includes(k)).reduce((a, k) => a + (pieces[k] || 1), 0);
  return [
    { label: 'Components shown', value: `${n} / 10` },
    { label: 'Entry points', value: frame.shown.includes('gateway') ? '1' : '0', tone: frame.shown.includes('gateway') ? 'ok' : undefined },
    { label: 'Mesh nodes', value: frame.shown.includes('mesh') ? '3' : '0' },
  ];
}

const YAML = {
  layers: `# AAP 2.7 — the pieces and what each owns
# (a conceptual map, not an installer file)

# who calls in: browser, API / CLI, webhooks

platform:
  gateway:                  # the only entry point, :443
    owns: [ui, api, authentication, rbac, routing]
  automation_controller:
    owns: [job_templates, inventories, credentials,
           projects, schedules, task_manager]
  private_automation_hub:
    owns: [collections, ee_image_registry]
  eda_controller:
    owns: [rulebook_activations]
  metrics_service: {}       # mandatory in 2.7

data:
  postgresql: "16 or 17"    # shared platform state
  redis: cache and queues

automation_mesh:
  protocol: receptor        # TLS, port 27199
  nodes: [control, hybrid, hop, execution]

install:                    # RPM installer removed in 2.7
  - containerized           # RHEL + Podman
  - operator                # OpenShift`,
  gateway: `# Launch job template 7 from a script

# 2.6 and earlier — direct to the component host
CTL=https://controller.example.com
curl -u admin:**** -X POST \\
  $CTL/api/v2/job_templates/7/launch/
# 2.7: 401 Unauthorized — direct access removed

# 2.7 — everything goes through the gateway
GW=https://gateway.example.com
curl -H "Authorization: Bearer $TOKEN" -X POST \\
  $GW/api/controller/v2/job_templates/7/launch/

# same front door for content and events
curl -H "Authorization: Bearer $TOKEN" \\
  $GW/api/galaxy/
curl -H "Authorization: Bearer $TOKEN" \\
  $GW/api/eda/v1/activations/

# config as code: the ansible.platform collection
# also talks to the gateway API`,
};

const FEATURES = {
  layers: [
    { name: 'Platform gateway', kind: 'component', what: 'Single entry point for UI and API. Owns authentication, RBAC and routing to every service behind it.' },
    { name: 'Automation controller', kind: 'component', what: 'Job templates, inventories, credentials, projects and schedules. Its task manager dispatches jobs onto capacity.' },
    { name: 'Private automation hub', kind: 'component', what: 'Collections plus a container registry for execution environment images.' },
    { name: 'Event-Driven Ansible', kind: 'component', what: 'Rulebook activations that turn incoming events into automation runs.' },
    { name: 'Automation mesh', kind: 'Receptor overlay', what: 'Control, hybrid, hop and execution nodes linked over TLS on 27199, so jobs run close to the hosts they manage.' },
  ],
  gateway: [
    { name: 'Gateway-only API', kind: '2.7 change', what: 'Direct API access to controller, hub and EDA hosts is removed; those requests return 401. Use /api/controller/v2/, /api/galaxy/, /api/eda/v1/ on the gateway.' },
    { name: 'Consolidated auth', kind: '2.7 change', what: 'Component-level basic auth and Personal Access Tokens are gone. Tokens, authenticators and RBAC are managed once, in the gateway.' },
    { name: 'ansible.platform', kind: 'collection', what: 'Configuration as code for gateway resources — organizations, users, authenticators — through the gateway API.' },
    { name: 'Upgrade path', kind: 'lifecycle', what: 'Only 2.6 → 2.7 is supported. The 2.5/2.6 compatibility layer that tolerated direct calls no longer exists.' },
  ],
};

const NOTES = {
  layers: [
    { heading: 'Point at', text: 'The gateway is the only box with arrows coming in from outside. Everything else — controller, hub, EDA, data, mesh — sits behind it.' },
    { heading: 'The line that lands', text: 'The controller decides what runs; the mesh decides where it runs. That split is why one platform can manage a datacenter, a cloud and an edge site at once. Also in 2.7: Lightspeed assistants, a self-service portal, and an MCP server and automation dashboard in Technology Preview.' },
    { ask: 'Where are your managed hosts, and how many network hops away from your controller are they?' },
  ],
  gateway: [
    { heading: 'Point at', text: 'The red 401 box on the direct path. Nothing about the request is wrong except the hostname it was sent to.' },
    { heading: 'The line that lands', text: 'Upgrading to 2.7 is a URL migration for every script, pipeline and CaC repo that knows a component hostname — find them before the upgrade, not after.' },
    { ask: 'How many of your scripts or pipelines call controller.example.com directly today?' },
  ],
};

export default {
  id: 'aap-overview',
  title: 'AAP 2.7: the platform at a glance',
  summary: 'Gateway, controller, hub, Event-Driven Ansible, metrics, shared data and the automation mesh — and why 2.7 has exactly one front door.',
  description: 'The AAP 2.7 architecture assembles component by component: clients, platform gateway, automation controller, automation hub, EDA controller, metrics service, PostgreSQL and Redis, automation mesh and managed hosts. A second mode shows direct component API calls refused with 401 while the same calls through the gateway succeed.',
  advanced: true,
  viewBox: '0 0 680 365',
  modes: MODES,
  buildFrames,
  renderSVG,
  metrics,
  speakerNotes: (m) => NOTES[m],
  yaml: (m) => YAML[m],
  features: (m) => FEATURES[m],
};
