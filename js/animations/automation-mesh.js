/**
 * Automation mesh: control, hop and execution nodes joined by Receptor.
 *
 * The controller decides what runs; execution nodes do the running, close to
 * the hosts they automate. Receptor (27199/tcp, TLS) is the overlay that
 * carries work out and job events back. Either side of a peer link can dial
 * the other, which is what lets a remote site with no inbound firewall rules
 * join the mesh through a hop node.
 *
 * Frame shape (fields a mode does not draw are simply absent):
 *   { mode, ctrl, nodes: { ex1, ex2, hop1, hop2 }, links: { key: state },
 *     hosts: [state...], stamps: [kind...], ssh: [[node, hostIdx]...],
 *     pk: [[pathKey, label]...], queue, note, badge, focus }
 *   node / host values are box states: 'pend' | 'run' | 'term' | 'hot' | 'bad' | 'off'
 *   link values are arrow states, or 'off' to hide the link
 */
import { box, zone, arrow, packet, seg, label, stamp, legend } from './lib/draw.js';

const MODES = [
  { id: 'direct', label: 'Control and execution nodes',
    caption: 'The controller dispatches over Receptor; execution nodes near the hosts do the work' },
  { id: 'hop', label: 'Hop node into a remote site',
    caption: 'No inbound allowed at the remote site — the execution node dials out to a hop node' },
  { id: 'resilient', label: 'A path goes down', advanced: true,
    caption: 'Two hop nodes: Receptor routes around the one that fails' },
];

/* ---------- geometry ---------- */

// direct mode
const D = {
  ctrl: [36, 110, 148, 60],
  ex1: [306, 80, 140, 56],
  ex2: [306, 190, 140, 56],
  host: (i) => [500, 50 + i * 62, 140, 40],
};
const D_CTRL = [184, 140];
const D_EX_IN = { ex1: [306, 108], ex2: [306, 218] };
const D_EX_OUT = { ex1: [446, 108], ex2: [446, 218] };
const dHostIn = (i) => [500, 70 + i * 62];

// hop + resilient modes share the left half and the firewall
const H_CTRL = [158, 150];
const FW_X = 392;
const R = {
  hop1: [220, 70, 130, 52], hop2: [220, 180, 130, 52],
  ex: [446, 120, 198, 60],
  host: (i) => [446 + i * 104, 225, 94, 40],
};

/** Named packet paths, so frames can say ['ctrl-ex1', 'job'] and stay data. */
const PATHS = {
  'ctrl-ex1': seg(D_CTRL, D_EX_IN.ex1),
  'ctrl-ex2': seg(D_CTRL, D_EX_IN.ex2),
  'ex1-ctrl': seg(D_EX_IN.ex1, D_CTRL),
  'ex2-ctrl': seg(D_EX_IN.ex2, D_CTRL),
  'h-ctrl-hop': seg(H_CTRL, [220, 150]),
  'h-hop-ex': seg([350, 150], [446, 98]),
  'h-ex-hop-ctrl': seg([446, 98], [350, 150], [220, 150], H_CTRL),
  'r-via1': seg(H_CTRL, [220, 96], [350, 96], [446, 150]),
  'r-via2': seg(H_CTRL, [220, 206], [350, 206], [446, 150]),
  'r-back1': seg([446, 150], [350, 96], [220, 96], H_CTRL),
  'r-back2': seg([446, 150], [350, 206], [220, 206], H_CTRL),
};

/* ---------- frames ---------- */

