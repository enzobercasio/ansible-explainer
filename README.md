# Ansible explained — animated explainers

A zero-dependency static site for **presenting** Ansible from first principles
to the Red Hat Ansible Automation Platform 2.7 architecture: how a control node
pushes modules over SSH, how inventories and playbooks fit together, why
idempotency matters, and then what AAP adds around that engine — the platform
gateway, automation controller, execution environments, automation mesh,
Event-Driven Ansible, and the supported deployment topologies.

Built on the player from
[oc-resiliency-animation](https://github.com/enzobercasio/oc-resiliency-animation):
keyboard transport, speaker notes, a presentation mode that strips the chrome,
and deep links to any frame. Under every animation sit **the code for the active
scenario** (a playbook, inventory, rulebook or installer inventory) and an
**outline of the concepts in play**. The lines each step is about highlight as
the animation runs.

No build step, no framework, no npm install. The repository root *is* the site.

**Two parts, two interfaces.**

- **Part 1 — Playbook Runner** ([`runner.html`](runner.html)). The Ansible
  basics, taught the way Ansible is actually used: the playbook on the left
  with a cursor on the task being executed, the fleet of hosts top right with
  their real state (packages, files, services), and `ansible-playbook` output
  streaming in a terminal. One fleet — web1 and web2 on RHEL 9, db1 on Ubuntu —
  runs through all seven chapters. Concepts come from *actions*: **Run again**
  shows idempotency, **Drift** stops a service by hand and the next run repairs
  only that, **Break web2** deletes a variable and that host drops out of the
  play. At the end of the frames, Space fires the suggested next action, so a
  presenter can just keep pressing it.
- **Part 2 — AAP 2.7 System Map** ([`aap.html`](aap.html)). One fixed map
  of the platform — gateway, controller, hub, EDA, metrics service, PostgreSQL,
  Redis, the mesh and the hosts. Pick a **journey** (sign in, launch a job,
  event to remediation, reach a remote site, publish and pull an EE) and watch
  its path light up, with every call laid out in a sequence diagram beneath.
  Switch **topology** — container growth, container enterprise, Operator on
  OpenShift — and **fail any component** to see the difference: growth loses
  the whole platform, enterprise moves to instance b, the Operator recreates
  the pod.

[`index.html`](index.html) is a landing page for both. The first version of the
site — one animated diagram per concept — is kept as
[`classic.html`](classic.html).

---

## Run it

```bash
./scripts/serve.sh            # http://localhost:8080
```

ES modules are blocked by CORS over `file://`, so it must be served over HTTP —
any static server works.

---

## What's in it

| Animation | What it shows |
|---|---|
| *Ansible basics* | |
| **How Ansible works** | The agentless round trip: SSH in, copy a module, run it with the host's Python, return JSON, clean up. Ad-hoc command vs playbook |
| **Inventories** | Hosts, groups, `:children`, `all`/`ungrouped` and host patterns; where a variable's value comes from (`group_vars`, `host_vars`, `-e`); a dynamic cloud inventory |
| **Playbooks: plays, tasks and run order** | The linear strategy as a task × host grid, a host failing and dropping out, and `--check` |
| **Idempotency** | Run 1 changes, run 2 is all ok, run 3 repairs only the drift — and the `shell: echo >>` anti-pattern next to its `lineinfile` fix |
| **Facts, conditionals, loops and register** | Facts picking `dnf` vs `apt` with `when:`, a loop creating users, and a registered result driving the next task |
| **Handlers** | Two notifications, one restart, at the end — and no restart at all when nothing changed |
| **Roles and collections** | The role directory layout and reuse with different variables; collections from Galaxy / automation hub and the anatomy of an FQCN |
| *AAP 2.7 architecture* | |
| **AAP 2.7: the platform at a glance** | The components assembled one by one, and 2.7's headline change: the platform gateway is the only front door |
| **Execution environments** | Building an EE with ansible-builder, publishing it to private automation hub, and how a job runs inside it |
| **Launching a job** | From the Launch button through gateway, controller, PostgreSQL, the mesh and an execution node to PLAY RECAP; and a workflow with a failure branch |
| **Automation mesh** | Control, hop and execution nodes over Receptor; reaching a remote site through a DMZ hop node; rerouting around a failed path |
| **Event-Driven Ansible** | An event matching a rulebook condition and launching remediation; an event filtered out |
| **Deploying AAP 2.7** | Container growth, container enterprise and the Operator on OpenShift — and what fails when a node dies |

Each has 1–3 modes you switch between live. The sidebar groups them into
**Ansible basics** and **AAP 2.7 architecture**; the **Beginner** toggle in the
top bar narrows it to the basics, which make a complete session on their own.

---

## Presenting

| Key | Action |
|---|---|
| `Space` | play / pause |
| `←` `→` | step back / forward |
| `Home` `End` | first / last frame |
| `1`–`3` | switch scenario within the animation |
| `J` `K` | previous / next animation |
| `B` | beginner mode — Ansible basics only |
| `N` | speaker notes panel |
| `T` | light / dark |
| `F` | presentation mode (hides chrome, scales up) |
| `R` | reset to first frame |
| `Esc` | close overlay / leave presentation mode |
| `?` | shortcuts |

**Deep links.** Every frame is addressable as `#animation-id/mode-id/step`:

```
#how-ansible-works/playbook/0      the agentless round trip
#idempotency/shell/3               the banner line, three times over
#aap-overview/gateway/0            2.7: one front door
```

See [`docs/presenting.md`](docs/presenting.md) for a running order with talk
tracks; the notes panel (`N`) carries the same material per mode.

---

## Deploying

**GitHub Pages** — push to `main`; `.github/workflows/pages.yml` publishes the
repository root. **Any static host** — copy the `*.html` files, `css/` and `js/`.
**OpenShift** — `deploy/openshift.yaml` plus the `Containerfile`. Details in
[`docs/deploying.md`](docs/deploying.md).

---

## How the Playbook Runner works

`js/runner/engine.js` is a small deterministic model of ansible-core: an
inventory with groups, patterns and variable precedence; hosts with state; a
handful of modules (`dnf`, `apt`, `template`, `copy`, `service`, `lineinfile`,
`shell`, `user`, `debug`, `firewalld`) that check before they act; and a
linear-strategy runner with handlers, `--check`, loops, `register` and `when:`.
`js/runner/chapters.js` holds the seven chapters — files, plays, actions and the
suggested script. A chapter's state is always rebuilt by replaying its action
history, so deep links carry the history:

```
runner.html#idempotency/run.again.drift.again/23    web1 repaired after drift
runner.html#plays-tasks/check.run.break.again/20    web2 fails on its template
runner.html#roles/run/2                              missing collection
```

`node tools/check-runner.mjs` replays every chapter and every action.

## How the System Map works

`js/aap/model.js` holds the components and their fixed positions, the three
topologies, and the journeys as a small DSL (`call(from, to, label, …)`,
`local(at, label, …)`). `reach()` decides what a failed component means in
each topology. Deep links carry journey, topology and failures:

```
aap.html#launch/enterprise/controller/4    controller a down, b serves
aap.html#launch/growth/hub/1               growth: one failure, platform down
aap.html#remote/operator/-/6               through the hop node
```

`node tools/check-aap.mjs` builds every journey in every topology with each
component failed in turn.

## Adding an animation

An animation is one ES module under `js/animations/` exporting one object; the
player knows nothing about Ansible. Shared SVG builders (boxes, zones, arrows,
travelling packets, result stamps) live in `js/animations/lib/draw.js`.
Register the module in `js/registry.js`. The full contract is in
[`docs/authoring-animations.md`](docs/authoring-animations.md).

```bash
node tools/check-animations.mjs            # every frame of every mode renders
node tools/check-animations.mjs js/animations/new.js   # just one file
node tools/check-bounds.mjs                # geometry inside the viewBox
node tools/check-grouping.mjs              # basics / AAP split intact
node tools/check-hidden-toggles.mjs        # [hidden] cascade guard
node tools/check-links.mjs                 # deep links in the docs resolve
node tools/check-runner.mjs                # every runner chapter replays cleanly
node tools/check-aap.mjs                   # every journey builds in every topology
```

---

## Design constraints worth knowing

**Every colour comes from `css/tokens.css`.** Animations use semantic classes
(`.pod.run`, `.pod.bad`, `.flow-line.active`) so light and dark both work.

**Frames are pure data.** `buildFrames()` returns an array; `renderSVG()` is a
pure function of one frame. Scrubbing backwards and deep-linking just work.

**Motion is CSS only.** Each frame is repainted, and CSS keyframes on the fresh
elements do the moving: packets travel connectors with `offset-path`, active
connectors march, new results fade in. Packet duration follows the playback
speed. `prefers-reduced-motion` turns all of it off.

**AAP facts are pinned to 2.7.** The architecture section reflects the 2.7
release notes (June 2026): the gateway as the sole API entry point, the RPM
installer removed, containerized and Operator topologies. Check the
[AAP 2.7 documentation](https://docs.redhat.com/en/documentation/red_hat_ansible_automation_platform/2.7)
before presenting details such as port numbers to a customer.

## License

Apache License 2.0 — the player and tooling derive from
[oc-resiliency-animation](https://github.com/enzobercasio/oc-resiliency-animation).
