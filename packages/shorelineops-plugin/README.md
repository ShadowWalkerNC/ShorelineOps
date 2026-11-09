# ShorelineOps — by CulinaryOS

Turn menus and tally sheets into clear kitchen paperwork.

1. Say **Set up my facility** and confirm the service-area names.
2. Upload a menu or completed tally with resident information removed.
3. Review the flagged entries and confirm the menu and counts separately.
4. Choose one area or a combined packet, then print or export to ShorelineOps.

**Try:** “What needs fixing?”, “Make today’s cook sheets”, “Add a prep page”, or “Export this for ShorelineOps”. You never need to edit JSON or calculate counts yourself.

Default packets: weekly selection+tally2pages; daily3cook sheets. Extra pages are optional. The complete44page master packet is generated only when requested. Blank prep/service sheets work without a menu. Every printed accountability field uses initials.

Free plugin, published by CulinaryOS. Runs locally with Node and the prepared Chromium runtime. Supported clients: Codex plugin, Claude Desktop local MCP, VS Code MCP. ChatGPT’s saved plugin uses the configured local executor; a remote/web renderer is not hosted. See platform-specific install guides in docs/platforms.md.

Current printable menu format: seven Sunday-Saturday dates, breakfast/lunch/dinner A/B. Other formats are flagged instead of invented. Menu/tally images are interpreted by the host AI, then deterministic code checks and prints. Remove names, resident-linked room numbers, IDs, clinical/diet notes and signatures before upload. Only aggregate counts or fully redacted anonymous choices are supported. No resident database or clinical substitutions.

ShorelineOps app: open Production & Service → Paperwork, import the reviewed .srmenu export, compare the source and confirm again. The target area must match. Files are offline snapshots: re-export after any menu/count change. Local plugin setup and app facility setup remain separate. No automatic app sync or background notifications.

Existing data and compatible tool/resource names are preserved. SHORELINEOPS_DATA_DIR (or legacy SYLVIA_DATA_DIR) selects local storage. Default legacy storage paths remain to prevent data loss. Restart the client after updates.

Maintained source: ShorelineOps/packages/shorelineops-plugin. Do not edit installed caches. Public platform review, legal attestations and hosted acceptance are separate from local test results.
