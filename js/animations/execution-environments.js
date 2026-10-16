/**
 * Execution environments: Ansible and every dependency it needs, as one image.
 *
 * "build" assembles the image layer by layer from execution-environment.yml
 * and pushes it to private automation hub. "run" opens with the problem EEs
 * solve - control nodes that drift apart - then follows one job from template
 * to container to hosts, and ends on a laptop running the same image.
 *
 * Frame shapes:
 *   build: { hl, layers, fresh, tagged, push, inHub, note, badge, focus }
 *          hl: null | 'def' | 'builder' | 'podman'   layers: 0..5
 *   run:   { scene: 'problem' | 'main' | 'laptop', jt, dispatch, pull, cache,
 *            ctr, mounts, play, hosts, stamps, fresh, pulls, note, badge, focus }
 *          ctr: null | 'hot' | 'run' | 'removed'
 */
import { box, zone, arrow, packet, seg, label, stamp, legend } from './lib/draw.js';

const MODES = [
  { id: 'build', label: 'Build and publish',
    caption: 'execution-environment.yml → ansible-builder → a layered image → private automation hub' },
  { id: 'run', label: 'How a job uses it',
    caption: 'The execution node pulls the image once, runs the playbook inside a container, then throws the container away' },
];

/* ---------- build ---------- */

// Bottom-up, the order the image is assembled in.
const LAYERS = [
  { title: 'Base image (UBI 9)', sub: 'ee-minimal-rhel9', y: 266 },
  { title: 'ansible-core + runner', sub: 'the engine and its launcher', y: 224 },
  { title: 'System packages', sub: 'bindep: openssh-clients, sshpass', y: 182 },
  { title: 'Python deps', sub: 'pip: netaddr, jmespath', y: 140 },
  { title: 'Collections', sub: 'ansible.netcommon, cisco.ios', y: 98 },
];
const P_PUSH = seg([434, 160], [492, 133]);

function buildBuild() {
  const f = [];
  const base = { hl: null, layers: 0, fresh: null, tagged: false, push: null, inHub: false };
  const push = (o) => f.push({ ...base, ...o });

  push({ hl: 'def', focus: ['version: 3'],
    note: 'Everything the automation needs, declared in one file',
    badge: 'execution-environment.yml (schema version 3) lists a base image and three kinds of dependency: galaxy, python, system.' });
  push({ hl: 'builder', focus: ['$ ansible-builder build'],
    note: 'ansible-builder turns that file into a Containerfile',
    badge: 'It resolves the dependency lists, writes a build context, and hands it to Podman to build.' });
  push({ hl: 'podman', layers: 1, fresh: 0, focus: ['base_image:', 'ee-minimal-rhel9'],
    note: 'Layer 1: a supported base image',
    badge: 'A minimal Red Hat EE built on UBI — RHEL userspace, Python, and a known-good starting point.' });
  push({ hl: 'podman', layers: 2, fresh: 1, focus: ['ansible_core:', 'ansible_runner:'],
    note: 'Layer 2: ansible-core and ansible-runner',
    badge: 'ansible-core is the engine; ansible-runner is the wrapper the platform uses to launch it and stream its events.' });
  push({ hl: 'podman', layers: 3, fresh: 2, focus: ['system:'],
    note: 'Layer 3: system packages',
    badge: 'RPMs the modules shell out to, declared in bindep format — here an SSH client and sshpass.' });
  push({ hl: 'podman', layers: 4, fresh: 3, focus: ['python:'],
    note: 'Layer 4: Python libraries',
    badge: 'pip requirements the collections import at run time. Missing ones are the classic "works on my laptop" failure.' });
  push({ hl: 'podman', layers: 5, fresh: 4, focus: ['galaxy:', 'name: cisco.ios'],
    note: 'Layer 5: collections',
    badge: 'Installed from private automation hub or Galaxy, pinned to the versions you tested.' });
  push({ layers: 5, tagged: true, fresh: 'tag', focus: ['-t hub.example.com/ee-network:1.0'],
    note: 'One immutable, versioned image',
    badge: 'The tag is the contract: ee-network:1.0 means exactly these versions of everything, wherever it runs.' });
  push({ layers: 5, tagged: true, push: 'active', focus: ['$ podman push'],
    note: 'podman push sends it to private automation hub',
    badge: 'Hub is also a container registry. Only changed layers are uploaded.' });
  push({ layers: 5, tagged: true, push: 'ok', inHub: true, fresh: 'hub',
    note: 'It sits next to the supported EEs, ready to be used',
    badge: 'Register it in the controller as an execution environment and any job template can select it.' });
  push({ layers: 5, tagged: true, push: 'ok', inHub: true,
    focus: ['version: 3'],
    note: 'Change a dependency → bump the tag → rebuild',
    badge: 'Treat the definition like code: review it, build it in CI, publish a new tag. Never patch a running EE.' });
  return f;
}

