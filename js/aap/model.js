/**
 * AAP 2.7 System Map model.
 *
 * One fixed map of the platform. A journey is a sequence of calls across it -
 * signing in, launching a job, an event triggering remediation - built for a
 * given topology and a set of failed components. Failures are resolved per
 * topology: growth has one VM, so any platform component failing takes the VM
 * with it; enterprise has two of everything, so traffic moves to instance b;
 * the Operator recreates a failed pod and carries on.
 *
 * Everything is pure: steps = buildJourney(id, topology, failed). The UI
 * renders step i of that list, which keeps scrubbing and deep links trivial.
 *
 * Step: { from, to: id | id[], label, kind: 'call' | 'local' | 'blocked' | 'recover', inst, note, badge }
 */

/* ------------------------------------------------------------------ */
/* Components and layout (viewBox 1000 x 430)                          */
/* ------------------------------------------------------------------ */

export const NODES = {
  browser: { x: 16, y: 56, w: 116, h: 50, title: 'Browser', sub: 'web UI' },
  cli: { x: 16, y: 126, w: 116, h: 50, title: 'API / CLI', sub: 'scripts · CI · podman' },
  monitor: { x: 16, y: 196, w: 116, h: 50, title: 'Monitoring', sub: 'event source' },
  lb: { x: 160, y: 116, w: 104, h: 70, title: 'Load balancer', sub: 'customer-provided' },
  gateway: { x: 292, y: 56, w: 128, h: 190, title: 'Platform gateway', sub: 'auth · RBAC · routing', pair: true },
  controller: { x: 452, y: 40, w: 172, h: 56, title: 'Automation controller', sub: 'jobs · task manager', pair: true },
  hub: { x: 452, y: 110, w: 172, h: 56, title: 'Private automation hub', sub: 'collections · EE registry', pair: true },
  eda: { x: 452, y: 180, w: 172, h: 56, title: 'Event-Driven Ansible', sub: 'rulebook activations', pair: true },
  metrics: { x: 452, y: 250, w: 172, h: 40, title: 'Metrics service', sub: '' },
  postgres: { x: 292, y: 330, w: 150, h: 52, title: 'PostgreSQL', sub: 'platform state' },
  redis: { x: 474, y: 330, w: 150, h: 52, title: 'Redis', sub: 'cache · queues' },
  git: { x: 672, y: 14, w: 130, h: 44, title: 'Git (SCM)', sub: 'playbook projects' },
  exec1: { x: 672, y: 96, w: 130, h: 60, title: 'Execution node', sub: 'runs EEs · podman', pair: true },
  hop: { x: 672, y: 232, w: 130, h: 50, title: 'Hop node', sub: 'DMZ · relays only' },
  exec2: { x: 672, y: 330, w: 130, h: 52, title: 'Exec node', sub: 'remote site' },
  web1: { x: 852, y: 60, w: 130, h: 38, title: 'web1', sub: '' },
  web2: { x: 852, y: 108, w: 130, h: 38, title: 'web2', sub: '' },
  db1: { x: 852, y: 156, w: 130, h: 38, title: 'db1', sub: '' },
  edge1: { x: 852, y: 336, w: 130, h: 40, title: 'edge1', sub: 'branch site' },
};

/** Components that live on the platform VM (growth) or in the cluster (operator). */
export const PLATFORM = ['gateway', 'controller', 'hub', 'eda', 'metrics', 'postgres', 'redis'];

export const TOPOLOGIES = [
  { id: 'growth', label: 'Container growth', caption: 'One RHEL VM running every platform component in Podman. Small, simple — and a single point of failure.' },
  { id: 'enterprise', label: 'Container enterprise', caption: 'A load balancer, two of every component, an external database and a Redis cluster. Lose any one VM and keep working.' },
  { id: 'operator', label: 'Operator on OpenShift', caption: 'The AAP operator runs the platform as pods. A failed pod is recreated; a Route is the front door.' },
];

