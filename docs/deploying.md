# Deploying

There is no build step. The `*.html` files, `css/` and `js/` are the entire artefact.

---

## GitHub Pages

`.github/workflows/pages.yml` publishes the repository root on every push to
`main`. One-time setup: **Settings → Pages → Source → GitHub Actions**.

The site then lives at `https://<org>.github.io/<repo>/`. Deep links work
unchanged because routing is fragment-based — there is no server-side routing to
configure and no 404 fallback needed.

---

## Any static host

```bash
# Netlify, Vercel, S3, Cloudflare Pages, an nginx docroot - all the same
cp -r *.html css js /var/www/html/ansible/
```

Requirements: serve over HTTP (not `file://`), and serve `.js` with a JavaScript
MIME type so ES modules load. Both are defaults everywhere; the only place this
bites is a misconfigured S3 bucket serving JS as `application/octet-stream`.

---

## On OpenShift

The manifests are a small, well-behaved workload:
two replicas, a spread constraint, a PDB, a
readiness probe, non-root.

```bash
oc new-project ansible-explainer
oc apply -f deploy/openshift.yaml
oc start-build ansible-explainer --from-dir=. --follow
oc get route ansible-explainer
```

The build is a binary Docker-strategy build from the working directory, so no Git
remote is required — useful on a customer laptop behind a proxy.

The base image is `registry.access.redhat.com/ubi9/nginx-124`, which listens on
8080 and runs happily under an arbitrary non-root UID. No SCC changes, no
`anyuid`. If the cluster cannot reach `registry.access.redhat.com`, mirror the
image first:

```bash
oc image mirror registry.access.redhat.com/ubi9/nginx-124:latest \
  <your-registry>/ubi9/nginx-124:latest
# then edit the FROM line in Containerfile
```

### Verifying it after deployment

```bash
oc get pods -l app=ansible-explainer -o wide     # should be on different nodes
oc get pdb ansible-explainer                     # ALLOWED DISRUPTIONS should be 1
```

---

## Air-gapped customer sites

No external dependencies at runtime: no CDN, no Google Fonts, no analytics, no
telemetry. The font stack falls back to the system sans if Red Hat Text is not
installed locally, which changes the look slightly and nothing else.

For a site with no egress at all, the simplest route is a directory on a laptop:

```bash
./scripts/serve.sh          # python3 -m http.server, localhost only
```

Then share the browser window. Nothing leaves the machine.

---

## Versioning for customer links

If you send deep links to customers, pin them. A frame index that shifts because
someone added a step turns a link you sent last week into the wrong moment.

Practical approach: tag a release before sending links, and deploy tags to a
versioned path.

```bash
git tag -a v1.0 -m "Frame indices stable for FSI-1 workshop"
```

`#animation/mode/step` is stable as long as `buildFrames` for that mode is
unchanged. Adding a *new* mode or a new animation does not shift existing
indices; inserting a frame into an existing mode does.
