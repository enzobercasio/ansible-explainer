/**
 * Playbook Runner chapters.
 *
 * One fleet for the whole of Part 1 - web1 and web2 on RHEL 9, db1 on Ubuntu -
 * so the audience meets the same three machines in every chapter. Each
 * chapter is a playbook (plus inventory and vars) and a set of actions the
 * presenter fires: run, run again, break something, change something.
 *
 * `script` is the suggested order. Pressing play at the end of the frames
 * fires the next scripted action, so a presenter can simply keep hitting Space.
 */

import { resolveVars } from './engine.js';

const FLEET = {
  web1: { os: 'RHEL 9', family: 'RedHat' },
  web2: { os: 'RHEL 9', family: 'RedHat' },
  db1: { os: 'Ubuntu 24.04', family: 'Debian' },
};

const INV_BASIC = {
  hosts: { web1: {}, web2: {}, db1: {} },
  groups: { web: { hosts: ['web1', 'web2'] }, db: { hosts: ['db1'] } },
};

const INVENTORY_INI = `[web]
web1.example.com
web2.example.com

[db]
db1.example.com`;

const yes = (b) => (b ? 'good' : 'bad');

/* ------------------------------------------------------------------ */
/* 1. Your first run                                                   */
/* ------------------------------------------------------------------ */

const firstRun = {
  id: 'first-run',
  title: 'Your first run',
  summary: 'One control node, three hosts, no agents. Ansible connects over SSH, ships a module, runs it, collects JSON and leaves nothing behind.',
  fleet: FLEET,
  inventory: INV_BASIC,
  files: () => ({
    'inventory.ini': INVENTORY_INI,
    'site.yml': `- name: Install the web server
  hosts: web
  become: true
  tasks:
    - name: Install nginx
      ansible.builtin.dnf:
        name: nginx
        state: present`,
  }),
  firstFile: 'inventory.ini',
  intro: {
    note: 'Three managed hosts. Ansible is installed only here, on the control node',
    badge: 'The hosts run sshd and Python — nothing else. The inventory on the left is how Ansible knows they exist.',
    anchor: '[web]',
  },
  play: () => ({
    name: 'Install the web server', hosts: 'web', file: 'site.yml', anchor: '- name: Install the web server',
    factsBadge: 'Before any task, Ansible gathers facts about each host. Chapter 5 puts them to work.',
    tasks: [{
      name: 'Install nginx', module: 'ansible.builtin.dnf', args: { name: 'nginx', state: 'present' }, anchor: '- name: Install nginx',
      say: ({ results }) => (Object.values(results).includes('changed')
        ? { note: 'Install nginx — changed on web1 and web2', badge: 'The dnf module checked first: nginx was missing, so it installed it. changed means it had to act.' }
        : { note: 'Install nginx — ok on web1 and web2', badge: 'Already installed, so the module did nothing. Same playbook, no change: that is idempotency, chapter 4.' }),
    }],
  }),
  rows: (h) => [['nginx', h.state.packages.nginx ? 'installed' : 'absent', yes(h.state.packages.nginx)]],
  actions: [
    { id: 'ping', kind: 'adhoc', label: 'ansible all -m ping', pattern: 'all', module: 'ansible.builtin.ping',
      note: 'An ad-hoc command: one module, every host in the inventory',
      badge: 'ping does not use ICMP. It proves Ansible can log in over SSH and run Python on each host.',
      doneNote: 'All three answered "pong" — and nothing was left running on them',
      doneBadge: 'The module file was copied to a temp directory, executed, and deleted. That round trip is what "agentless" means.' },
    { id: 'run', kind: 'playbook', label: 'ansible-playbook site.yml',
      note: 'Now the same mechanism, driven by a playbook you can keep in Git',
      badge: 'A playbook describes the state you want. This one: nginx is present on the web group.' },
    { id: 'again', kind: 'playbook', label: 'Run it again',
      note: 'Run exactly the same playbook a second time',
      badge: 'What should happen when nothing needs doing?' },
  ],
  script: ['ping', 'run', 'again'],
  notes: [
    { heading: 'Point at', text: 'db1 never lights up during the playbook run. The play says hosts: web, so db1 is never contacted.' },
    { heading: 'The line that lands', text: 'An ad-hoc command and a playbook use the same round trip. The playbook just makes it repeatable and reviewable.' },
    { ask: 'How many agents are installed on a typical server in your estate today?' },
  ],
};