function buildFrames(modeId) {
  const f = [];
  const base = { ctrl: 'pend', nodes: {}, links: {}, hosts: [], stamps: [], ssh: [], pk: [], queue: 0 };
  const push = (o) => f.push({ mode: modeId, ...base, ...o });

  if (modeId === 'direct') {
    const H = (s) => [s, s, s, s];
    const one = { ex1: 'run', ex2: 'off' };
    const L1 = { ex1: 'ok', ex2: 'off' };
    push({ nodes: { ex1: 'pend', ex2: 'off' }, links: { ex1: 'idle', ex2: 'off' }, hosts: H('pend'),
      note: 'The controller lives in the datacenter; the hosts live at site A',
      badge: 'In AAP the controller is the <b>control plane</b>: it schedules jobs and stores results. Running the playbook is a separate job — the <b>execution plane</b>.' });
    push({ nodes: one, links: L1, hosts: H('pend'), focus: ['exec1.example.com', '[execution_nodes]'],
      note: 'exec1, an execution node at site A, peers with the controller over Receptor',
      badge: 'Receptor is the automation mesh overlay network: <b>27199/tcp, TLS</b> by default. The installer sets up the peers and certificates for you.' });
    push({ ctrl: 'hot', nodes: one, links: { ex1: 'active', ex2: 'off' }, hosts: H('pend'), pk: [['ctrl-ex1', 'job']],
      focus: ['[automationcontroller]'],
      note: 'A job is launched. The controller sends the work to exec1',
      badge: 'The job carries the project, inventory and credentials it needs. The controller itself never opens SSH to the hosts.' });
    push({ nodes: { ex1: 'term', ex2: 'off' }, links: L1, hosts: [...H('term').slice(0, 2), 'pend', 'pend'], ssh: [['ex1', 0], ['ex1', 1]],
      note: 'exec1 runs the playbook in an execution environment, right next to the hosts',
      badge: 'SSH traffic stays inside site A. Only Receptor crosses the WAN, so latency to each host is local.' });
    push({ nodes: { ex1: 'term', ex2: 'off' }, links: { ex1: 'active', ex2: 'off' }, hosts: ['run', 'run', 'pend', 'pend'],
      stamps: ['changed', 'changed'], pk: [['ex1-ctrl', 'events']],
      note: 'Job events stream back to the controller as they happen',
      badge: 'Every task result travels back over the same Receptor link, so the job output in the UI is live.' });
    push({ ctrl: 'hot', nodes: { ex1: 'term', ex2: 'off' }, links: L1, hosts: ['term', 'term', 'pend', 'pend'], ssh: [['ex1', 0], ['ex1', 1]], queue: 2,
      note: 'More jobs arrive than exec1 has capacity for — they queue',
      badge: 'Each node has a capacity, roughly forks it can run at once. A busy instance group leaves jobs <b>pending</b>.' });
    push({ nodes: { ex1: 'term', ex2: 'hot' }, links: { ex1: 'ok', ex2: 'active' }, hosts: ['term', 'term', 'pend', 'pend'], ssh: [['ex1', 0], ['ex1', 1]], queue: 2,
      focus: ['exec2.example.com', 'instance group'],
      note: 'Add exec2 to the inventory, re-run the installer, put it in the instance group',
      badge: 'Scaling out is adding a node: it peers over Receptor and joins the <b>site-a</b> instance group. Jobs need no change.' });
    push({ ctrl: 'hot', nodes: { ex1: 'term', ex2: 'term' }, links: { ex1: 'active', ex2: 'active' }, hosts: H('term'),
      ssh: [['ex1', 0], ['ex1', 1], ['ex2', 2], ['ex2', 3]], pk: [['ctrl-ex1', 'job'], ['ctrl-ex2', 'job']],
      note: 'The queued jobs spread across both execution nodes',
      badge: 'The controller places each job on the node in the group with the most free capacity.' });
    push({ nodes: { ex1: 'run', ex2: 'run' }, links: { ex1: 'active', ex2: 'active' }, hosts: H('run'),
      stamps: ['changed', 'changed', 'changed', 'changed'], pk: [['ex1-ctrl', 'events'], ['ex2-ctrl', 'events']],
      note: 'Both report back. The queue is empty',
      badge: 'Capacity grew with one node. The controller did not get any bigger.' });
    push({ nodes: { ex1: 'run', ex2: 'run' }, links: { ex1: 'ok', ex2: 'ok' }, hosts: H('run'),
      stamps: ['changed', 'changed', 'changed', 'changed'],
      note: 'Control stays central; execution scales out next to the hosts',
      badge: 'One controller can drive many execution nodes in many sites, each in its own instance group.' });
  } else if (modeId === 'hop') {
    const P = (s) => [s, s];
    push({ nodes: { ex: 'pend', hop1: 'off' }, links: {}, hosts: P('pend'),
      note: 'A remote site whose firewall allows no inbound connections',
      badge: 'Common for branch offices, retail stores, OT networks and other clouds: traffic may leave, nothing may come in.' });
    push({ ctrl: 'hot', nodes: { ex: 'pend', hop1: 'off' }, links: { direct: 'blocked' }, hosts: P('pend'),
      note: 'The controller cannot reach exec2 directly — the firewall drops it',
      badge: 'A direct peer would need 27199 open <b>inbound</b> at the remote site. That is not going to be approved.' });
    push({ nodes: { ex: 'pend', hop1: 'hot' }, links: { ctrlHop: 'ok' }, hosts: P('pend'),
      focus: ['receptor_type=hop'],
      note: 'Put a hop node in the DMZ and peer it with the controller',
      badge: '<code>receptor_type=hop</code>: a Receptor node that only relays mesh traffic. The controller can reach the DMZ.' });
    push({ nodes: { ex: 'hot', hop1: 'run' }, links: { ctrlHop: 'ok', exHop: 'active' }, hosts: P('pend'),
      focus: ["receptor_peers='[\"hop1.example.com\"]'"],
      note: 'exec2 dials OUT to the hop node — outbound is allowed',
      badge: 'Receptor peers can initiate in either direction. exec2 lists hop1 in <code>receptor_peers</code>, so exec2 opens the connection.' });
    push({ nodes: { ex: 'run', hop1: 'run' }, links: { ctrlHop: 'ok', exHop: 'ok' }, hosts: P('pend'),
      note: 'Once connected, the link carries traffic both ways',
      badge: 'Who dialled whom no longer matters. The mesh now has a route: controller → hop1 → exec2.' });
    push({ ctrl: 'hot', nodes: { ex: 'run', hop1: 'hot' }, links: { ctrlHop: 'active', exHop: 'ok' }, hosts: P('pend'),
      pk: [['h-ctrl-hop', 'job']],
      note: 'A job for the remote site goes to the hop node first',
      badge: 'The job targets an instance group that contains exec2. Receptor works out the route.' });
    push({ nodes: { ex: 'hot', hop1: 'hot' }, links: { ctrlHop: 'ok', exHop: 'active' }, hosts: P('pend'),
      pk: [['h-hop-ex', 'job']],
      note: 'hop1 relays it down the connection exec2 opened',
      badge: 'The firewall sees only an established outbound session carrying return traffic.' });
    push({ nodes: { ex: 'term', hop1: 'run' }, links: { ctrlHop: 'ok', exHop: 'ok' }, hosts: P('term'), ssh: [['ex', 0], ['ex', 1]],
      note: 'exec2 runs the playbook against the hosts beside it',
      badge: 'SSH to the remote hosts never leaves the remote site.' });
    push({ nodes: { ex: 'run', hop1: 'hot' }, links: { ctrlHop: 'active', exHop: 'active' }, hosts: P('run'),
      stamps: ['changed', 'changed'], pk: [['h-ex-hop-ctrl', 'events']],
      note: 'Job events flow back the same way: exec2 → hop1 → controller',
      badge: 'Output streams live into the controller UI, exactly as for a local node.' });
    push({ nodes: { ex: 'run', hop1: 'pend' }, links: { ctrlHop: 'ok', exHop: 'ok' }, hosts: P('run'),
      stamps: ['changed', 'changed'], focus: ['hop1.example.com receptor_type=hop'],
      note: 'The hop node ran no jobs. It only relayed',
      badge: 'A hop node needs no execution environments and no capacity. It is a small, hardened relay.' });
  } else {
    const P = (s) => [s, s];
    const up = { c1: 'ok', c2: 'ok', e1: 'ok', e2: 'ok' };
    push({ nodes: { ex: 'run', hop1: 'run', hop2: 'run' }, links: up, hosts: P('pend'),
      focus: ['hop2.example.com receptor_type=hop', '- hop2.example.com'],
      note: 'Two hop nodes; exec2 peers with both',
      badge: 'Two independent paths into the remote site. Receptor knows the whole mesh and picks a route per message.' });
    push({ ctrl: 'hot', nodes: { ex: 'hot', hop1: 'hot', hop2: 'run' }, links: { ...up, c1: 'active', e1: 'active' }, hosts: P('pend'),
      pk: [['r-via1', 'job']],
      note: 'A job goes out via hop1',
      badge: 'Either hop would do. Receptor chooses a shortest path.' });
    push({ nodes: { ex: 'run', hop1: 'run', hop2: 'run' }, links: { ...up, c1: 'active', e1: 'active' }, hosts: P('run'),
      stamps: ['ok', 'ok'], pk: [['r-back1', 'events']],
      note: 'It runs and reports back. Normal day',
      badge: 'Nothing about the job knows how many hops it crossed.' });
    push({ nodes: { ex: 'run', hop1: 'bad', hop2: 'run' }, links: { ...up, c1: 'blocked', e1: 'blocked' }, hosts: P('pend'),
      note: 'hop1 goes down — a reboot, a failed VM, a cut link',
      badge: 'Its Receptor connections drop on both sides.' });
    push({ nodes: { ex: 'run', hop1: 'bad', hop2: 'hot' }, links: { ...up, c1: 'blocked', e1: 'blocked' }, hosts: P('pend'),
      note: 'Receptor notices and recalculates: the route is now via hop2',
      badge: 'Nodes advertise their connections to the mesh. A lost peer is withdrawn and the remaining path takes over.' });
    push({ ctrl: 'hot', nodes: { ex: 'hot', hop1: 'bad', hop2: 'hot' }, links: { ...up, c1: 'blocked', e1: 'blocked', c2: 'active', e2: 'active' }, hosts: P('pend'),
      pk: [['r-via2', 'job']],
      note: 'The next job lands on exec2 through hop2',
      badge: 'No one edited a job template or an inventory. The mesh routed around the failure.' });
    push({ nodes: { ex: 'term', hop1: 'bad', hop2: 'run' }, links: { ...up, c1: 'blocked', e1: 'blocked' }, hosts: P('term'), ssh: [['ex', 0], ['ex', 1]],
      note: 'exec2 runs it as usual',
      badge: 'From the hosts’ point of view nothing happened at all.' });
    push({ nodes: { ex: 'run', hop1: 'bad', hop2: 'hot' }, links: { ...up, c1: 'blocked', e1: 'blocked', c2: 'active', e2: 'active' }, hosts: P('run'),
      stamps: ['changed', 'changed'], pk: [['r-back2', 'events']],
      note: 'Results come back via hop2',
      badge: 'The job succeeded while half of the DMZ was down.' });
    push({ nodes: { ex: 'run', hop1: 'term', hop2: 'run' }, links: { ...up, c1: 'active', e1: 'active' }, hosts: P('run'),
      stamps: ['changed', 'changed'],
      note: 'hop1 comes back and its peers reconnect',
      badge: 'exec2 keeps retrying its outbound connection; the controller re-dials hop1. No manual step.' });
    push({ nodes: { ex: 'run', hop1: 'run', hop2: 'run' }, links: up, hosts: P('run'), stamps: ['changed', 'changed'],
      note: 'Two paths again. The mesh healed itself',
      badge: 'Design rule: any site that matters gets two hops. Topology view in the controller shows every link.' });
  }
  return markFresh(f);
}

