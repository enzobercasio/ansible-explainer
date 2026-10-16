/**
 * Launching a job: from the Launch button to PLAY RECAP.
 *
 * "template" follows one job template launch through every component it
 * touches - gateway, controller API, PostgreSQL, Git, task manager, mesh,
 * hub, execution node, hosts - and back to the browser as live output.
 * "workflow" plays a workflow job template whose smoke test fails, so the
 * failure path runs and the success-only branch never does.
 *
 * Frame shapes:
 *   template: { st: { key: state }, flow, status, events, node, stamps, pgSub, note, badge, focus }
 *             flow: null | 'click' | 'proxy' | 'pg' | 'scm' | 'pick' | 'dispatch'
 *                   | 'pull' | 'run' | 'events' | 'stream' | 'done'
 *   workflow: { wf: { node: status }, edges: { id: state }, wstatus, note, badge, focus }
 *             node status: 'waiting' | 'running' | 'successful' | 'failed' | 'not run'
 */
import { box, zone, arrow, route, packet, seg, label, stamp, legend } from './lib/draw.js';

const MODES = [
  { id: 'template', label: 'Job template launch',
    caption: 'One click, ten components: what actually happens between Launch and PLAY RECAP' },
  { id: 'workflow', label: 'Workflow job template',
    caption: 'Job templates chained into a graph with success, failure and always edges' },
];

/* ---------- template ---------- */

const STATUSES = ['new', 'pending', 'waiting', 'running', 'successful'];
const HOSTS = [{ id: 'web1', y: 122 }, { id: 'web2', y: 166 }, { id: 'db1', y: 210 }];

// Connector geometry, shared by the line and the packet that rides it.
const P = {
  click: seg([100, 145], [122, 145]),
  proxy: seg([224, 120], [256, 79]),
  pg: 'M406 77 L428 77 L428 273 L408 273',
  scm: 'M224 262 L238 262 L238 129 L256 129',
  dispatch: seg([406, 129], [446, 146]),
  other: seg([406, 137], [446, 214]),
  pull: seg([506, 76], [506, 120]),
  events: seg([446, 162], [408, 181]),
  store: seg([332, 204], [332, 248]),
  ui: seg([256, 184], [226, 170]),
  ui2: seg([122, 160], [102, 160]),
};