/* ------------------------------------------------------------------ */
/* 2. Inventory                                                        */
/* ------------------------------------------------------------------ */

const inventory = {
  id: 'inventory',
  title: 'Inventory: which hosts, which values',
  summary: 'Groups and patterns decide which hosts a run touches; group_vars and host_vars decide what each host is told.',
  fleet: FLEET,
  inventory: {
    hosts: { web1: {}, web2: {}, db1: {} },
    groups: { web: { hosts: ['web1', 'web2'] }, db: { hosts: ['db1'] }, prod: { children: ['web', 'db'] } },
  },
  vars: { all: { http_port: 80 }, groups: { web: { http_port: 8080 } }, hosts: { web2: { http_port: 9090 } } },
  files: () => ({
    'inventory.ini': `[web]
web1.example.com
web2.example.com

[db]
db1.example.com

[prod:children]
web
db`,
    'group_vars/all.yml': 'http_port: 80',
    'group_vars/web.yml': 'http_port: 8080',
    'host_vars/web2.yml': 'http_port: 9090',
  }),
  intro: {
    note: 'Two groups, web and db, and a parent group prod that contains both',
    badge: 'Every host is also in the implicit group all. Variables sit beside the inventory in group_vars/ and host_vars/.',
    anchor: '[prod:children]',
  },
  play: () => ({ name: 'n/a', hosts: 'all', tasks: [] }),
  rows: (h, world) => {
    const { v, src } = resolveVars(world, h.name);
    return [['http_port', `${v.http_port}`, 'good'], ['from', src.http_port, 'muted']];
  },
  actions: [
    { id: 'web', kind: 'adhoc', label: 'ansible web -m ping', pattern: 'web', module: 'ansible.builtin.ping', anchor: '[web]',
      note: 'Pattern: web — the two web servers', badge: 'A pattern is matched against the inventory. db1 is not in web, so it is not contacted.' },
    { id: 'prod', kind: 'adhoc', label: "ansible 'prod:!web' -m ping", pattern: 'prod:!web', module: 'ansible.builtin.ping', anchor: '[prod:children]',
      note: 'Pattern: prod:!web — everything in prod except the web group',
      badge: ':! excludes, :& intersects, : alone is a union. Here that leaves db1.' },
    { id: 'limit', kind: 'adhoc', label: 'ansible web --limit web2', pattern: 'web', limit: 'web2', module: 'ansible.builtin.ping', anchor: 'web2.example.com',
      note: '--limit narrows any run further — here, to one canary host',
      badge: 'Common practice: run the real change against one host, check it, then run it everywhere.' },
    { id: 'vars', kind: 'adhoc', label: 'ansible all -m debug -a var=http_port', pattern: 'all', module: 'ansible.builtin.debug', args: 'var=http_port', moduleArgs: { var: 'http_port' },
      file: 'group_vars/web.yml', anchor: 'http_port',
      note: 'Which http_port does each host get?', badge: 'Three files define it. The most specific one wins for each host.',
      connectNote: 'Each host resolves http_port from the layers that apply to it',
      doneNote: 'web1 gets 8080 from its group, web2 gets 9090 from host_vars, db1 keeps the default 80',
      doneBadge: 'all → group → host: the closer the definition is to the host, the higher it ranks.' },
    { id: 'extra', kind: 'adhoc', label: '… -e http_port=7000', pattern: 'all', module: 'ansible.builtin.debug', args: 'var=http_port', moduleArgs: { var: 'http_port' },
      extra: { http_port: 7000 }, file: 'host_vars/web2.yml', anchor: 'http_port',
      note: 'Extra vars on the command line beat every file', badge: 'Useful for a one-off run. As a habit it hides configuration in shell history.',
      connectNote: '-e overrides every other layer, on every host',
      doneNote: 'All three report 7000 for this run only', doneBadge: 'Nothing on disk changed; the next run without -e is back to 8080, 9090 and 80.' },
  ],
  script: ['web', 'prod', 'limit', 'vars', 'extra'],
  notes: [
    { heading: 'Point at', text: 'The faded cards on each pattern. A pattern is a filter over the inventory, nothing more.' },
    { heading: 'The line that lands', text: 'Good grouping means playbooks never contain hostnames, and environment differences live in vars files, not in the playbook.' },
    { ask: 'Where do environment-specific values live in your current scripts?' },
  ],
};


