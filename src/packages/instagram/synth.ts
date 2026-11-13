import { SynthDevice } from './types'

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function synthInstagramDevice(): SynthDevice {
  return {
    deviceId: `android-${randomHex(8)}`,
    phoneId: crypto.randomUUID(),
    uuid: crypto.randomUUID(),
    adid: crypto.randomUUID(),
    familyDeviceId: crypto.randomUUID(),
  }
}
