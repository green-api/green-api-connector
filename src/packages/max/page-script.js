;(function () {
  'use strict'

  function osFamily() {
    try {
      var uad = navigator.userAgentData
      if (uad && uad.platform) return uad.platform
    } catch (e) {}
    var ua = navigator.userAgent || ''
    if (/Windows/i.test(ua)) return 'Windows'
    if (/Android/i.test(ua)) return 'Android'
    if (/(iPhone|iPad|iPod)/i.test(ua)) return 'iOS'
    if (/Mac OS X|Macintosh/i.test(ua)) return 'Mac OS X'
    if (/CrOS/i.test(ua)) return 'Chrome OS'
    if (/Linux/i.test(ua)) return 'Linux'
    return 'Unknown'
  }

  function browserName() {
    var ua = navigator.userAgent || ''
    if (/YaBrowser/i.test(ua)) return 'Yandex Browser'
    if (/Edg\//i.test(ua)) return 'Microsoft Edge'
    if (/OPR\//i.test(ua)) return 'Opera'
    if (/Firefox\//i.test(ua)) return 'Firefox'
    if (/Chrome\//i.test(ua)) return 'Chrome'
    if (/Safari\//i.test(ua)) return 'Safari'
    return 'Chrome'
  }

  function screenString() {
    try {
      var s = window.screen || {}
      var h = s.height || 0
      var w = s.width || 0
      var dpr = window.devicePixelRatio || 1
      return h + 'x' + w + ' ' + dpr.toFixed(1) + 'x'
    } catch (e) {
      return undefined
    }
  }

  function timezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
    } catch (e) {
      return undefined
    }
  }

  function isPwa() {
    try {
      if (window.matchMedia) {
        if (window.matchMedia('(display-mode: standalone)').matches) return true
        if (window.matchMedia('(display-mode: window-controls-overlay)').matches) return true
        if (window.matchMedia('(display-mode: minimal-ui)').matches) return true
      }
      if (window.navigator && window.navigator.standalone === true) return true
    } catch (e) {}
    return false
  }

  function buildAcceptLanguage(langs) {
    if (!langs || !langs.length) return undefined
    var parts = []
    for (var i = 0; i < langs.length; i++) {
      if (i === 0) { parts.push(langs[i]); continue }
      var q = 1 - i * 0.1
      if (q < 0.1) q = 0.1
      parts.push(langs[i] + ';q=' + q.toFixed(1))
    }
    return parts.join(',')
  }

  function buildIdentity() {
    var lang = navigator.language || (navigator.languages && navigator.languages[0]) || 'en'
    return {
      headerUserAgent: navigator.userAgent,
      deviceName: browserName(),
      osVersion: osFamily(),
      locale: lang.split('-')[0],
      deviceLocale: lang,
      screen: screenString(),
      timezone: timezone(),
      isPwa: isPwa(),
      acceptLanguage: buildAcceptLanguage(navigator.languages),
    }
  }

  function dumpSession() {
    try {
      var raw = window.localStorage.getItem('__oneme_auth')
      if (!raw) return null
      var parsed = JSON.parse(raw)
      if (!parsed || typeof parsed.token !== 'string' || !parsed.token) return null
      var deviceId = window.localStorage.getItem('__oneme_device_id') || null
      return { token: parsed.token, deviceId: deviceId, identity: buildIdentity() }
    } catch (e) {
      return null
    }
  }

  window.__maxSessionDump = function () {
    return dumpSession()
  }
})()
