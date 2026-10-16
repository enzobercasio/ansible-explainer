/**
 * Handlers: react to change, once, at the end.
 *
 * Two config files both want nginx restarted. Each task notifies the same
 * handler; the handler is queued once and runs after all tasks finish. When
 * nothing changes, nothing is notified and the service is never bounced -
 * which is exactly why handlers exist.
 *
 * Frame shape:
 *   { task, stamps: [result per task], queue: [names], notifying, svc, phase, note, badge, focus }
 *   svc: 'running' | 'restarting' | 'restarted'  ;  phase: 'tasks' | 'handlers' | 'done'
 */
import { box, zone, arrow, packet, seg, label, stamp, legend } from './lib/draw.js';

const MODES = [
  { id: 'changed', label: 'Config changed',
    caption: 'Two tasks notify the same handler — nginx restarts once, after the tasks' },
  { id: 'unchanged', label: 'Nothing changed',
    caption: 'Rerun with nothing to do: no notification, no restart, no dropped connections' },
];

const TASKS = [
  { name: 'template: nginx.conf', notify: true },
  { name: 'template: site.conf', notify: true },
  { name: 'copy: index.html', notify: false },
];

function buildFrames(modeId) {
  const f = [];
  const ch = modeId === 'changed';
  const stamps = ['', '', ''];
  let queue = [];
  const snap = (o) => f.push({ task: -1, stamps: [...stamps], queue: [...queue], notifying: -1, svc: 'running', phase: 'tasks', ...o });

  snap({ focus: ['handlers:'],
    note: ch ? 'nginx is running with the old configuration' : 'Same playbook, run again right after',
    badge: ch ? 'Three tasks, two of which mean nginx must reload what it serves.' : 'Every file already matches, so this run should be invisible to users.' });

  TASKS.forEach((t, i) => {
    snap({ task: i, focus: [i === 0 ? 'dest: /etc/nginx/nginx.conf' : i === 1 ? 'dest: /etc/nginx/conf.d/site.conf' : 'dest: /usr/share/nginx/html/'],
      note: `Task ${i + 1}: ${t.name}`,
      badge: t.notify ? 'This task carries notify: Restart nginx.' : 'No notify on this one — new content does not need a restart.' });
    stamps[i] = ch ? 'changed' : 'ok';
    if (ch && t.notify) {
      const first = !queue.length;
      queue = ['Restart nginx'];
      snap({ task: i, notifying: i, focus: ['notify: Restart nginx'],
        note: first ? 'changed → the task notifies "Restart nginx"' : 'changed again → notifies the same handler again',
        badge: first ? 'The handler does not run now. It is added to a queue for the end of the play.' : 'Already queued, so nothing new is added. A handler runs at most once per play, however often it is notified.' });
    } else {
      snap({ task: i,
        note: ch ? `${t.name} → changed, but notifies nothing` : `${t.name} → ok`,
        badge: ch ? 'changed alone does not trigger anything. Only notify does.' : 'ok means no change — and notify only fires on changed.' });
    }
  });

  if (ch) {
    snap({ phase: 'handlers', svc: 'restarting', focus: ['- name: Restart nginx', 'state: restarted'],
      note: 'All tasks done — now the queued handler runs: one restart',
      badge: 'Two notifications, one restart. Handlers run in the order they are defined in handlers:, not the order notified.' });
    queue = [];
    snap({ phase: 'done', svc: 'restarted',
      note: 'nginx is serving the new configuration',
      badge: 'Need it sooner? meta: flush_handlers runs anything queued at that point in the play.' });
  } else {
    snap({ phase: 'done', svc: 'running', focus: ['- name: Restart nginx'],
      note: 'The handler queue is empty, so the handler never runs',
      badge: 'A naive "restart nginx" task would have bounced the service on every run. The handler only fires when it matters.' });
  }
  return f;
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

const ROW_Y = [56, 116, 176];

function renderSVG(frame) {
  let out = '';
  out += zone(16, 24, 230, 206, 'tasks');
  TASKS.forEach((t, i) => {
    out += box(28, ROW_Y[i], 206, 42, { state: frame.task === i && frame.phase === 'tasks' ? 'hot' : 'pend', title: t.name, sub: t.notify ? 'notify: Restart nginx' : '', titleCls: 'mono' });
    out += stamp(262, ROW_Y[i] + 25, frame.stamps[i], { anchor: 'start', fresh: frame.task === i && frame.notifying !== i && frame.stamps[i] !== '' });
  });

  // handler queue
  out += zone(330, 24, 160, 206, 'handler queue');
  if (frame.queue.length) {
    out += box(344, 110, 132, 42, { state: frame.phase === 'handlers' ? 'hot' : 'term', title: 'Restart nginx', cls: frame.notifying === 0 ? 'appear' : frame.notifying === 1 ? 'pulse' : '' });
  } else {
    out += label(410, 136, frame.phase === 'done' ? 'empty' : '(empty)', { cls: 'svg-tiny on-node', anchor: 'middle' });
  }
  if (frame.notifying >= 0) {
    const y = ROW_Y[frame.notifying] + 21;
    out += arrow(314, y, 340, 131, { state: 'active' });
    out += packet(seg([314, y], [340, 131]), 'notify');
  }

  // service
  out += zone(540, 24, 124, 206, 'web1');
  const svcState = { running: 'run', restarting: 'term', restarted: 'run' }[frame.svc];
  out += box(552, 104, 100, 54, { state: svcState, title: 'nginx', sub: frame.svc, cls: frame.svc === 'restarting' ? 'pulse' : '' });
  if (frame.phase === 'handlers') {
    out += arrow(478, 131, 548, 131, { state: 'active' });
    out += packet(seg([478, 131], [548, 131]), 'restart');
  }

  // phase rail
  const phases = [['tasks', 'tasks run'], ['handlers', 'handlers run'], ['done', 'play ends']];
  phases.forEach(([id, text], i) => {
    const x = 70 + i * 220;
    const active = frame.phase === id;
    out += box(x - 50, 254, 140, 30, { state: active ? 'hot' : 'pend', title: text, titleCls: 'svg-sub' });
    if (i < 2) out += arrow(x + 92, 269, x + 168, 269, { state: 'idle' });
  });
  out += legend('Handlers run after the tasks of a play, once each, and only if something notified them.', 318);
  return out;
}

function metrics(frame) {
  const notified = frame.stamps.filter((s, i) => s === 'changed' && TASKS[i].notify).length;
  const restarts = frame.svc === 'restarting' || frame.svc === 'restarted' ? 1 : 0;
  return [
    { label: 'Notifications', value: notified },
    { label: 'Queued handlers', value: frame.queue.length },
    { label: 'nginx restarts', value: restarts, tone: restarts ? 'warn' : 'ok' },
  ];
}

/* ------------------------------------------------------------------ */
/* Config column                                                       */
/* ------------------------------------------------------------------ */

const PLAY = `- name: Web content and config
  hosts: web1
  become: true
  tasks:
    - name: Main config
      ansible.builtin.template:
        src: nginx.conf.j2
        dest: /etc/nginx/nginx.conf
      notify: Restart nginx

    - name: Site config
      ansible.builtin.template:
        src: site.conf.j2
        dest: /etc/nginx/conf.d/site.conf
      notify: Restart nginx

    - name: Static content
      ansible.builtin.copy:
        src: index.html
        dest: /usr/share/nginx/html/

  handlers:
    - name: Restart nginx
      ansible.builtin.service:
        name: nginx
        state: restarted`;

const FEATURES = [
  { name: 'notify:', kind: 'task keyword', what: 'Names one or more handlers to queue — but only when this task reports changed.' },
  { name: 'handlers:', kind: 'play section', what: 'Tasks that only run when notified, after the regular tasks of the play. Each runs at most once.' },
  { name: 'listen:', kind: 'handler keyword', what: 'Lets several handlers subscribe to one topic, so tasks notify a topic instead of a handler name.' },
  { name: 'meta: flush_handlers', kind: 'task', what: 'Runs any queued handlers right now instead of at the end of the play.' },
];

const NOTES = {
  changed: [
    { heading: 'Point at', text: 'The second notify pulses the same queue entry rather than adding another one.' },
    { heading: 'The line that lands', text: 'Handlers turn "restart if anything relevant changed" into one line, without counting or tracking it yourself.' },
    { ask: 'How often does your team restart services "just to be safe" after a change?' },
  ],
  unchanged: [
    { heading: 'Point at', text: 'The restarts metric stays at zero, and the queue stays empty.' },
    { heading: 'The line that lands', text: 'Handlers are idempotency applied to side effects: no change, no disruption.' },
    { ask: 'Which of your services would users notice being bounced every time a playbook runs?' },
  ],
};

export default {
  id: 'handlers',
  title: 'Handlers: restart only when something changed',
  summary: 'Tasks notify a handler when they change something; the handler runs once, after the tasks — and not at all when nothing changed.',
  description: 'Two template tasks notify the same restart handler, which is queued once and runs at the end of the play; on a rerun with no changes, the handler never runs.',
  viewBox: '0 0 680 330',
  modes: MODES,
  buildFrames,
  renderSVG,
  metrics,
  speakerNotes: (m) => NOTES[m],
  yaml: () => PLAY,
  features: () => FEATURES,
};