/**
 * Every frame is repainted, so 'appear' would replay on each one. Mark only
 * what is new in this frame: stamps that changed, and nodes that were absent.
 */
function markFresh(frames) {
  return frames.map((fr, i) => {
    const prev = frames[i - 1];
    const freshStamps = fr.stamps.map((k, j) => !!k && (!prev || prev.stamps[j] !== k));
    const fresh = Object.keys(fr.nodes).filter((k) => fr.nodes[k] !== 'off' && (!prev || !prev.nodes[k] || prev.nodes[k] === 'off'));
    return { ...fr, freshStamps, fresh: i === 0 ? [] : fresh };
  });
}

/* ---------- rendering ---------- */

function renderDirect(fr) {
  let out = '';
  out += zone(20, 40, 180, 250, 'datacenter');
  out += box(...D.ctrl, { state: fr.ctrl, title: 'controller', sub: 'control node' });
  out += box(36, 200, 148, 40, fr.queue
    ? { state: 'term', title: `${fr.queue} jobs pending`, titleCls: 'svg-sub' }
    : { state: 'off', title: 'queue empty', titleCls: 'svg-sub' });

  out += zone(280, 20, 380, 290, 'site A');
  out += zone(292, 50, 168, 230, 'instance group');
  for (const id of ['ex1', 'ex2']) {
    const s = fr.nodes[id];
    out += box(...D[id], { state: s, title: id === 'ex1' ? 'exec1' : 'exec2',
      sub: s === 'off' ? 'not installed' : 'execution node', cls: fr.fresh.includes(id) ? 'appear' : '' });
    const ls = fr.links[id];
    if (ls && ls !== 'off') out += arrow(...D_CTRL, D_EX_IN[id][0] - 2, D_EX_IN[id][1], { state: ls, both: ls !== 'idle' });
  }
  out += label(240, 92, 'Receptor', { cls: 'flow-label', anchor: 'middle' });
  out += label(240, 104, '27199 · TLS', { cls: 'flow-label', anchor: 'middle' });

  fr.hosts.forEach((s, i) => {
    out += box(...D.host(i), { state: s, title: `host${i + 1}` });
    out += stamp(570, 50 + i * 62 + 53, fr.stamps[i], { fresh: fr.freshStamps[i] });
  });
  for (const [n, i] of fr.ssh) {
    const [x2, y2] = dHostIn(i);
    out += arrow(...D_EX_OUT[n], x2 - 2, y2, { state: 'active' });
  }
  for (const [k, l] of fr.pk) out += packet(PATHS[k], l);

  out += legend('Receptor carries work out and events back. SSH to the hosts stays inside the site.', 334);
  return out;
}

