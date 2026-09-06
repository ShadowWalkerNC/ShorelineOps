/**
 * ThermalPrintEngine — Shoreline Hardware Integration v6.0
 *
 * Generates structured 4x6 label payloads for thermal tray card printers.
 * Output is a JSON label zone document that is printer-agnostic and
 * can be transmitted to ZPL/EPL/StarPRNT driver bridges.
 */

import crypto from 'crypto'

// ── Types ─────────────────────────────────────────────────────────────────────

export type LabelZoneType =
  | 'text'
  | 'bold_text'
  | 'small_text'
  | 'qr_code'
  | 'divider'
  | 'allergen_banner'

export interface LabelZone {
  zoneId: string
  type: LabelZoneType
  label?: string
  value: string
  fontSize?: number
  bold?: boolean
  yOffsetMm: number
  xOffsetMm: number
  widthMm?: number
}

export interface ThermalPrintResidentInput {
  id: string
  name: string
  room: string
  wing?: string
  diet: string
  texture: string
  fluids: string
  allergies: string[]
  mealDate?: string
  mealType?: string
}

export interface ThermalPrintJob {
  jobId: string
  residentId: string
  residentName: string
  labelWidthMm: number
  labelHeightMm: number
  zones: LabelZone[]
  qrToken: string
  generatedAt: string
  printerLanguage: 'ZPL' | 'STAR_PRNT' | 'JSON'
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class ThermalPrintEngine {
  private static readonly LABEL_WIDTH_MM = 101.6
  private static readonly LABEL_HEIGHT_MM = 152.4

  static printTrayCard(resident: ThermalPrintResidentInput): ThermalPrintJob {
    const jobId = `PJ-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const mealDate = resident.mealDate ?? new Date().toISOString().split('T')[0]
    const mealType = resident.mealType ?? 'Meal'
    const generatedAt = new Date().toISOString()

    const qrToken = crypto
      .createHash('sha256')
      .update(`${resident.id}:${mealDate}:${jobId}`)
      .digest('hex')
      .slice(0, 16)
      .toUpperCase()

    const allergenDisplay =
      resident.allergies.length > 0
        ? `ALLERGENS: ${resident.allergies.join(', ')}`
        : 'No Known Allergens'

    const zones: LabelZone[] = [
      {
        zoneId: 'facility_header',
        type: 'small_text',
        label: 'facility',
        value: 'SHORELINE CARE OS',
        fontSize: 7,
        bold: false,
        yOffsetMm: 3,
        xOffsetMm: 2,
        widthMm: 97,
      },
      {
        zoneId: 'resident_name',
        type: 'bold_text',
        label: 'name',
        value: resident.name,
        fontSize: 14,
        bold: true,
        yOffsetMm: 10,
        xOffsetMm: 2,
        widthMm: 80,
      },
      {
        zoneId: 'room_wing',
        type: 'text',
        label: 'room',
        value: resident.wing
          ? `Room ${resident.room} - ${resident.wing}`
          : `Room ${resident.room}`,
        fontSize: 10,
        bold: false,
        yOffsetMm: 26,
        xOffsetMm: 2,
        widthMm: 97,
      },
      {
        zoneId: 'div_1',
        type: 'divider',
        value: '-------------------------',
        fontSize: 8,
        yOffsetMm: 36,
        xOffsetMm: 2,
        widthMm: 97,
      },
      {
        zoneId: 'diet_order',
        type: 'text',
        label: 'Diet',
        value: `Diet: ${resident.diet}`,
        fontSize: 10,
        bold: false,
        yOffsetMm: 42,
        xOffsetMm: 2,
        widthMm: 97,
      },
      {
        zoneId: 'iddsi_texture',
        type: 'text',
        label: 'Texture',
        value: `Texture: ${resident.texture}`,
        fontSize: 10,
        bold: false,
        yOffsetMm: 54,
        xOffsetMm: 2,
        widthMm: 97,
      },
      {
        zoneId: 'fluid_consistency',
        type: 'text',
        label: 'Fluids',
        value: `Fluids: ${resident.fluids}`,
        fontSize: 10,
        bold: false,
        yOffsetMm: 66,
        xOffsetMm: 2,
        widthMm: 97,
      },
      {
        zoneId: 'div_2',
        type: 'divider',
        value: '-------------------------',
        fontSize: 8,
        yOffsetMm: 78,
        xOffsetMm: 2,
        widthMm: 97,
      },
      {
        zoneId: 'allergen_banner',
        type: 'allergen_banner',
        label: 'allergens',
        value: allergenDisplay,
        fontSize: 11,
        bold: resident.allergies.length > 0,
        yOffsetMm: 84,
        xOffsetMm: 2,
        widthMm: 97,
      },
      {
        zoneId: 'div_3',
        type: 'divider',
        value: '-------------------------',
        fontSize: 8,
        yOffsetMm: 100,
        xOffsetMm: 2,
        widthMm: 97,
      },
      {
        zoneId: 'meal_date',
        type: 'text',
        label: 'meal',
        value: `${mealType}  -  ${mealDate}`,
        fontSize: 9,
        bold: false,
        yOffsetMm: 106,
        xOffsetMm: 2,
        widthMm: 60,
      },
      {
        zoneId: 'qr_code',
        type: 'qr_code',
        label: 'qr_token',
        value: qrToken,
        fontSize: 8,
        yOffsetMm: 100,
        xOffsetMm: 68,
        widthMm: 30,
      },
      {
        zoneId: 'timestamp',
        type: 'small_text',
        label: 'printed_at',
        value: `Printed: ${generatedAt}`,
        fontSize: 6,
        bold: false,
        yOffsetMm: 144,
        xOffsetMm: 2,
        widthMm: 97,
      },
      {
        zoneId: 'footer_id',
        type: 'small_text',
        label: 'resident_id',
        value: `ID: ${resident.id}  Token: ${qrToken}`,
        fontSize: 6,
        bold: false,
        yOffsetMm: 149,
        xOffsetMm: 2,
        widthMm: 97,
      },
    ]

    return {
      jobId,
      residentId: resident.id,
      residentName: resident.name,
      labelWidthMm: ThermalPrintEngine.LABEL_WIDTH_MM,
      labelHeightMm: ThermalPrintEngine.LABEL_HEIGHT_MM,
      zones,
      qrToken,
      generatedAt,
      printerLanguage: 'JSON',
    }
  }

  /**
   * Translates structured 4x6 label zones into standard Zebra ZPL II commands (203 DPI / 8 dots per mm).
   * 4x6 inches = 812 dots wide x 1218 dots tall.
   */
  static generateZplString(job: ThermalPrintJob): string {
    const dotsPerMm = 8 // 203 DPI standard for Zebra ZD421 / ZD620
    const lines: string[] = [
      '^XA', // Start Format
      '^PW812', // Print Width 812 dots (4 in)
      '^LL1218', // Label Length 1218 dots (6 in)
      '^LH0,0', // Label Home
    ]

    for (const zone of job.zones) {
      const xDots = Math.round(zone.xOffsetMm * dotsPerMm)
      const yDots = Math.round(zone.yOffsetMm * dotsPerMm)

      if (zone.type === 'qr_code') {
        // ZPL QR Code command: ^BQN,2,6 (Magnification 6)
        lines.push(`^FO${xDots},${yDots}^BQN,2,6^FDQA,${zone.value}^FS`)
      } else if (zone.type === 'divider') {
        // Draw horizontal line: ^GBwidth,height,thickness
        const widthDots = Math.round((zone.widthMm || 97) * dotsPerMm)
        lines.push(`^FO${xDots},${yDots}^GB${widthDots},2,2^FS`)
      } else if (zone.type === 'allergen_banner' && zone.bold) {
        // Reverse black box with white text for allergen warning banner
        const widthDots = Math.round((zone.widthMm || 97) * dotsPerMm)
        lines.push(`^FO${xDots},${yDots}^GB${widthDots},50,50^FS`)
        lines.push(`^FO${xDots + 16},${yDots + 12}^A0N,28,28^FR^FD${zone.value}^FS`)
      } else {
        const heightDots = zone.bold ? 36 : 24
        const widthCharDots = zone.bold ? 36 : 24
        lines.push(`^FO${xDots},${yDots}^A0N,${heightDots},${widthCharDots}^FD${zone.value}^FS`)
      }
    }

    lines.push('^XZ') // End Format
    return lines.join('\n')
  }

  /**
   * Direct TCP Port 9100 Socket transmission to physical Zebra network printer.
   * Gracefully fails if printer is offline or network socket times out.
   */
  static async sendZplToNetworkPrinter(
    host: string,
    port = 9100,
    zplString: string,
    timeoutMs = 4000
  ): Promise<{ success: boolean; error?: string; bytesWritten?: number }> {
    const net = await import('net')
    return new Promise((resolve) => {
      const socket = new net.Socket()
      let bytes = 0

      socket.setTimeout(timeoutMs)

      socket.connect(port, host, () => {
        bytes = Buffer.byteLength(zplString, 'utf8')
        socket.write(zplString, 'utf8', () => {
          socket.end()
        })
      })

      socket.on('close', () => {
        resolve({ success: true, bytesWritten: bytes })
      })

      socket.on('timeout', () => {
        socket.destroy()
        resolve({ success: false, error: `Connection to Zebra printer ${host}:${port} timed out.` })
      })

      socket.on('error', (err: any) => {
        socket.destroy()
        resolve({ success: false, error: err.message || `Socket error connecting to ${host}:${port}` })
      })
    })
  }
}

