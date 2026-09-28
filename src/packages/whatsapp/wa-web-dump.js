;(function () {
  'use strict'

  const SIGNAL_DB_NAME = 'signal-storage'
  const STORE_META = 'signal-meta-store'
  const STORE_IDENTITY = 'identity-store'
  const STORE_PREKEY = 'prekey-store'
  const STORE_SIGNED_PREKEY = 'signed-prekey-store'
  const STORE_SESSION = 'session-store'
  const STORE_SENDERKEY = 'senderkey-store'
  function bytesToB64(u8) {
    if (!u8) return ''
    let binary = ''
    const bytes = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8)
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode.apply(null, chunk)
    }
    return btoa(binary)
  }

  function bufWrap(bytes) {
    return { type: 'Buffer', data: bytesToB64(bytes) }
  }

  function isBinaryLike(value) {
    return (
      value instanceof Uint8Array ||
      value instanceof ArrayBuffer ||
      (ArrayBuffer.isView && ArrayBuffer.isView(value))
    )
  }

  function deepBufWrap(value) {
    if (value == null) return value
    if (isBinaryLike(value)) {
      const u8 = value instanceof Uint8Array ? value : new Uint8Array(value.buffer || value)
      return bufWrap(u8)
    }
    if (Array.isArray(value)) return value.map(deepBufWrap)
    if (typeof value === 'object') {
      const out = {}
      for (const key of Object.keys(value)) out[key] = deepBufWrap(value[key])
      return out
    }
    return value
  }
  function openDB(name) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error || new Error('indexedDB.open failed for ' + name))
      req.onblocked = () => reject(new Error('indexedDB.open blocked for ' + name))
    })
  }

  function getAll(db, storeName) {
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve([])
        return
      }
      let tx
      try {
        tx = db.transaction(storeName, 'readonly')
      } catch (err) {
        reject(err)
        return
      }
      const store = tx.objectStore(storeName)
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error || new Error('getAll failed for ' + storeName))
    })
  }
  function getWaModule(name) {
    try {
      if (typeof window.__d === 'function' && typeof window.require === 'function') {
        try {
          const mod = window.require(name)
          if (mod) return mod
        } catch (_) {
          // fall through to other mechanisms
        }
      }
      if (typeof window.requireLazy === 'function') {
        let resolved = null
        try {
          window.requireLazy([name], (mod) => {
            resolved = mod
          })
        } catch (_) {
        }
        if (resolved) return resolved
      }
      if (typeof window.require === 'function') {
        try {
          const mod = window.require(name)
          if (mod) return mod
        } catch (_) {
        }
      }
    } catch (_) {
    }
    return null
  }

  async function decryptStaticKey(bytes, encKey) {
    if (!bytes || !encKey) return null
    try {
      const counter = new Uint8Array(16)
      const plain = await crypto.subtle.decrypt({ name: 'AES-CTR', counter, length: 128 }, encKey, bytes)
      return new Uint8Array(plain)
    } catch (_) {
      return null
    }
  }

  function metaMapFromRows(rows) {
    const map = new Map()
    for (const row of rows) {
      if (row && Object.prototype.hasOwnProperty.call(row, 'key')) {
        map.set(row.key, row.value)
      }
    }
    return map
  }

  function parseAddress(identifier) {
    if (!identifier || typeof identifier !== 'string') return { jid: null, device: 0 }
    const dotIdx = identifier.lastIndexOf('.')
    let head = identifier
    let device = 0
    if (dotIdx > -1) {
      const devicePart = identifier.slice(dotIdx + 1)
      const parsedDevice = Number(devicePart)
      if (Number.isFinite(parsedDevice)) {
        head = identifier.slice(0, dotIdx)
        device = parsedDevice
      }
    }
    const jid = head.includes('@') ? head : head + '@s.whatsapp.net'
    return { jid, device }
  }

  function parseSenderKeyName(senderKeyName) {
    if (!senderKeyName || typeof senderKeyName !== 'string') {
      return { groupId: null, senderJid: null, senderDevice: 0 }
    }
    const sepIdx = senderKeyName.indexOf('::')
    if (sepIdx === -1) {
      return { groupId: senderKeyName, senderJid: null, senderDevice: 0 }
    }
    const groupId = senderKeyName.slice(0, sepIdx)
    const senderPart = senderKeyName.slice(sepIdx + 2)
    const { jid: senderJid, device: senderDevice } = parseAddress(senderPart)
    return { groupId, senderJid, senderDevice }
  }

  function safeParseLocalStorageJson(raw) {
    if (raw == null) return null
    try {
      return JSON.parse(raw)
    } catch (_) {
      return raw
    }
  }

  function widToJid(wid) {
    if (!wid) return null
    if (typeof wid === 'string') return wid.includes('@') ? wid : null
    const user = wid.user || wid._serialized || null
    const device = wid.device != null ? wid.device : 0
    const server = wid.server || 's.whatsapp.net'
    if (wid._serialized && typeof wid._serialized === 'string') return wid._serialized
    if (!user) return null
    return device ? user + ':' + device + '@' + server : user + '@' + server
  }

  function readMeJid() {
    try {
      const parsed = safeParseLocalStorageJson(localStorage.getItem('last-wid-md'))
      return widToJid(parsed)
    } catch (_) {
      return null
    }
  }

  function readMeLid() {
    try {
      const parsed = safeParseLocalStorageJson(localStorage.getItem('WALid'))
      if (typeof parsed === 'string') return parsed
      return widToJid(parsed)
    } catch (_) {
      return null
    }
  }
  
  function readPushnameFromModules() {
    const candidates = [
      ['WAWebConnModel', (m) => m && (m.Conn && m.Conn.pushname)],
      ['WAWebConn', (m) => m && ((m.Conn && m.Conn.pushname) || m.pushname)],
      ['WAWebUserPrefsMeUser', (m) => m && ((m.getMaybeMeUser && m.getMaybeMeUser() || {}).pushname)],
    ]
    for (const [name, pick] of candidates) {
      try {
        const mod = getWaModule(name)
        const value = mod ? pick(mod) : null
        if (typeof value === 'string' && value.trim()) return value.trim()
      } catch (_) {
      }
    }
    return null
  }

  function readMeDisplayName() {
    const fromModule = readPushnameFromModules()
    if (fromModule) return fromModule
    try {
      const parsed = safeParseLocalStorageJson(localStorage.getItem('me-display-name'))
      return typeof parsed === 'string' ? parsed : null
    } catch (_) {
      return null
    }
  }

  async function dumpSession() {
    const db = await openDB(SIGNAL_DB_NAME)

    const [metaRows, identityRows, prekeyRows, signedPrekeyRows, sessionRows, senderkeyRows] = await Promise.all([
      getAll(db, STORE_META),
      getAll(db, STORE_IDENTITY),
      getAll(db, STORE_PREKEY),
      getAll(db, STORE_SIGNED_PREKEY),
      getAll(db, STORE_SESSION),
      getAll(db, STORE_SENDERKEY),
    ])

    const meta = metaMapFromRows(metaRows)

    const registrationIdRaw = meta.get('signal_reg_id')
    const registrationId = typeof registrationIdRaw === 'number' ? registrationIdRaw : Number(registrationIdRaw) || null

    let identityKey = null
    try {
      const pubRecord = meta.get('signal_static_pubkey')
      const privRecord = meta.get('signal_static_privkey')
      if (pubRecord && privRecord) {
        const pubEncKey = pubRecord.encKey || privRecord.encKey
        const privEncKey = privRecord.encKey || pubRecord.encKey
        const pubBytes = await decryptStaticKey(pubRecord.value || pubRecord, pubEncKey)
        const privBytes = await decryptStaticKey(privRecord.value || privRecord, privEncKey)
        if (pubBytes && privBytes) {
          identityKey = { pubKey: bufWrap(pubBytes), privKey: bufWrap(privBytes) }
        }
      }
    } catch (_) {
      identityKey = null
    }

    let account = null
    try {
      const advSignedIdentity = meta.get('adv_signed_identity')
      if (advSignedIdentity) account = deepBufWrap(advSignedIdentity)
    } catch (_) {
      account = null
    }

    let noiseKey = null
    try {
      const userPrefsInfo = getWaModule('WAWebUserPrefsInfoStore')
      const getter = userPrefsInfo && userPrefsInfo.waNoiseInfo && userPrefsInfo.waNoiseInfo.get
      const noiseInfo = getter ? await userPrefsInfo.waNoiseInfo.get() : null
      const staticKeyPair = noiseInfo && noiseInfo.staticKeyPair
      const pub = staticKeyPair && (staticKeyPair.pubKey || staticKeyPair.public)
      const priv = staticKeyPair && (staticKeyPair.privKey || staticKeyPair.private)
      if (pub && priv) {
        noiseKey = {
          pubKey: bufWrap(pub),
          privKey: bufWrap(priv),
        }
      }
    } catch (_) {
      noiseKey = null
    }

    let advSecretKey = null
    try {
      const multiDevice = getWaModule('WAWebUserPrefsMultiDevice')
      const secret = multiDevice && typeof multiDevice.getADVSecretKey === 'function'
        ? await multiDevice.getADVSecretKey()
        : null
      if (typeof secret === 'string' && secret.length) {
        advSecretKey = bufWrap(Uint8Array.from(atob(secret), (c) => c.charCodeAt(0)))
      } else if (secret) {
        advSecretKey = bufWrap(secret)
      }
    } catch (_) {
      advSecretKey = null
    }

    let signedPreKey = null
    if (signedPrekeyRows.length > 0) {
      const last = signedPrekeyRows[signedPrekeyRows.length - 1]
      try {
        signedPreKey = {
          keyId: last.keyId,
          keyPair: {
            pubKey: bufWrap(last.keyPair.pubKey),
            privKey: bufWrap(last.keyPair.privKey),
          },
          signature: bufWrap(last.signature),
        }
      } catch (_) {
        signedPreKey = null
      }
    }

    const preKeys = []
    for (const row of prekeyRows) {
      try {
        preKeys.push({
          keyId: row.keyId,
          keyPair: {
            pubKey: bufWrap(row.keyPair.pubKey),
            privKey: bufWrap(row.keyPair.privKey),
          },
        })
      } catch (_) {
      }
    }

    const identities = []
    for (const row of identityRows) {
      try {
        const ik = row.identityKey
        const ikLen = ik ? (ik.byteLength != null ? ik.byteLength : ik.length || 0) : 0
        if (ikLen < 32) continue
        const { jid, device } = parseAddress(row.identifier)
        identities.push({ jid, device, identityKey: bufWrap(ik) })
      } catch (_) {
      }
    }

    const sessions = []
    for (const row of sessionRows) {
      try {
        const { jid, device } = parseAddress(row.identifier || row.address)
        if (!jid) continue
        sessions.push({ jid, device, session: deepBufWrap(row.session) })
      } catch (_) {
      }
    }

    const senderKeys = []
    for (const row of senderkeyRows) {
      try {
        const { groupId, senderJid, senderDevice } = parseSenderKeyName(row.senderKeyName)
        senderKeys.push({ groupId, senderJid, senderDevice, record: deepBufWrap(row.record) })
      } catch (_) {
      }
    }

    return {
      device: {
        registrationId: registrationId != null && !Number.isNaN(registrationId) ? registrationId : null,
        noiseKey,
        identityKey,
        signedPreKey,
        advSecretKey,
        account,
        meJid: readMeJid(),
        meLid: readMeLid(),
        meDisplayName: readMeDisplayName(),
        platform: 'web',
      },
      preKeys,
      identities,
      sessions,
      senderKeys,
      privacyTokens: [],
      contacts: [],
    }
  }

  window.__waWebSessionDump = async function () {
    return dumpSession()
  }
})()
