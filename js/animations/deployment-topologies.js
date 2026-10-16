/**
 * Deploying AAP 2.7: the three shapes a platform install can take.
 *
 * 2.7 has exactly two installers - the containerized installer (Podman on
 * RHEL) and the operator (OpenShift); the RPM installer is gone. The
 * containerized installer has two tested topologies, growth and enterprise.
 * The point of the three modes is what happens when one piece dies: growth
 * loses everything, enterprise loses one of two, the operator puts it back.
 *
 * Frame shape (per mode; fields another mode draws are absent):
 *   { mode, st: { component: state }, links: { key: arrow state }, pk: [[pathKey, label]...],
 *     stamp, freshStamp, fresh: [component...], note, badge, focus }
 *   st values are box states: 'pend' | 'run' | 'term' | 'hot' | 'bad' | 'off'
 */
import { box, zone, arrow, route, packet, seg, label, stamp, legend } from './lib/draw.js';

const MODES = [
  { id: 'growth', label: 'Container growth',
    caption: 'Every component as a Podman container on one RHEL VM — small, simple, no redundancy' },
  { id: 'enterprise', label: 'Container enterprise',
    caption: 'Everything at least twice, behind a load balancer, with external PostgreSQL' },
  { id: 'operator', label: 'Operator on OpenShift',
    caption: 'Apply one custom resource; the operator creates and keeps the pods running' },
];

/* ---------- geometry ---------- */

// growth: 3 x 2 container grid inside one VM
const G = {
  gw: [40, 80, 125, 56, 'gateway', 'entry point'],
  hub: [185, 80, 125, 56, 'hub', 'collections, EEs'],
  ctrl: [330, 80, 125, 56, 'controller', 'hybrid node'],
  eda: [40, 160, 125, 56, 'EDA', 'rulebooks'],
  pg: [185, 160, 125, 56, 'PostgreSQL', 'database'],
  redis: [330, 160, 125, 56, 'Redis', 'cache'],
};

// enterprise
const E = {
  lb: [175, 16, 170, 42, 'load balancer', ''],
  gw1: [95, 82, 130, 42, 'gateway1', ''],
  gw2: [295, 82, 130, 42, 'gateway2', ''],
  hub1: [25, 174, 70, 38, 'hub1', ''],
  hub2: [102, 174, 70, 38, 'hub2', ''],
  eda1: [200, 174, 70, 38, 'eda1', ''],
  eda2: [277, 174, 70, 38, 'eda2', ''],
  ctrl1: [375, 174, 68, 38, 'ctrl1', ''],
  ctrl2: [450, 174, 68, 38, 'ctrl2', ''],
  store: [15, 250, 165, 44, 'shared storage', 'hub content (NFS)'],
  redis: [190, 250, 165, 44, 'Redis cluster', 'on 6 AAP VMs'],
  pg: [365, 250, 160, 44, 'PostgreSQL', 'external database'],
  ex1: [550, 140, 106, 44, 'exec1', 'execution'],
  ex2: [550, 200, 106, 44, 'exec2', 'execution'],
};

// operator: pods in a 3 x 2 grid, gateway nearest the Route
const O = {
  hub: [205, 60, 105, 52, 'hub', 'pod'],
  eda: [320, 60, 105, 52, 'EDA', 'pod'],
  gw: [435, 60, 105, 52, 'gateway', 'pod'],
  pg: [205, 130, 105, 52, 'PostgreSQL', 'pod'],
  redis: [320, 130, 105, 52, 'Redis', 'pod'],
  ctrl: [435, 130, 105, 52, 'controller', 'pod'],
};
const POD_IDS = Object.keys(O);

