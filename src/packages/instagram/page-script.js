; (function () {
  'use strict'

  const WEB_APP_ID = '936619743392459'

  function readCookie(name) {
    try {
      const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
      return m ? decodeURIComponent(m[1]) : null
    } catch (_) {
      return null
    }
  }

  function readSharedData() {
    try {
      const sd = window._sharedData
      if (sd && typeof sd === 'object') return sd
    } catch (_) {
      /* ignore */
    }
    return null
  }

  function readAppId() {
    try {
      const shared = readSharedData()
      const fromShared = shared && shared.config && shared.config.app_id
      if (fromShared) return String(fromShared)
    } catch (_) {
      /* ignore */
    }
    return WEB_APP_ID
  }

  function readWwwClaim() {
    const keys = ['www-claim-v2', 'wwwClaim', 'ig-www-claim']
    for (const store of [sessionStorage, localStorage]) {
      for (const k of keys) {
        try {
          const v = store.getItem(k)
          if (typeof v === 'string' && v.length) return v
        } catch (_) {
          /* ignore */
        }
      }
    }
    return null
  }

  function readViewerData() {
    try {
      if (typeof window.require !== 'function') return null
      let data = null
      let id = null

      try {
        const viewer = window.require('PolarisViewer')
        if (viewer) {
          if (viewer.data && typeof viewer.data === 'object') data = viewer.data
          if (viewer.id != null) id = viewer.id
        }
      } catch (_) {}

      const username = data && typeof data.username === 'string' ? data.username : null
      const fullName = data && typeof data.full_name === 'string' ? data.full_name : null
      const outId = id != null ? String(id) : null
      if (username == null && outId == null && fullName == null) return null
      return { username, id: outId, fullName }
    } catch (_) {
      return null
    }
  }

  function readViewer() {
    let userId = null
    let username = null
    let fullName = null

    const data = readViewerData()
    if (data) {
      if (typeof data.username === 'string') username = data.username
      if (typeof data.fullName === 'string') fullName = data.fullName
      if (data.id != null) userId = data.id
    }

    try {
      const shared = readSharedData()
      const viewer = shared && shared.config && shared.config.viewer
      if (viewer) {
        if (!userId && viewer.id != null) userId = String(viewer.id)
        if (!username && typeof viewer.username === 'string') username = viewer.username
        if (!fullName && typeof viewer.full_name === 'string') fullName = viewer.full_name
      }
    } catch (_) {
      /* ignore */
    }

    const dsUserId = readCookie('ds_user_id')
    if (dsUserId) userId = dsUserId

    return { userId, username, fullName }
  }

  function readAcceptLanguage() {
    try {
      const source = Array.isArray(navigator.languages) && navigator.languages.length ? navigator.languages : [navigator.language]
      const list = source.filter(function (lang) {
        return typeof lang === 'string' && lang.length
      })
      if (!list.length) return null
      return list
        .map(function (lang, index) {
          if (index === 0) return lang
          return lang + ';q=' + Math.max(0.1, 1 - index * 0.1).toFixed(1)
        })
        .join(',')
    } catch (_) {
      return null
    }
  }

  function brandList(brands) {
    if (!Array.isArray(brands) || !brands.length) return null
    return brands
      .map(function (b) {
        return '"' + b.brand + '";v="' + b.version + '"'
      })
      .join(', ')
  }

  async function readClientHints() {
    try {
      const uaData = navigator.userAgentData
      if (!uaData) return null

      const hints = {
        ua: brandList(uaData.brands),
        mobile: uaData.mobile ? '?1' : '?0',
        platform: uaData.platform ? '"' + uaData.platform + '"' : null,
        fullVersionList: null,
        platformVersion: null,
        model: null,
        prefersColorScheme: null,
      }

      try {
        const high = await uaData.getHighEntropyValues(['fullVersionList', 'platformVersion', 'model'])
        if (high) {
          hints.fullVersionList = brandList(high.fullVersionList)
          if (typeof high.platformVersion === 'string') hints.platformVersion = '"' + high.platformVersion + '"'
          if (typeof high.model === 'string') hints.model = '"' + high.model + '"'
        }
      } catch (_) {
        /* ignore */
      }

      try {
        hints.prefersColorScheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      } catch (_) {
        /* ignore */
      }

      return hints
    } catch (_) {
      return null
    }
  }

  function readModuleToken(moduleName) {
    try {
      if (typeof window.require !== 'function') return null
      const m = window.require(moduleName)
      if (m && typeof m.token === 'string' && m.token) return m.token
    } catch (_) {}
    return null
  }

  function readInlineToken(regex) {
    try {
      for (const s of document.querySelectorAll('script[type="application/json"]')) {
        const txt = s.textContent || ''
        const m = txt.match(regex)
        if (m && m[1]) return m[1]
      }
    } catch (_) {
      /* ignore */
    }
    return null
  }

  function readFbDtsg() {
    return (
      readModuleToken('DTSGInitialData') ||
      readModuleToken('DTSGInitData') ||
      readInlineToken(/DTSGInit(?:ial)?Data[^{]*\{[^}]*"token"\s*:\s*"([^"]+)"/) ||
      readInlineToken(/"dtsg"\s*:\s*\{[^}]*"token"\s*:\s*"([^"]+)"/)
    )
  }

  function readLsd() {
    return (
      readModuleToken('LSD') ||
      readInlineToken(/"LSD"\s*,\s*\[\s*\]\s*,\s*\{[^}]*"token"\s*:\s*"([^"]+)"/) ||
      readInlineToken(/"lsd"\s*:\s*\{[^}]*"token"\s*:\s*"([^"]+)"/)
    )
  }

  window.__igWebSessionDump = async function () {
    return {
      userAgent: (typeof navigator !== 'undefined' && navigator.userAgent) || null,
      acceptLanguage: readAcceptLanguage(),
      clientHints: await readClientHints(),
      appId: readAppId(),
      wwwClaim: readWwwClaim(),
      csrfToken: readCookie('csrftoken'),
      fbDtsg: readFbDtsg(),
      lsd: readLsd(),
      me: readViewer(),
    }
  }
})()
