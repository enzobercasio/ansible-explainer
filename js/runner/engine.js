/**
 * Playbook Runner engine.
 *
 * A small, deterministic model of ansible-core: an inventory, a fleet of hosts
 * with real-ish state (packages, files, services, users), a handful of
 * modules that check before they act, and a linear-strategy runner that emits
 * the same output ansible-playbook prints.
 *
 * Everything a chapter does is an action replayed from the chapter's initial
 * state, so a history like ['run', 'again', 'drift', 'again'] always produces
 * the same frames. That is what makes scrubbing backwards and deep links work:
 * the UI never mutates anything, it just replays.
 *
 * Frame shape (pure data, consumed by app.js):
 *   { file, hl: [start, end] | null, term: [{ t, c }], fresh, hosts: [HostView],
 *     note, badge, label }
 *   HostView: { name, os, groups, rows: [[label, value, tone]], status, act }
 */

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const clone = (o) => JSON.parse(JSON.stringify(o));
const WIDTH = 64;
const banner = (s) => `${s} ${'*'.repeat(Math.max(3, WIDTH - s.length - 1))}`;

/** Locate a block in a file: the anchor line through the line before the
    next sibling at the same or shallower indent. 0-based, inclusive. */
export function blockRange(text, anchor) {
  if (!text || !anchor) return null;
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.includes(anchor));
  if (start < 0) return null;
  const indent = (l) => l.match(/^(\s*)/)[1].length;
  const base = indent(lines[start]);
  let end = start;
  for (let i = start + 1; i < lines.length; i += 1) {
    const l = lines[i];
    if (!l.trim()) { continue; }
    if (indent(l) <= base) break;
    end = i;
  }
  return [start, end];
}

/** A play's header: its name line down to (not including) tasks:/handlers:. */
export function playRange(text, anchor) {
  const r = blockRange(text, anchor);
  if (!r) return null;
  const lines = text.split('\n');
  for (let i = r[0] + 1; i <= r[1]; i += 1) {
    if (/^\s+(tasks|handlers):/.test(lines[i])) return [r[0], i - 1];
  }
  return r;
}

/* ------------------------------------------------------------------ */
/* Inventory                                                           */
/* ------------------------------------------------------------------ */

function groupMembers(inv, name, seen = new Set()) {
  if (name === 'all') return Object.keys(inv.hosts);
  if (inv.hosts[name]) return [name];
  const g = inv.groups[name];
  if (!g || seen.has(name)) return [];
  seen.add(name);
  const direct = g.hosts || [];
  const kids = (g.children || []).flatMap((c) => groupMembers(inv, c, seen));
  return [...new Set([...direct, ...kids])];
}

/** Host patterns: a:b union, a:&b intersection, a:!b exclusion. */
export function selectHosts(inv, pattern, limit) {
  let sel = [];
  pattern.split(':').forEach((tok, i) => {
    if (tok.startsWith('!')) sel = sel.filter((h) => !groupMembers(inv, tok.slice(1)).includes(h));
    else if (tok.startsWith('&')) sel = sel.filter((h) => groupMembers(inv, tok.slice(1)).includes(h));
    else sel = i === 0 ? groupMembers(inv, tok) : [...new Set([...sel, ...groupMembers(inv, tok)])];
  });
  if (limit) sel = sel.filter((h) => groupMembers(inv, limit).includes(h));
  const order = Object.keys(inv.hosts);
  return order.filter((h) => sel.includes(h));
}

export function groupsOf(inv, host) {
  return Object.keys(inv.groups).filter((g) => groupMembers(inv, g).includes(host));
}

/** Variable precedence, simplified to the layers the chapters use:
    group_vars/all < parent group < child group < host_vars < extra vars. */
