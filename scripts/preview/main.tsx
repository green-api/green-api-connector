// Pages built from one bundle (scripts/lib/kit.mjs -> bundlePages):
//   preview - presentation: the REAL popup and popout components (src/popup, src/popout) with the real theme.css and
//             locale messages inside mock browser chrome ('webextension-polyfill' is aliased to ./browser-mock.ts)
//   editor  - the same preview + the brand form (./editor.tsx), served by scripts/brand-editor.mjs
//   test    - test page that talks to a DEV_MODE build of the extension (./test-page.tsx)

import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Icon from '@mdi/react'
import { mdiPuzzleOutline, mdiDotsVertical, mdiMinus, mdiCropSquare, mdiClose, mdiInformationOutline, mdiAlertOutline } from '@mdi/js'
import '../../src/shared/theme.css'
import './preview.css'
import { App as PopupApp } from '../../src/popup/App'
import { App as PopoutApp } from '../../src/popout/App'
import type { ImportEvent } from '../../src/packages/types'
import { emitToExtensionPage, onSendMessage, setMessages, type Messages } from './browser-mock'
import { BrandEditor, type Brand } from './editor'
import { TestPage } from './test-page'
import { applyColors, config, initialLang, langs, rememberLang } from './config'

const UI = {
  en: {
    title: 'Extension preview',
    subtitle: 'How the extension will look in the browser',
    messenger: 'Messenger',
    testPage: 'Open the test page',
    iconIssues: 'Problems with the icon files in public/icons (each must be a PNG of the exact size):',
    listTitle: 'Installed extension',
    listDesc: 'After installation the extension appears in the browser extension list (and in the store) with this icon, name and description.',
    toolbarTitle: 'Toolbar button and menu',
    toolbarDesc: 'The user clicks the extension icon in the browser toolbar - this menu opens.',
    popoutTitle: 'Authorization window',
    popoutDesc: 'The "Authorize instance" button opens this window. Switch states to see every message the user can get.',
    details: 'Details',
    remove: 'Remove',
    states: 'Window state',
    started: 'In the real extension the messenger window opens here and the authorization starts.',
    note: 'Drawn from the real extension components. Fonts and window frames may differ slightly between browsers and operating systems. Dark mode follows your system settings.',
    s_initial: 'Initial',
    s_sent: 'Success',
    s_existing: 'Already logged in',
    s_hasCreds: 'Instance has other data (409)',
    s_failed: 'Error',
    s_inProgress: 'Already in progress',
  },
  ru: {
    title: 'Предпросмотр расширения',
    subtitle: 'Как расширение будет выглядеть в браузере',
    messenger: 'Мессенджер',
    testPage: 'Открыть тестовую страницу',
    iconIssues: 'Проблемы с файлами иконок в public/icons (каждая должна быть PNG точного размера):',
    listTitle: 'Установленное расширение',
    listDesc: 'После установки, расширение появляется в списке расширений браузера с этой иконкой, названием и описанием.',
    toolbarTitle: 'Кнопка на панели и меню',
    toolbarDesc: 'Пользователь нажимает на иконку расширения на панели браузера — открывается это меню.',
    popoutTitle: 'Окно авторизации',
    popoutDesc: 'Кнопка «Авторизовать инстанс» открывает это окно. Переключайте состояния, чтобы увидеть все сообщения, которые может получить пользователь.',
    details: 'Подробнее',
    remove: 'Удалить',
    states: 'Состояние окна',
    started: 'В настоящем расширении здесь откроется окно мессенджера и начнётся авторизация.',
    note: 'Нарисовано из настоящих компонентов расширения. Шрифты и рамки окон могут немного отличаться в разных браузерах и ОС. Тёмная тема — по настройкам системы.',
    s_initial: 'Начальное',
    s_sent: 'Успех',
    s_existing: 'Уже авторизован',
    s_hasCreds: 'У инстанса другие данные (409)',
    s_failed: 'Ошибка',
    s_inProgress: 'Уже выполняется',
  },
}
type UiLang = keyof typeof UI
type UiText = typeof UI.en

const SCENARIOS: { id: 'initial' | 'sent' | 'existing' | 'hasCreds' | 'failed' | 'inProgress'; event?: ImportEvent }[] = [
  { id: 'initial' },
  { id: 'sent', event: { type: 'IMPORT_SENT', name: null, number: null } },
  { id: 'existing', event: { type: 'EXISTING_SESSION', number: '' } },
  { id: 'hasCreds', event: { type: 'IMPORT_ERROR', reason: 'http_error', httpStatus: 409 } },
  { id: 'failed', event: { type: 'IMPORT_ERROR', reason: 'timeout' } },
  { id: 'inProgress', event: { type: 'IMPORT_ERROR', reason: 'import_already_in_progress' } },
]
type ScenarioId = (typeof SCENARIOS)[number]['id']

