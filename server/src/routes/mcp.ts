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

import { Router, Request, Response, NextFunction } from 'express'
import { SHORELINE_MCP_TOOLS, executeMcpTool } from '../mcp/server'
import { globalHealerBot } from '../agent/healer'
import { requireAuth, requireRole } from '../middleware/requireAuth'

export const mcpRouter = Router()

// Parked admin surface: every route requires an authenticated manager-or-higher JWT.
// (Owner decision 2026-09-13: put the unauthenticated /api/mcp/* routes behind auth.)
mcpRouter.use(requireAuth, requireRole('manager'))

// MCP Tool Discovery
mcpRouter.get('/tools', (_req: Request, res: Response) => {
  res.json({
    protocol: 'modelcontextprotocol/v1',
    server: 'shorelineops-mcp',
    version: '6.2.0',
    tools: SHORELINE_MCP_TOOLS,
  })
})

// MCP Server-Sent Events (SSE) Stream Transport
mcpRouter.get('/sse', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const sessionId = `mcp-session-${Date.now()}`
  res.write(`event: endpoint\ndata: /api/mcp/messages?sessionId=${sessionId}\n\n`)

  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n')
  }, 15000)

  req.on('close', () => {
    clearInterval(keepAlive)
  })
})

// MCP Stream Messages
mcpRouter.post('/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { method, params } = req.body
    if (method === 'tools/list') {
      return res.json({ tools: SHORELINE_MCP_TOOLS })
    }
    if (method === 'tools/call') {
      const result = await executeMcpTool(params.name, params.arguments || {})
      return res.json({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] })
    }
    res.status(400).json({ error: `Unsupported MCP method: ${method}` })
  } catch (err) {
    next(err)
  }
})

// MCP Tool Execution
mcpRouter.post('/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tool, arguments: toolArgs } = req.body
    if (!tool) {
      return res.status(400).json({ error: 'Missing required field: tool' })
    }

    const result = await executeMcpTool(tool, toolArgs || {})
    res.json({
      success: true,
      tool,
      result,
    })
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    })
  }
})

// Self-Healing Diagnostics & Audit
mcpRouter.get('/diagnostics/self-healing', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await globalHealerBot.runAudit(false)
    res.json(report)
  } catch (err) { next(err) }
})

mcpRouter.post('/diagnostics/self-healing/run', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await globalHealerBot.runAudit(true)
    res.json({
      message: 'Self-healing audit and remediation completed.',
      report,
    })
  } catch (err) { next(err) }
})
