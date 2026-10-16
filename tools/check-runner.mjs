#!/usr/bin/env node
/**
 * Replays every Playbook Runner chapter - its suggested script, and each
 * action fired on its own - and checks the frames the UI will paint.
 *
 *   node tools/check-runner.mjs
 *
 * Catches: an action that throws, a frame with no narration, a highlight
 * that points past the end of its file, a cursor anchor that matches nothing,
 * and an undefined value leaking into a host card or the terminal.
 */
import { chapters } from '../js/runner/chapters.js';
import { replay } from '../js/runner/engine.js';

let fail = 0;
const bad = (msg) => { fail = 1; console.log(`  FAIL ${msg}`); };

for (const c of chapters) {
  console.log(`\n=== ${c.id} (${c.actions.length} actions)`);
  for (const id of c.script) if (!c.actions.some((a) => a.id === id)) bad(`script names unknown action "${id}"`);

  const histories = [c.script, ...c.actions.map((a) => [a.id])];
  for (const h of histories) {
    let out;
    try { out = replay(c, h); } catch (e) { bad(`[${h.join('.')}] threw: ${e.message}`); continue; }
    const { frames, runs } = out;
    if (runs.length !== h.length) bad(`[${h.join('.')}] produced ${runs.length} runs for ${h.length} actions`);
    frames.forEach((f, i) => {
      const where = `[${h.join('.')}] frame ${i}`;
      if (!f.note) bad(`${where}: no note`);
      if (f.files[f.file] === undefined) bad(`${where}: file "${f.file}" is not in files()`);
      if (f.hl) {
        const n = f.files[f.file].split('\n').length;
        if (f.hl[0] < 0 || f.hl[1] >= n || f.hl[0] > f.hl[1]) bad(`${where}: highlight ${f.hl} outside ${f.file} (${n} lines)`);
      }
      const blob = JSON.stringify(f.hosts) + JSON.stringify(f.term) + f.note + f.badge;
      // "is undefined" is Ansible's own AnsibleUndefinedVariable wording, not a leak
      if (/(?<!is )undefined|NaN/.test(blob)) bad(`${where}: "undefined" or "NaN" in rendered data`);
      if (f.term.some((l) => l.t.length > 96)) bad(`${where}: a terminal line is wider than 96 columns`);
    });
    // every task a frame visits should have found its anchor
    frames.filter((f) => /^(Task|Handler)/.test(f.note) && !f.hl).forEach((f) => bad(`[${h.join('.')}] "${f.note}" has no cursor - anchor not found`));
    if (h === c.script) console.log(`  script ${h.join(' → ').padEnd(48)} frames=${frames.length}`);
  }
  if (!c.notes || c.notes.length < 2) bad('missing speaker notes');
}

console.log(fail ? '\nFAILURES\n' : '\nall runner chapters replay cleanly\n');
process.exit(fail);