const PATHS = {
  'g-user': 'M510 62 H102 V80',
  'g-ctrl-host': seg([455, 126], [510, 265]),
  'g-ctrl-ex': seg([455, 108], [510, 180]),
  'g-ex-host': seg([585, 212], [585, 250]),
  'e-user': seg([60, 37], [175, 37]),
  'e-lb-gw1': seg([230, 58], [160, 82]),
  'e-lb-gw2': seg([290, 58], [360, 82]),
  'e-gw1-ctrl': 'M160 124 V138 H445 V150',
  'e-gw2-ctrl': 'M360 124 V138 H445 V150',
  'e-ctrl-ex1': seg([525, 186], [550, 162]),
  'e-ctrl-ex2': seg([525, 186], [550, 222]),
  'o-route': seg([610, 26], [610, 60], [565, 86], [540, 86]),
  'o-cr-op': seg([105, 112], [105, 160]),
  'o-op-pods': seg([180, 186], [205, 160]),
  'o-ctrl-job': seg([487, 182], [487, 245]),
};

/* ---------- frames ---------- */

function buildFrames(modeId) {
  const f = [];
  const push = (o) => f.push({ mode: modeId, links: {}, pk: [], stamp: '', ...o });

  if (modeId === 'growth') {
    const all = (s) => ({ gw: s, hub: s, ctrl: s, eda: s, pg: s, redis: s });
    const up = { ...all('run'), ex: 'off', hosts: 'pend' };
    push({ st: { ...all('off'), ex: 'off', hosts: 'pend' },
      note: 'Growth topology: one RHEL VM, nothing on it yet',
      badge: 'AAP 2.7 installs two ways: the <b>containerized installer</b> on RHEL, or the <b>operator</b> on OpenShift. The RPM installer is gone.' });
    push({ st: { ...all('term'), ex: 'off', hosts: 'pend' }, focus: ['ansible.containerized_installer.install'],
      note: 'The containerized installer starts each component as a Podman container',
      badge: 'It is an Ansible collection you run with ansible-playbook. Every group in the inventory points at the same host.' });
    push({ st: up, focus: ['aap.example.org'],
      note: 'Gateway, controller, hub, EDA, PostgreSQL and Redis — all on one host',
      badge: 'The database runs here too, as a container (<code>[database]</code>). Small footprint, one machine to back up.' });
    push({ st: { ...up, gw: 'hot' }, links: { user: 'active' }, pk: [['g-user', 'https']], focus: ['[automationgateway]'],
      note: 'Users and API clients only ever talk to the gateway',
      badge: 'The platform gateway is the single entry point: UI, API, authentication, RBAC and routing for every component.' });
    push({ st: { ...up, ctrl: 'term', hosts: 'term' }, links: { user: 'ok', ctrlHost: 'active' }, pk: [['g-ctrl-host', 'ssh']],
      focus: ['[automationcontroller]'],
      note: 'A job runs on the controller itself — it is a hybrid node',
      badge: 'Hybrid means control and execution on one node. Fine at this size; heavy jobs compete with the UI and API.' });
    push({ st: { ...up, ex: 'hot', hosts: 'pend' }, links: { user: 'ok', ctrlEx: 'ok' }, fresh: ['ex'], focus: ['[execution_nodes]', 'exec1.example.org'],
      note: 'Optionally, add an execution node to take the jobs',
      badge: 'Growth allows one or more execution nodes outside the VM. The rest of the platform stays on one host.' });
    push({ st: { ...up, ctrl: 'run', ex: 'term', hosts: 'term' }, links: { user: 'ok', ctrlEx: 'active', exHost: 'active' },
      pk: [['g-ctrl-ex', 'job'], ['g-ex-host', 'ssh']],
      note: 'Now the controller dispatches and exec1 does the work',
      badge: 'Receptor carries the job to exec1; the controller only schedules and records.' });
    push({ st: { ...up, ex: 'run', hosts: 'run' }, links: { user: 'ok', ctrlEx: 'ok', exHost: 'ok' }, stamp: 'changed',
      note: 'The job completes. A perfectly good platform for a lab or a small team',
      badge: 'One VM to patch, one VM to back up, one inventory file.' });
    push({ st: { ...all('bad'), ex: 'pend', hosts: 'run' }, links: { user: 'blocked', ctrlEx: 'blocked' }, stamp: 'changed', vmDown: true,
      note: 'Then the VM goes down',
      badge: 'A kernel panic, a failed hypervisor, a full disk. Whatever the cause, every container goes with it.' });
    push({ st: { ...all('bad'), ex: 'pend', hosts: 'run' }, links: { user: 'blocked', ctrlEx: 'blocked' }, vmDown: true,
      focus: ['[database]'],
      note: 'Everything is down: UI, API, jobs, EDA, even the database',
      badge: 'exec1 is fine but has no one to take work from. This is the single point of failure growth accepts.' });
    push({ st: { ...up, ex: 'run' }, links: { user: 'ok', ctrlEx: 'ok' },
      note: 'Growth: simplest to run, no redundancy. Choose it knowingly',
      badge: 'Labs, demos, proof of concept, small teams. When downtime matters, use enterprise — next tab.' });
  } else if (modeId === 'enterprise') {
    const all = (s) => Object.fromEntries(Object.keys(E).map((k) => [k, s]));
    const up = all('run');
    const lb = { lb1: 'ok', lb2: 'ok' };
    push({ st: { ...all('off'), lb: 'hot', gw1: 'hot', gw2: 'hot' }, fresh: ['lb', 'gw1', 'gw2'], links: lb,
      focus: ['[automationgateway]', 'gateway2.example.org'],
      note: 'Enterprise topology starts with two gateways behind a load balancer',
      badge: 'Users and API clients hit the load balancer, which spreads them over gateway1 and gateway2.' });
    push({ st: { ...all('off'), lb: 'run', gw1: 'run', gw2: 'run', hub1: 'hot', hub2: 'hot', eda1: 'hot', eda2: 'hot', ctrl1: 'hot', ctrl2: 'hot' },
      fresh: ['hub1', 'hub2', 'eda1', 'eda2', 'ctrl1', 'ctrl2'], links: { ...lb, bus: 'ok' },
      focus: ['[automationcontroller]', '[automationhub]', '[automationeda]'],
      note: 'Two of each: controller, hub and EDA, each on its own VM',
      badge: 'Every component the gateway routes to has a twin. Losing one VM never loses a capability.' });
    push({ st: { ...up, ex1: 'off', ex2: 'off', store: 'hot', redis: 'hot', pg: 'hot' }, fresh: ['store', 'redis', 'pg'], links: { ...lb, bus: 'ok' },
      focus: ['_pg_host=db.example.org', '[redis]', 'hub_shared_data_path'],
      note: 'State lives outside the app VMs: external PostgreSQL, a Redis cluster, shared storage',
      badge: 'No <code>[database]</code> group: you supply a PostgreSQL. Both hubs need the same content, so they mount shared storage.' });
    push({ st: { ...up, ex1: 'hot', ex2: 'hot' }, fresh: ['ex1', 'ex2'], links: { ...lb, bus: 'ok', ex1: 'ok', ex2: 'ok' },
      focus: ['[execution_nodes]'],
      note: 'Two or more execution nodes run the jobs',
      badge: 'Controllers are pure control nodes here. Execution scales separately, as in the mesh animation.' });
    push({ st: { ...up, lb: 'hot', gw1: 'hot', ctrl1: 'hot' }, links: { ...lb, lb1: 'active', bus: 'active', ex1: 'ok', ex2: 'ok', user: 'active' },
      pk: [['e-user', 'https'], ['e-gw1-ctrl', 'launch']],
      note: 'A request comes in: load balancer → gateway1 → a controller',
      badge: 'Any gateway can route to any controller, hub or EDA node.' });
    push({ st: { ...up, ex1: 'term', ex2: 'term' }, links: { ...lb, bus: 'ok', ex1: 'active', ex2: 'active' },
      pk: [['e-ctrl-ex1', 'job'], ['e-ctrl-ex2', 'job']],
      note: 'Jobs spread across both execution nodes',
      badge: 'Both controllers dispatch work; both execution nodes take it.' });
    push({ st: { ...up, ctrl1: 'bad', ex1: 'term', ex2: 'term' }, links: { ...lb, bus: 'ok', ex1: 'ok', ex2: 'ok' },
      note: 'controller1’s VM fails',
      badge: 'Its jobs in progress are affected; the platform as a whole is not.' });
    push({ st: { ...up, ctrl1: 'bad', ctrl2: 'hot', ex1: 'term', ex2: 'term' }, links: { ...lb, bus: 'ok', ex1: 'active', ex2: 'active' },
      pk: [['e-ctrl-ex1', 'job'], ['e-ctrl-ex2', 'job']],
      note: 'controller2 carries on scheduling and dispatching',
      badge: 'Shared state is in PostgreSQL, so controller2 sees the same jobs, inventories and schedules.' });
    push({ st: { ...up, ctrl1: 'bad', gw1: 'bad' }, links: { lb1: 'blocked', lb2: 'ok', bus: 'ok', ex1: 'ok', ex2: 'ok' },
      note: 'Now gateway1 fails too. The load balancer’s health check takes it out',
      badge: 'The load balancer is yours to provide; the installer does not deploy one. Health checks are what make the pair redundant.' });
    push({ st: { ...up, ctrl1: 'bad', gw1: 'bad', lb: 'hot', gw2: 'hot', ctrl2: 'hot' }, links: { lb1: 'blocked', lb2: 'active', bus: 'active', ex1: 'ok', ex2: 'ok', user: 'active' },
      pk: [['e-user', 'https'], ['e-gw2-ctrl', 'launch']],
      note: 'Users keep working — every request goes through gateway2',
      badge: 'From the outside the platform looks exactly the same, just with less spare capacity.' });
    push({ st: up, links: { ...lb, bus: 'ok', ex1: 'ok', ex2: 'ok' },
      note: 'Repaired nodes rejoin. Two of everything again',
      badge: 'Upgrades work the same way: only 2.6 → 2.7 is supported, and RPM installs migrate to containerized first.' });
  } else {
    const pods = (s) => Object.fromEntries(POD_IDS.map((k) => [k, s]));
    const ready = { cr: 'run', op: 'run', ...pods('run'), route: 'off', job: 'off' };
    push({ st: { cr: 'off', op: 'run', ...pods('off'), route: 'off', job: 'off' },
      note: 'The AAP operator is installed in the cluster, watching namespace aap',
      badge: 'Install it from OperatorHub. On its own it does nothing — it waits for a custom resource.' });
    push({ st: { cr: 'hot', op: 'run', ...pods('off'), route: 'off', job: 'off' }, fresh: ['cr'],
      focus: ['apiVersion: aap.ansible.com/v1alpha1', 'kind: AnsibleAutomationPlatform'],
      note: 'You apply one AnsibleAutomationPlatform custom resource',
      badge: '<code>oc apply -f myaap.yml</code>. One object describes the whole platform you want.' });
    push({ st: { cr: 'run', op: 'term', ...pods('off'), route: 'off', job: 'off' }, links: { crOp: 'active' }, pk: [['o-cr-op', '']],
      note: 'The operator sees it and starts reconciling',
      badge: 'Reconcile: compare what the CR asks for with what exists, then create or fix the difference.' });
    push({ st: { cr: 'run', op: 'term', ...pods('term'), route: 'off', job: 'off' }, fresh: POD_IDS, links: { crOp: 'ok', opPods: 'active' },
      focus: ['controller:', 'hub:', 'eda:'],
      note: 'It creates pods: gateway, controller, hub, EDA, PostgreSQL, Redis',
      badge: 'Plus their Services, Secrets and persistent volumes. Hub asks for a ReadWriteMany volume for shared content.' });
    push({ st: ready, links: { crOp: 'ok' },
      note: 'All pods are ready',
      badge: 'The operator-managed PostgreSQL is the default; point the CR at an external database for production.' });
    push({ st: { ...ready, route: 'hot', gw: 'hot' }, fresh: ['route'], links: { crOp: 'ok', user: 'active' }, pk: [['o-route', 'https']],
      focus: ['name: myaap'],
      note: 'A Route exposes the gateway — the only way in',
      badge: 'The operator creates it for the CR named myaap. As in every 2.7 install, the gateway fronts all components.' });
    push({ st: { ...ready, route: 'run', ctrl: 'hot', job: 'term' }, fresh: ['job'], links: { crOp: 'ok', user: 'ok', job: 'active' },
      pk: [['o-ctrl-job', 'job']],
      note: 'Jobs run as pods of their own, in a container group',
      badge: 'Each job gets a pod with its execution environment, then it is deleted. Cluster capacity is execution capacity.' });
    push({ st: { ...ready, route: 'run', job: 'run' }, links: { crOp: 'ok', user: 'ok', job: 'ok' }, stamp: 'ok',
      note: 'The job finishes and its pod is cleaned up',
      badge: 'Execution nodes outside the cluster can still be added through the mesh for hosts it cannot reach.' });
    push({ st: { ...ready, route: 'run', ctrl: 'bad' }, links: { crOp: 'ok', user: 'ok' },
      note: 'The controller pod crashes',
      badge: 'An OOM kill, a node drain, a lost worker — the pod is gone.' });
    push({ st: { ...ready, route: 'run', op: 'hot', ctrl: 'term' }, links: { crOp: 'ok', user: 'ok', opPods: 'active' },
      pk: [['o-op-pods', '']],
      note: 'Kubernetes and the operator recreate it',
      badge: 'The Deployment replaces the pod; the operator keeps every object matching the CR.' });
    push({ st: { ...ready, route: 'run' }, links: { crOp: 'ok', user: 'ok' },
      focus: ['kind: AnsibleAutomationPlatform'],
      note: 'Desired state restored. The CR is the source of truth',
      badge: 'Upgrades too: change the operator channel and it rolls the platform forward (2.6 → 2.7 only).' });
  }
  // 'appear' replays on every repaint, so only flag what is new in this frame.
  return f.map((fr, i) => ({ fresh: [], ...fr,
    freshStamp: !!fr.stamp && (i === 0 || f[i - 1].stamp !== fr.stamp) }));
}

