/**
 * Event-Driven Ansible: an event comes in, a rule decides, a job runs.
 *
 * The top row is EDA's half - monitoring posts an event to the webhook source
 * of a rulebook activation, which evaluates a condition. The bottom row is the
 * same platform the earlier animations showed: the action goes through the
 * platform gateway (the only entry point in 2.7) to the controller, which runs
 * the job on an execution node against the host that raised the alarm.
 *
 * Frame shape:
 *   { at: { web1, mon, src, cond, act, gw, ctrl, exec }, svc, verdict, pk, hl,
 *     stamp, freshStamp, freshVerdict, events, matched, jobs, note, badge, focus }
 *   at values are box states; pk is a key into PATHS; verdict is '' | 'true' | 'false'
 */
import { box, zone, arrow, route, packet, seg, label, stamp, legend } from './lib/draw.js';

const MODES = [
  { id: 'match', label: 'Event matches a rule',
    caption: 'A service goes down; the rulebook matches and launches a job template to fix it' },
  { id: 'nomatch', label: 'Event filtered out',
    caption: 'An informational event arrives; no condition is true, so nothing runs' },
];

/* ---------- geometry ---------- */

const B = {
  web1: [20, 62, 110, 52],
  mon: [158, 62, 110, 52],
  src: [308, 62, 92, 52],
  cond: [412, 62, 120, 52],
  act: [544, 62, 112, 52],
  gw: [516, 210, 144, 52],
  ctrl: [336, 210, 140, 52],
  exec: [156, 210, 140, 52],
};

const PATHS = {
  alarm: seg([130, 88], [158, 88]),
  post: seg([268, 88], [308, 88]),
  eval: seg([400, 88], [412, 88]),
  fire: seg([532, 88], [544, 88]),
  toGw: seg([600, 114], [600, 210]),
  toCtrl: seg([516, 236], [476, 236]),
  toExec: seg([336, 236], [296, 236]),
  toHost: 'M156 236 H75 V114',
  back: 'M75 114 V236 H156',
};

/* ---------- frames ---------- */

