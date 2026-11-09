# Install ShorelineOps — free, by CulinaryOS

Choose your client. Facility users interact in ordinary language: “Set up my facility”, upload a redacted menu/tally, review flagged entries, confirm, and print.

## Before first use

Install Node22 or newer. Extract the local-MCP release and run `node setup.mjs` once to install the pinned local Chromium renderer. This downloads runtime dependencies; no menu is uploaded by setup. Keep the extracted directory in a permanent location. Choose a dedicated folder for redacted menu/tally images. The server can read images only from supported attachments, preserved sources or that chosen folder. Do not select your home folder/disk root.

## Codex

Use the portable plugin ZIP or the repo-local personal marketplace entry. Existing plugin identity sylvia-ross-menu-processor is retained; display name ShorelineOps. The installed version is checked through shoreline_status. Setup the renderer first; restart the plugin session after updates. Host/plugin permissions and approval controls still apply.

## Claude Desktop

Install the local renderer before enabling the extension. In Claude Desktop’s Extensions developer settings choose Install Extension and select shorelineops-<version>.mcpb; select the dedicated import folder. Alternatively generate a new config with `node scripts/configure-client.mjs claude <new-file.json>` from the local release and merge it through your client’s supported configuration flow. Existing settings are never overwritten by this helper. The MCPB is a local-install candidate; directory review and actual Desktop UI acceptance are separate.

## VS Code

From the local release run `node scripts/configure-client.mjs vscode <new-mcp.json>`. Import the generated server through VS Code’s MCP setup, or put its servers block in your workspace .vscode/mcp.json after reviewing existing settings. The command uses this installation’s absolute server path. Trust/start the server through VS Code, then ask ShorelineOps to set up your facility. Protocol smoke tests do not certify Copilot/host UI acceptance.

## ChatGPT

The existing private plugin remains the development installation with its configured local executor. The public candidate is a separate ZIP with public listing prompts and review cases; it is not a submitted or approved listing. A local stdio package does not host a remote ChatGPT web/mobile backend. Public review needs verified product/support/privacy/terms URLs, the runnable supported connection, demo and publisher attestations. Do not invent an endpoint.

## ShorelineOps app

In Production & Service → Paperwork select a service area from the app’s saved facility setup. Import the reviewed .srmenu file exported by the plugin, compare source/menu/counts and confirm before printing. Plugin setup and app setup are separate; area IDs must match. Transfers are offline snapshots and need re-export after changes. No clinical rules or resident identities enter this workflow.

Current menu adapter: seven Sunday-Saturday days, breakfast/lunch/dinner A/B. Counts fill cook headers and summary only; prep/item quantities remain manual. Redact names, room links, IDs, signatures and clinical notes before using the host AI. Countries: all supported by each platform; this is not a claim of clinical/regulatory certification.

Official client references used for these configurations: https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop ; https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md ; https://code.visualstudio.com/docs/agents/reference/mcp-configuration . Source package uses the local Codex plugin/MCP schema; no new server credentials are created.