function buildTemplate() {
  const f = [];
  const push = (o) => f.push({ st: {}, flow: null, status: null, events: 0, node: null, stamps: false, pgSub: 'platform state', ...o });

  push({ st: { user: 'hot' }, focus: ['name: Configure web'],
    note: 'A user clicks Launch on the "Configure web" job template',
    badge: 'In the browser, the CLI or a pipeline — the request is the same POST either way.' });
  push({ st: { user: 'run', gw: 'hot' }, flow: 'click', focus: ['POST https://gateway.example.com'],
    note: 'The request arrives at the platform gateway',
    badge: 'The gateway authenticates the session or token. It is the only way in.' });
  push({ st: { user: 'run', gw: 'term' }, focus: ['# RBAC: the user needs Execute'],
    note: 'RBAC: may this user execute this template?',
    badge: 'Roles are evaluated at the gateway. Without Execute on template 7 the request stops here with 403.' });
  push({ st: { user: 'run', gw: 'run', api: 'hot' }, flow: 'proxy',
    focus: ['/api/controller/v2/job_templates/7/launch/'],
    note: 'Proxied to the controller API',
    badge: '<code>/api/controller/v2/job_templates/7/launch/</code> — the controller validates prompts and survey answers.' });
  push({ st: { gw: 'run', api: 'run', pg: 'hot' }, flow: 'pg', status: 'pending', pgSub: 'job #42 · pending',
    focus: ['# job status: new'],
    note: 'A job record is written to PostgreSQL: new, then pending',
    badge: 'The API returns job id 42 immediately. Everything from here on is asynchronous.' });
  push({ st: { pg: 'run', git: 'hot', tm: 'term' }, flow: 'scm', status: 'pending', pgSub: 'job #42 · pending',
    focus: ['scm_update_on_launch: true'],
    note: 'Project needs updating? Sync it from Git first',
    badge: 'With update on launch, a project update runs before the job so the playbook is the latest commit.' });
  push({ st: { pg: 'run', git: 'run', tm: 'hot', ex1: 'hot', ex2: 'term' }, flow: 'pick', status: 'pending',
    pgSub: 'job #42 · pending', focus: ['instance_groups: [datacenter-east]'],
    note: 'The task manager picks capacity in the instance group',
    badge: 'exec-2 is busy; exec-1 has room. If no node had capacity, the job would simply stay pending.' });
  push({ st: { pg: 'run', tm: 'run', ex1: 'hot' }, flow: 'dispatch', status: 'waiting', node: 'exec-1',
    pgSub: 'job #42 · waiting',
    note: 'Dispatched over the mesh to exec-1',
    badge: 'Receptor carries the work unit across automation mesh — TLS on port 27199, through hop nodes if needed.' });
  push({ st: { pg: 'run', hub: 'hot', ex1: 'term' }, flow: 'pull', status: 'waiting', node: 'exec-1',
    pgSub: 'job #42 · waiting', focus: ['execution_environment: ee-web'],
    note: 'exec-1 pulls the execution environment from hub',
    badge: 'Only if it is not already cached. The job then starts inside a fresh EE container.' });
  push({ st: { pg: 'run', ex1: 'term', web1: 'term', web2: 'term', db1: 'term' }, flow: 'run', status: 'running',
    node: 'exec-1', pgSub: 'job #42 · running', focus: ['playbook: site.yml'],
    note: 'ansible-runner runs site.yml against the hosts over SSH',
    badge: 'Inventory and credentials are injected into the container; the playbook connects out from exec-1.' });
  push({ st: { pg: 'run', ex1: 'term', cr: 'hot', web1: 'term', web2: 'term', db1: 'term' }, flow: 'events',
    status: 'running', node: 'exec-1', events: 24, pgSub: 'job #42 · running',
    note: 'Job events stream back over the mesh as they happen',
    badge: 'Every task start, result and stdout line is an event, sent back to the controller while the play runs.' });
  push({ st: { pg: 'hot', cr: 'run', gw: 'hot', user: 'hot', ex1: 'term', web1: 'term', web2: 'term', db1: 'term' },
    flow: 'stream', status: 'running', node: 'exec-1', events: 57, pgSub: 'job #42 · events',
    note: 'Events are stored and shown live in the browser',
    badge: 'They land in PostgreSQL and are pushed to the UI through the gateway, so the user watches the output scroll.' });
  push({ st: { user: 'run', gw: 'run', api: 'run', tm: 'run', cr: 'run', pg: 'run', git: 'run', hub: 'run', ex1: 'run', ex2: 'run', web1: 'run', web2: 'run', db1: 'run' },
    flow: 'done', status: 'successful', node: 'exec-1', events: 61, stamps: true, pgSub: 'job #42 · successful',
    focus: ['→ successful'],
    note: 'PLAY RECAP — job #42 successful',
    badge: 'The container is removed, capacity on exec-1 is released, and the full output stays queryable in the job history.' });
  return f;
}