/* ------------------------------------------------------------------ */
/* 3. Plays, tasks and order                                           */
/* ------------------------------------------------------------------ */

const NGINX_TPL = (v) => `listen ${v.nginx_port}`;

const playsTasks = {
  id: 'plays-tasks',
  title: 'Plays, tasks and run order',
  summary: 'Each task runs on every host before the next task starts. A host that fails drops out; the others carry on. --check previews it all.',
  fleet: FLEET,
  inventory: INV_BASIC,
  vars: { all: {}, groups: {}, hosts: { web1: { nginx_port: 8080 }, web2: { nginx_port: 8080 } } },
  files: (w) => ({
    'site.yml': `- name: Configure web servers
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
        state: started`,
    'host_vars/web1.yml': 'nginx_port: 8080',
    'host_vars/web2.yml': w.flags.broken ? '# nginx_port was deleted in a bad commit' : 'nginx_port: 8080',
    'templates/nginx.conf.j2': 'listen {{ nginx_port }};',
  }),
  intro: { note: 'One play, three tasks, two target hosts', badge: 'A playbook is a list of plays; a play maps a host pattern to an ordered task list.', anchor: '- name: Configure web servers' },
  play: () => ({
    name: 'Configure web servers', hosts: 'web', file: 'site.yml', anchor: '- name: Configure web servers',
    tasks: [
      { name: 'Install nginx', module: 'ansible.builtin.dnf', args: { name: 'nginx', state: 'present' }, anchor: '- name: Install nginx',
        explain: 'Task 2 waits until task 1 has finished on every host: the default linear strategy.' },
      { name: 'Deploy nginx.conf', module: 'ansible.builtin.template', args: { dest: '/etc/nginx/nginx.conf', needs: ['nginx_port'], render: NGINX_TPL }, anchor: '- name: Deploy nginx.conf',
        say: ({ results }) => (results.web2 === 'failed'
          ? { note: 'Deploy nginx.conf — web2 FAILED: nginx_port is undefined', badge: 'web2 is removed from the rest of the play. web1 is not held back by it.' }
          : null),
        explain: 'The template is rendered with each host’s own variables, then copied over.' },
      { name: 'Start nginx', module: 'ansible.builtin.service', args: { name: 'nginx', state: 'started' }, anchor: '- name: Start nginx',
        say: ({ results }) => (!results.web2 && results.web1 ? { note: 'Start nginx — runs on web1 only', badge: 'A failed host gets no further tasks. Fix the variable and rerun: finished work reports ok.' } : null) },
    ],
  }),
  rows: (h) => (h.name === 'db1' ? [['not in web', '—', 'muted']] : [
    ['nginx', h.state.packages.nginx ? 'installed' : 'absent', yes(h.state.packages.nginx)],
    ['nginx.conf', h.state.files['/etc/nginx/nginx.conf'] || 'missing', yes(h.state.files['/etc/nginx/nginx.conf'])],
    ['service', h.state.services.nginx || 'stopped', yes(h.state.services.nginx === 'running')],
  ]),
  actions: [
    { id: 'check', kind: 'playbook', check: true, label: 'Dry run: --check',
      note: 'First, a dry run: what would this playbook change?', badge: 'In check mode modules report what they would do, and do nothing.' },
    { id: 'run', kind: 'playbook', label: 'ansible-playbook site.yml',
      note: 'Now for real', badge: 'Watch the cursor: each task finishes on both hosts before the next begins.' },
    { id: 'break', kind: 'event', label: 'Break web2', cmd: ['$ git commit -m "tidy host_vars"   # oops: nginx_port deleted'],
      file: 'host_vars/web2.yml', anchor: 'nginx_port',
      apply: (w) => { w.flags.broken = true; w.vars.hosts.web2 = {}; return ['web2']; },
      note: 'A bad commit removes nginx_port from web2’s host_vars', badge: 'Nothing on the host has changed yet. The next run will find out.' },
    { id: 'again', kind: 'playbook', label: 'Run again',
      note: 'Run the playbook again with the broken variable', badge: 'web1 is fine. web2 cannot render its template.' },
  ],
  script: ['check', 'run', 'break', 'again'],
  notes: [
    { heading: 'Point at', text: 'The cursor on the left and the terminal moving together, task by task.' },
    { heading: 'The line that lands', text: 'Read playbook output as "for each task, for each host". Partial progress is the default; any_errors_fatal changes that.' },
    { ask: 'For a production change, would you rather stop everything on the first failure or keep healthy hosts moving?' },
  ],
};