function renderRemoteFrame(fr, title) {
  let out = '';
  out += zone(20, 40, 150, 250, 'datacenter');
  out += box(32, 120, 126, 60, { state: fr.ctrl, title: 'controller', sub: 'control node' });
  out += zone(200, 40, 170, 250, 'DMZ');
  out += box(FW_X, 20, 16, 290, { state: 'pend', rx: 3 });
  out += label(FW_X + 8, 14, 'firewall', { cls: 'svg-tiny on-node', anchor: 'middle' });
  out += label(FW_X + 8, 324, 'no inbound', { cls: 'svg-tiny on-node', anchor: 'middle' });
  out += zone(430, 40, 230, 250, title);
  return out;
}

function hostsAndSsh(fr, exBottom, hostY) {
  let out = '';
  fr.hosts.forEach((s, i) => {
    const [x, y, w, h] = R.host(i);
    out += box(x, y, w, h, { state: s, title: `host${i + 1}` });
    out += stamp(x + w / 2, y + h + 14, fr.stamps[i], { fresh: fr.freshStamps[i] });
  });
  for (const [, i] of fr.ssh) {
    const [x, , w] = R.host(i);
    out += arrow(exBottom[0], exBottom[1], x + w / 2, hostY - 2, { state: 'active' });
  }
  return out;
}