function renderTemplate(frame) {
  const st = (k, d = 'pend') => frame.st[k] || d;
  const fl = frame.flow;
  const on = (k) => (fl === k ? 'active' : 'idle');
  let out = '';

  // caller and front door
  out += box(16, 120, 84, 50, { state: st('user'), title: 'User', sub: 'clicks Launch' });
  out += box(124, 104, 100, 82, { state: st('gw'), title: 'Gateway', sub: 'authenticate', sub2: 'RBAC check' });
  out += arrow(100, 145, 122, 145, { state: on('click') });
  if (fl === 'click') out += packet(P.click, 'POST');

  // controller
  out += zone(246, 30, 172, 184, 'controller');
  out += box(258, 56, 148, 42, { state: st('api'), title: 'API', sub: 'POST …/launch/' });
  out += box(258, 108, 148, 42, { state: st('tm'), title: 'Task manager', sub: 'picks capacity' });
  out += box(258, 160, 148, 42, { state: st('cr'), title: 'Callback receiver', sub: 'stores job events' });
  out += arrow(224, 120, 256, 79, { state: on('proxy') });
  if (fl === 'proxy') out += packet(P.proxy);

  // state and source
  out += box(258, 250, 148, 46, { state: st('pg'), title: 'PostgreSQL', sub: frame.pgSub });
  out += box(124, 250, 100, 46, { state: st('git'), title: 'Git (SCM)', sub: 'web-app repo' });
  out += route(P.pg, { state: on('pg') });
  if (fl === 'pg') out += packet(P.pg, 'job #42');
  out += route(P.scm, { state: on('scm') });
  if (fl === 'scm') out += packet(P.scm, 'project');
  out += arrow(332, 204, 332, 248, { state: on('stream') });
  if (fl === 'stream') out += packet(P.store);

  // hub and the instance group
  out += box(446, 30, 124, 46, { state: st('hub'), title: 'Automation hub', sub: 'ee-web image' });
  out += zone(436, 96, 140, 170, 'instance group');
  out += box(448, 122, 116, 52, { state: st('ex1'), title: 'exec-1', sub: 'capacity 75% free' });
  out += box(448, 192, 116, 52, { state: st('ex2'), title: 'exec-2', sub: 'capacity 10% free' });
  out += arrow(406, 129, 446, 146, { state: fl === 'dispatch' ? 'active' : fl === 'pick' ? 'ok' : 'idle' });
  out += arrow(406, 137, 446, 214, { state: fl === 'pick' ? 'blocked' : 'idle' });
  if (fl === 'dispatch') {
    out += packet(P.dispatch, 'job');
    out += label(506, 284, 'receptor · TLS 27199', { cls: 'flow-label active', anchor: 'middle' });
  }
  out += arrow(506, 76, 506, 120, { state: on('pull') });
  if (fl === 'pull') out += packet(P.pull, 'EE');
  out += arrow(446, 162, 408, 181, { state: on('events') });
  if (fl === 'events') out += packet(P.events, 'events');

  // live output back to the browser
  if (fl === 'stream') {
    out += arrow(256, 184, 226, 170, { state: 'active' });
    out += arrow(122, 160, 102, 160, { state: 'active' });
    out += packet(P.ui);
    out += packet(P.ui2);
  }

  // managed hosts
  out += zone(588, 96, 84, 170, 'hosts');
  HOSTS.forEach((h) => {
    const live = fl === 'run' || fl === 'events' || fl === 'stream';
    out += arrow(564, 148, 594, h.y + 17, { state: live ? 'active' : fl === 'done' ? 'ok' : 'idle' });
    if (fl === 'run') out += packet(seg([564, 148], [594, h.y + 17]));
    out += box(596, h.y, 68, 34, { state: st(h.id), title: h.id });
  });
  if (frame.stamps) {
    out += stamp(630, 260, 'changed', { fresh: true });
  }

  // job lifecycle strip
  out += label(20, 333, 'job #42', { cls: 'svg-sub on-node' });
  const cur = STATUSES.indexOf(frame.status);
  STATUSES.forEach((s, i) => {
    const state = cur < 0 || i > cur ? 'pend' : i === cur && s !== 'successful' ? 'hot' : 'run';
    out += box(86 + i * 100, 316, 92, 24, { state, title: s, titleCls: 'svg-tiny', rx: 12 });
  });
  return out;
}

/* ---------- workflow ---------- */