function buildFrames(modeId) {
  const f = [];
  const idle = { web1: 'run', mon: 'pend', src: 'pend', cond: 'pend', act: 'pend', gw: 'pend', ctrl: 'pend', exec: 'pend' };
  const push = (o) => f.push({ svc: 'up', verdict: '', pk: '', pkLabel: '', stamp: '', events: 0, matched: 0, jobs: 0, ...o, at: { ...idle, ...o.at } });

  if (modeId === 'match') {
    push({ at: { src: 'hot' }, focus: ['ansible.eda.webhook:', 'port: 5000'],
      note: 'A rulebook activation is listening for events',
      badge: 'The activation runs the rulebook inside a <b>decision environment</b> — a container image with ansible-rulebook and the source plugins. Here: a webhook on port 5000.' });
    push({ at: { web1: 'bad' }, svc: 'down',
      note: 'httpd on web1 stops',
      badge: 'Nobody is looking at a dashboard. Without automation, this waits for someone to notice, open a ticket and log in.' });
    push({ at: { web1: 'bad', mon: 'hot' }, svc: 'down', pk: 'alarm', pkLabel: 'alert',
      note: 'Monitoring sees it and fires an alert',
      badge: 'Any system that can send an HTTP POST works: Alertmanager, a log pipeline, a ticketing tool. EDA also ships Kafka and Alertmanager sources.' });
    push({ at: { web1: 'bad', mon: 'run', src: 'hot' }, svc: 'down', pk: 'post', pkLabel: 'event', events: 1,
      focus: ['host: 0.0.0.0', 'port: 5000'],
      note: 'The alert is POSTed to the webhook source as an event',
      badge: 'The JSON body becomes <code>event.payload</code>. In 2.7 an <b>event stream</b> can receive it on the platform instead of a bare port, and in-flight events are persisted.' });
    push({ at: { web1: 'bad', src: 'run', cond: 'hot' }, svc: 'down', pk: 'eval', events: 1,
      focus: ['condition: event.payload.status == "down"'],
      note: 'The rule engine tests the condition',
      badge: '<code>event.payload.status == "down"</code> — every rule in the rulebook is checked against every incoming event.' });
    push({ at: { web1: 'bad', cond: 'run', act: 'hot' }, svc: 'down', verdict: 'true', pk: 'fire', events: 1, matched: 1,
      focus: ['- name: Restart when a service is down', 'run_job_template:'],
      note: 'It matches. The action fires: run_job_template',
      badge: 'Actions include <code>run_job_template</code>, <code>run_workflow_template</code> and <code>debug</code>. EDA decides; the controller does.' });
    push({ at: { web1: 'bad', cond: 'run', act: 'run', gw: 'hot' }, svc: 'down', verdict: 'true', pk: 'toGw', pkLabel: 'launch', events: 1, matched: 1,
      focus: ['name: Restart service', 'organization: Default'],
      note: 'EDA asks the platform gateway to launch “Restart service”',
      badge: 'In 2.7 even component-to-component calls go through the gateway, using EDA’s stored AAP credential. A direct call to the controller API gets 401.' });
    push({ at: { web1: 'bad', cond: 'run', act: 'run', gw: 'run', ctrl: 'hot' }, svc: 'down', verdict: 'true', pk: 'toCtrl', pkLabel: '/api/controller/v2/', events: 1, matched: 1, jobs: 1,
      note: 'The gateway authenticates the call and routes it to the controller',
      badge: 'RBAC applies here like for a person: the credential needs execute rights on the job template.' });
    push({ at: { web1: 'bad', cond: 'run', act: 'run', ctrl: 'term', exec: 'hot' }, svc: 'down', verdict: 'true', pk: 'toExec', pkLabel: 'job', events: 1, matched: 1, jobs: 1,
      note: 'The controller runs the job on an execution node',
      badge: 'Same job template a person could launch by hand — same inventory, same credentials, same audit trail.' });
    push({ at: { web1: 'term', cond: 'run', act: 'run', ctrl: 'term', exec: 'term' }, svc: 'restarting', verdict: 'true', pk: 'toHost', pkLabel: 'ssh', events: 1, matched: 1, jobs: 1,
      note: 'The playbook restarts httpd on web1',
      badge: 'The job template targets the host from the event — pass it in with extra vars such as <code>event.payload.host</code>.' });
    push({ at: { web1: 'run', cond: 'run', act: 'run', ctrl: 'run', exec: 'run' }, svc: 'up', verdict: 'true', stamp: 'changed', pk: 'back', pkLabel: 'result', events: 1, matched: 1, jobs: 1,
      note: 'httpd is back. The job reports changed',
      badge: 'From alert to fixed with no human in the loop: minutes of waiting become seconds of automation.' });
    push({ at: { src: 'hot' }, stamp: 'changed', events: 1, matched: 1, jobs: 1,
      note: 'The activation keeps listening for the next event',
      badge: 'The job’s output is in the controller, linked from the rule audit in EDA: which event, which rule, which job.' });
  } else {
    push({ at: { src: 'hot' }, focus: ['ansible.eda.webhook:'],
      note: 'Same activation, same rulebook, listening',
      badge: 'Monitoring sends a lot more than outages: warnings, recoveries, heartbeats, configuration notices.' });
    push({ at: { mon: 'hot' }, pk: 'alarm', pkLabel: 'info',
      note: 'web1 is fine, but monitoring raises an informational notice',
      badge: 'For example: a certificate will expire in 60 days, or disk usage crossed 50%.' });
    push({ at: { mon: 'run', src: 'hot' }, pk: 'post', pkLabel: 'event', events: 1, focus: ['port: 5000'],
      note: 'It is POSTed to the webhook like any other event',
      badge: 'EDA does not know in advance which events matter. That is what rules are for.' });
    push({ at: { src: 'run', cond: 'hot' }, pk: 'eval', events: 1,
      focus: ['condition: event.payload.status == "down"'],
      note: 'The condition is tested: status is "info", not "down"',
      badge: 'The rule is evaluated and found false. No other rule in this rulebook matches either.' });
    push({ at: { src: 'run', cond: 'pend', act: 'off', gw: 'off', ctrl: 'off', exec: 'off' }, verdict: 'false', events: 1,
      focus: ['run_job_template:'],
      note: 'No match, so no action. Nothing is launched',
      badge: 'The gateway, the controller and the execution nodes never hear about this event. No job, no noise in the job list.' });
    push({ at: { mon: 'hot', src: 'run', act: 'off', gw: 'off', ctrl: 'off', exec: 'off' }, pk: 'post', pkLabel: 'event', events: 2,
      note: 'Another informational event arrives…',
      badge: 'High-volume sources are normal. The rule engine is built to discard most of what it sees.' });
    push({ at: { src: 'run', cond: 'pend', act: 'off', gw: 'off', ctrl: 'off', exec: 'off' }, verdict: 'false', events: 2,
      note: '…and is filtered out the same way',
      badge: 'Two events in, zero jobs out. The host was never touched.' });
    push({ at: { src: 'hot', act: 'pend' }, events: 2,
      focus: ['- name: Restart when a service is down'],
      note: 'EDA turns a stream of events into only the actions that matter',
      badge: 'Write narrow conditions. A rule that matches too much launches jobs nobody asked for.' });
  }
  // 'appear' replays on every repaint, so flag only what is new in this frame.
  return f.map((fr, i) => ({ ...fr,
    freshStamp: !!fr.stamp && (i === 0 || f[i - 1].stamp !== fr.stamp),
    freshVerdict: !!fr.verdict && (i === 0 || f[i - 1].verdict !== fr.verdict) }));
}

