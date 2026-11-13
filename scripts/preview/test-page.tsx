// Test page (release/<name>/test/test-page.html): talks to a DEV_MODE build of the extension via postMessage,
// exactly like the client's web app would. Same look as the preview / brand editor.

import { useEffect, useRef, useState } from 'react'
import Icon from '@mdi/react'
import { mdiAlertOutline, mdiLanConnect, mdiLoginVariant, mdiRefresh, mdiAccountCheckOutline, mdiClose } from '@mdi/js'
import { applyColors, config, initialLang, langs, rememberLang } from './config'

const API_URL = 'https://api.green-api.com'

const TEXT = {
  en: {
    title: 'Test page',
    subtitle: 'Extension test page',
    messenger: 'Messenger',
    preview: 'Extension preview',
    statusWaiting: 'Waiting for the extension… If this does not change, make sure the TEST build is installed and enabled (test/chrome or test/firefox). In Chrome also turn on "Allow access to file URLs" on its Details page.',
    statusReady: 'Extension is connected and ready.',
    statusSent: 'Authorization data was sent to the instance.',
    statusExisting: 'You are already logged in to the web version. Choose an action in step 3.',
    statusError: 'Error',
    statusNoUrl: 'Fill in idInstance and apiTokenInstance, or the endpoint URL.',
    stepCheck: 'Check the extension',
    stepCheckDesc: 'The page pings the extension automatically on load. Press the button to check again.',
    ping: 'Check connection',
    stepImport: 'Authorize an instance',
    stepImportDesc: 'Enter the credentials of a test instance. The token stays on this page and is masked in the log.',
    or: 'or',
    endpoint: 'Full endpoint URL',
    endpointHint: 'Used only if idInstance and apiTokenInstance are empty.',
    start: 'Start authorization',
    stepExisting: 'If a session already exists',
    stepExistingDesc: 'If you are already logged in to the web version, the extension asks what to do.',
    clear: 'Log in again',
    clearHint: 'Clear the session and authorize from scratch',
    keep: 'Keep session',
    keepHint: 'Use the current logged-in session',
    cancel: 'Cancel',
    cancelHint: 'Stop and close the messenger window',
    log: 'Event log',
    clearLog: 'Clear',
    logEmpty: 'No events yet',
    footer: 'The test build trusts local pages (file://, localhost). Do not publish or distribute it - publish only chrome/ / firefox/ from the release folder.',
  },
  ru: {
    title: 'Тестовая страница',
    subtitle: 'Тестовая страница расширения',
    messenger: 'Мессенджер',
    preview: 'Предпросмотр расширения',
    statusWaiting: 'Ожидание расширения… Если статус не меняется, проверьте, что установлена и включена ТЕСТОВАЯ сборка (test/chrome или test/firefox). В Chrome также включите «Разрешить доступ к URL файлов» в «Подробнее».',
    statusReady: 'Расширение подключено и готово к работе.',
    statusSent: 'Данные авторизации отправлены в инстанс.',
    statusExisting: 'Вы уже авторизованы в веб-версии. Выберите действие в шаге 3.',
    statusError: 'Ошибка',
    statusNoUrl: 'Заполните idInstance и apiTokenInstance или URL endpoint.',
    stepCheck: 'Проверка расширения',
    stepCheckDesc: 'Страница проверяет расширение автоматически при загрузке. Нажмите кнопку, чтобы проверить ещё раз.',
    ping: 'Проверить подключение',
    stepImport: 'Авторизация инстанса',
    stepImportDesc: 'Введите данные тестового инстанса. Токен остаётся на этой странице и скрыт в журнале.',
    or: 'или',
    endpoint: 'Полный URL endpoint',
    endpointHint: 'Используется, только если idInstance и apiTokenInstance не заполнены.',
    start: 'Начать авторизацию',
    stepExisting: 'Если сессия уже существует',
    stepExistingDesc: 'Если вы уже вошли в веб-версию, расширение спросит, что делать.',
    clear: 'Войти заново',
    clearHint: 'Очистить сессию и авторизоваться с нуля',
    keep: 'Оставить сессию',
    keepHint: 'Использовать текущую сессию',
    cancel: 'Отменить',
    cancelHint: 'Прервать и закрыть окно мессенджера',
    log: 'Журнал событий',
    clearLog: 'Очистить',
    logEmpty: 'Событий пока нет',
    footer: 'Тестовая сборка доверяет локальным страницам (file://, localhost). Не публикуйте и не распространяйте её - публикуйте только chrome/ / firefox/ из папки релиза.',
  },
}
type Text = typeof TEXT.en
type StatusKey = 'statusWaiting' | 'statusReady' | 'statusSent' | 'statusExisting' | 'statusError' | 'statusNoUrl'

