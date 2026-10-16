/**
 * Playbooks: plays, tasks, and the order things actually happen in.
 *
 * Left is the anatomy - a playbook holds plays, a play holds tasks, a task
 * calls a module. Right is the run grid: one row per task, one column per
 * host. The default linear strategy finishes a task on every host before the
 * next task starts, which is the single most useful thing to know when
 * reading playbook output.
 *
 * Frame shape:
 *   { row, dry, cells: [[state per host] per task], recap, note, badge, focus }
 *   cell states: '' (not yet) | 'run' (in progress) | 'ok' | 'changed' | 'failed' | 'skip'
 */
import { box, zone, label, legend } from './lib/draw.js';

const MODES = [
  { id: 'linear', label: 'Task by task',
    caption: 'The linear strategy: each task runs on every host before the next task begins' },
  { id: 'failure', label: 'A host fails',
    caption: 'A failed task removes that host from the rest of the play — the others carry on' },
  { id: 'check', label: 'Check mode (--check)',
    caption: 'A dry run: modules report what they would change, and change nothing' },
];

const TASKS = ['Gathering Facts', 'Install nginx', 'Deploy nginx.conf', 'Start nginx'];
const HOSTS = ['web1', 'web2', 'web3'];

function buildFrames(modeId) {
  const f = [];
  const grid = () => TASKS.map(() => HOSTS.map(() => ''));
  let cells = grid();
  const snap = (o) => f.push({ row: -1, recap: false, dry: modeId === 'check', cells: cells.map((r) => [...r]), ...o });
  const set = (row, states) => { cells[row] = [...states]; };

  const failMode = modeId === 'failure';
  const check = modeId === 'check';

  snap({ focus: ['- name: Configure web servers'],
    note: check ? 'Same playbook, run with --check' : 'One play, four tasks, three hosts',
    badge: check
      ? 'Nothing on the hosts will be modified. Every module is asked to predict instead of act.'
      : 'A playbook is a list of plays; a play maps hosts to an ordered list of tasks.' });

  // Gathering Facts
  set(0, ['run', 'run', 'run']);
  snap({ row: 0, focus: ['hosts: web'], note: 'Gathering Facts runs first, on all three hosts at once',
    badge: 'An implicit task. It collects OS, network and hardware details into ansible_facts.' });
  set(0, ['ok', 'ok', 'ok']);
  snap({ row: 0, note: 'Facts gathered — ok on every host',
    badge: 'Reading information never changes anything, so the result is ok rather than changed.' });

  // Install nginx
  set(1, ['run', 'run', 'run']);
  snap({ row: 1, focus: ['ansible.builtin.dnf:'], note: 'Task 2 starts only after task 1 has finished everywhere',
    badge: 'This lockstep is the linear strategy, the default. Forks controls how many hosts run at once.' });
  set(1, check ? ['changed', 'changed', 'changed'] : ['changed', 'changed', 'changed']);
  snap({ row: 1, note: check ? 'dnf predicts it would install nginx: changed' : 'nginx installed on all three: changed',
    badge: check ? 'Reported as changed, yet the package is still absent. The prediction is the whole point.' : 'Each host reports back independently; the play waits for the slowest one.' });

  // Deploy config
  set(2, ['run', 'run', 'run']);
  snap({ row: 2, focus: ['ansible.builtin.template:'], note: 'Task 3: render the config template on each host',
    badge: 'template fills in variables with Jinja2 on the control node, then copies the result over.' });
  if (failMode) {
    set(2, ['changed', 'changed', 'failed']);
    snap({ row: 2, focus: ['src: nginx.conf.j2'], note: 'web3 fails — its host_vars are missing a variable the template needs',
      badge: 'fatal: [web3]: FAILED! => AnsibleUndefinedVariable. web1 and web2 succeeded.' });
  } else {
    set(2, ['changed', 'changed', 'changed']);
    snap({ row: 2, note: check ? 'template predicts a new file on each host' : 'Config written on all three hosts',
      badge: check ? 'Add --diff to see the exact lines that would change.' : 'Three hosts, three changed results.' });
  }

  // Start service
  const alive = failMode ? ['run', 'run', ''] : ['run', 'run', 'run'];
  set(3, alive);
  snap({ row: 3, focus: ['ansible.builtin.service:'],
    note: failMode ? 'Task 4 runs on web1 and web2 only' : 'Task 4: make sure nginx is started and enabled',
    badge: failMode ? 'A failed host is dropped from the rest of the play. The others are not held back by it.' : 'state: started is a desired state, not a command — the next animation is about why.' });
  set(3, failMode ? ['changed', 'changed', 'skip'] : ['changed', 'changed', 'changed']);
  snap({ row: 3,
    note: failMode ? 'web1 and web2 are serving; web3 never reached this task' : check ? 'service predicts it would start nginx' : 'nginx running on all three',
    badge: failMode ? 'Fix the variable and rerun — finished hosts will report ok, only web3 has work left.' : check ? 'Caveat: a task that depends on an earlier change (a package not yet installed) may report differently in check mode.' : 'Every task ran on every host, in order.' });

  snap({ recap: true, row: -1, focus: failMode ? ['any_errors_fatal'] : check ? ['$ ansible-playbook site.yml --check'] : ['$ ansible-playbook site.yml'],
    note: failMode ? 'PLAY RECAP: web3 failed=1, and the run exits non-zero' : check ? 'PLAY RECAP shows changed=3 — and the hosts are untouched' : 'PLAY RECAP: ok=4 changed=3 on every host',
    badge: failMode ? 'Want one failure to stop everyone? Set any_errors_fatal: true or max_fail_percentage on the play.' : check ? 'Run --check --diff in a pipeline to review a change before you apply it.' : 'The recap is the summary you read first after every run.' });
  return f;
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

const ROW_Y = [86, 136, 186, 236];
const COL_X = [318, 434, 550];
const CELL = { run: 'hot', ok: 'run', changed: 'term', failed: 'bad', skip: 'off', '': 'pend' };
const WORD = { run: 'running…', ok: 'ok', changed: 'changed', failed: 'failed', skip: 'removed', '': '' };

function recap(frame, h) {
  const col = frame.cells.map((r) => r[h]);
  const n = (s) => col.filter((x) => x === s).length;
  const ok = n('ok') + n('changed');
  return [`ok=${ok} changed=${n('changed')}`, `failed=${n('failed')}`];
}

function renderSVG(frame) {
  let out = '';
  out += zone(16, 22, 270, 268, 'playbook: site.yml');
  out += zone(28, 46, 246, 236, 'play: hosts: web');
  TASKS.forEach((t, i) => {
    out += box(40, ROW_Y[i], 222, 38, { state: frame.row === i ? 'hot' : 'pend', title: t, sub: i === 0 ? 'implicit' : 'task → module' });
  });

  HOSTS.forEach((h, j) => {
    out += label(COL_X[j] + 54, 70, h, { cls: 'svg-title on-node', anchor: 'middle' });
  });
  frame.cells.forEach((row, i) => row.forEach((s, j) => {
    out += box(COL_X[j], ROW_Y[i], 108, 38, { state: CELL[s], title: WORD[s], cls: i === frame.row && s && s !== 'run' ? 'appear' : '' });
  }));
  if (frame.row >= 0) {
    out += `<rect class="zone outline" x="300" y="${ROW_Y[frame.row] - 6}" width="372" height="50" rx="10"/>`;
  }

  if (frame.recap) {
    HOSTS.forEach((h, j) => {
      const [a, b] = recap(frame, j);
      out += label(COL_X[j] + 54, 300, a, { cls: 'mono on-node appear', anchor: 'middle' });
      out += label(COL_X[j] + 54, 316, b, { cls: 'mono on-node appear', anchor: 'middle' });
    });
    out += label(16, 308, 'PLAY RECAP', { cls: 'zone-label' });
  }
  out += legend('Rows are tasks, columns are hosts. Linear strategy: a row completes before the next row starts.', 338);
  return out;
}

function metrics(frame) {
  const all = frame.cells.flat();
  const n = (s) => all.filter((x) => x === s).length;
  const doneRows = frame.cells.filter((r) => r.every((x) => x && x !== 'run')).length;
  return [
    { label: 'Tasks complete', value: `${doneRows} / ${TASKS.length}` },
    { label: 'changed', value: n('changed'), tone: n('changed') ? 'warn' : '' },
    frame.dry
      ? { label: 'Hosts actually modified', value: '0', tone: 'ok' }
      : { label: 'failed', value: n('failed'), tone: n('failed') ? 'bad' : 'ok' },
  ];
}

/* ------------------------------------------------------------------ */
/* Config column                                                       */
/* ------------------------------------------------------------------ */

const PLAY = `# site.yml
- name: Configure web servers
  hosts: web
  become: true
  tasks:
    - name: Install nginx
      ansible.builtin.dnf:
        name: nginx
        state: present

    - name: Deploy nginx.conf
      ansible.builtin.template:
        src: nginx.conf.j2
        dest: /etc/nginx/nginx.conf

    - name: Start nginx
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true`;

const YAML = {
  linear: `${PLAY}

$ ansible-playbook site.yml`,
  failure: PLAY.replace('  become: true', `  become: true
  # any_errors_fatal: true   # stop all hosts on one failure`),
  check: `${PLAY}

$ ansible-playbook site.yml --check --diff`,
};

const FEATURES = {
  linear: [
    { name: 'Play', kind: 'playbook entry', what: 'Maps a host pattern to an ordered list of tasks, plus settings like become and vars.' },
    { name: 'Task', kind: 'play item', what: 'One call to one module with arguments, and a name you will see in the output.' },
    { name: 'Gathering Facts', kind: 'implicit task', what: 'Runs first unless gather_facts: false. Populates ansible_facts for conditionals and templates.' },
    { name: 'strategy: linear', kind: 'default', what: 'Every host finishes a task before the next one starts. strategy: free lets each host race ahead.' },
    { name: 'forks', kind: 'ansible.cfg', what: 'How many hosts are worked on in parallel. Default 5; raise it for large inventories.' },
  ],
  failure: [
    { name: 'Failed host', kind: 'behaviour', what: 'Removed from the remaining tasks of the play. Other hosts continue unaffected.' },
    { name: 'any_errors_fatal', kind: 'play keyword', what: 'Stops the play for all hosts as soon as any host fails — for changes that must be all or nothing.' },
    { name: 'max_fail_percentage', kind: 'play keyword', what: 'Aborts once more than this share of hosts has failed. Pairs well with serial for rolling updates.' },
    { name: 'ignore_errors', kind: 'task keyword', what: 'Keep going after a failure on this task. Use rarely, and prefer failed_when to say what failure means.' },
  ],
  check: [
    { name: '--check', kind: 'CLI flag', what: 'Dry run. Modules that support check mode report what they would do without doing it.' },
    { name: '--diff', kind: 'CLI flag', what: 'Shows the before and after of files and templates. Combine with --check for a reviewable plan.' },
    { name: 'check_mode:', kind: 'task keyword', what: 'Force a single task to always (true) or never (false) run in check mode.' },
    { name: 'Limitation', kind: 'caveat', what: 'A task that depends on an earlier, simulated change can report misleadingly. Treat check mode as a preview.' },
  ],
};

const NOTES = {
  linear: [
    { heading: 'Point at', text: 'The highlighted row. Nothing in row three starts until all of row two is done.' },
    { heading: 'The line that lands', text: 'Read playbook output as "for each task, for each host". Once that clicks, the log makes sense.' },
    { ask: 'Which of your runbooks would need a different order — host by host rather than step by step?' },
  ],
  failure: [
    { heading: 'Point at', text: 'web3 turning red, then being skipped in the last row while web1 and web2 carry on.' },
    { heading: 'The line that lands', text: 'Ansible defaults to partial progress. If that is wrong for your change, say so with any_errors_fatal or max_fail_percentage.' },
    { ask: 'For a production change, would you rather stop everything or keep the healthy hosts moving?' },
  ],
  check: [
    { heading: 'Point at', text: 'The recap reports changes while the metric says nothing on the hosts moved.' },
    { heading: 'The line that lands', text: '--check --diff is the change-review step: run it in a pull request pipeline before anyone approves.' },
    { ask: 'Who reviews an infrastructure change before it reaches production today?' },
  ],
};

export default {
  id: 'playbook-run',
  title: 'Playbooks: plays, tasks and run order',
  summary: 'A playbook holds plays, a play holds tasks, a task calls a module — and each task runs on every host before the next one starts.',
  description: 'A grid of four tasks by three hosts fills row by row, showing the linear strategy, a host failing and being removed from the play, and check mode.',
  viewBox: '0 0 680 345',
  modes: MODES,
  buildFrames,
  renderSVG,
  metrics,
  speakerNotes: (m) => NOTES[m],
  yaml: (m) => YAML[m],
  features: (m) => FEATURES[m],
};