function renderHop(fr) {
  let out = renderRemoteFrame(fr, 'remote site');
  const L = fr.links;
  const hs = fr.nodes.hop1;
  if (hs !== 'off') out += box(220, 120, 130, 60, { state: hs, title: 'hop1', sub: hs === 'pend' ? 'ran no jobs' : 'hop node', cls: fr.fresh.includes('hop1') ? 'appear' : '' });
  out += box(446, 70, 198, 56, { state: fr.nodes.ex, title: 'exec2', sub: 'execution node' });

  if (L.direct) {
    out += route(`M140 120 V28 H${FW_X - 3}`, 'blocked');
    out += label(270, 22, 'direct: dropped', { cls: 'flow-label blocked', anchor: 'middle' });
  }
  if (L.ctrlHop) {
    out += arrow(...H_CTRL, 218, 150, { state: L.ctrlHop, both: L.ctrlHop !== 'idle' });
    out += label(189, 142, 'Receptor', { cls: 'flow-label', anchor: 'middle' });
    out += label(189, 166, '27199', { cls: 'flow-label', anchor: 'middle' });
  }
  if (L.exHop) {
    out += arrow(446, 98, 352, 140, { state: L.exHop, both: L.exHop === 'ok' });
    out += label(446, 144, 'exec2 dials out', { cls: `flow-label ${L.exHop === 'active' ? 'active' : ''}` });
  }
  out += hostsAndSsh(fr, [545, 126], 200);
  for (const [k, l] of fr.pk) out += packet(PATHS[k], l);
  out += legend('A hop node relays Receptor traffic between networks. It never runs jobs.', 342);
  return out;
}

