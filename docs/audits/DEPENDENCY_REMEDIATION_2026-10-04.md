# Dependency remediation — October 4, 2026

## Scope and evidence

The root/workspace and standalone server/marketing lockfiles were audited after the release push. Compatible updates were selected within existing dependency ranges; no forced major update, incompatible override, advisory exclusion, or disabled audit was applied.

`tailwindcss-animate` is referenced only by `tailwind.config.ts:99`. It generates CSS during the frontend build and has no application runtime import. It was moved from `dependencies` to `devDependencies` so the manifest accurately describes its use. This classification does not resolve or suppress its build-time vulnerability chain.

The root manifest now requires Node `>=22.19.0`. The actual Astro/Electron/transitive HTTP tooling requires a newer runtime than historical Node 20 guidance; the local verification runtime is Node 24.21.0. Deployment and CI must use a compatible maintained runtime.

## Patched lock versions

| Package | Selected version(s) | Relevant scope |
|---|---|---|
| axios | 1.20.0 | Application HTTP client |
| devalue | 5.9.4 | Astro serialization tooling |
| http-cache-semantics | 4.3.0 | Astro caching tooling |
| undici | 6.29.0 / 7.30.0 / 8.11.2 | Node-gyp / Electron download / Astro font tooling |
| electron | 43.7.7 | Desktop runtime tooling |
| brace-expansion | 5.0.12 / 2.1.7 | Build dependency variants |
| js-yaml | 4.3.2 | Standalone marketing dependency tree |

Root `npm ci` completed successfully and the installed dependency tree matches the patched versions above. All three production audits (`npm audit --omit=dev --json`, `npm --prefix server audit --omit=dev --json`, and `npm --prefix marketing audit --omit=dev --json`) returned **zero findings** again after installation. Standalone server and marketing full audits also returned zero findings. This is dependency advisory evidence, not application security certification. Final installed-tree build/test acceptance is recorded by the release verification rather than inferred from dependency audits. Electron's package installation alone does not establish that its downloaded runtime binary is available or tested.

## Remaining development findings — not resolved

The full root audit reports **five high-severity package entries**: `braces`, `chokidar`, `fast-glob`, `micromatch`, and `tailwindcss`. These are propagation entries for the same underlying [braces recursion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), which lists affected versions through 3.0.3 and no published patched version. The registry's current latest braces version is 3.0.3. npm recommends a Tailwind 4 major migration; that migration is outside this compatible dependency patch and requires a separate styling/build review.

The affected chain is used for configured build/watch file patterns. Treat source trees, build configuration, content paths, and supplied glob patterns as trusted inputs; do not allow untrusted user-provided patterns or project uploads into this build process. This narrows the presently inspected execution scope; it does not eliminate the advisory, prove that every tooling invocation is safe, or permit marking the full dependency audit clean. Keep the five development findings open until a compatible upstream patch or reviewed migration removes the chain.