/* ---------- rendering ---------- */

function renderSVG(frame) {
  const a = frame.at;
  let out = '';

  out += label(20, 42, 'managed host', { cls: 'svg-tiny on-node' });
  out += box(...B.web1, { state: a.web1, title: 'web1', sub: `httpd ${frame.svc}` });
  out += box(...B.mon, { state: a.mon, title: 'monitoring', sub: 'Alertmanager' });

  out += zone(296, 28, 372, 112, 'EDA · rulebook activation');
  out += box(...B.src, { state: a.src, title: 'source', sub: 'webhook' });
  out += box(...B.cond, { state: a.cond, title: 'condition', sub: 'status == "down"' });
  out += box(...B.act, { state: a.act, title: 'action', sub: 'run_job_template' });
  out += arrow(130, 88, 156, 88);
  out += arrow(268, 88, 306, 88);
  out += arrow(400, 88, 410, 88);
  out += arrow(532, 88, 542, 88, { state: a.act === 'off' ? 'idle' : frame.verdict === 'true' ? 'ok' : 'idle' });
  if (frame.verdict) {
    out += label(472, 128, frame.verdict === 'true' ? 'match: true' : 'match: false',
      { cls: `stamp ${frame.verdict === 'true' ? 'ok' : 'skip'}${frame.freshVerdict ? ' appear' : ''}`, anchor: 'middle' });
  }

  out += zone(140, 180, 528, 100, 'Ansible Automation Platform');
  out += box(...B.gw, { state: a.gw, title: 'gateway', sub: a.gw === 'off' ? 'not called' : 'auth · RBAC · route' });
  out += box(...B.ctrl, { state: a.ctrl, title: 'controller', sub: a.ctrl === 'off' ? 'no job' : 'Restart service' });
  out += box(...B.exec, { state: a.exec, title: 'execution', sub: 'node' });

  const launched = frame.jobs > 0;
  out += arrow(600, 114, 600, 208, { state: a.gw === 'off' ? 'idle' : launched || a.gw === 'hot' ? 'ok' : 'idle' });
  out += arrow(516, 236, 478, 236, { state: launched ? 'ok' : 'idle' });
  out += arrow(336, 236, 298, 236, { state: a.exec !== 'pend' && a.exec !== 'off' ? 'ok' : 'idle' });
  out += route('M156 236 H75 V116', { state: frame.svc !== 'up' && a.exec === 'term' ? 'active' : 'idle' });
  out += stamp(75, 134, frame.stamp, { fresh: frame.freshStamp });

  if (frame.pk) out += packet(PATHS[frame.pk], frame.pkLabel);

  out += legend('EDA decides what should happen. The controller, through the gateway, makes it happen.', 318);
  return out;
}