interface LogRow { id: number; dir: 'out' | 'in'; time: string; text: string }

// Never show the instance token in the log.
function mask(payload: Record<string, unknown>): string {
  const copy = { ...payload }
  if (typeof copy.url === 'string') copy.url = copy.url.replace(/(setAuthCreds\/)[^/?#]+/, '$1***')
  return JSON.stringify(copy)
}

export function TestPage() {
  const [lang, setLang] = useState(initialLang)
  const t: Text = TEXT[(lang in TEXT ? lang : 'en') as keyof typeof TEXT]
  const [status, setStatus] = useState<{ key: StatusKey; kind: '' | 'ok' | 'err' | 'info'; suffix: string }>({ key: 'statusWaiting', kind: '', suffix: '' })
  const [idInstance, setIdInstance] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [log, setLog] = useState<LogRow[]>([])
  const logRef = useRef<HTMLDivElement>(null)
  const rowId = useRef(0)

  const name = config.locales[lang]?.extName?.message ?? ''

  useEffect(() => applyColors(config.colors), [])
  useEffect(() => {
    document.documentElement.lang = lang
    document.title = `${name} - ${t.title}`
  }, [lang, name, t.title])
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }) }, [log])

  const addLog = (dir: LogRow['dir'], text: string) => {
    rowId.current += 1
    const row = { id: rowId.current, dir, time: new Date().toLocaleTimeString(), text }
    setLog((rows) => [...rows, row])
  }

  const send = (type: string, extra: Record<string, unknown> = {}) => {
    const payload = { target: config.connectorSource, type, ...extra }
    window.postMessage(payload, '*')
    addLog('out', mask(payload))
  }

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown> | null
      if (event.source !== window || !data || data.source !== config.connectorSource) return
      addLog('in', JSON.stringify(data))
      switch (data.type) {
        case 'CONNECTOR_READY': setStatus({ key: 'statusReady', kind: 'ok', suffix: '' }); break
        case 'IMPORT_SENT': setStatus({ key: 'statusSent', kind: 'ok', suffix: '' }); break
        case 'EXISTING_SESSION': setStatus({ key: 'statusExisting', kind: 'info', suffix: '' }); break
        case 'IMPORT_ERROR':
          setStatus({ key: 'statusError', kind: 'err', suffix: `: ${String(data.reason)}${data.httpStatus ? ` (HTTP ${String(data.httpStatus)})` : ''}` })
          break
        default:
      }
    }
    window.addEventListener('message', onMessage)
    // The extension announces itself on load; ask once more in case that was missed.
    const timer = setTimeout(() => send('PING'), 500)
    return () => { window.removeEventListener('message', onMessage); clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = () => {
    const url = idInstance.trim() && apiToken.trim()
      ? `${API_URL}/waInstance${idInstance.trim()}/setAuthCreds/${apiToken.trim()}`
      : endpoint.trim()
    if (!url) { setStatus({ key: 'statusNoUrl', kind: 'err', suffix: '' }); return }
    send('START_IMPORT', { url })
  }

  const chooseLang = (next: string) => { rememberLang(next); setLang(next) }

  return (
    <div className="pv-layout">
      <div className="pv-page">
        <header className="pv-header">
          <img className="pv-header-icon" src={config.icons[48]} alt="" />
          <div className="pv-header-text">
            <h1>{name}</h1>
            <div className="pv-meta">
              <span>{t.subtitle}</span>
              {config.messenger && <span>{t.messenger}: <b>{config.messenger}</b></span>}
              {config.version && <span>v{config.version}</span>}
            </div>
          </div>
          <div className="pv-header-side">
            {langs.length > 1 && (
              <div className="pv-lang" role="group" aria-label="Language">
                {langs.map((l) => (
                  <button key={l} type="button" aria-pressed={l === lang} onClick={() => chooseLang(l)}>{l.toUpperCase()}</button>
                ))}
              </div>
            )}
            {config.previewHref && <a className="pv-link" href={`${config.previewHref}?lang=${lang}`}>{t.preview} →</a>}
          </div>
        </header>

        <div className={`pv-status${status.kind ? ` pv-status-${status.kind}` : ''}`}>
          <span className="pv-dot" />
          <span>{t[status.key]}{status.suffix}</span>
        </div>

        <ol className="pv-steps">
          <li className="pv-step">
            <div className="pv-step-marker"><span>1</span></div>
            <div className="pv-step-content">
              <h2>{t.stepCheck}</h2>
              <p className="pv-desc">{t.stepCheckDesc}</p>
              <button type="button" className="pv-btn" onClick={() => send('PING')}>
                <Icon path={mdiLanConnect} size={0.75} /> {t.ping} <code className="pv-code">PING</code>
              </button>
            </div>
          </li>

          <li className="pv-step">
            <div className="pv-step-marker"><span>2</span></div>
            <div className="pv-step-content">
              <h2>{t.stepImport}</h2>
              <p className="pv-desc">{t.stepImportDesc}</p>
              <div className="pv-card pv-form">
                <div className="pv-grid-2">
                  <label className="pv-label">idInstance
                    <input className="pv-input" inputMode="numeric" autoComplete="off" placeholder="1101000001"
                      value={idInstance} onChange={(e) => setIdInstance(e.target.value)} />
                  </label>
                  <label className="pv-label">apiTokenInstance
                    <input className="pv-input" type="password" autoComplete="off" placeholder="••••••••••••"
                      value={apiToken} onChange={(e) => setApiToken(e.target.value)} />
                  </label>
                </div>
                <div className="pv-divider">{t.or}</div>
                <label className="pv-label">{t.endpoint}
                  <input className="pv-input pv-mono" placeholder={`${API_URL}/waInstance{idInstance}/setAuthCreds/{apiTokenInstance}`}
                    value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
                </label>
                <p className="pv-hint">{t.endpointHint}</p>
                <button type="button" className="pv-btn pv-btn-primary pv-btn-wide" onClick={start}>
                  <Icon path={mdiLoginVariant} size={0.75} /> {t.start} <code className="pv-code">START_IMPORT</code>
                </button>
              </div>
            </div>
          </li>

          <li className="pv-step">
            <div className="pv-step-marker"><span>3</span></div>
            <div className="pv-step-content">
              <h2>{t.stepExisting}</h2>
              <p className="pv-desc">{t.stepExistingDesc}</p>
              <div className="pv-choices">
                <button type="button" className="pv-choice" onClick={() => send('CLEAR_AND_CONTINUE')}>
                  <b><Icon path={mdiRefresh} size={0.7} /> {t.clear}</b><small>{t.clearHint}</small><code className="pv-code">CLEAR_AND_CONTINUE</code>
                </button>
                <button type="button" className="pv-choice" onClick={() => send('KEEP_AND_CONTINUE')}>
                  <b><Icon path={mdiAccountCheckOutline} size={0.7} /> {t.keep}</b><small>{t.keepHint}</small><code className="pv-code">KEEP_AND_CONTINUE</code>
                </button>
                <button type="button" className="pv-choice pv-choice-danger" onClick={() => send('CANCEL_IMPORT')}>
                  <b><Icon path={mdiClose} size={0.7} /> {t.cancel}</b><small>{t.cancelHint}</small><code className="pv-code">CANCEL_IMPORT</code>
                </button>
              </div>
            </div>
          </li>
        </ol>

        <section className="pv-log-card">
          <div className="pv-log-head">
            <span>{t.log}</span>
            <button type="button" className="pv-link-btn" onClick={() => setLog([])}>{t.clearLog}</button>
          </div>
          <div className="pv-log" ref={logRef}>
            {log.length === 0 && <div className="pv-log-empty">{t.logEmpty}</div>}
            {log.map((row) => (
              <div key={row.id} className="pv-log-row">
                <span className="pv-log-time">{row.time}</span>
                <span className={`pv-log-dir pv-log-${row.dir}`}>{row.dir === 'out' ? '→' : '←'}</span>
                <span className="pv-log-msg">{row.text}</span>
              </div>
            ))}
          </div>
        </section>

        <p className="pv-note"><Icon path={mdiAlertOutline} size={0.6} /> {t.footer}</p>
      </div>
    </div>
  )
}
