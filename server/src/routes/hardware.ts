/**
 * Hardware Routes — Shoreline v6.0
 *
 * POST   /api/hardware/print/tray-card          Print a thermal tray card
 *
 * B13: simulated printer registry (GET /printers), simulated BLE probe scan
 * (GET /probes), simulated probe reads (GET /probes/:probeId/temperature) and
 * simulated HACCP logging (POST /probes/:probeId/log-haccp) were CUT.
 */

import { Router, Request, Response, NextFunction } from 'express'
import { ThermalPrintEngine } from '../hardware/thermalPrint'

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

    const zpl = ThermalPrintEngine.generateZplString(job)

    const directPrint = req.body.directPrint === true
    const printerHost = req.body.printerHost || '192.168.1.101'
    const printerPort = req.body.printerPort || 9100

    let socketResult: { success: boolean; error?: string; bytesWritten?: number } | undefined

    if (directPrint) {
      socketResult = await ThermalPrintEngine.sendZplToNetworkPrinter(printerHost, printerPort, zpl)
    }

    return res.status(201).json({
      message: 'Tray card print job generated',
      job,
      zpl,
      directPrintRequested: directPrint,
      socketResult,
    })
  } catch (err) {
    next(err)
  }
})


// ─────────────────────────────────────────────────────────────────────────────
// B13 scope cuts: the simulated hardware endpoints were CUT from this file:
//   GET    /api/hardware/printers                      (simulated printer registry)
//   GET    /api/hardware/probes                        (simulated BLE scan)
//   GET    /api/hardware/probes/:probeId/temperature   (simulated temp reads)
//   POST   /api/hardware/probes/:probeId/log-haccp     (simulated HACCP logging)
// Kept: POST /api/hardware/print/tray-card (real ZPL thermal-print engine).
// ─────────────────────────────────────────────────────────────────────────────