/* ---------- side panels ---------- */

function metrics(frame) {
  const fixed = frame.stamp === 'changed';
  return [
    { label: 'Events received', value: frame.events },
    { label: 'Rules matched', value: frame.matched, tone: frame.matched ? 'ok' : '' },
    { label: 'Jobs launched', value: frame.jobs, tone: fixed ? 'ok' : frame.jobs ? 'warn' : '' },
  ];
}

const RULEBOOK = `- name: Remediate down services
  hosts: all
  sources:
    - ansible.eda.webhook:
        host: 0.0.0.0
        port: 5000
  rules:
    - name: Restart when a service is down
      condition: event.payload.status == "down"
      action:
        run_job_template:
          name: Restart service
          organization: Default`;

const YAML = {
  match: `# rulebook.yml — runs as a rulebook activation
${RULEBOOK}
          job_args:
            extra_vars:
              target: "{{ event.payload.host }}"`,
  nomatch: `# rulebook.yml — runs as a rulebook activation
${RULEBOOK}

# an event with status "info" matches no rule:
# no action, no job, nothing touches the host`,
};

const FEATURES = {
  match: [
    { name: 'Rulebook', kind: 'YAML file', what: 'Sources, rules and actions. Like a playbook, but it waits for events instead of running top to bottom.' },
    { name: 'ansible.eda.webhook', kind: 'event source', what: 'Listens for HTTP POSTs. Others include ansible.eda.kafka and ansible.eda.alertmanager; event streams take events in through the platform.' },
    { name: 'Rulebook activation', kind: 'EDA controller', what: 'A running rulebook, inside a decision environment container. 2.7 persists in-flight events so a restart does not lose them.' },
    { name: 'run_job_template', kind: 'action', what: 'Launches a controller job template — in 2.7 via the platform gateway, with the activation’s AAP credential.' },
  ],
  nomatch: [
    { name: 'condition', kind: 'rule', what: 'A test against event data. When it is false the event is simply dropped for that rule.' },
    { name: 'event.payload', kind: 'event data', what: 'The body the source received. Match on the fields that really signal a problem.' },
    { name: 'Filtering', kind: 'design', what: 'Most events should match nothing. Narrow conditions keep automation from reacting to noise.' },
  ],
};

const NOTES = {
  match: [
    { heading: 'Point at', text: 'The two rows. The top row only decides; the bottom row is the controller everyone already knows, reached through the gateway.' },
    { heading: 'The line that lands', text: 'EDA does not replace your playbooks. It decides when to run the ones you already trust.' },
    { ask: 'Which alert does your on-call team fix the same way every single time?' },
  ],
  nomatch: [
    { heading: 'Point at', text: 'The bottom row goes faint: gateway, controller and execution node never hear about the event.' },
    { heading: 'The line that lands', text: 'Most events should do nothing. A good rulebook is mostly a filter.' },
    { ask: 'What fraction of your monitoring alerts are actually actionable?' },
  ],
};

export default {
  id: 'eda-flow',
  title: 'Event-Driven Ansible: from event to remediation',
  summary: 'A rulebook activation receives events, tests conditions, and launches a controller job template through the gateway when one matches.',
  description: 'A host failure triggers a monitoring alert that is posted to an EDA rulebook; a matching rule launches a job template via the platform gateway and controller, which restarts the service.',
  viewBox: '0 0 680 330',
  advanced: true,
  modes: MODES,
  buildFrames,
  renderSVG,
  metrics,
  speakerNotes: (m) => NOTES[m],
  yaml: (m) => YAML[m],
  features: (m) => FEATURES[m],
};