// The brand currently in the repo; the editor starts from it and "Reset" returns to it.
const initialBrand: Brand = {
  name: Object.fromEntries(langs.map((l) => [l, config.locales[l]?.extName?.message ?? ''])),
  description: Object.fromEntries(langs.map((l) => [l, config.locales[l]?.extDescription?.message ?? ''])),
  colors: config.colors,
  icons: config.icons,
}

// Locale messages with the (possibly edited) brand name/description on top.
function brandMessages(lang: string, brand: Brand): Messages {
  return {
    ...(config.locales[lang] ?? {}),
    extName: { message: brand.name[lang] ?? '' },
    extDescription: { message: brand.description[lang] ?? '' },
  }
}

// ?state=<id> opens the authorization window in that state (handy for screenshots).
function initialScenario(): ScenarioId {
  const fromUrl = new URLSearchParams(location.search).get('state')
  return SCENARIOS.find((s) => s.id === fromUrl)?.id ?? 'initial'
}

// The extension's own popup closes itself via window.close() - keep the preview page open.
window.close = () => {}

function PopoutWithState({ scenario }: { scenario: ScenarioId }) {
  // Runs after PopoutApp's own effects, so its runtime.onMessage listener is already registered.
  useEffect(() => {
    const event = SCENARIOS.find((s) => s.id === scenario)?.event
    if (event) emitToExtensionPage(event)
  }, [scenario])
  return <PopoutApp />
}

const TOAST_MS = 5000

function Toast({ text }: { text: string }) {
  return (
    <div className="pv-toast" role="status" style={{ animationDuration: `${TOAST_MS}ms` }}>
      <Icon path={mdiInformationOutline} size={0.75} /> {text}
    </div>
  )
}

// The browser's own "Please fill out this field" bubble follows the browser UI language, not the EN / RU switch
// of this page - replace it with the text in the selected language (the real extension uses the browser language
// for both, so they always match there).
const REQUIRED_FIELD: Record<string, string> = {
  en: 'Please fill out this field.',
  ru: 'Заполните это поле.',
}

function useRequiredFieldMessage(lang: string) {
  useEffect(() => {
    const message = REQUIRED_FIELD[lang] ?? REQUIRED_FIELD.en
    const onInvalid = (e: Event) => {
      const field = e.target as HTMLInputElement
      if (field.validity.valueMissing || (field.validity.customError && !field.value)) field.setCustomValidity(message)
    }
    const onInput = (e: Event) => { (e.target as HTMLInputElement).setCustomValidity?.('') }
    document.addEventListener('invalid', onInvalid, true)
    document.addEventListener('input', onInput, true)
    return () => {
      document.removeEventListener('invalid', onInvalid, true)
      document.removeEventListener('input', onInput, true)
    }
  }, [lang])
}