/* ---------- rendering ---------- */

const appear = (fr, id) => (fr.fresh.includes(id) ? 'appear' : '');
const comp = (fr, spec, id, extra = {}) => {
  const [x, y, w, h, title, sub] = spec;
  return box(x, y, w, h, { state: fr.st[id], title, sub, cls: appear(fr, id), ...extra });
};

function renderGrowth(fr) {
  const L = fr.links;
  let out = '';
  out += zone(20, 30, 450, 280, 'RHEL VM · aap.example.org · Podman');
  for (const id of Object.keys(G)) out += comp(fr, G[id], id, fr.vmDown ? { sub: 'down' } : {});
  out += label(245, 262, fr.vmDown ? 'one host down = whole platform down' : 'six containers, one host',
    { cls: fr.vmDown ? 'flow-label blocked' : 'svg-tiny on-node', anchor: 'middle' });

  out += box(510, 40, 150, 44, { state: 'pend', title: 'users / API' });
  out += route(PATHS['g-user'], { state: L.user || 'idle' });
  out += box(510, 160, 150, 52, { state: fr.st.ex, title: 'exec1', sub: fr.st.ex === 'off' ? 'optional' : 'execution node', cls: appear(fr, 'ex') });
  out += box(510, 250, 150, 44, { state: fr.st.hosts, title: 'managed hosts' });
  out += stamp(585, 310, fr.stamp, { fresh: fr.freshStamp });
  if (L.ctrlHost) out += arrow(455, 126, 508, 263, { state: L.ctrlHost });
  if (L.ctrlEx) out += arrow(455, 108, 508, 180, { state: L.ctrlEx });
  if (L.exHost) out += arrow(585, 212, 585, 248, { state: L.exHost });

  for (const [k, l] of fr.pk) out += packet(PATHS[k], l);
  out += legend('Containerized growth: every component on one RHEL host. Simple — and one failure takes it all.', 340);
  return out;
}

