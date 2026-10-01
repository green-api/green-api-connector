;(function () {
  'use strict'
  async function dumpSession() {
      try {
        const raw = window.localStorage.getItem('__oneme_auth')
        if (!raw) {
          return null
        }

        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed.token !== 'string' || !parsed.token) {
          return null
        }

        const deviceId = window.localStorage.getItem('__oneme_device_id')
        return { token: parsed.token, deviceId: deviceId }
      } catch {
        return null
      }
  }

  window.__maxSessionDump = async function () {
    return dumpSession()
  }
})()