export function resolveVars(world, host, extra = {}) {
  const inv = world.inventory;
  const v = {};
  const src = {};
  const put = (vars, from) => Object.entries(vars || {}).forEach(([k, val]) => {
    if (val === undefined) return;
    v[k] = val; src[k] = from;
  });
  put(world.vars.defaults, 'role defaults');
  put(world.vars.all, 'group_vars/all.yml');
  // parents before children: a group that is a child of another applies later
  const groups = groupsOf(inv, host).sort((a, b) => depth(inv, a) - depth(inv, b));
  groups.forEach((g) => put(world.vars.groups[g], `group_vars/${g}.yml`));
  put(world.vars.hosts[host], `host_vars/${host}.yml`);
  put(extra, '-e (extra vars)');
  return { v, src };
}

function depth(inv, g) {
  const parents = Object.keys(inv.groups).filter((p) => (inv.groups[p].children || []).includes(g));
  return parents.length ? 1 + Math.max(...parents.map((p) => depth(inv, p))) : 0;
}

/* ------------------------------------------------------------------ */
/* Modules                                                             */
/* ------------------------------------------------------------------ */

/* Each module inspects the host, decides changed / ok / failed, and returns
   an apply() that is only called outside check mode. That split is the whole
   of idempotency, in miniature. */
const pkg = (h, a) => {
  const want = a.state !== 'absent';
  const has = Boolean(h.state.packages[a.name]);
  return { changed: want !== has, apply() { h.state.packages[a.name] = want; } };
};

const MODULES = {
  'ansible.builtin.ping': () => ({ changed: false, data: { ping: 'pong' } }),
  'ansible.builtin.setup': (h) => ({ changed: false, always: true, apply() { h.facts = true; } }),
  'ansible.builtin.dnf': pkg,
  'ansible.builtin.apt': pkg,
  'ansible.builtin.package': pkg,
  'ansible.builtin.template': (h, a, vars, world) => {
    const missing = (a.needs || []).find((n) => vars[n] === undefined);
    if (missing) return { failed: true, msg: `AnsibleUndefinedVariable: '${missing}' is undefined` };
    const content = a.render(vars, h, world);
    return { changed: h.state.files[a.dest] !== content, apply() { h.state.files[a.dest] = content; } };
  },
  'ansible.builtin.copy': (h, a) => ({
    changed: h.state.files[a.dest] !== a.content,
    apply() { h.state.files[a.dest] = a.content; },
  }),
  'ansible.builtin.service': (h, a) => {
    const running = h.state.services[a.name] === 'running';
    if (a.state === 'restarted') {
      return { changed: true, apply() { h.state.services[a.name] = 'running'; h.state.restarts = (h.state.restarts || 0) + 1; } };
    }
    const want = a.state === 'started';
    return { changed: want !== running, apply() { h.state.services[a.name] = want ? 'running' : 'stopped'; } };
  },
  'ansible.builtin.lineinfile': (h, a) => {
    const n = h.state.lines[a.path] || 0;
    return { changed: n === 0, apply() { h.state.lines[a.path] = Math.max(1, n); } };
  },
  'ansible.builtin.shell': (h, a) => ({
    changed: true, noCheck: true,
    apply() { if (a.appendTo) h.state.lines[a.appendTo] = (h.state.lines[a.appendTo] || 0) + 1; },
  }),
  'ansible.builtin.user': (h, a) => {
    const has = h.state.users.includes(a.name);
    return { changed: !has, apply() { if (!has) h.state.users.push(a.name); } };
  },
  'ansible.builtin.debug': (h, a, vars) => ({ changed: false, msg: a.msg ? a.msg(vars, h) : undefined, varOut: a.var }),
  'ansible.posix.firewalld': (h, a) => {
    const has = (h.state.firewall || []).includes(a.service);
    return { changed: !has, apply() { h.state.firewall = [...(h.state.firewall || []), a.service]; } };
  },
};

const short = (mod) => mod.split('.').pop();

/* ------------------------------------------------------------------ */
/* Replay                                                              */
/* ------------------------------------------------------------------ */