function renderEnterprise(fr) {
  const L = fr.links;
  let out = '';
  out += label(20, 41, 'users', { cls: 'svg-sub on-node' });
  out += arrow(62, 37, 173, 37, { state: L.user || 'idle' });
  out += comp(fr, E.lb, 'lb');
  out += comp(fr, E.gw1, 'gw1');
  out += comp(fr, E.gw2, 'gw2');
  out += arrow(230, 58, 162, 80, { state: L.lb1 || 'idle' });
  out += arrow(290, 58, 358, 80, { state: L.lb2 || 'idle' });

  // gateway "bus" to the three services
  const bus = L.bus || 'idle';
  if (L.bus) {
    const c = bus === 'idle' ? '' : bus;
    out += `<path class="flow-line ${c}" d="M160 124 V138 M360 124 V138 M97 138 H445"/>`;
    for (const x of [97, 272, 445]) out += arrow(x, 138, x, 148, { state: bus });
  }

  out += zone(15, 150, 165, 72, 'hub');
  out += zone(190, 150, 165, 72, 'EDA');
  out += zone(365, 150, 160, 72, 'controller');
  for (const id of ['hub1', 'hub2', 'eda1', 'eda2', 'ctrl1', 'ctrl2']) out += comp(fr, E[id], id);
  for (const id of ['store', 'redis', 'pg']) out += comp(fr, E[id], id);
  if (fr.st.store !== 'off') out += arrow(97, 222, 97, 248);

  out += zone(538, 110, 130, 200, 'execution');
  out += comp(fr, E.ex1, 'ex1');
  out += comp(fr, E.ex2, 'ex2');
  if (L.ex1) out += arrow(525, 186, 548, 163, { state: L.ex1 });
  if (L.ex2) out += arrow(525, 186, 548, 221, { state: L.ex2 });

  for (const [k, l] of fr.pk) out += packet(PATHS[k], l);
  out += legend('Containerized enterprise: two of every component, state held outside them, a load balancer in front.', 340);
  return out;
}

