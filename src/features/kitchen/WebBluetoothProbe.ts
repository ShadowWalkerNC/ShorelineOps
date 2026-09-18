/**
 * Web Bluetooth API Driver for Kitchen Tablet Kiosks
 * Shoreline Care OS v6.1
 *
 * Direct zero-driver pairing with Bluetooth Low Energy (BLE) HACCP temperature probes
 * (ThermoWorks, Inkbird, Govee, and standard Environmental Sensing GATT profile).
 * Enables hands-free line cook HACCP temperature capture directly in Chrome / Edge PWAs.
 */

export interface BleProbeReading {
  temperatureF: number
  temperatureC: number
  batteryLevel?: number
  deviceName: string
  readAt: string
}

export class WebBluetoothProbeDriver {
  private device: any = null
  private server: any = null
  private characteristic: any = null
  private onReadingCallback?: (reading: BleProbeReading) => void

  /**
   * Checks if the current browser environment supports the Web Bluetooth API.
   */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator
  }

  /**
   * Request pairing with a nearby Bluetooth LE thermometer.
   * Scans for standard Environmental Sensing (0x181A), Health Thermometer (0x1809), or generic profiles.
   */
  async connect(onReading?: (reading: BleProbeReading) => void): Promise<{ success: boolean; deviceName?: string; error?: string }> {
    if (!WebBluetoothProbeDriver.isSupported()) {
      return { success: false, error: 'Web Bluetooth API is not supported in this browser. Please use Chrome or Edge.' }
    }

    try {
      this.onReadingCallback = onReading
      const navAny = navigator as any

      this.device = await navAny.bluetooth.requestDevice({
        filters: [
          { services: ['environmental_sensing'] },
          { services: ['health_thermometer'] },
          { namePrefix: 'Thermo' },
          { namePrefix: 'Inkbird' },
          { namePrefix: 'Govee' },
          { namePrefix: 'Probe' },
        ],
        optionalServices: ['battery_service', 0x181A, 0x1809],
      })

      const deviceName = this.device.name || 'BLE HACCP Probe'

      this.server = await this.device.gatt.connect()

      // Attempt to acquire primary temperature service
      try {
        const service = await this.server.getPrimaryService('environmental_sensing')
          .catch(() => this.server.getPrimaryService('health_thermometer'))

        this.characteristic = await service.getCharacteristic('temperature')
          .catch(() => service.getCharacteristic('temperature_measurement'))

        await this.characteristic.startNotifications()
        this.characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
          this.handleCharacteristicChange(event, deviceName)
        })
      } catch (serviceErr) {
        console.error('[WebBluetoothProbe] Standard GATT temperature service not found on paired device:', serviceErr)
        throw new Error('Connected Bluetooth device does not expose standard HACCP temperature GATT services.')
      }

      return { success: true, deviceName }
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        return { success: false, error: 'Pairing cancelled: No probe selected.' }
      }
      return { success: false, error: err.message || 'Bluetooth connection failed.' }
    }
  }

  /**
   * Parse raw binary GATT temperature value (typically IEEE-11073 16-bit or 32-bit float)
   */
  private handleCharacteristicChange(event: any, deviceName: string) {
    const value = event.target.value as DataView
    if (!value || value.byteLength < 2) return

    // Standard Bluetooth 0x2A6E (Temperature) is a signed 16-bit int in units of 0.01 degrees Celsius
    const rawCelsius = value.getInt16(0, true) / 100
    const tempF = Math.round(((rawCelsius * 9) / 5 + 32) * 10) / 10

    const reading: BleProbeReading = {
      temperatureF: tempF,
      temperatureC: Math.round(rawCelsius * 10) / 10,
      deviceName,
      readAt: new Date().toISOString(),
    }

    if (this.onReadingCallback) {
      this.onReadingCallback(reading)
    }
  }

  /**
   * Read single temperature sample on demand
   */
  async readSample(): Promise<BleProbeReading> {
    if (this.characteristic) {
      const value = await this.characteristic.readValue()
      const rawCelsius = value.getInt16(0, true) / 100
      const tempF = Math.round(((rawCelsius * 9) / 5 + 32) * 10) / 10
      return {
        temperatureF: tempF,
        temperatureC: Math.round(rawCelsius * 10) / 10,
        deviceName: this.device?.name || 'BLE Probe',
        readAt: new Date().toISOString(),
      }
    }

    throw new Error('No Bluetooth temperature probe connected. Please pair a probe or enter temperature manually.')
  }

  /**
   * Disconnect and release BLE GATT session
   */
  disconnect() {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect()
    }
    this.device = null
    this.server = null
    this.characteristic = null
  }
}