function renderBuild(frame) {
  let out = '';
  const st = (k) => (frame.hl === k ? 'hot' : frame.hl && ['def', 'builder', 'podman'].indexOf(k) < ['def', 'builder', 'podman'].indexOf(frame.hl) ? 'run' : 'pend');

  // the tool chain
  out += box(16, 40, 164, 56, { state: st('def'), title: 'EE definition', sub: 'execution-environment.yml' });
  out += arrow(98, 96, 98, 126, { state: frame.hl === 'builder' ? 'active' : 'idle' });
  out += box(16, 128, 164, 56, { state: st('builder'), title: 'ansible-builder', sub: 'writes a Containerfile' });
  out += arrow(98, 184, 98, 214, { state: frame.hl === 'podman' && frame.layers === 1 ? 'active' : 'idle' });
  out += box(16, 216, 164, 56, { state: st('podman'), title: 'podman build', sub: 'assembles the layers' });
  out += arrow(180, 244, 228, 244, { state: frame.hl === 'podman' ? 'active' : 'idle' });

  // the image
  out += zone(214, 30, 236, 286, 'image layers');
  LAYERS.forEach((l, i) => {
    if (i >= frame.layers) {
      out += box(230, l.y, 204, 36, { state: 'off', title: '', rx: 6 });
      return;
    }
    const state = frame.fresh === i ? 'hot' : frame.tagged ? 'run' : 'term';
    out += box(230, l.y, 204, 36, { state, title: l.title, sub: l.sub, rx: 6, cls: frame.fresh === i ? 'appear' : '' });
  });
  if (frame.tagged) {
    out += `<g class="${frame.fresh === 'tag' ? 'appear' : ''}">${label(332, 76, 'hub.example.com/ee-network:1.0', { cls: 'mono on-node', anchor: 'middle' })}</g>`;
  }

  // the registry
  out += zone(478, 30, 190, 286, 'private automation hub');
  out += box(494, 98, 158, 64, { state: frame.inHub ? 'run' : 'pend', title: 'Registry', sub: 'EE container images' });
  out += box(494, 190, 158, 34, { state: 'run', title: 'ee-minimal-rhel9' });
  out += box(494, 232, 158, 34, { state: 'run', title: 'ee-supported-rhel9' });
  if (frame.inHub) {
    out += box(494, 274, 158, 34, { state: frame.fresh === 'hub' ? 'hot' : 'run', title: 'ee-network:1.0', cls: frame.fresh === 'hub' ? 'appear' : '' });
  }
  if (frame.tagged) out += arrow(434, 160, 492, 133, { state: frame.push || 'idle', label: frame.push ? 'push' : '', lx: 458, ly: 136 });
  if (frame.push === 'active') out += packet(P_PUSH);

  out += legend('ansible-core, ansible-runner, collections, Python and system deps: one image, one tag.', 340);
  return out;
}

/* ---------- run ---------- */

const HOSTS = [{ id: 'sw1', y: 70 }, { id: 'sw2', y: 140 }, { id: 'sw3', y: 210 }];
const MOUNTS = [
  { id: 'project', x: 214 }, { id: 'inventory', x: 300 }, { id: 'credentials', x: 386 },
];
const PLAY_OUT = [466, 171];

