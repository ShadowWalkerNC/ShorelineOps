# ShorelineOps decisions

Accepted user decisions: desktop first; separate Railway app service and PostgreSQL per customer; $0/$199/$399 monthly facility pricing; Light/Dark/System appearance; Stripe deferred. Gmail send-only authorization was approved and completed locally on 2026-11-08.

Implementation decisions: retain existing Electron/Express/SQLite; isolate central accounts from clinical staff credentials and patient records; maintain paperwork source inside packages/shorelineops-plugin and generate its pinned vendor engine; preserve independent worktrees. See ../PROJECT_CACHE.md for current details.