/* ------------------------------------------------------------------ */
/* 4. Idempotency                                                      */
/* ------------------------------------------------------------------ */

const IDEM_HEAD = `- name: Web server, as a desired state
  hosts: web
  become: true
  tasks:
    - name: nginx is installed
      ansible.builtin.dnf:
        name: nginx
        state: present

    - name: nginx.conf matches the template
      ansible.builtin.template:
        src: nginx.conf.j2
        dest: /etc/nginx/nginx.conf

    - name: nginx is running
      ansible.builtin.service:
        name: nginx
        state: started
`;

const idempotency = {
  id: 'idempotency',
  title: 'Idempotency: run it again, safely',
  summary: 'Modules check before they act, so a second run changes nothing and a third repairs only what drifted. A shell one-liner cannot do that.',
  fleet: FLEET,
  inventory: INV_BASIC,
  vars: { all: { nginx_port: 80 }, groups: {}, hosts: {} },
  files: (w) => ({
    'site.yml': IDEM_HEAD + (w.variant === 'fixed'
      ? `
    - name: Login banner is present
      ansible.builtin.lineinfile:
        path: /etc/motd
        line: "Authorized use only"`
      : `
    - name: Add login banner  # anti-pattern
      ansible.builtin.shell: >
        echo "Authorized use only" >> /etc/motd`),
  }),
  intro: { note: 'Four tasks. Three describe an end state; the last one is a shell command', badge: 'Run it a few times and watch which tasks keep reporting changed.', anchor: '- name: Add login banner' },
  play: (w) => ({
    name: 'Web server, as a desired state', hosts: 'web', file: 'site.yml', anchor: '- name: Web server, as a desired state',
    tasks: [
      { name: 'nginx is installed', module: 'ansible.builtin.dnf', args: { name: 'nginx', state: 'present' }, anchor: '- name: nginx is installed' },
      { name: 'nginx.conf matches the template', module: 'ansible.builtin.template', args: { dest: '/etc/nginx/nginx.conf', render: (v) => `listen ${v.nginx_port}` }, anchor: '- name: nginx.conf matches' },
      { name: 'nginx is running', module: 'ansible.builtin.service', args: { name: 'nginx', state: 'started' }, anchor: '- name: nginx is running',
        say: ({ results, runNo }) => (runNo > 2 && results.web1 === 'changed'
          ? { note: 'nginx is running — changed on web1 only', badge: 'Only the drifted piece is repaired. Run this on a schedule and drift heals itself.' } : null) },
      w.variant === 'fixed'
        ? { name: 'Login banner is present', module: 'ansible.builtin.lineinfile', args: { path: '/etc/motd' }, anchor: '- name: Login banner is present',
          say: ({ results }) => (results.web1 === 'ok' ? { note: 'Login banner is present — ok', badge: 'lineinfile found the line and left the file alone. The recap can be trusted again. (Clean up old duplicates once, by hand or with a regexp.)' } : null) }
        : { name: 'Add login banner', module: 'ansible.builtin.shell', args: { appendTo: '/etc/motd' }, anchor: '- name: Add login banner',
          say: ({ runNo }) => (runNo > 1
            ? { note: `Add login banner — changed, again. /etc/motd now has ${runNo} copies`, badge: 'shell cannot know what "done" looks like, so it acts — and reports changed — on every run.' }
            : { note: 'Add login banner — changed', badge: 'Looks fine after one run, which is why this pattern survives code review.' }) },
    ],
  }),
  rows: (h) => (h.name === 'db1' ? [['not in web', '—', 'muted']] : [
    ['nginx', h.state.packages.nginx ? 'installed' : 'absent', yes(h.state.packages.nginx)],
    ['nginx.conf', h.state.files['/etc/nginx/nginx.conf'] ? 'rendered' : 'missing', yes(h.state.files['/etc/nginx/nginx.conf'])],
    ['service', h.state.services.nginx || 'stopped', yes(h.state.services.nginx === 'running')],
    ['motd banner', `${h.state.lines['/etc/motd'] || 0}×`, (h.state.lines['/etc/motd'] || 0) > 1 ? 'bad' : (h.state.lines['/etc/motd'] ? 'good' : 'muted')],
  ]),
  actions: [
    { id: 'run', kind: 'playbook', label: 'ansible-playbook site.yml', note: 'First run against fresh hosts', badge: 'Everything is missing, so everything should change.' },
    { id: 'again', kind: 'playbook', label: 'Run again', note: 'Same playbook, same hosts, run again', badge: 'A well-written playbook should now report changed=0.',
      recap: ({ tally, world }) => {
        const ch = Object.values(tally).reduce((s, t) => s + t.changed, 0);
        if (world.variant === 'fixed' && ch === 0) return { note: 'PLAY RECAP — changed=0. Fully idempotent', badge: 'Now "changed" means something real happened, which makes it a signal worth alerting on.' };
        if (ch === 2) return { note: 'PLAY RECAP — still changed=1 per host: the banner task', badge: 'Every declarative task said ok. The shell task is the only one that cannot tell it is already done.' };
        return {};
      } },
    { id: 'drift', kind: 'event', label: 'Drift: stop nginx on web1', cmd: ['$ ssh web1 sudo systemctl stop nginx   # someone, at 2am'],
      apply: (w) => { w.hosts.web1.state.services.nginx = 'stopped'; return ['web1']; },
      note: 'Someone logs in to web1 and stops nginx by hand', badge: 'Configuration drift. The playbook still describes what you actually want.' },
    { id: 'fix', kind: 'event', label: 'Fix: use lineinfile', cmd: ['$ git commit -m "banner: shell -> lineinfile"'],
      file: 'site.yml', anchor: '- name: Login banner is present',
      apply: (w) => { w.variant = 'fixed'; return []; },
      note: 'Replace the shell command with a module that describes the end state', badge: 'lineinfile reads the file first and only adds the line if it is missing.' },
  ],
  script: ['run', 'again', 'drift', 'again', 'fix', 'again'],
  notes: [
    { heading: 'Point at', text: 'The second run: three oks and one stubborn changed. Then the drift run: exactly one repair.' },
    { heading: 'The line that lands', text: 'If every run says changed, changed stops meaning anything. Idempotent tasks make "just run it again" a safe answer.' },
    { ask: 'How many shell: tasks are in your playbooks, and how many have a module that already does the job?' },
  ],
};

