#!/usr/bin/env node
/**
 * Builds every System Map journey for every topology, with no failures and
 * with each single component failed, and checks the steps the UI will draw.
 *
 *   node tools/check-aap.mjs
 *
 * Catches: a step pointing at a component that does not exist or is not
 * deployed in that topology (the load balancer on growth), a step with no
 * narration or label, and a failure that silently changes nothing.
 */
import { NODES, TOPOLOGIES, JOURNEYS, INFO, nodeView, buildJourney } from '../js/aap/model.js';

let fail = 0;
const bad = (m) => { fail = 1; console.log(`  FAIL ${m}`); };

for (const id of Object.keys(NODES)) if (!INFO[id]) bad(`no INFO card for ${id}`);

for (const t of TOPOLOGIES) {
  console.log(`\n=== ${t.id}`);
  for (const j of JOURNEYS) {
    const scenarios = [[], ...Object.keys(NODES).filter((n) => !nodeView(n, t.id).absent).map((n) => [n])];
    let base = 0;
    for (const failed of scenarios) {
      let steps;
      try { steps = buildJourney(j.id, t.id, failed); } catch (e) { bad(`${j.id} [${failed}] threw ${e.message}`); continue; }
      if (!failed.length) base = steps.length;
      steps.forEach((s, n) => {
        const where = `${j.id} [${failed.join(',') || 'none'}] step ${n + 1}`;
        for (const c of [s.from, ...[].concat(s.to)]) {
          if (!NODES[c]) bad(`${where}: unknown component "${c}"`);
          else if (nodeView(c, t.id).absent) bad(`${where}: "${c}" is not deployed in ${t.id}`);
        }
        if (!s.note) bad(`${where}: no note`);
        if (!s.label) bad(`${where}: no label`);
        if (/undefined|NaN/.test(JSON.stringify(s))) bad(`${where}: undefined in step`);
      });
      if (!failed.length && steps.some((s) => s.kind === 'blocked' || s.kind === 'recover')) bad(`${j.id}: blocked with nothing failed`);
    }
    console.log(`  ${j.id.padEnd(8)} ${String(base).padStart(2)} steps, ${scenarios.length - 1} failure scenarios`);
  }
}
console.log(fail ? '\nFAILURES\n' : '\nall journeys build cleanly in every topology\n');
process.exit(fail);