function buildRun() {
  const f = [];
  const base = { scene: 'main', jt: 'pend', dispatch: null, pull: null, cache: 'empty', ctr: null,
    mounts: false, play: null, hosts: 'pend', stamps: false, fresh: null, pulls: 0 };
  const push = (o) => f.push({ ...base, ...o });

  push({ scene: 'problem', focus: ['# without an EE'],
    note: '"Works on my laptop": three control nodes, three different results',
    badge: 'Each machine has a different ansible-core, a different collection version, a missing Python library. Same playbook, different outcome.' });
  push({ jt: 'hot', focus: ['execution_environment: ee-network'],
    note: 'A job template names the execution environment it runs in',
    badge: 'The EE is a property of the template — not of whichever node happens to run it.' });
  push({ jt: 'run', dispatch: 'active', cache: 'empty',
    note: 'The job lands on an execution node that has never seen this image',
    badge: 'The controller dispatches the job over the mesh. The node checks its local Podman image cache first.' });
  push({ jt: 'run', dispatch: 'ok', pull: 'active', cache: 'pulling', pulls: 1,
    focus: ['image: hub.example.com/ee-network:1.0', 'pull: missing'],
    note: 'First time only: pull the image from private automation hub',
    badge: 'pull: missing means fetch it if it is not cached. Hub registry credentials are attached to the EE definition.' });
  push({ jt: 'run', dispatch: 'ok', pull: 'ok', cache: 'cached', ctr: 'hot', fresh: 'ctr', pulls: 1,
    note: 'A fresh container starts from the image',
    badge: 'Every job gets a brand-new container. Nothing left over from the previous job can leak in.' });
  push({ jt: 'run', dispatch: 'ok', cache: 'cached', ctr: 'run', mounts: true, fresh: 'mounts', pulls: 1,
    focus: ['project: network-playbooks', 'inventory: datacenter', 'credentials: [network-ssh]'],
    note: 'Project, inventory and credentials are mounted in',
    badge: 'The playbooks come from the synced project; credentials are injected at run time, never baked into the image.' });
  push({ jt: 'run', dispatch: 'ok', cache: 'cached', ctr: 'run', mounts: true, play: 'term', hosts: 'term', pulls: 1,
    focus: ['playbook: switches.yml'],
    note: 'ansible-playbook runs inside the container and connects out',
    badge: 'ansible-runner launches it with exactly the core, collections and libraries in the image. Events stream back as it runs.' });
  push({ jt: 'run', dispatch: 'ok', cache: 'cached', ctr: 'run', mounts: true, play: 'run', hosts: 'run',
    stamps: true, fresh: 'stamps', pulls: 1,
    note: 'Results come back: all three switches changed',
    badge: 'The PLAY RECAP and every job event go back to the controller over the mesh.' });
  push({ jt: 'run', cache: 'cached', ctr: 'removed', hosts: 'run', stamps: true, pulls: 1,
    note: 'The container is removed; the image stays cached',
    badge: 'The next job using ee-network:1.0 on this node starts instantly — no pull.' });
  push({ scene: 'laptop', pulls: 1, focus: ['$ ansible-navigator run switches.yml'],
    note: 'The same image runs on your laptop with ansible-navigator',
    badge: 'Develop and test against exactly what production will run. Works here = works in AAP.' });
  return f;
}

function renderProblem() {
  let out = '';
  const M = [
    { title: 'Laptop A', sub: 'ansible-core 2.16', sub2: 'cisco.ios 9 · netaddr', x: 30, res: 'ok' },
    { title: 'Laptop B', sub: 'ansible-core 2.15', sub2: 'cisco.ios 5 · netaddr', x: 250, res: 'failed' },
    { title: 'CI runner', sub: 'ansible-core 2.16', sub2: 'cisco.ios 9 · no netaddr', x: 470, res: 'failed' },
  ];
  out += box(250, 40, 180, 48, { state: 'hot', title: 'switches.yml', sub: 'the same playbook' });
  M.forEach((m) => {
    out += arrow(340, 88, m.x + 90, 148, { state: 'active' });
    out += box(m.x, 150, 180, 72, { state: m.res === 'ok' ? 'run' : 'bad', title: m.title, sub: m.sub, sub2: m.sub2 });
    out += stamp(m.x + 90, 248, m.res, { fresh: true });
  });
  out += legend('Every control node is its own snowflake. Drift shows up as failures nobody can reproduce.', 336);
  return out;
}

function renderLaptop() {
  let out = '';
  out += box(250, 30, 180, 52, { state: 'run', title: 'Automation hub', sub: 'ee-network:1.0' });
  out += zone(30, 130, 280, 160, 'your laptop');
  out += box(50, 166, 240, 44, { state: 'hot', title: 'ansible-navigator run', sub: '--eei ee-network:1.0' });
  out += box(50, 222, 240, 44, { state: 'run', title: 'EE container', sub: 'ee-network:1.0' });
  out += zone(370, 130, 280, 160, 'AAP execution node');
  out += box(390, 166, 240, 44, { state: 'run', title: 'Job template', sub: 'EE: ee-network:1.0' });
  out += box(390, 222, 240, 44, { state: 'run', title: 'EE container', sub: 'ee-network:1.0' });
  out += arrow(300, 82, 200, 128, { state: 'active', label: 'pull', lx: 236, ly: 98, anchor: 'end' });
  out += arrow(380, 82, 480, 128, { state: 'ok', label: 'pull', lx: 444, ly: 98, anchor: 'start' });
  out += packet(seg([300, 82], [200, 128]));
  out += stamp(170, 284, 'ok', { fresh: true });
  out += stamp(510, 284, 'ok');
  out += legend('Same image, same versions, same result — on a laptop, in CI, or on an execution node.', 336);
  return out;
}