function renderResilient(fr) {
  let out = renderRemoteFrame(fr, 'remote site');
  const L = fr.links;
  for (const id of ['hop1', 'hop2']) {
    const s = fr.nodes[id];
    out += box(...R[id], { state: s, title: id, sub: s === 'bad' ? 'down' : 'hop node' });
  }
  out += box(...R.ex, { state: fr.nodes.ex, title: 'exec2', sub: 'execution node' });

  const both = (s) => s === 'ok' || s === 'active';
  out += arrow(...H_CTRL, 218, 96, { state: L.c1, both: both(L.c1) });
  out += arrow(...H_CTRL, 218, 206, { state: L.c2, both: both(L.c2) });
  out += arrow(446, 150, 352, 96, { state: L.e1, both: both(L.e1) });
  out += arrow(446, 150, 352, 206, { state: L.e2, both: both(L.e2) });

  out += hostsAndSsh(fr, [545, 180], 225);
  for (const [k, l] of fr.pk) out += packet(PATHS[k], l);
  out += legend('Receptor routes each message over any live path. Two hops, no single point of failure.', 342);
  return out;
}

const route = (d, state) => `<path class="flow-line ${state}" d="${d}" marker-end="url(#arrow-${state})"/>`;

function renderSVG(frame) {
  if (frame.mode === 'direct') return renderDirect(frame);
  if (frame.mode === 'hop') return renderHop(frame);
  return renderResilient(frame);
}

/* ---------- side panels ---------- */

function metrics(frame) {
  const n = frame.nodes;
  if (frame.mode === 'direct') {
    const execs = ['ex1', 'ex2'].filter((k) => n[k] && n[k] !== 'off').length;
    const busy = ['ex1', 'ex2'].filter((k) => n[k] === 'term').length;
    return [
      { label: 'Execution nodes', value: execs, tone: execs > 1 ? 'ok' : '' },
      { label: 'Nodes running jobs', value: busy, tone: busy ? 'warn' : '' },
      { label: 'Jobs pending', value: frame.queue, tone: frame.queue ? 'warn' : 'ok' },
    ];
  }
  if (frame.mode === 'hop') {
    const routed = frame.links.exHop === 'ok' || frame.links.exHop === 'active';
    return [
      { label: 'Inbound rules at remote', value: '0', tone: 'ok' },
      { label: 'Route to exec2', value: frame.links.direct ? 'blocked' : routed ? 'via hop1' : 'none', tone: frame.links.direct ? 'bad' : routed ? 'ok' : '' },
      { label: 'Jobs run on hop1', value: '0' },
    ];
  }
  const hops = ['hop1', 'hop2'].filter((k) => n[k] === 'run' || n[k] === 'hot').length;
  return [
    { label: 'Hop nodes up', value: `${hops} / 2`, tone: hops === 2 ? 'ok' : 'warn' },
    { label: 'Route in use', value: n.hop1 === 'bad' ? 'via hop2' : 'via hop1' },
    { label: 'Jobs lost', value: '0', tone: 'ok' },
  ];
}

