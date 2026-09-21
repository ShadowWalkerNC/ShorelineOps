"use strict";
/**
 * PARKED (B13 scope cut — Owner Decision 5) — DO NOT DELETE, DO NOT UNMOUNT.
 *
 * The MCP tool-discovery/execution routes and self-healing diagnostics endpoints
 * served the cut HealerBot admin panel. They are parked, not removed: the code
 * stays mounted and compiling so a future decision can re-activate it, but no
 * UI surface reaches these endpoints anymore. Since 2026-09-13 every route on
 * this router requires a valid JWT with manager rank or higher (401/403 otherwise).
 *
 * MCP & Self-Healing Diagnostics API Routes (parked)
 *
 * Exposes:
 * - GET /api/mcp/tools: Model Context Protocol tool schema discovery
 * - POST /api/mcp/execute: Tool invocation endpoint for CulinaryOS and AI agents
 * - GET /api/diagnostics/self-healing: On-demand self-healing audit report
 * - POST /api/diagnostics/self-healing/run: Trigger manual remediation run
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpRouter = void 0;
const express_1 = require("express");
const server_1 = require("../mcp/server");
const healer_1 = require("../agent/healer");
const requireAuth_1 = require("../middleware/requireAuth");
exports.mcpRouter = (0, express_1.Router)();
// Parked admin surface: every route requires an authenticated manager-or-higher JWT.
// (Owner decision 2026-09-13: put the unauthenticated /api/mcp/* routes behind auth.)
exports.mcpRouter.use(requireAuth_1.requireAuth, (0, requireAuth_1.requireRole)('manager'));
// MCP Tool Discovery
exports.mcpRouter.get('/tools', (_req, res) => {
    res.json({
        protocol: 'modelcontextprotocol/v1',
        server: 'shorelineops-mcp',
        version: '6.2.0',
        tools: server_1.SHORELINE_MCP_TOOLS,
    });
});
// MCP Server-Sent Events (SSE) Stream Transport
exports.mcpRouter.get('/sse', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const sessionId = `mcp-session-${Date.now()}`;
    res.write(`event: endpoint\ndata: /api/mcp/messages?sessionId=${sessionId}\n\n`);
    const keepAlive = setInterval(() => {
        res.write(': keepalive\n\n');
    }, 15000);
    req.on('close', () => {
        clearInterval(keepAlive);
    });
});
// MCP Stream Messages
exports.mcpRouter.post('/messages', async (req, res, next) => {
    try {
        const { method, params } = req.body;
        if (method === 'tools/list') {
            return res.json({ tools: server_1.SHORELINE_MCP_TOOLS });
        }
        if (method === 'tools/call') {
            const result = await (0, server_1.executeMcpTool)(params.name, params.arguments || {});
            return res.json({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
        }
        res.status(400).json({ error: `Unsupported MCP method: ${method}` });
    }
    catch (err) {
        next(err);
    }
});
// MCP Tool Execution
exports.mcpRouter.post('/execute', async (req, res, next) => {
    try {
        const { tool, arguments: toolArgs } = req.body;
        if (!tool) {
            return res.status(400).json({ error: 'Missing required field: tool' });
        }
        const result = await (0, server_1.executeMcpTool)(tool, toolArgs || {});
        res.json({
            success: true,
            tool,
            result,
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});
// Self-Healing Diagnostics & Audit
exports.mcpRouter.get('/diagnostics/self-healing', async (_req, res, next) => {
    try {
        const report = await healer_1.globalHealerBot.runAudit(false);
        res.json(report);
    }
    catch (err) {
        next(err);
    }
});
exports.mcpRouter.post('/diagnostics/self-healing/run', async (_req, res, next) => {
    try {
        const report = await healer_1.globalHealerBot.runAudit(true);
        res.json({
            message: 'Self-healing audit and remediation completed.',
            report,
        });
    }
    catch (err) {
        next(err);
    }
});