/**
 * Build every frame for a chapter and a history of action ids.
 * Returns { frames, runs } where runs[i] is the frame index each action starts at.
 */
export function replay(chapter, history) {
  const world = {
    inventory: clone(chapter.inventory),
    vars: clone(chapter.vars || { all: {}, groups: {}, hosts: {} }),
    hosts: {},
    variant: chapter.variant || 'default',
    collections: [...(chapter.collections || [])],
    flags: {},
  };
  Object.entries(chapter.fleet).forEach(([name, h]) => {
    world.hosts[name] = { name, os: h.os, family: h.family, facts: false, reg: {}, state: { packages: {}, files: {}, services: {}, lines: {}, users: [], restarts: 0, ...clone(h.state || {}) } };
  });
  if (chapter.init) chapter.init(world);

  const frames = [];
  const runs = [];
  const term = [];
  let lastFile = chapter.firstFile || Object.keys(chapter.files(world))[0];
  let runNo = 0;

  const view = (statuses = {}, acts = {}) => Object.values(world.hosts).map((h) => ({
    name: h.name, os: h.os,
    groups: groupsOf(world.inventory, h.name).filter((g) => !(chapter.hideGroups || []).includes(g)),
    rows: chapter.rows(h, world),
    status: statuses[h.name] || 'idle',
    act: acts[h.name] || '',
  }));

  const emit = (o, newLines = []) => {
    newLines.forEach((l) => term.push(typeof l === 'string' ? { t: l, c: 'plain' } : l));
    if (o.file) lastFile = o.file;
    const files = chapter.files(world);
    frames.push({
      file: lastFile, files, hl: o.hl || null,
      term: term.slice(-80), fresh: Math.min(newLines.length, 80),
      hosts: o.hosts || view(o.statuses, o.acts),
      note: o.note, badge: o.badge || '', label: o.label || '',
    });
  };

  const rangeIn = (file, anchor) => blockRange(chapter.files(world)[file], anchor);

  /* first frame: the chapter as it stands, nothing run yet */
  emit({ note: chapter.intro.note, badge: chapter.intro.badge, file: lastFile, hl: chapter.intro.anchor ? rangeIn(lastFile, chapter.intro.anchor) : null });

  history.forEach((id) => {
    const action = chapter.actions.find((a) => a.id === id);
    if (!action) return;
    runs.push(frames.length);
    if (action.kind === 'event') return runEvent(action);
    if (action.kind === 'adhoc') return runAdhoc(action);
    runNo += 1;
    return runPlaybook(action);
  });

  return { frames, runs };

  /* ---------------- events: something happens outside Ansible ---------------- */
  function runEvent(a) {
    const touched = a.apply(world) || [];
    const statuses = {};
    touched.forEach((h) => { statuses[h] = 'drift'; });
    emit({ note: a.note, badge: a.badge, statuses, file: a.file, hl: a.file && a.anchor ? rangeIn(a.file, a.anchor) : null, label: a.label },
      [{ t: '', c: 'plain' }, ...a.cmd.map((t) => ({ t, c: t.startsWith('$') ? 'cmd' : 'dim' }))]);
  }

  /* ---------------- ansible <pattern> -m module ---------------- */
  function runAdhoc(a) {
    const targets = selectHosts(world.inventory, a.pattern, a.limit);
    const statuses = {};
    Object.keys(world.hosts).forEach((h) => { statuses[h] = targets.includes(h) ? 'targeted' : 'excluded'; });
    const cmd = `$ ansible ${a.pattern} -i inventory.ini -m ${a.module}${a.args ? ` -a '${a.args}'` : ''}${a.limit ? ` --limit ${a.limit}` : ''}${a.extra ? ` -e ${Object.entries(a.extra).map(([k, x]) => `${k}=${x}`).join(' ')}` : ''}`;
    emit({ note: a.note, badge: a.badge, statuses, label: a.label, file: a.file || 'inventory.ini', hl: a.anchor ? rangeIn(a.file || 'inventory.ini', a.anchor) : null },
      [{ t: '', c: 'plain' }, { t: cmd, c: 'cmd' }]);

    const busy = {}; const acts = {};
    targets.forEach((h) => { busy[h] = 'busy'; acts[h] = short(a.module); });
    Object.keys(world.hosts).forEach((h) => { if (!targets.includes(h)) busy[h] = 'excluded'; });
    emit({ note: a.connectNote || `SSH to ${targets.join(', ')} — copy the ${short(a.module)} module, run it, collect JSON`,
      badge: a.connectBadge || 'Each host runs the module with its own Python. Nothing stays behind afterwards.',
      statuses: busy, acts, label: a.label });

    const out = [];
    const done = {};
    targets.forEach((name) => {
      const h = world.hosts[name];
      const { v } = resolveVars(world, name, a.extra);
      const r = MODULES[a.module](h, a.moduleArgs || {}, v, world);
      done[name] = 'ok';
      out.push({ t: `${name} | SUCCESS => {`, c: 'ok' });
      out.push({ t: '    "changed": false,', c: 'ok' });
      if (r.data) Object.entries(r.data).forEach(([k, val]) => out.push({ t: `    "${k}": "${val}"`, c: 'ok' }));
      if (r.varOut) out.push({ t: `    "${r.varOut}": ${JSON.stringify(v[r.varOut])}`, c: 'ok' });
      out.push({ t: '}', c: 'ok' });
    });
    Object.keys(world.hosts).forEach((h) => { if (!targets.includes(h)) done[h] = 'excluded'; });
    emit({ note: a.doneNote || `${targets.length} host${targets.length === 1 ? '' : 's'} answered: ${targets.join(', ')}`,
      badge: a.doneBadge || '', statuses: done, label: a.label }, out);
  }

  /* ---------------- ansible-playbook ---------------- */
  function runPlaybook(a) {
    const play = chapter.play(world);
    const check = Boolean(a.check);
    const file = play.file || 'site.yml';
    const targets = selectHosts(world.inventory, play.hosts, a.limit);
    const live = new Set(targets);
    const failed = new Set();
    const tally = {};
    targets.forEach((h) => { tally[h] = { ok: 0, changed: 0, failed: 0, skipped: 0 }; });
    const notified = {};

    const base = () => {
      const s = {};
      Object.keys(world.hosts).forEach((h) => {
        s[h] = failed.has(h) ? 'failed' : targets.includes(h) ? 'targeted' : 'excluded';
      });
      return s;
    };

    const cmd = `$ ansible-playbook -i inventory.ini ${file}${check ? ' --check' : ''}${a.limit ? ` --limit ${a.limit}` : ''}`;
    emit({ note: a.note, badge: a.badge, statuses: base(), label: a.label, file, hl: null },
      [{ t: '', c: 'plain' }, { t: cmd, c: 'cmd' }]);

    // collections are resolved before anything runs
    const missing = play.tasks.find((t) => t.collection && !world.collections.includes(t.collection));
    if (missing) {
      emit({ note: `The run stops before it starts: ${missing.module} cannot be resolved`,
        badge: `${missing.collection} is not installed on the control node. Install it from Galaxy or automation hub first.`,
        statuses: base(), file: missing.file || file, hl: rangeIn(missing.file || file, missing.anchor), label: a.label },
      [{ t: `ERROR! couldn't resolve module/action '${missing.module}'.`, c: 'fail' },
        { t: 'This often indicates a misspelling, missing collection,', c: 'fail' },
        { t: 'or incorrect module path.', c: 'fail' }]);
      return;
    }

    emit({ note: a.playNote || `PLAY [${play.name}] — hosts: ${play.hosts} matches ${targets.join(', ') || 'nothing'}`,
      badge: a.playBadge || (Object.keys(world.hosts).length > targets.length
        ? `${Object.keys(world.hosts).filter((h) => !targets.includes(h)).join(', ')} ${Object.keys(world.hosts).length - targets.length === 1 ? 'is' : 'are'} in the inventory but not matched, so never contacted.`
        : 'Every host in the inventory matches this play.'),
      statuses: base(), file, hl: playRange(chapter.files(world)[file], play.anchor), label: a.label },
    ['', { t: banner(`PLAY [${play.name}]`), c: 'hdr' }]);

    if (play.gather !== false) {
      const out = ['', { t: banner('TASK [Gathering Facts]'), c: 'hdr' }];
      const st = base(); const acts = {};
      [...live].forEach((name) => {
        world.hosts[name].facts = true;
        tally[name].ok += 1; st[name] = 'ok'; acts[name] = 'setup';
        out.push({ t: `ok: [${name}]`, c: 'ok' });
      });
      emit({ note: 'Gathering Facts — the setup module runs on every host first',
        badge: play.factsBadge || 'OS, network, hardware: hundreds of facts per host, stored as ansible_facts for later tasks.',
        statuses: st, acts, file, hl: playRange(chapter.files(world)[file], play.anchor), label: a.label }, out);
    }

    play.tasks.forEach((task) => runTask(task, false));

    // handlers: in definition order, once each, only for notified hosts
    (play.handlers || []).forEach((hd) => {
      const hosts = Object.keys(notified).filter((h) => notified[h].includes(hd.name) && live.has(h));
      if (!hosts.length) return;
      runTask(hd, true, hosts);
    });

    // recap
    const out = live.size ? [] : ['', { t: 'NO MORE HOSTS LEFT', c: 'fail' }];
    out.push('', { t: banner('PLAY RECAP'), c: 'hdr' });
    targets.forEach((h) => {
      const t = tally[h];
      out.push({ t: `${h.padEnd(8)}: ok=${String(t.ok).padEnd(3)} changed=${String(t.changed).padEnd(3)} unreachable=0  failed=${String(t.failed).padEnd(2)} skipped=${t.skipped}`, c: t.failed ? 'fail' : t.changed ? 'chg' : 'ok' });
    });
    const st = base();
    targets.forEach((h) => { if (!failed.has(h)) st[h] = tally[h].changed ? 'changed' : 'ok'; });
    const totals = Object.values(tally).reduce((s, t) => ({ ch: s.ch + t.changed, f: s.f + t.failed }), { ch: 0, f: 0 });
    const recap = a.recap ? a.recap({ tally, check, runNo, world }) : {};
    emit({
      note: recap.note || (totals.f ? `PLAY RECAP — ${totals.f} host failed, the run exits non-zero`
        : totals.ch ? `PLAY RECAP — ${totals.ch} change${totals.ch === 1 ? '' : 's'}${check ? ' predicted, none made' : ''}`
          : 'PLAY RECAP — changed=0 everywhere: nothing needed doing'),
      badge: recap.badge || (check ? 'Check mode: modules reported what they would do. The hosts are exactly as they were.' : ''),
      statuses: st, file, label: a.label,
    }, out);

    function runTask(task, isHandler, only) {
      const tfile = task.file || file;
      const hosts = only || [...live];
      const head = isHandler ? `RUNNING HANDLER [${task.role ? `${task.role} : ` : ''}${task.name}]` : `TASK [${task.role ? `${task.role} : ` : ''}${task.name}]`;
      const out = ['', { t: banner(head), c: 'hdr' }];
      const st = base(); const acts = {};
      const results = {};
      hosts.forEach((name) => {
        const h = world.hosts[name];
        const { v } = resolveVars(world, name, a.extra);
        v.ansible_facts = h.facts ? { os_family: h.family } : {};
        if (task.when && !task.when(v, h)) {
          results[name] = 'skip'; st[name] = 'skipped'; tally[name].skipped += 1;
          out.push({ t: `skipping: [${name}]`, c: 'skip' });
          return;
        }
        acts[name] = short(task.module);
        const items = task.loop || [null];
        let anyChanged = false; let fail = null;
        const itemResults = [];
        items.forEach((item) => {
          if (fail) return;
          const args = typeof task.args === 'function' ? task.args(item, v) : task.args;
          const r = MODULES[task.module](h, args || {}, v, world);
          if (r.failed) { fail = r; return; }
          if (check && r.noCheck) { itemResults.push({ item, status: 'skip' }); return; }
          if (r.changed && (!check || r.always)) r.apply && r.apply();
          else if (r.always && r.apply) r.apply();
          anyChanged = anyChanged || r.changed;
          itemResults.push({ item, status: r.changed ? 'changed' : 'ok', r });
        });
        if (fail) {
          failed.add(name); live.delete(name);
          results[name] = 'failed'; st[name] = 'failed'; tally[name].failed += 1;
          out.push({ t: `fatal: [${name}]: FAILED! => {"changed": false,`, c: 'fail' });
          out.push({ t: `  "msg": "${fail.msg}"}`, c: 'fail' });
          return;
        }
        if (itemResults.length && itemResults.every((x) => x.status === 'skip')) {
          results[name] = 'skip'; st[name] = 'skipped'; tally[name].skipped += 1;
          out.push({ t: `skipping: [${name}]`, c: 'skip' });
          return;
        }
        if (task.loop) {
          itemResults.forEach((x) => out.push({ t: `${x.status}: [${name}] => (item=${x.item})`, c: x.status === 'changed' ? 'chg' : 'ok' }));
        } else {
          const x = itemResults[0];
          if (task.module === 'ansible.builtin.debug') {
            out.push({ t: `ok: [${name}] => {`, c: 'ok' });
            if (x.r.msg !== undefined) {
              // ansible prints structured values pretty, four-space indented
              JSON.stringify(x.r.msg, null, 4).split('\n')
                .forEach((l, k) => out.push({ t: `    ${k === 0 ? '"msg": ' : ''}${l}`, c: 'ok' }));
            }
            if (x.r.varOut) out.push({ t: `    "${x.r.varOut}": ${JSON.stringify(v[x.r.varOut])}`, c: 'ok' });
            out.push({ t: '}', c: 'ok' });
          } else {
            out.push({ t: `${x.status}: [${name}]`, c: x.status === 'changed' ? 'chg' : 'ok' });
          }
        }
        if (task.register) h.reg[task.register] = { changed: anyChanged, results: itemResults.map((x) => ({ item: x.item, changed: x.status === 'changed' })) };
        tally[name].ok += 1;
        if (anyChanged) {
          tally[name].changed += 1;
          (task.notify ? [task.notify] : []).forEach((n) => { notified[name] = [...new Set([...(notified[name] || []), n])]; });
        }
        results[name] = anyChanged ? 'changed' : 'ok';
        st[name] = anyChanged ? 'changed' : 'ok';
      });
      const said = task.say ? task.say({ results, check, runNo, world, notified }) || {} : {};
      const summary = summarize(results);
      emit({
        note: said.note || `${isHandler ? 'Handler' : 'Task'}: ${task.name} — ${summary}`,
        badge: said.badge || task.explain || '',
        statuses: st, acts, file: tfile, hl: rangeIn(tfile, task.anchor), label: a.label,
      }, out);
    }
  }
}

function summarize(results) {
  const by = {};
  Object.entries(results).forEach(([h, s]) => { (by[s] = by[s] || []).push(h); });
  const word = { ok: 'ok', changed: 'changed', skip: 'skipping', failed: 'FAILED' };
  return Object.entries(by).map(([s, hs]) => `${word[s]} on ${hs.join(', ')}`).join('; ') || 'no hosts left';
}