const W = 112, H = 48;
const NODES = [
  { id: 'sync', title: 'Sync project', x: 14, y: 40 },
  { id: 'provision', title: 'Provision VM', x: 14, y: 150 },
  { id: 'configure', title: 'Configure app', x: 194, y: 150 },
  { id: 'smoke', title: 'Smoke test', x: 374, y: 150 },
  { id: 'promote', title: 'Promote', x: 554, y: 150 },
  { id: 'rollback', title: 'Rollback', x: 374, y: 262 },
  { id: 'notify', title: 'Notify team', x: 554, y: 262 },
];
const EDGES = [
  { id: 'sp', kind: 'success', d: [70, 88, 70, 148], lx: 78, ly: 122, anchor: 'start' },
  { id: 'pc', kind: 'success', d: [126, 174, 192, 174] },
  { id: 'cs', kind: 'success', d: [306, 174, 372, 174] },
  { id: 'sm', kind: 'success', d: [486, 174, 552, 174] },
  { id: 'cr', kind: 'failure', d: [290, 198, 372, 272], lx: 318, ly: 248, anchor: 'end' },
  { id: 'sr', kind: 'failure', d: [430, 198, 430, 260], lx: 438, ly: 232, anchor: 'start' },
  { id: 'rn', kind: 'always', d: [486, 286, 552, 286] },
];
const BOX_STATE = { waiting: 'pend', running: 'term', successful: 'run', failed: 'bad', 'not run': 'off' };

function buildWorkflow() {
  const f = [];
  const wf = { sync: 'waiting', provision: 'waiting', configure: 'waiting', smoke: 'waiting', promote: 'waiting', rollback: 'waiting', notify: 'waiting' };
  const edges = {};
  const push = (o) => f.push({ wstatus: 'running', ...o, wf: { ...wf }, edges: { ...edges } });

  push({ wstatus: 'new', focus: ['ansible.controller.workflow_job_template'],
    note: 'A workflow chains job templates into a graph',
    badge: 'Each node is a job template, project sync or inventory sync. Each edge fires on success, on failure, or always.' });
  wf.sync = 'running';
  push({ focus: ['identifier: sync'],
    note: 'The root node runs first: sync the project',
    badge: 'Every job downstream will use the commit this sync fetched.' });
  wf.sync = 'successful'; wf.provision = 'running'; edges.sp = 'active';
  push({ focus: ['identifier: provision'],
    note: 'Sync succeeded → the success edge fires: Provision VM',
    badge: 'Edges are evaluated when the parent finishes. Only the edge matching the outcome fires.' });
  wf.provision = 'successful'; wf.configure = 'running'; edges.sp = 'ok'; edges.pc = 'active';
  push({ focus: ['identifier: configure'],
    note: 'Provision succeeded → Configure app',
    badge: 'Workflow variables and artifacts set with set_stats flow down to the next node.' });
  wf.configure = 'successful'; wf.smoke = 'running'; edges.pc = 'ok'; edges.cs = 'active';
  push({ focus: ['identifier: smoke'],
    note: 'Configure succeeded → Smoke test',
    badge: 'Configure also has a failure edge to Rollback. It did not fail, so that edge never fires.' });
  wf.smoke = 'failed'; edges.cs = 'ok';
  push({ focus: ['name: Smoke test'],
    note: 'The smoke test fails',
    badge: 'The app answered with errors. In a plain job template this is where the story would end.' });
  wf.rollback = 'running'; wf.promote = 'not run'; edges.sr = 'active';
  push({ focus: ['failure_nodes: [{identifier: rollback}]'],
    note: 'The failure edge fires: Rollback runs, Promote never will',
    badge: 'Promote hangs off a success edge only, so it is marked do-not-run. The failure is handled, not ignored.' });
  wf.rollback = 'successful'; wf.notify = 'running'; edges.sr = 'blocked'; edges.rn = 'active';
  push({ focus: ['always_nodes: [{identifier: notify}]'],
    note: 'Rollback finished → the always edge notifies the team',
    badge: 'An always edge fires whatever the parent’s outcome — the natural place for notifications and cleanup.' });
  wf.notify = 'successful'; edges.rn = 'ok';
  push({ wstatus: 'successful',
    note: 'The workflow ends: six nodes ran, one failed, one never ran',
    badge: 'A failure with a failure path counts as handled, so the workflow job itself can still end successful — check the node statuses, not just the top line.' });
  push({ wstatus: 'successful', focus: ['success_nodes: [{identifier: promote}]', 'failure_nodes: [{identifier: rollback}]'],
    note: 'Success, failure, always: three edge types make the error handling explicit',
    badge: 'The graph is the runbook — including what to do when it goes wrong.' });
  return f;
}

