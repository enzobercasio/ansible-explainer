#!/usr/bin/env node
/**
 * Validates every deep link written in the docs against the real animations.
 *
 * Deep links are `#animation-id/mode-id/step`. A frame index that drifts because
 * someone inserted a step turns a link you sent a customer last week into the
 * wrong moment - and nothing else in the build would notice.
 *
 *   node tools/check-links.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { animations } from '../js/registry.js';
import { chapters } from '../js/runner/chapters.js';
import { replay } from '../js/runner/engine.js';
import { NODES, TOPOLOGIES, JOURNEYS, buildJourney } from '../js/aap/model.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['README.md', 'docs/presenting.md', 'docs/deploying.md', 'docs/authoring-animations.md', 'antipatterns.html'];

let fail = 0;
let checked = 0;

for (const f of files) {
  const full = path.join(root, f);
  if (!fs.existsSync(full)) continue;
  const txt = fs.readFileSync(full, 'utf8');

  // Playbook Runner links carry an action history: runner.html#chapter/a.b.c/step
  for (const m of txt.matchAll(/runner\.html#([a-z-]+)\/([a-z.-]+)\/(\d+)/g)) {
    const [link, id, hist, step] = m;
    checked += 1;
    const c = chapters.find((x) => x.id === id);
    if (!c) { console.log(`FAIL ${f}: no runner chapter "${id}"  (${link})`); fail = 1; continue; }
    const h = hist === '-' ? [] : hist.split('.');
    const unknown = h.find((a) => !c.actions.some((x) => x.id === a));
    if (unknown) { console.log(`FAIL ${f}: chapter "${id}" has no action "${unknown}"  (${link})`); fail = 1; continue; }
    const n = replay(c, h).frames.length;
    if (Number(step) >= n) { console.log(`FAIL ${f}: ${link} but that history has only ${n} frames`); fail = 1; }
  }

  // System Map links: aap.html#journey/topology/failed,failed/step
  for (const m of txt.matchAll(/aap\.html#([a-z-]+)\/([a-z-]+)\/([a-z0-9,-]+)\/(\d+)/g)) {
    const [link, j, t, f, step] = m;
    checked += 1;
    if (!JOURNEYS.some((x) => x.id === j)) { console.log(`FAIL ${f}: no journey "${j}"  (${link})`); fail = 1; continue; }
    if (!TOPOLOGIES.some((x) => x.id === t)) { console.log(`FAIL ${link}: no topology "${t}"`); fail = 1; continue; }
    const failed = f === '-' ? [] : f.split(',');
    const unknown = failed.find((x) => !NODES[x]);
    if (unknown) { console.log(`FAIL ${link}: no component "${unknown}"`); fail = 1; continue; }
    const n = buildJourney(j, t, failed).length;
    if (Number(step) > n) { console.log(`FAIL ${link}: that journey has only ${n} steps`); fail = 1; }
  }

  for (const m of txt.matchAll(/(?<!(?:runner|aap)\.html)#([a-z-]+)\/([a-z-]+)\/(\d+)/g)) {
    const [link, id, mode, step] = m;
    checked += 1;
    const a = animations.find((x) => x.id === id);
    if (!a) { console.log(`FAIL ${f}: no animation "${id}"  (${link})`); fail = 1; continue; }
    if (!a.modes.some((x) => x.id === mode)) {
      console.log(`FAIL ${f}: "${id}" has no mode "${mode}"  (${link})`); fail = 1; continue;
    }
    const n = a.buildFrames(mode).length;
    if (Number(step) >= n) {
      console.log(`FAIL ${f}: ${link} but "${mode}" has only ${n} frames (0-${n - 1})`); fail = 1;
    }
  }
}

console.log(fail ? '\nbroken deep links in the docs\n' : `\nall ${checked} documented deep links resolve\n`);
process.exit(fail);