function renderRun(frame) {
  if (frame.scene === 'problem') return renderProblem();
  if (frame.scene === 'laptop') return renderLaptop();
  let out = '';

  // controller side
  out += zone(12, 30, 150, 112, 'controller');
  out += box(24, 58, 126, 56, { state: frame.jt, title: 'Job template', sub: 'EE: ee-network:1.0' });
  out += box(24, 214, 126, 56, { state: frame.pull === 'active' ? 'hot' : 'run', title: 'Automation hub', sub: 'ee-network:1.0' });

  // execution node
  out += zone(188, 30, 300, 286, 'execution node · exec-1');
  out += arrow(150, 86, 202, 100, { state: frame.dispatch || 'idle', label: frame.dispatch ? 'job' : '', lx: 182, ly: 86 });
  if (frame.dispatch === 'active') out += packet(seg([150, 86], [202, 100]));

  if (frame.ctr === 'removed') {
    out += box(204, 62, 268, 150, { state: 'off', title: 'container removed', cls: 'appear' });
  } else if (frame.ctr) {
    out += box(204, 62, 268, 150, { state: frame.ctr, title: '', cls: frame.fresh === 'ctr' ? 'appear' : '' });
    out += label(216, 80, 'EE container · ee-network:1.0', { cls: 'svg-sub on-node' });
    if (frame.mounts) {
      MOUNTS.forEach((m) => {
        out += box(m.x, 92, 80, 34, { state: 'run', title: m.id, titleCls: 'svg-sub', cls: frame.fresh === 'mounts' ? 'appear' : '' });
      });
      out += box(214, 144, 252, 50, { state: frame.play || 'pend', title: 'ansible-playbook', sub: 'launched by ansible-runner' });
    }
  } else {
    out += label(338, 140, 'no container yet', { cls: 'svg-tiny on-node', anchor: 'middle' });
  }

  const cache = {
    empty: { state: frame.dispatch === 'active' ? 'hot' : 'pend', sub: 'empty' },
    pulling: { state: 'term', sub: 'pulling ee-network:1.0' },
    cached: { state: 'run', sub: 'ee-network:1.0 cached' },
  }[frame.cache];
  out += box(204, 236, 268, 48, { state: cache.state, title: 'Image cache (Podman)', sub: cache.sub });
  out += arrow(150, 242, 202, 256, { state: frame.pull || 'idle', label: frame.pull ? 'pull' : '', lx: 182, ly: 242 });
  if (frame.pull === 'active') out += packet(seg([150, 242], [202, 256]), 'image');

  // managed hosts
  out += zone(512, 30, 156, 286, 'managed hosts');
  HOSTS.forEach((h) => {
    const live = frame.play === 'term';
    if (frame.play) out += arrow(PLAY_OUT[0], PLAY_OUT[1], 526, h.y + 25, { state: live ? 'active' : 'ok' });
    if (live) out += packet(seg(PLAY_OUT, [526, h.y + 25]));
    out += box(528, h.y, 124, 50, { state: frame.hosts, title: h.id, sub: 'switch' });
    if (frame.stamps) out += stamp(590, h.y + 64, 'changed', { fresh: frame.fresh === 'stamps' });
  });

  out += legend('Pulled once, cached per node. A new container per job, removed when the job ends.', 340);
  return out;
}

/* ---------- module ---------- */

const buildFrames = (m) => (m === 'run' ? buildRun() : buildBuild());
const renderSVG = (frame) => (frame.scene ? renderRun(frame) : renderBuild(frame));

function metrics(frame) {
  if (frame.scene) {
    const same = frame.scene !== 'problem';
    return [
      { label: 'Same image everywhere', value: same ? 'yes' : 'no', tone: same ? 'ok' : 'bad' },
      { label: 'Image pulls', value: frame.pulls },
      { label: 'Containers running', value: frame.ctr === 'hot' || frame.ctr === 'run' ? 1 : 0 },
    ];
  }
  return [
    { label: 'Layers', value: `${frame.layers} / 5`, tone: frame.layers === 5 ? 'ok' : undefined },
    { label: 'Image tag', value: frame.tagged ? 'ee-network:1.0' : '—' },
    { label: 'In private hub', value: frame.inHub ? 'yes' : 'no', tone: frame.inHub ? 'ok' : undefined },
  ];
}