const YAML = {
  direct: `# inventory — containerized installer (excerpt)
[automationcontroller]
ctrl1.example.com

[execution_nodes]
exec1.example.com
# added later to grow capacity at site A
exec2.example.com

# receptor_type defaults to execution
# Receptor peers on 27199/tcp, TLS, by default

$ ansible-playbook -i inventory \\
    ansible.containerized_installer.install

# then, in the controller: add exec2 to the
# site-a instance group`,
  hop: `# inventory — containerized installer (excerpt)
[automationcontroller]
ctrl1.example.com

[execution_nodes]
# DMZ: relays Receptor traffic, runs no jobs
hop1.example.com receptor_type=hop
# remote site: dials OUT to the hop node
exec2.example.com receptor_peers='["hop1.example.com"]'`,
  resilient: `# inventory — containerized installer (excerpt)
[automationcontroller]
ctrl1.example.com

[execution_nodes]
hop1.example.com receptor_type=hop
hop2.example.com receptor_type=hop
exec2.example.com

# host_vars/exec2.example.com.yml
receptor_peers:
  - hop1.example.com
  - hop2.example.com`,
};

const FEATURES = {
  direct: [
    { name: 'Control node', kind: 'controller', what: 'Schedules jobs, holds inventory, credentials and results. In a mesh it can leave the running of playbooks to others.' },
    { name: 'Execution node', kind: 'receptor_type=execution', what: 'Runs jobs inside execution environments. Place it close to the hosts it manages.' },
    { name: 'Receptor', kind: 'overlay network', what: 'The automation mesh transport: 27199/tcp with TLS by default. Carries work out and job events back.' },
    { name: 'Instance group', kind: 'controller object', what: 'A pool of nodes a job template or inventory can target. Adding a node to the group adds capacity.' },
  ],
  hop: [
    { name: 'Hop node', kind: 'receptor_type=hop', what: 'A relay. It routes mesh traffic between networks and never runs jobs, so it needs no execution environments.' },
    { name: 'receptor_peers', kind: 'inventory host var', what: 'Which nodes this node connects to. The side that lists the peer opens the connection — here, outbound from the remote site.' },
    { name: 'Bidirectional peers', kind: 'Receptor', what: 'Once a connection is up, traffic flows both ways, so no inbound firewall rule is needed at the remote site.' },
  ],
  resilient: [
    { name: 'Redundant hops', kind: 'topology', what: 'A node that peers with two hop nodes has two routes. Lose one and the other carries the work.' },
    { name: 'Mesh routing', kind: 'Receptor', what: 'Nodes advertise their links; routes are recalculated when a peer disappears or comes back.' },
    { name: 'receptor_peers (list)', kind: 'host var', what: 'A list, so a node can dial several peers. Put longer lists in host_vars to keep the inventory readable.' },
    { name: 'Topology view', kind: 'controller UI', what: 'Shows every node and link with its state, so a failed hop is visible before anyone files a ticket.' },
  ],
};

const NOTES = {
  direct: [
    { heading: 'Point at', text: 'The SSH arrows never leave site A. Only Receptor crosses from the datacenter.' },
    { heading: 'The line that lands', text: 'You scale the controller for how many jobs you schedule, and execution nodes for how much work you run — two separate dials.' },
    { ask: 'Where are your managed hosts furthest, in network terms, from where your controller runs today?' },
  ],
  hop: [
    { heading: 'Point at', text: 'The red dashed line in step two, then the arrow pointing left out of the remote site in step four. Direction of connection is the whole trick.' },
    { heading: 'The line that lands', text: 'You do not open a hole into the remote site. The remote site reaches out, and the work rides back along that connection.' },
    { ask: 'Which of your sites has an "outbound only" firewall policy today?' },
  ],
  resilient: [
    { heading: 'Point at', text: 'hop1 turns red, yet the job in the next frames still completes via hop2. Nobody changes a template.' },
    { heading: 'The line that lands', text: 'A single hop node is a single point of failure for the whole site. Two hop nodes and the mesh routes around trouble on its own.' },
    { ask: 'How would you find out today that the only path into a remote site was down?' },
  ],
};

export default {
  id: 'automation-mesh',
  title: 'Automation mesh: running jobs close to the hosts',
  summary: 'Receptor connects control, hop and execution nodes so jobs run near the hosts — even behind firewalls that allow no inbound traffic.',
  description: 'A controller in a datacenter sends jobs over the Receptor mesh to execution nodes at remote sites, directly or through hop nodes, and receives job events back.',
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