/** Per-topology overrides for how a node is drawn. */
export function nodeView(id, topo) {
  const n = { ...NODES[id] };
  if (id === 'lb') {
    if (topo === 'growth') n.absent = true;
    if (topo === 'operator') Object.assign(n, { title: 'Route', sub: 'OpenShift router' });
  }
  if (topo === 'growth') {
    if (id === 'controller') n.sub = 'hybrid: also runs jobs';
    if (id === 'exec1') Object.assign(n, { optional: true, sub: 'optional in growth' });
    n.pair = false;
  }
  if (topo === 'enterprise') {
    if (id === 'postgres') n.sub = 'external · customer HA';
    if (id === 'redis') n.sub = 'cluster on AAP VMs';
    if (id === 'hub') n.sub = 'shared storage for content';
  }
  if (topo === 'operator') {
    n.pair = false;
    if (PLATFORM.includes(id)) n.sub = id === 'postgres' ? 'pod + PVC (or external)' : n.sub ? `${n.sub.split(' · ')[0]} · pods` : 'pods';
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* Failure resolution                                                  */
/* ------------------------------------------------------------------ */

/** What happens when a call reaches component id: ok, rerouted to b, recovered, or down. */
export function reach(id, topo, failed) {
  const down = (why) => ({ ok: false, why });
  if (topo === 'growth' && PLATFORM.includes(id) && PLATFORM.some((p) => failed.includes(p))) {
    const culprit = PLATFORM.find((p) => failed.includes(p));
    return down(`${NODES[culprit].title} failed, and on a growth topology every platform component shares one VM — the whole platform is down.`);
  }
  if (!failed.includes(id)) return { ok: true, inst: 'a' };
  if (topo === 'enterprise') {
    if (NODES[id].pair) return { ok: true, inst: 'b', rerouted: true };
    if (id === 'redis') return { ok: true, inst: 'a', rerouted: true };
    if (id === 'postgres') return down('The external database is down. Its high availability is the customer’s responsibility in the enterprise topology.');
    if (id === 'lb') return down('The load balancer is the one piece AAP does not deploy. Make it highly available, or it is your single point of failure.');
  }
  if (topo === 'operator' && (PLATFORM.includes(id) || id === 'lb')) return { ok: true, inst: 'a', recover: true };
  if (['web1', 'web2', 'db1', 'edge1'].includes(id)) return down(`${NODES[id].title} is unreachable over SSH. The job reports it as unreachable and carries on with the other hosts.`);
  if (id === 'exec1') return down('The only execution node in this instance group is down, so the job waits in pending until capacity returns.');
  if (id === 'hop') return down('The hop node is the only path to the remote site in this mesh. Add a second hop node and Receptor routes around a failure.');
  return down(`${NODES[id].title} is down.`);
}

/* ------------------------------------------------------------------ */
/* Journeys                                                            */
/* ------------------------------------------------------------------ */

export const JOURNEYS = [
  { id: 'login', title: 'Sign in', summary: 'A user signs in and lists job templates — the gateway authenticates once and vouches for the user to every component behind it.' },
  { id: 'launch', title: 'Launch a job', summary: 'From the Launch button to PLAY RECAP: gateway, controller, database, Git, the mesh, an execution environment and the hosts.' },
  { id: 'eda', title: 'Event to remediation', summary: 'Monitoring posts an event; a rulebook matches it and launches a job template through the gateway. No human in the loop.' },
  { id: 'remote', title: 'Reach a remote site', summary: 'A job for a branch site travels the mesh through a hop node to an execution node that dialled out — no inbound firewall rule.' },
  { id: 'ee', title: 'Publish and pull an EE', summary: 'An execution environment is pushed to private automation hub, then pulled by an execution node the first time a job needs it.' },
];

/**
 * Build the step list for a journey. A small DSL keeps each journey readable:
 *   call(from, to, label, note, badge)   a request from one component to another
 *   local(at, label, note, badge)        work done inside one component
 * Each call checks reach(); a failure ends the journey with a blocked step.
 */
export function buildJourney(id, topo, failed = []) {
  const steps = [];
  let stopped = false;
  const ent = topo === 'enterprise';
  const growth = topo === 'growth';
  const op = topo === 'operator';
  const runner = growth ? 'controller' : 'exec1';

  const touch = (to) => {
    for (const t of [].concat(to)) {
      const r = reach(t, topo, failed);
      if (!r.ok) return { blocked: t, why: r.why };
      if (r.recover) {
        steps.push({ from: t, to: t, kind: 'recover', label: 'pod recreated',
          note: `${NODES[t].title} pod failed — the operator recreates it`,
          badge: 'Kubernetes notices the failed pod and the AAP operator reconciles it back. A short pause, then the request continues.' });
      }
    }
    return {};
  };
  const inst = (t) => { const r = reach(t, topo, failed); return r.ok && r.inst === 'b' ? 'b' : 'a'; };

  const call = (from, to, label, note, badge) => {
    if (stopped) return;
    const hit = touch(to);
    if (hit.blocked) {
      steps.push({ from, to: hit.blocked, kind: 'blocked', label, note: `Blocked at ${NODES[hit.blocked].title}`, badge: hit.why });
      stopped = true;
      return;
    }
    const tos = [].concat(to);
    const reroute = tos.find((t) => inst(t) === 'b');
    steps.push({ from, to, kind: 'call', label, inst: reroute ? 'b' : 'a',
      note, badge: reroute ? `${badge} ${NODES[reroute].title} a is down — instance b takes the request.` : badge });
  };
  const local = (at, label, note, badge) => {
    if (stopped) return;
    steps.push({ from: at, to: at, kind: 'local', label, note, badge });
  };
  /* Into the platform: through the load balancer or Route when there is one. */
  const enter = (client, label, note, badge) => {
    if (growth) return call(client, 'gateway', label, note, badge);
    call(client, 'lb', label, note, ent ? `${badge} The load balancer spreads clients across both gateways.` : `${badge} On OpenShift, a Route exposes the gateway service.`);
    return call('lb', 'gateway', label, ent ? 'The load balancer forwards to a healthy gateway' : 'The Route forwards to the gateway pods', 'TLS can terminate at the load balancer or pass through to the gateway.');
  };
  const back = (from, client, label, note, badge) => {
    call(from, 'gateway', label, note, badge);
    if (growth) call('gateway', client, label, 'The gateway returns the response to the client', '');
    else { call('gateway', 'lb', label, 'Back out through the front door', ''); call('lb', client, label, 'The client receives the response', ''); }
  };

  if (id === 'login') {
    enter('browser', 'HTTPS 443', 'The browser opens the platform URL — that is the gateway',
      'In 2.7 the gateway is the only entry point: UI, API, and automation clients all come through it.');
    local('gateway', 'authenticate', 'The gateway authenticates the user',
      'Local accounts, LDAP, SAML, OIDC and other authenticators are configured once, here. 2.7 removed component-level basic auth and component personal access tokens.');
    call('gateway', 'postgres', 'SQL 5432', 'Users, teams, organizations and role assignments are read from the database',
      'RBAC is decided centrally: one place defines who may see and do what across controller, hub and EDA.');
    enter('browser', 'GET /api/controller/v2/…', 'The UI asks for job templates — at a gateway path',
      'Controller APIs live under /api/controller/v2/, hub under /api/galaxy/, EDA under /api/eda/v1/ — all on the gateway host.');
    call('gateway', 'controller', 'proxy + user token', 'The gateway forwards the request with a signed token identifying the user',
      'The controller never handles the login itself. A request sent straight to a component host is refused with HTTP 401 in 2.7.');
    call('controller', 'postgres', 'SQL 5432', 'The controller reads only the templates this user may see',
      'Objects are filtered by the role assignments the gateway manages.');
    back('controller', 'browser', '200 OK', 'The list goes back through the gateway', 'Same path in reverse — the client only ever talks to the gateway.');
  }

  if (id === 'launch') {
    enter('browser', 'POST …/launch/', 'The user presses Launch on a job template',
      'The request goes to /api/controller/v2/job_templates/42/launch/ on the gateway.');
    local('gateway', 'RBAC: may execute?', 'The gateway checks: may this user execute this template?',
      'Authentication and authorization happen before the controller sees anything.');
    call('gateway', 'controller', 'proxy', 'The launch is forwarded to the controller', 'Job #42 is created with status "new".');
    call('controller', 'postgres', 'INSERT job #42', 'The job is recorded in the database as pending',
      'Inventory, credentials, extra vars and the EE to use are resolved and stored with the job.');
    call('controller', 'git', 'git fetch', 'The project is synced from Git, if set to update on launch',
      'The playbook that runs is whatever the project revision says — Git is the source of truth.');
    local('controller', 'task manager', growth ? 'The task manager picks capacity: the controller itself' : 'The task manager picks an instance with free capacity',
      growth ? 'On a growth topology the controller is a hybrid node: it schedules jobs and can run them too.'
        : `The job’s instance group has capacity on the execution node${op ? ' (jobs can also run as pods through a container group)' : ''}.`);
    if (!growth) call('controller', 'exec1', 'Receptor 27199', 'The work unit is sent over the automation mesh',
      'Receptor carries the job to the execution node over TLS. Not HTTP, and not through the gateway.');
    call(runner, 'gateway', 'pull EE · 443', 'The execution environment image is pulled — if not already cached',
      'The container registry of private automation hub is reached through the gateway host.');
    call('gateway', 'hub', 'registry', 'Hub serves the image layers', 'ee-supported-rhel9 or your own EE: ansible-core, collections and Python deps in one image.');
    local(runner, 'podman run EE', 'ansible-runner starts the playbook inside the EE container',
      'Project files, inventory and credentials are mounted into the container for this job only.');
    call(runner, ['web1', 'web2', 'db1'], 'SSH 22', 'The playbook connects to the managed hosts',
      'Exactly the Part 1 round trip — module over SSH, JSON back — now from inside a container on an execution node.');
    if (!growth) call('exec1', 'controller', 'job events', 'Job events stream back over the mesh as tasks complete', 'Each task result for each host is an event.');
    call('controller', 'postgres', 'store events', 'The controller stores every event', 'This is the job output you can search and audit later.');
    back('controller', 'browser', 'live output (websocket)', 'The UI shows the output live, through the gateway', 'The user watches PLAY RECAP arrive without refreshing.');
    local('controller', 'successful', 'Job #42: successful', 'new → pending → waiting → running → successful.');
  }

  if (id === 'eda') {
    local('monitor', 'alert: httpd down on web2', 'Monitoring detects httpd is down on web2', 'Any system that can POST JSON can be an event source.');
    enter('monitor', 'POST event · 443', 'It posts the event to an EDA event stream on the gateway',
      'Event streams receive external events through the gateway and hand them to rulebook activations.');
    call('gateway', 'eda', 'route to activation', 'The gateway routes the event to the rulebook activation', 'The activation runs the rulebook inside a decision environment container.');
    local('eda', 'condition: status == "down"', 'The rule’s condition matches', 'Events that match no rule are simply dropped — EDA filters noise as well as reacting to signal.');
    call('eda', 'gateway', 'run_job_template', 'The action launches a job template — via the gateway',
      'EDA uses a Red Hat Ansible Automation Platform credential to call the controller API, through the gateway like any other client.');
    call('gateway', 'controller', 'proxy', 'The controller launches "Restart service" for web2', 'From here it is the Launch a job journey.');
    call('controller', 'postgres', 'INSERT job', 'The job is recorded', 'The event payload can be passed in as extra vars.');
    if (!growth) call('controller', 'exec1', 'Receptor 27199', 'Dispatched over the mesh', '');
    call(runner, 'web2', 'SSH 22', 'httpd is restarted on web2', 'The same playbook a human would have run — but seconds after the alert, not after a page.');
    if (growth) call('controller', 'postgres', 'job events', 'The result is recorded', 'Every automated remediation is audited like any other job.');
    else call('exec1', 'controller', 'job events', 'The result is recorded', 'Every automated remediation is audited like any other job.');
  }

  if (id === 'remote') {
    enter('browser', 'POST …/launch/', 'A job for the branch site is launched', 'Its inventory points at edge1, behind a firewall that allows no inbound connections.');
    call('gateway', 'controller', 'proxy', 'The controller creates the job', '');
    local('controller', 'instance group: branch', 'The task manager picks the branch-site instance group', 'Instance groups map jobs to the part of the mesh that can reach the hosts.');
    call('controller', 'hop', 'Receptor 27199', 'The work unit goes to the hop node in the DMZ', 'Hop nodes relay mesh traffic. They never run jobs themselves.');
    call('hop', 'exec2', 'Receptor 27199 · reverse', 'The hop relays it to the remote execution node',
      'The remote node opened this connection outbound to the hop node — so the branch firewall needs no inbound rule.');
    call('exec2', 'edge1', 'SSH 22', 'The job runs next to the host it manages', 'SSH stays inside the branch site. It still needs registry access for EE images, or a local mirror.');
    call('exec2', 'hop', 'job events', 'Events return the way they came', '');
    call('hop', 'controller', 'job events', 'The controller records the result', 'One controller, many sites, no VPN mesh of SSH connections.');
  }

  if (id === 'ee') {
    local('cli', 'ansible-builder build', 'A developer builds an execution environment', 'execution-environment.yml lists the base image, collections, Python and system packages.');
    enter('cli', 'podman push · 443', 'It is pushed to the registry on the gateway host', 'podman login and push use the gateway URL.');
    call('gateway', 'hub', 'registry API', 'Private automation hub stores the image', ent ? 'In enterprise, hub instances share storage so both can serve every layer.' : 'Now any job template can reference it.');
    call('hub', 'postgres', 'metadata', 'Image metadata and tags are recorded', '');
    call(runner, 'gateway', 'podman pull · 443', 'Later, a job needs this EE on a node that has not seen it', 'The first job pays for the pull; afterwards the image is cached on the node.');
    call('gateway', 'hub', 'registry', 'Hub serves the layers', '');
    local(runner, 'cached', 'The image is cached locally', 'Pull policy on the EE decides whether later jobs check for a newer image.');
  }

  return steps;
}

/* ------------------------------------------------------------------ */
/* Component info cards                                                */
/* ------------------------------------------------------------------ */

export const INFO = {
  browser: 'Any user of the web UI. Talks only to the gateway.',
  cli: 'Scripts, CI pipelines, the ansible.platform collection, podman. In 2.7 every API call goes to the gateway URL.',
  monitor: 'An external system — monitoring, ITSM, a message bus — sending events that EDA can act on.',
  lb: 'Enterprise: a customer-provided load balancer in front of two gateways. Operator: the OpenShift Route and router.',
  gateway: 'The single entry point in 2.7: the unified UI, authentication, RBAC, and routing to /api/controller/v2/, /api/galaxy/ and /api/eda/v1/. Direct calls to component hosts return HTTP 401.',
  controller: 'Job templates, workflows, inventories, credentials, schedules. Its task manager dispatches jobs to instance groups over the mesh.',
  hub: 'Private automation hub: certified, validated and your own collections, plus the container registry for execution environments.',
  eda: 'Event-Driven Ansible controller: runs rulebook activations in decision environments and launches job templates when rules match.',
  metrics: 'Collects platform usage metrics. A mandatory component as of 2.7.',
  postgres: 'Shared durable state for the platform components. Enterprise topologies use an external, customer-managed database; PostgreSQL 16 and 17 are supported.',
  redis: 'Caching and queues for platform components. A Redis cluster spans the AAP VMs in the enterprise topology.',
  git: 'Where projects — playbooks, roles, requirements — live. The controller syncs them.',
  exec1: 'Runs jobs inside execution environment containers with Podman. Grouped into instance groups for capacity and placement.',
  hop: 'Relays Receptor traffic between network zones, e.g. a DMZ. Runs no jobs.',
  exec2: 'An execution node at a remote site. It can open its Receptor connection outbound to a hop node, so the site needs no inbound rule.',
  web1: 'A managed host. Reached over SSH (or WinRM) from whichever node runs the job.',
  web2: 'A managed host.',
  db1: 'A managed host.',
  edge1: 'A managed host at a branch site, reachable only from inside that site.',
};