const YAML = {
  build: `# execution-environment.yml
version: 3

images:
  base_image:
    # a supported minimal EE from registry.redhat.io
    name: registry.redhat.io/<aap-repo>/ee-minimal-rhel9:latest

dependencies:
  ansible_core:
    package_pip: ansible-core
  ansible_runner:
    package_pip: ansible-runner
  galaxy:
    collections:
      - name: ansible.netcommon
      - name: cisco.ios
  python:
    - netaddr
    - jmespath
  system:
    - openssh-clients [platform:rpm]
    - sshpass [platform:rpm]

options:
  package_manager_path: /usr/bin/microdnf

# build, then publish to private automation hub
$ ansible-builder build -t hub.example.com/ee-network:1.0
$ podman login hub.example.com
$ podman push hub.example.com/ee-network:1.0`,
  run: `# without an EE: every control node is different
#   pip list | grep netaddr   # here? which version?

# register the EE in the controller
- ansible.controller.execution_environment:
    name: ee-network
    image: hub.example.com/ee-network:1.0
    pull: missing          # pull once, then use the cache
    credential: hub-registry

# a job template that runs inside it
- ansible.controller.job_template:
    name: Configure switches
    project: network-playbooks
    playbook: switches.yml
    inventory: datacenter
    credentials: [network-ssh]
    execution_environment: ee-network

# the same image on a laptop
$ ansible-navigator run switches.yml \\
    --eei hub.example.com/ee-network:1.0 \\
    -i inventory.yml --mode stdout`,
};

const FEATURES = {
  build: [
    { name: 'execution-environment.yml', kind: 'version: 3', what: 'Declares the base image and the galaxy, python and system dependencies. The whole definition of your runtime in one reviewed file.' },
    { name: 'ansible-builder', kind: 'CLI', what: 'Turns the definition into a Containerfile and build context, then builds the image with Podman.' },
    { name: 'Image layers', kind: 'container image', what: 'Base, ansible-core and ansible-runner, system packages, Python libraries, collections — immutable once tagged.' },
    { name: 'Private automation hub', kind: 'registry', what: 'Stores your EE images next to the supported ones, so every execution node pulls from one trusted place.' },
  ],
  run: [
    { name: 'execution_environment', kind: 'job template field', what: 'Which EE image the job runs in. It travels with the template, not with the node.' },
    { name: 'pull', kind: 'EE setting', what: 'always, missing or never. missing pulls on first use and then relies on the node’s local image cache.' },
    { name: 'Job container', kind: 'Podman', what: 'A fresh container per job, with the project, inventory and injected credentials mounted in. Removed when the job ends.' },
    { name: 'ansible-navigator', kind: 'CLI', what: 'Runs playbooks inside the same EE image on a laptop or in CI, so local results match the platform.' },
  ],
};

const NOTES = {
  build: [
    { heading: 'Point at', text: 'The stack growing one layer per step. Every line in the YAML maps to exactly one of those layers.' },
    { heading: 'The line that lands', text: 'An EE turns "install Ansible and these 14 things on the control node" into one versioned artifact you can review, scan, and roll back. The self-service portal in 2.7 adds a visual EE builder on top of the same idea.' },
    { ask: 'Who in your team owns the Python libraries your playbooks depend on today?' },
  ],
  run: [
    { heading: 'Point at', text: 'The image cache after the container is removed: the image stays, so the second job never pulls. And the credentials box — injected per job, never in the image.' },
    { heading: 'The line that lands', text: 'There is no "control node" to drift any more. The runtime is an image tag, and the same tag runs on your laptop and in production.' },
    { ask: 'How long does it take today to find out why a playbook works for one person but not another?' },
  ],
};

export default {
  id: 'execution-environments',
  title: 'Execution environments: Ansible in a container',
  summary: 'ansible-core, ansible-runner, collections and every Python and system dependency packaged as one image — built once, run identically everywhere.',
  description: 'An execution-environment.yml is built by ansible-builder into a five-layer container image and pushed to private automation hub. A job template then runs inside that image on an execution node, and the same image runs on a laptop with ansible-navigator.',
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
