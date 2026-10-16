# Presenting

A running order, the deep links to open on, and what to say over each
animation. The basics take about 35 minutes; the AAP 2.7 section about 30.

---

## Before the room

- [ ] Press `T` until the theme suits the room — dark for a projector in a dark
      room, light for a screen share.
- [ ] Press `F` for presentation mode and check the note text is readable from
      the back. Zoom the browser to 125% if not.
- [ ] Press `N` and read the notes for the modes you plan to use. Notes are not
      visible in presentation mode on a single screen.
- [ ] For an audience new to Ansible, press **Beginner** (`B`). The sidebar drops
      to the seven basics. Deep links into the AAP section still work — opening
      one switches the toggle off for you.
- [ ] Set speed to **slow** if you talk over the animation, **fast** if you
      narrate afterwards. Packets in flight follow the speed setting.

---

## Part 1 — Ansible basics

**Use the Playbook Runner (`runner.html`) for this part.** Each chapter has a
suggested script; the next suggested action is marked **next**. Press Space to
play a run, and Space again at the end to fire the next action, so you rarely
need the mouse. Number keys fire any action out of order; `R` resets the
chapter. The diagram versions below remain in `classic.html` as a fallback.

### 1. How Ansible works (5 min)

Open: `#how-ansible-works/adhoc/0`

Play **Ad-hoc command** first. The beat is the last frame: nothing is left on
the managed nodes. Then **Running a playbook** — point at db1 going grey on
`#how-ansible-works/playbook/2`: the play's `hosts:` pattern decides who is
contacted.

### 2. Inventories (5 min)

Open: `#inventory/groups/0`

Step through the patterns slowly; `#inventory/groups/6` (`prod:!web`) is the one
people ask about. **Where a variable comes from** answers "why did this host get
that value?" before anyone asks it. Use **Dynamic inventory** for cloud-heavy
audiences.

### 3. Playbooks: plays, tasks and run order (5 min)

Open: `#playbook-run/linear/0`

The grid is the mental model for reading playbook output. **A host fails**
lands on `#playbook-run/failure/5`: web3 drops out and the others carry on.

### 4. Idempotency (5 min)

Open: `#idempotency/declarative/0`

The whole of column two turning green is the moment. Then the anti-pattern:
`#idempotency/shell/3` — three copies of the banner — and the fix in
**The fix: lineinfile**.

### 5. Facts, conditionals, loops and register (5 min)

Open: `#facts-conditionals/facts/0`

Point at the skipping stamps on `#facts-conditionals/facts/4`.

### 6. Handlers (4 min)

Open: `#handlers/changed/0`

Two notifications, one restart. Then **Nothing changed** — the restart count
stays at zero.

### 7. Roles and collections (5 min)

Open: `#roles-collections/role/0`

End the basics on the FQCN breakdown, `#roles-collections/collection/3`: every
module name in the AAP section follows that shape.

---

## Part 2 — AAP 2.7 System Map

**Use the System Map (`aap.html`).** Keep the map on screen the whole time —
the point is that it never moves. Press Space to follow a journey and Space at
the end to move to the next one. `1` `2` `3` switch topology, `X` turns on
fail-a-component mode, `C` clears failures.

### 8. Sign in (5 min)

Open: `aap.html#login/growth/-/0`

Every arrow out of a client ends at the gateway. Land the 2.7 change here:
direct component API calls return 401 and component-level basic auth and
tokens are gone — integrations must move to the gateway paths.

### 9. Launch a job (6 min)

Open: `aap.html#launch/growth/-/0`

Narrate each hop. Point out that the Receptor step is the one that is not HTTP.
Then switch to enterprise (`2`) and fail the controller:
`aap.html#launch/enterprise/controller/4` — instance b takes the request.
Back on growth, fail hub: `aap.html#launch/growth/hub/1` — the whole platform
is down, because it is one VM.

### 10. Event to remediation (4 min)

Open: `aap.html#eda/growth/-/0`

EDA decides; the controller acts, through the gateway like any other client.
On the Operator, fail EDA to show the pod being recreated:
`aap.html#eda/operator/eda/4`.

### 11. Reach a remote site (4 min)

Open: `aap.html#remote/growth/-/0`

The hop-to-remote arrow is a connection the remote side opened. Fail the hop
node to show why you would run two.

### 12. Publish and pull an EE (3 min)

Open: `aap.html#ee/enterprise/-/0`

Push and pull both go through the gateway host. Close by reminding the room
that the RPM installer is gone in 2.7: containerized or Operator only, and only
2.6 → 2.7 upgrades are supported.

---

## Classic diagrams

`classic.html` keeps the first version: one animated diagram per concept, with
deep links such as `#aap-overview/gateway/0` and `#deployment-topologies/growth/0`.