function Preview() {
  const [lang, setLang] = useState(initialLang)
  const [scenario, setScenario] = useState<ScenarioId>(initialScenario)
  const [nonce, setNonce] = useState(0)
  // Hint under the authorization window for TOAST_MS - only after "Link device" (the menu button just scrolls there).
  const [toast, setToast] = useState<{ key: 'started'; id: number } | null>(null)
  const [flash, setFlash] = useState(false)
  const [brand, setBrand] = useState<Brand>(initialBrand)

  const messages = brandMessages(lang, brand)
  setMessages(messages)
  const t = UI[(lang in UI ? lang : 'en') as UiLang]
  const name = messages.extName?.message ?? ''
  const description = messages.extDescription?.message ?? ''
  const icons = brand.icons
  const messengerLabel = config.messenger

  useEffect(() => applyColors(brand.colors), [brand.colors])
  useRequiredFieldMessage(lang)

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = `${name} - ${t.title}`
  }, [lang, name, t.title])

  useEffect(() => onSendMessage((message) => {
    const type = (message as { type?: string } | null)?.type
    if (type === 'OPEN_POPOUT') {
      // Like the real extension: the menu button leads to the authorization window (step 3).
      document.getElementById('popout-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setFlash(true)
      setTimeout(() => setFlash(false), 1600)
    } else if (type === 'START_IMPORT') {
      setToast({ key: 'started', id: Date.now() })
    }
  }), [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  const chooseLang = (next: string) => {
    rememberLang(next)
    setMessages(brandMessages(next, brand))
    setLang(next)
    setToast(null)
  }

  const chooseScenario = (next: ScenarioId) => {
    setScenario(next)
    setNonce((n) => n + 1)
    setToast(null)
  }

  return (
    <div className={config.editor ? 'pv-layout pv-layout-editor' : 'pv-layout'}>
    {config.editor && (
      <BrandEditor lang={lang} langs={langs} brand={brand} initial={initialBrand} config={config.editor} onChange={setBrand} />
    )}
    <div className="pv-page">
      <header className="pv-header">
        <img className="pv-header-icon" src={icons[48]} alt="" />
        <div className="pv-header-text">
          <h1>{name}</h1>
          <div className="pv-meta">
            <span>{t.subtitle}</span>
            {messengerLabel && <span>{t.messenger}: <b>{messengerLabel}</b></span>}
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
          {config.testPageHref && <a className="pv-link" href={`${config.testPageHref}?lang=${lang}`}>{t.testPage} →</a>}
        </div>
      </header>

      {config.iconIssues.length > 0 && icons === initialBrand.icons && (
        <div className="pv-notice pv-notice-warn">
          <Icon path={mdiAlertOutline} size={0.8} />
          <div>
            <b>{t.iconIssues}</b>
            <ul>{config.iconIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
          </div>
        </div>
      )}

      <ol className="pv-steps">
        <li className="pv-step">
          <div className="pv-step-marker"><span>1</span></div>
          <div className="pv-step-content">
            <h2>{t.listTitle}</h2>
            <p className="pv-desc">{t.listDesc}</p>
            <div className="pv-ext-card">
              <div className="pv-ext-main">
                <img src={icons[48]} alt="" />
                <div>
                  <div className="pv-ext-name">{name} <span>{config.version}</span></div>
                  <div className="pv-ext-desc">{description}</div>
                </div>
              </div>
              <div className="pv-ext-actions">
                <span>{t.details}</span>
                <span>{t.remove}</span>
                <span className="pv-toggle" />
              </div>
            </div>
          </div>
        </li>

        <li className="pv-step">
          <div className="pv-step-marker"><span>2</span></div>
          <div className="pv-step-content">
            <h2>{t.toolbarTitle}</h2>
            <p className="pv-desc">{t.toolbarDesc}</p>
            <div className="pv-browser">
              <div className="pv-toolbar">
                <div className="pv-omnibox">example.com</div>
                <span className="pv-tool pv-tool-active"><img src={icons[32]} alt="" /></span>
                <span className="pv-tool"><Icon path={mdiPuzzleOutline} size={0.8} /></span>
                <span className="pv-avatar" />
                <span className="pv-tool"><Icon path={mdiDotsVertical} size={0.8} /></span>
              </div>
              <div className="pv-viewport">
                <div className="pv-lines"><i /><i /><i /><i /><i /></div>
                <div className="pv-popup" key={lang}>
                  <div style={{ width: 320 }}>
                    <PopupApp />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </li>

        <li className="pv-step" id="popout-section">
          <div className="pv-step-marker"><span>3</span></div>
          <div className="pv-step-content">
            <h2>{t.popoutTitle}</h2>
            <p className="pv-desc">{t.popoutDesc}</p>
            <div className="pv-states">
              <span className="pv-states-label">{t.states}:</span>
              {SCENARIOS.map((s) => (
                <button key={s.id} type="button" aria-pressed={s.id === scenario} onClick={() => chooseScenario(s.id)}>
                  {t[`s_${s.id}` as keyof UiText]}
                </button>
              ))}
            </div>
            <div className={`pv-window${flash ? ' pv-flash' : ''}`}>
              <div className="pv-titlebar">
                <img src={icons[16]} alt="" />
                <span className="pv-titlebar-url">chrome-extension://…/popout.html</span>
                <span className="pv-titlebar-controls">
                  <Icon path={mdiMinus} size={0.6} /><Icon path={mdiCropSquare} size={0.55} /><Icon path={mdiClose} size={0.6} />
                </span>
              </div>
              <div className="pv-window-body">
                <PopoutWithState key={`${lang}-${scenario}-${nonce}`} scenario={scenario} />
              </div>
            </div>
            {toast && <Toast key={toast.id} text={t[toast.key]} />}
          </div>
        </li>
      </ol>

      <p className="pv-note">{t.note}</p>
    </div>
    </div>
  )
}

setMessages(brandMessages(initialLang(), initialBrand))
createRoot(document.getElementById('preview-root')!).render(config.page === 'test' ? <TestPage /> : <Preview />)