/* ------------------------------------------------------------------ */
/* 5. Facts, conditionals, loops, register                             */
/* ------------------------------------------------------------------ */

const facts = {
  id: 'facts',
  title: 'Facts, conditionals, loops and register',
  summary: 'Ansible learns about each host before acting, uses when: to pick the right task per host, loops over lists, and remembers results with register.',
  fleet: FLEET,
  inventory: INV_BASIC,
  init: (w) => { Object.values(w.hosts).forEach((h) => { h.state.users = ['alice']; }); },
  files: () => ({
    'site.yml': `- name: Web server on any OS family
  hosts: all
  become: true
  tasks:
    - name: Install httpd (RHEL family)
      ansible.builtin.dnf:
        name: httpd
      when: ansible_facts['os_family'] == 'RedHat'

    - name: Install apache2 (Debian family)
      ansible.builtin.apt:
        name: apache2
      when: ansible_facts['os_family'] == 'Debian'

    - name: Team accounts exist
      ansible.builtin.user:
        name: "{{ item }}"
      loop: [alice, bob, carol]
      register: created

    - name: Report new accounts
      ansible.builtin.debug:
        msg: "{{ created.results | selectattr('changed')
                 | map(attribute='item') | list }}"
      when: created.changed`,
  }),
  intro: { note: 'One playbook for a mixed fleet: two RHEL hosts and one Ubuntu host', badge: 'RHEL installs with dnf, Ubuntu with apt. Facts let one play handle both.', anchor: 'hosts: all' },
  play: () => ({
    name: 'Web server on any OS family', hosts: 'all', file: 'site.yml', anchor: '- name: Web server on any OS family',
    factsBadge: 'Now the facts matter: os_family is RedHat on web1 and web2, Debian on db1. Look at the cards.',
    tasks: [
      { name: 'Install httpd (RHEL family)', module: 'ansible.builtin.dnf', args: { name: 'httpd' }, anchor: '- name: Install httpd',
        when: (v) => v.ansible_facts.os_family === 'RedHat',
        explain: 'when: is evaluated per host before anything is sent. db1 reports skipping — not a failure, just not applicable.' },
      { name: 'Install apache2 (Debian family)', module: 'ansible.builtin.apt', args: { name: 'apache2' }, anchor: '- name: Install apache2',
        when: (v) => v.ansible_facts.os_family === 'Debian',
        explain: 'Mirror image: only db1 acts. Every host got exactly one web server.' },
      { name: 'Team accounts exist', module: 'ansible.builtin.user', loop: ['alice', 'bob', 'carol'], args: (item) => ({ name: item }), register: 'created', anchor: '- name: Team accounts exist',
        explain: 'One task, three iterations per host. alice already existed, so her item is ok; bob and carol are created.' },
      { name: 'Report new accounts', module: 'ansible.builtin.debug', anchor: '- name: Report new accounts',
        when: (v, h) => h.reg.created && h.reg.created.changed,
        args: { msg: (v, h) => h.reg.created.results.filter((r) => r.changed).map((r) => r.item) },
        say: ({ results }) => (Object.values(results).every((r) => r === 'skip')
          ? { note: 'Report new accounts — skipping everywhere', badge: 'created.changed is false on every host this time, so the report does not fire.' }
          : { note: 'Report new accounts — prints bob and carol per host', badge: 'register saved the loop results; this task reads them. That is how one task reacts to another.' }) },
    ],
  }),
  rows: (h) => [
    ['os_family', h.facts ? h.family : 'not gathered', h.facts ? 'good' : 'muted'],
    [h.family === 'RedHat' ? 'httpd' : 'apache2', (h.state.packages.httpd || h.state.packages.apache2) ? 'installed' : 'absent', yes(h.state.packages.httpd || h.state.packages.apache2)],
    ['users', h.state.users.join(', '), 'good'],
  ],
  actions: [
    { id: 'run', kind: 'playbook', label: 'ansible-playbook site.yml', note: 'Run against all three hosts', badge: 'First, the facts.' },
    { id: 'again', kind: 'playbook', label: 'Run again', note: 'Run it again', badge: 'Packages present, users present: what does the report task do now?' },
  ],
  script: ['run', 'again'],
  notes: [
    { heading: 'Point at', text: 'The os_family row filling in on Gathering Facts, then the skipping lines that follow from it.' },
    { heading: 'The line that lands', text: 'Facts let one playbook describe a mixed estate. register lets one task’s outcome drive the next.' },
    { ask: 'How many OS versions does your team support, and how many separate scripts does that imply today?' },
  ],
};