function renderOperator(fr) {
  const L = fr.links;
  const s = fr.st;
  let out = '';
  out += zone(15, 30, 650, 280, 'OpenShift cluster · namespace aap');
  out += box(30, 60, 150, 52, { state: s.cr, title: 'myaap', sub: s.cr === 'off' ? 'no CR yet' : 'AAP custom resource', cls: appear(fr, 'cr') });
  out += box(30, 160, 150, 52, { state: s.op, title: 'AAP operator', sub: 'reconciles' });
  out += arrow(105, 112, 105, 158, { state: L.crOp || 'idle' });
  out += label(112, 140, 'watches', { cls: 'flow-label' });
  out += arrow(180, 180, 203, 160, { state: L.opPods || 'idle' });
  for (const id of POD_IDS) out += comp(fr, O[id], id, s[id] === 'bad' ? { sub: 'crashed' } : {});

  out += label(610, 18, 'users', { cls: 'svg-tiny on-node', anchor: 'middle' });
  out += route('M610 24 V58', { state: L.user || 'idle' });
  out += box(565, 60, 90, 52, { state: s.route, title: 'Route', sub: 'https', cls: appear(fr, 'route') });
  if (s.route !== 'off') out += arrow(565, 86, 542, 86, { state: L.user || 'idle' });

  out += zone(200, 205, 455, 95, 'container group · job pods');
  out += box(430, 245, 115, 40, { state: s.job, title: s.job === 'off' ? 'no job running' : 'job pod', titleCls: s.job === 'off' ? 'svg-sub' : 'svg-title', cls: appear(fr, 'job') });
  if (L.job) out += arrow(487, 182, 487, 243, { state: L.job });
  out += stamp(600, 270, fr.stamp, { fresh: fr.freshStamp });

  for (const [k, l] of fr.pk) out += packet(PATHS[k], l);
  out += legend('Operator: you declare the platform in one CR; the operator builds it and keeps it that way.', 340);
  return out;
}