function renderWorkflow(frame) {
  let out = '';
  out += box(194, 40, 292, 56, { state: frame.wstatus === 'successful' ? 'run' : frame.wstatus === 'new' ? 'pend' : 'term',
    title: 'Deploy web app', sub: `workflow job · ${frame.wstatus}` });

  EDGES.forEach((e) => {
    const [x1, y1, x2, y2] = e.d;
    const s = frame.edges[e.id] || 'idle';
    out += arrow(x1, y1, x2, y2, { state: s, label: e.kind, lx: e.lx, ly: e.ly ?? y1 - 8, anchor: e.anchor || 'middle' });
    if (s === 'active') out += packet(seg([x1, y1], [x2, y2]));
  });

  NODES.forEach((n) => {
    const s = frame.wf[n.id];
    out += box(n.x, n.y, W, H, { state: BOX_STATE[s], title: n.title, sub: s });
  });

  out += legend('Green: success edge fired. Red: failure edge fired. Grey dotted: never ran.', 338);
  return out;
}

/* ---------- module ---------- */

const buildFrames = (m) => (m === 'workflow' ? buildWorkflow() : buildTemplate());
const renderSVG = (frame) => (frame.wf ? renderWorkflow(frame) : renderTemplate(frame));

function metrics(frame) {
  if (frame.wf) {
    const v = Object.values(frame.wf);
    const ran = v.filter((s) => s === 'successful' || s === 'failed').length;
    const failed = v.filter((s) => s === 'failed').length;
    const skipped = v.filter((s) => s === 'not run').length;
    return [
      { label: 'Nodes finished', value: `${ran} / 7`, tone: ran ? 'ok' : undefined },
      { label: 'Failed', value: failed, tone: failed ? 'bad' : undefined },
      { label: 'Not run', value: skipped, tone: skipped ? 'warn' : undefined },
    ];
  }
  const tone = { successful: 'ok', running: 'warn', waiting: 'warn', pending: 'warn' }[frame.status];
  return [
    { label: 'Job #42 status', value: frame.status || '—', tone },
    { label: 'Events received', value: frame.events, tone: frame.events ? 'ok' : undefined },
    { label: 'Running on', value: frame.node || '—' },
  ];
}

const YAML = {
  template: `# What the Launch button sends (via the gateway)
POST https://gateway.example.com
     /api/controller/v2/job_templates/7/launch/
# RBAC: the user needs Execute on this template

# The template it launches (ansible.controller)
- ansible.controller.job_template:
    name: Configure web
    project: web-app
    playbook: site.yml
    inventory: production
    credentials: [web-ssh]
    execution_environment: ee-web
    instance_groups: [datacenter-east]

- ansible.controller.project:
    name: web-app
    scm_type: git
    scm_url: https://git.example.com/web-app.git
    scm_update_on_launch: true

# job status: new → pending → waiting → running
#             → successful | failed | error | canceled`,
  workflow: `# abbreviated — the workflow as code
- ansible.controller.workflow_job_template:
    name: Deploy web app
    organization: Default
    workflow_nodes:
      - identifier: sync
        unified_job_template: {name: web-app, type: project}
        related:
          success_nodes: [{identifier: provision}]
      - identifier: provision
        unified_job_template:
          {name: Provision VM, type: job_template}
        related:
          success_nodes: [{identifier: configure}]
      - identifier: configure
        unified_job_template:
          {name: Configure app, type: job_template}
        related:
          success_nodes: [{identifier: smoke}]
          failure_nodes: [{identifier: rollback}]
      - identifier: smoke
        unified_job_template:
          {name: Smoke test, type: job_template}
        related:
          success_nodes: [{identifier: promote}]
          failure_nodes: [{identifier: rollback}]
      - identifier: rollback
        unified_job_template:
          {name: Rollback, type: job_template}
        related:
          always_nodes: [{identifier: notify}]
      # promote and notify: leaf nodes, omitted`,
};