/* ------------------------------------------------------------------ */
/* 6. Handlers                                                         */
/* ------------------------------------------------------------------ */

const handlers = {
  id: 'handlers',
  title: 'Handlers: restart only when something changed',
  summary: 'Tasks notify a handler when they change something. It runs once, after the tasks — and not at all when nothing changed.',
  fleet: FLEET,
  inventory: INV_BASIC,
  init: (w) => {
    w.flags.workers = 1024;
    ['web1', 'web2'].forEach((n) => { Object.assign(w.hosts[n].state, { packages: { nginx: true }, services: { nginx: 'running' } }); });
  },
  files: (w) => ({
    'site.yml': `- name: Web config and content
  hosts: web
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
        dest: /usr/share/nginx/html/index.html

  handlers:
    - name: Restart nginx
      ansible.builtin.service:
        name: nginx
        state: restarted`,
    'templates/nginx.conf.j2': `worker_processes auto;
events {
  worker_connections ${w.flags.workers};
}`,
  }),
  intro: { note: 'nginx is already running. Two config tasks notify a restart handler', badge: 'The third task changes content only — no restart needed for that.', anchor: 'handlers:' },
  play: () => ({
    name: 'Web config and content', hosts: 'web', file: 'site.yml', anchor: '- name: Web config and content', gather: false,
    tasks: [
      { name: 'Main config', module: 'ansible.builtin.template', args: { dest: '/etc/nginx/nginx.conf', render: (v, h, w) => `workers ${w.flags.workers}` }, notify: 'Restart nginx', anchor: '- name: Main config',
        say: ({ results }) => (results.web1 === 'changed' ? { note: 'Main config — changed → notifies "Restart nginx"', badge: 'The handler does not run now. It is queued for the end of the play.' } : null) },
      { name: 'Site config', module: 'ansible.builtin.template', args: { dest: '/etc/nginx/conf.d/site.conf', render: () => 'site v1' }, notify: 'Restart nginx', anchor: '- name: Site config',
        say: ({ results }) => (results.web1 === 'changed' ? { note: 'Site config — changed → notifies the same handler again', badge: 'Already queued. A handler runs at most once per play, however often it is notified.' } : null) },
      { name: 'Static content', module: 'ansible.builtin.copy', args: { dest: '/usr/share/nginx/html/index.html', content: 'v1' }, anchor: '- name: Static content',
        explain: 'No notify on this task: new content does not need a restart.' },
    ],
    handlers: [
      { name: 'Restart nginx', module: 'ansible.builtin.service', args: { name: 'nginx', state: 'restarted' }, anchor: '- name: Restart nginx',
        say: () => ({ note: 'RUNNING HANDLER [Restart nginx] — once per host', badge: 'All tasks are done; now each queued handler runs once. Need it sooner? meta: flush_handlers.' }) },
    ],
  }),
  rows: (h, w) => (h.name === 'db1' ? [['not in web', '—', 'muted']] : [
    ['nginx.conf', h.state.files['/etc/nginx/nginx.conf'] || 'not managed yet', h.state.files['/etc/nginx/nginx.conf'] ? 'good' : 'muted'],
    ['site.conf', h.state.files['/etc/nginx/conf.d/site.conf'] ? 'present' : 'missing', yes(h.state.files['/etc/nginx/conf.d/site.conf'])],
    ['service', h.state.services.nginx, yes(h.state.services.nginx === 'running')],
    ['restarts', String(h.state.restarts || 0), h.state.restarts ? 'warn' : 'good'],
  ]),
  actions: [
    { id: 'run', kind: 'playbook', label: 'ansible-playbook site.yml', note: 'First run: both configs are new', badge: 'Two tasks will notify. How many restarts should that cause?' },
    { id: 'again', kind: 'playbook', label: 'Run again', note: 'Run it again with nothing to change', badge: 'No change, no notify — so no restart and no dropped connections.',
      recap: ({ tally }) => (Object.values(tally).every((t) => t.changed === 0)
        ? { note: 'PLAY RECAP — changed=0, and the handler never ran', badge: 'A plain "restart nginx" task would have bounced the service on every run.' } : {}) },
    { id: 'edit', kind: 'event', label: 'Edit nginx.conf.j2', cmd: ['$ git commit -m "nginx: worker_connections 1024 -> 2048"'],
      file: 'templates/nginx.conf.j2', anchor: 'worker_connections',
      apply: (w) => { w.flags.workers = 2048; return []; },
      note: 'A colleague raises worker_connections in the template', badge: 'Only the main config will differ on the next run.' },
  ],
  script: ['run', 'again', 'edit', 'again'],
  notes: [
    { heading: 'Point at', text: 'Two "changed" notifications, one RUNNING HANDLER, and the restarts counter going up by exactly one.' },
    { heading: 'The line that lands', text: 'Handlers are idempotency applied to side effects: no change, no disruption.' },
    { ask: 'Which of your services would users notice being restarted every time a playbook runs?' },
  ],
};