function renderSVG(frame) {
  if (frame.mode === 'growth') return renderGrowth(frame);
  if (frame.mode === 'enterprise') return renderEnterprise(frame);
  return renderOperator(frame);
}

/* ---------- side panels ---------- */

const isUp = (s) => s === 'run' || s === 'hot' || s === 'term';

function metrics(frame) {
  const s = frame.st;
  if (frame.mode === 'growth') {
    const up = Object.keys(G).filter((k) => isUp(s[k])).length;
    return [
      { label: 'VMs', value: '1' },
      { label: 'Containers up', value: `${up} / 6`, tone: up === 6 ? 'ok' : frame.vmDown ? 'bad' : '' },
      { label: 'Redundancy', value: 'none', tone: frame.vmDown ? 'bad' : 'warn' },
    ];
  }
  if (frame.mode === 'enterprise') {
    const gws = ['gw1', 'gw2'].filter((k) => isUp(s[k])).length;
    const ctrls = ['ctrl1', 'ctrl2'].filter((k) => isUp(s[k])).length;
    const deployed = s.ctrl1 !== 'off';
    return [
      { label: 'Gateways up', value: `${gws} / 2`, tone: gws === 2 ? 'ok' : 'warn' },
      { label: 'Controllers up', value: deployed ? `${ctrls} / 2` : '—', tone: !deployed ? '' : ctrls === 2 ? 'ok' : 'warn' },
      { label: 'Platform', value: deployed ? 'available' : 'building', tone: deployed ? 'ok' : '' },
    ];
  }
  const ready = POD_IDS.filter((k) => s[k] === 'run' || s[k] === 'hot').length;
  return [
    { label: 'Pods ready', value: `${ready} / 6`, tone: ready === 6 ? 'ok' : ready ? 'warn' : '' },
    { label: 'Entry point', value: s.route === 'off' ? 'none yet' : 'Route → gateway' },
    { label: 'Fixed by hand', value: '0', tone: 'ok' },
  ];
}

