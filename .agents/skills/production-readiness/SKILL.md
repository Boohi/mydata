---
name: production-readiness
description: Require runtime, integration, observability, and rollback evidence before production-ready claims.
---

# Production Readiness

Use this whenever the final claim goes beyond local implementation. A demo,
mocked flow, scaffold, or unverified deployment is not production-ready.

## Hard Gates

1. **Real data path**: confirm the feature uses the intended live database,
   service, API, account, or fixture policy. Call out any mock, seed, fake,
   sample, disabled, TODO, or placeholder path.
2. **Live smoke**: exercise the deployed or target runtime, not only local unit
   tests. For UI work, include browser or device verification. For services,
   include a real request, job, webhook, or CLI smoke.
3. **Configuration**: required env vars, secrets, domains, webhooks, queues,
   cron jobs, storage buckets, migrations, and permissions are present or
   explicitly listed as blockers.
4. **CI and tests**: relevant automated checks pass, or failures are linked and
   explained.
5. **Observability**: logs, metrics, errors, traces, dashboards, or alerts are
   sufficient to know whether the shipped path works after handoff.
6. **Rollback**: name the rollback path: revert PR, disable flag, restore
   config, rollback deploy, or pause worker.
7. **User workflow**: the primary user path is complete enough for the intended
   audience, including empty/error/loading states when they matter.
8. **Security and data safety**: no leaked secrets, unsafe auth bypasses, broad
   production writes, or unreviewed migrations.
9. **GitHub handoff**: issue or PR records the deployment target, smoke command,
   known gaps, and owner of remaining work.

## Decision

- `PRODUCTION READY`: every hard gate passes with evidence.
- `RELEASE CANDIDATE`: implementation is likely shippable, but one external
  check such as CI, review, or scheduled deploy is still pending.
- `DEMO ONLY`: valuable prototype, but mocks/placeholders/local-only flows or
  missing live smoke prevent readiness claims.
- `BLOCKED`: a required external dependency, credential, migration, or service
  is missing.

Use the exact label. Do not soften `DEMO ONLY` into "ready" language.