const FEATURES = {
  template: [
    { name: 'Gateway RBAC', kind: 'platform gateway', what: 'Authenticates the caller and checks the Execute role on the template before the controller ever sees the request.' },
    { name: 'Job template', kind: 'ansible.controller', what: 'Bundles project, playbook, inventory, credentials, execution environment and instance groups into one launchable unit.' },
    { name: 'Task manager', kind: 'controller', what: 'Moves jobs from pending to waiting by finding an instance with capacity in an allowed instance group.' },
    { name: 'Automation mesh', kind: 'Receptor · 27199', what: 'Carries the job to the execution node and the job events back, over TLS, through hop nodes where needed.' },
    { name: 'Job events', kind: 'callback receiver', what: 'Each task result streams back, is stored in PostgreSQL, and is pushed live to the UI through the gateway.' },
  ],
  workflow: [
    { name: 'Workflow job template', kind: 'ansible.controller', what: 'A graph of job templates, project syncs and inventory syncs, launched and tracked as one job.' },
    { name: 'success_nodes / failure_nodes', kind: 'edges', what: 'Children that run only if the parent succeeded, or only if it failed. The other branch is marked do-not-run.' },
    { name: 'always_nodes', kind: 'edge', what: 'Children that run whatever the outcome — notifications, cleanup, ticket updates.' },
    { name: 'identifier', kind: 'workflow node', what: 'A stable name for each node so the graph can be defined and updated as code.' },
  ],
};

const NOTES = {
  template: [
    { heading: 'Point at', text: 'The status strip along the bottom. Pending means waiting for capacity; waiting means dispatched but not yet started. Most "my job is stuck" questions are one of those two.' },
    { heading: 'The line that lands', text: 'The user only ever talks to the gateway. Everything after the click — database, Git, task manager, mesh, hub — happens behind it, and every step is observable.' },
    { ask: 'When a job sits in pending, which component would you look at first?' },
  ],
  workflow: [
    { heading: 'Point at', text: 'Promote going grey the moment Smoke test fails. Nobody wrote an if-statement; the edge type decided it.' },
    { heading: 'The line that lands', text: 'Workflows turn "what do we do when it breaks" from tribal knowledge into a reviewed part of the automation.' },
    { ask: 'Which of your deployments today has a rollback that is written down and tested?' },
  ],
};

export default {
  id: 'job-launch-flow',
  title: 'Launching a job: from click to PLAY RECAP',
  summary: 'Follow one job through gateway, controller, PostgreSQL, Git, task manager, mesh, hub and execution node — then chain jobs into a workflow with failure handling.',
  description: 'A user launches a job template. The request passes the gateway, reaches the controller API, is recorded in PostgreSQL, the project syncs from Git, the task manager dispatches it over the mesh to an execution node that pulls an EE and runs the playbook, and events stream back to the browser. A second mode plays a workflow whose smoke test fails and triggers a rollback.',
  advanced: true,
  viewBox: '0 0 680 350',
  modes: MODES,
  buildFrames,
  renderSVG,
  metrics,
  speakerNotes: (m) => NOTES[m],
  yaml: (m) => YAML[m],
  features: (m) => FEATURES[m],
};