const YAML = {
  growth: `# inventory — containerized installer, growth
[automationgateway]
aap.example.org

[automationcontroller]
aap.example.org

[automationhub]
aap.example.org

[automationeda]
aap.example.org

# optional: take job execution off the VM
[execution_nodes]
exec1.example.org

[database]
aap.example.org

$ ansible-playbook -i inventory \\
    ansible.containerized_installer.install`,
  enterprise: `# inventory — containerized installer, enterprise
[automationgateway]
gateway1.example.org
gateway2.example.org

[automationcontroller]
controller1.example.org
controller2.example.org

[automationhub]
hub1.example.org
hub2.example.org

[automationeda]
eda1.example.org
eda2.example.org

[execution_nodes]
exec1.example.org
exec2.example.org

[redis]
gateway1.example.org
gateway2.example.org
hub1.example.org
hub2.example.org
eda1.example.org
eda2.example.org

[all:vars]
# no [database] group: PostgreSQL is external
gateway_pg_host=db.example.org
controller_pg_host=db.example.org
hub_pg_host=db.example.org
eda_pg_host=db.example.org
# both hubs mount the same content
hub_shared_data_path=nfs.example.org:/exports/hub`,
  operator: `apiVersion: aap.ansible.com/v1alpha1
kind: AnsibleAutomationPlatform
metadata:
  name: myaap
  namespace: aap
spec:
  # the platform gateway is always deployed
  controller:
    disabled: false
  hub:
    disabled: false
    # shared content needs ReadWriteMany storage
    storage_type: file
    file_storage_storage_class: <rwx-storage-class>
  eda:
    disabled: false
  # no database section: the operator runs PostgreSQL

$ oc apply -f myaap.yml`,
};

