/**
 * Hardware Routes — Shoreline v6.0
 *
 * POST   /api/hardware/print/tray-card          Print a thermal tray card
 * GET    /api/hardware/printers                 List available printers
 * GET    /api/hardware/probes                   List BLE HACCP probes
 * GET    /api/hardware/probes/:probeId/temperature  Read probe temperature
 * POST   /api/hardware/probes/:probeId/log-haccp    Log HACCP temperature
 */

import { Router, Request, Response, NextFunction } from 'express'
import { ThermalPrintEngine } from '../hardware/thermalPrint'
import { globalProbeManager } from '../hardware/bluetoothProbe'

export const hardwareRouter = Router()

// ── Thermal Printing ──────────────────────────────────────────────────────────

/**
 * POST /api/hardware/print/tray-card
 * Body: ThermalPrintResidentInput
 */
hardwareRouter.post('/print/tray-card', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resident = req.body as {
      id?: string
      name?: string
      room?: string
      diet?: string
      texture?: string
      fluids?: string
      allergies?: string[]
      wing?: string
      mealDate?: string
      mealType?: string
    }

    // Validate required fields
    if (!resident.id || !resident.name || !resident.room) {
      return res.status(400).json({
        error: 'id, name, and room are required resident fields',
      })
    }

    const job = ThermalPrintEngine.printTrayCard({
      id: resident.id,
      name: resident.name,
      room: resident.room,
      wing: resident.wing,
      diet: resident.diet ?? 'Regular',
      texture: resident.texture ?? 'IDDSI Level 7 Regular',
      fluids: resident.fluids ?? 'Thin',
      allergies: resident.allergies ?? [],
      mealDate: resident.mealDate,
      mealType: resident.mealType,
    })

    return res.status(201).json({
      message: 'Tray card print job generated',
      job,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/hardware/printers
 * Returns list of configured thermal printer destinations.
 */
hardwareRouter.get('/printers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Simulated printer registry — replace with real printer discovery in production
    const printers = [
      {
        printerId: 'PRINTER-001',
        name: 'Tray Line Main (ZPL)',
        model: 'Zebra ZD421',
        connectionType: 'ethernet',
        host: '192.168.1.101',
        port: 9100,
        status: 'online',
        labelFormat: 'ZPL',
        lastJobAt: new Date(Date.now() - 120000).toISOString(),
      },
      {
        printerId: 'PRINTER-002',
        name: 'Dining Room Station (StarPRNT)',
        model: 'Star TSP743II',
        connectionType: 'ethernet',
        host: '192.168.1.102',
        port: 9100,
        status: 'online',
        labelFormat: 'STAR_PRNT',
        lastJobAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        printerId: 'PRINTER-003',
        name: 'Wing B Mobile Printer (BT)',
        model: 'Zebra ZQ521',
        connectionType: 'bluetooth',
        host: null,
        port: null,
        status: 'offline',
        labelFormat: 'ZPL',
        lastJobAt: null,
      },
    ]

    return res.json({ count: printers.length, printers })
  } catch (err) {
    next(err)
  }
})

// ── Bluetooth HACCP Probes ─────────────────────────────────────────────────────

/**
 * GET /api/hardware/probes
 * Scan and return all discovered BLE HACCP probes.
 */
hardwareRouter.get('/probes', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const probes = globalProbeManager.scanForProbes()
    return res.json({ count: probes.length, probes })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/hardware/probes/:probeId/temperature
 * Read current temperature from a specific probe.
 */
hardwareRouter.get('/probes/:probeId/temperature', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { probeId } = req.params
    const { stationId } = req.query as { stationId?: string }

    const reading = globalProbeManager.readTemperature(probeId, stationId ?? 'STATION-UNKNOWN')
    return res.json({ reading })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('not found')) {
      return res.status(404).json({ error: message })
    }
    next(err)
  }
})

/**
 * POST /api/hardware/probes/:probeId/log-haccp
 * Log a HACCP temperature reading; fires webhook if violation detected.
 * Body: { stationId, itemName, loggedBy? }
 */
hardwareRouter.post('/probes/:probeId/log-haccp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { probeId } = req.params
    const { stationId, itemName, loggedBy } = req.body as {
      stationId?: string
      itemName?: string
      loggedBy?: string
    }

    if (!stationId || !itemName) {
      return res.status(400).json({ error: 'stationId and itemName are required' })
    }

    const logEntry = await globalProbeManager.logToHaccp(
      probeId,
      stationId,
      itemName,
      loggedBy ?? 'api'
    )

    const statusCode = logEntry.compliant ? 200 : 207
    return res.status(statusCode).json({
      message: logEntry.compliant
        ? 'HACCP log recorded — temperature compliant'
        : 'HACCP log recorded — VIOLATION DETECTED',
      logEntry,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('not found')) {
      return res.status(404).json({ error: message })
    }
    next(err)
  }
})