/* ------------------------------------------------------------------ */
/* 7. Roles and collections                                            */
/* ------------------------------------------------------------------ */

const ROLE = 'roles/nginx/tasks/main.yml';
const roles = {
  id: 'roles',
  title: 'Roles and collections',
  summary: 'A role packages tasks, handlers and defaults in a standard layout; collections bring the modules. The play shrinks to one line.',
  fleet: FLEET,
  inventory: INV_BASIC,
  vars: { defaults: { nginx_port: 80 }, all: {}, groups: {}, hosts: {} },
  collections: ['ansible.builtin'],
  files: () => ({
    'site.yml': `- name: Web tier
  hosts: web
  become: true
  roles:
    - nginx`,
    [ROLE]: `- name: Install nginx
  ansible.builtin.dnf:
    name: nginx

- name: Render config
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
  notify: Restart nginx

- name: Open https
  ansible.posix.firewalld:
    service: https
    state: enabled
    permanent: true

- name: Start nginx
  ansible.builtin.service:
    name: nginx
    state: started`,
    'roles/nginx/handlers/main.yml': `- name: Restart nginx
  ansible.builtin.service:
    name: nginx
    state: restarted`,
    'roles/nginx/defaults/main.yml': 'nginx_port: 80',
    'requirements.yml': `collections:
  - name: ansible.posix`,
  }),
  intro: { note: 'The whole play is now one line: roles: [nginx]', badge: 'The work lives in roles/nginx — tasks, handlers and defaults, each in its expected folder.', anchor: 'roles:' },
  play: () => ({
    name: 'Web tier', hosts: 'web', file: 'site.yml', anchor: '- name: Web tier', gather: false,
    tasks: [
      { role: 'nginx', file: ROLE, name: 'Install nginx', module: 'ansible.builtin.dnf', args: { name: 'nginx' }, anchor: '- name: Install nginx',
        explain: 'The output says [nginx : Install nginx] — the role name, then the task. The cursor jumped into the role’s tasks file.' },
      { role: 'nginx', file: ROLE, name: 'Render config', module: 'ansible.builtin.template', args: { dest: '/etc/nginx/nginx.conf', needs: ['nginx_port'], render: (v) => `listen ${v.nginx_port}` }, notify: 'Restart nginx', anchor: '- name: Render config',
        explain: 'nginx_port comes from the role’s defaults/main.yml — the lowest precedence, so inventory can override it.' },
      { role: 'nginx', file: ROLE, name: 'Open https', module: 'ansible.posix.firewalld', collection: 'ansible.posix', args: { service: 'https' }, anchor: '- name: Open https',
        explain: 'ansible.posix.firewalld comes from a collection: namespace ansible, collection posix, module firewalld.' },
      { role: 'nginx', file: ROLE, name: 'Start nginx', module: 'ansible.builtin.service', args: { name: 'nginx', state: 'started' }, anchor: '- name: Start nginx' },
    ],
    handlers: [
      { role: 'nginx', file: 'roles/nginx/handlers/main.yml', name: 'Restart nginx', module: 'ansible.builtin.service', args: { name: 'nginx', state: 'restarted' }, anchor: '- name: Restart nginx',
        explain: 'The role’s handlers/main.yml was registered automatically — no wiring in the play.' },
    ],
  }),
  rows: (h) => (h.name === 'db1' ? [['not in web', '—', 'muted']] : [
    ['nginx', h.state.packages.nginx ? 'installed' : 'absent', yes(h.state.packages.nginx)],
    ['firewall https', (h.state.firewall || []).includes('https') ? 'open' : 'closed', yes((h.state.firewall || []).includes('https'))],
    ['service', h.state.services.nginx || 'stopped', yes(h.state.services.nginx === 'running')],
  ]),
  actions: [
    { id: 'run', kind: 'playbook', label: 'ansible-playbook site.yml', note: 'Run the one-line play', badge: 'The role needs a module from a collection. Is it installed?' },
    { id: 'install', kind: 'event', label: 'ansible-galaxy collection install', file: 'requirements.yml', anchor: '- name: ansible.posix',
      cmd: ['$ ansible-galaxy collection install -r requirements.yml', 'Starting galaxy collection install process', 'Process install dependency map', 'Installing \'ansible.posix\' to ~/.ansible/collections/…', 'ansible.posix was installed successfully'],
      apply: (w) => { w.collections.push('ansible.posix'); return []; },
      note: 'Install what requirements.yml lists', badge: 'From Ansible Galaxy, or certified and validated content from Red Hat automation hub. Pin versions for repeatable runs.' },
    { id: 'again', kind: 'playbook', label: 'Run again', note: 'Run the play again, collection in place', badge: 'Watch the cursor move into the role’s files.' },
  ],
  script: ['run', 'install', 'again'],
  notes: [
    { heading: 'Point at', text: 'The run that fails before it starts, and then the cursor jumping from site.yml into roles/nginx/tasks/main.yml.' },
    { heading: 'The line that lands', text: 'The play says what; the role holds how; collections supply the modules. Upgrade a collection without touching ansible-core.' },
    { ask: 'Which configuration does each team write slightly differently today, and could be one shared role?' },
  ],
};

export const chapters = [firstRun, inventory, playsTasks, idempotency, facts, handlers, roles];