const FEATURES = {
  growth: [
    { name: 'Containerized installer', kind: 'ansible.containerized_installer', what: 'An Ansible collection that installs AAP as Podman containers on RHEL. With the operator, the only install method in 2.7 — the RPM installer was removed.' },
    { name: 'Growth topology', kind: 'tested topology', what: 'Every component, including PostgreSQL, on one VM. Quick to stand up; no redundancy.' },
    { name: 'Platform gateway', kind: 'component', what: 'The single entry point for UI, API, authentication and RBAC. In 2.7, direct calls to a component API are refused.' },
    { name: 'Hybrid node', kind: 'controller node type', what: 'Control plus execution on one node — the default when there are no separate execution nodes.' },
  ],
  enterprise: [
    { name: 'Enterprise topology', kind: 'tested topology', what: 'Two gateways, controllers, hubs and EDA nodes, two or more execution nodes, external PostgreSQL and a Redis cluster.' },
    { name: 'Load balancer', kind: 'customer provided', what: 'Fronts both gateways and health-checks them. Without it, the second gateway is a spare nobody reaches.' },
    { name: '*_pg_host', kind: 'inventory vars', what: 'Point each component at your external PostgreSQL. Shared state there is what lets a twin take over.' },
    { name: '[redis]', kind: 'inventory group', what: 'The hosts that form the Redis cluster, co-located on the gateway, hub and EDA VMs.' },
    { name: 'Upgrades', kind: 'lifecycle', what: 'Only 2.6 → 2.7 is supported. RPM installs migrate to containerized on their current version first.' },
  ],
  operator: [
    { name: 'AnsibleAutomationPlatform', kind: 'aap.ansible.com/v1alpha1', what: 'One custom resource describing the whole platform: gateway plus the components you enable.' },
    { name: 'AAP operator', kind: 'OpenShift operator', what: 'Reconciles the CR into pods, services, secrets and volumes, and keeps them matching it.' },
    { name: 'Route', kind: 'route.openshift.io', what: 'Exposes the gateway outside the cluster — the one entry point, as in every 2.7 install.' },
    { name: 'Container group', kind: 'instance group', what: 'Runs each job as a short-lived pod in the cluster, so cluster capacity becomes execution capacity.' },
  ],
};

const NOTES = {
  growth: [
    { heading: 'Point at', text: 'The whole VM turning red at once — gateway, controller and database together.' },
    { heading: 'The line that lands', text: 'Growth is not a toy; it is a deliberate trade: one host to run, and one host to lose.' },
    { ask: 'How long could your teams go without automation before someone escalates?' },
  ],
  enterprise: [
    { heading: 'Point at', text: 'controller1 and gateway1 go red, yet the request in the next frame still lands via gateway2 and controller2.' },
    { heading: 'The line that lands', text: 'Redundancy comes from two things together: twin components, and shared state outside them.' },
    { ask: 'Who in your organisation owns the load balancer and the external PostgreSQL?' },
  ],
  operator: [
    { heading: 'Point at', text: 'The crashed controller pod comes back without anyone touching it — the operator is reading the same CR it always does.' },
    { heading: 'The line that lands', text: 'On OpenShift you do not install AAP so much as declare it. The cluster does the rest.' },
    { ask: 'Do you already run OpenShift where your automation would live?' },
  ],
};

export default {
  id: 'deployment-topologies',
  title: 'Deploying AAP 2.7: growth, enterprise and operator',
  summary: 'The containerized installer on RHEL (growth or enterprise) or the operator on OpenShift — and what each does when a piece fails.',
  description: 'Three AAP 2.7 deployments: all components on one RHEL VM, a redundant enterprise layout behind a load balancer, and an operator-managed platform on OpenShift.',
  viewBox: '0 0 680 350',
  advanced: true,
  modes: MODES,
  buildFrames,
  renderSVG,
  metrics,
  speakerNotes: (m) => NOTES[m],
  yaml: (m) => YAML[m],
  features: (m) => FEATURES[m],
};
