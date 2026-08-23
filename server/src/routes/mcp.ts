/**
 * MCP & Self-Healing Diagnostics API Routes
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

export const mcpRouter = Router()

// MCP Tool Discovery
mcpRouter.get('/tools', (_req: Request, res: Response) => {
  res.json({
    protocol: 'modelcontextprotocol/v1',
    server: 'shorelineops-mcp',
    version: '6.0.0',
    tools: SHORELINE_MCP_TOOLS,
  })
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
