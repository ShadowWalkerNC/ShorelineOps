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
}
