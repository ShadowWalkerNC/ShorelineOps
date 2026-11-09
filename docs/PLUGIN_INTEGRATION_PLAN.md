# ShorelineOps plugin ownership and distribution

User requested friendly information, ChatGPT/Codex/ClaudeDesktop/VSCode distribution, full repo ownership and the exact app logo. Publisher CulinaryOS; free; all supported countries; existing ShorelineOps website owns listing pages.

Canonical source moves into packages/shorelineops-plugin (independent lock/dependencies, not a new root workspace). Preserve original source outside repo as historical backup; no destructive move. Same account plugin and legacy stable IDs. App’s original public/icon-512.png is the icon source; verify byte hashes. Root build/test/release commands own package builds and pinned vendor update. No release source depends on another checkout.

Native adapter reads existing initialized facility_config wings, not a fixed Ross roster; empty/unavailable config fails closed. No DB schema, permissions, clinical writes or tenant-switching changes. Tests inject known profiles and cover custom wing collisions/unknown areas. UI gives three stages, matched-area selection and clear privacy/confirmation/print actions.

Prepare local client installers/config generators without overwriting user settings. MCP protocol smoke tests prove config launch, not actual host UI acceptance. ChatGPT public upload prepared separately with up to3public prompts, real logoPNG, review cases/free/allcountries metadata; four existing private prompts preserved. Required URLs/demo/legal attestations/hosting remain explicit gaps until verified.

Validation: plugin strict/full tests and installed protocol, icon hash, release inventories and no-private-path checks; API/facility tests; frontend/backend builds;390/1280 UI; required demo/marketing/full tests before localcommit. Dedicated worktree; no main changes/push/deploy without their separate final gate.
