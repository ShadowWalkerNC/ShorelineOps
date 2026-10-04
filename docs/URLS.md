# ShorelineOps URL contract

The published Railway origin referenced by the supplied design package is `https://shorelineops.up.railway.app`. Its deployed release has not been verified during this commit. Domains shown in provider guides are deployment examples, not additional production entry points.

| Experience | Unified path | Published-origin link |
|---|---|---|
| Marketing | `/` | https://shorelineops.up.railway.app/ |
| Demo dashboard | `/demo/` | https://shorelineops.up.railway.app/demo/ |
| Demo menu | `/demo/menu` | https://shorelineops.up.railway.app/demo/menu |
| Application sign-in | `/app/login` | https://shorelineops.up.railway.app/app/login |
| Kitchen tablet | `/app/kitchen/tablet` | https://shorelineops.up.railway.app/app/kitchen/tablet |
| Backend | `/api/` | Authenticated server routes; never a marketing fallback |

## Build-time configuration

- `PUBLIC_SITE_URL`: canonical origin for metadata and structured data. Default is the Railway origin above. Set this when adopting a custom domain or another provider.
- `PUBLIC_DEMO_URL`: demo entry destination, default `/demo`.
- `PUBLIC_APP_URL`: application sign-in destination, default `/app/login`.
- `VITE_API_URL`: API base including `/api` when the backend is on a separate origin. Demo isolation remains active regardless of this setting.

Unified deployments keep relative navigation links. A separately hosted marketing site requires absolute demo and application entry URLs. Contact email addresses, repository links and third-party integration URLs are independent of the hosting origin and must not be bulk-replaced.

Direct-open and reload of `/demo/*` and `/app/*` must resolve to their respective shells. Use the checked-in provider configuration; do not use a global marketing rewrite. Express returns 404 for missing assets; static-provider wildcard edge cases require hosted verification.
