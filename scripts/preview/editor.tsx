// White label brand editor panel (shown next to the preview when served by scripts/brand-editor.mjs).
// Edits are applied to the preview live. The main button walks through the steps:
//   dependencies (already installed when this page loads) -> "Save" (writes branding/) -> "Build extension"
//   -> "Open extension folder". After the build the form is read-only; closing the tab stops the editor process.

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import Icon from '@mdi/react'
import {
  mdiImagePlusOutline, mdiAlertOutline, mdiCheckCircle, mdiContentSaveOutline, mdiRestore,
  mdiPackageVariantClosed, mdiLoading, mdiCircleOutline, mdiFolderOpenOutline, mdiContentCopy, mdiCheck,
} from '@mdi/js'
import type { EditorConfig } from './config'

export interface Brand {
  name: Record<string, string>
  description: Record<string, string>
  colors: { primary: string; primaryDark: string }
  icons: Record<string, string>
}

const ICON_SIZES = [16, 32, 48, 128]
const BUILD_STEPS = ['build', 'testBuild', 'pages', 'zip'] as const
// Lets the editor process know the page is still open (it exits when the tab is closed).
const HEARTBEAT_MS = 5000
const COPIED_MS = 2000

const TEXT = {
  en: {
    title: 'Your brand',
    intro: 'Change the logo, name, description and colors - the preview updates instantly. Then press Save and Build extension.',
    logo: 'Logo',
    logoHint: 'Square PNG or SVG, 512×512 recommended, transparent background. Icons 16/32/48/128 are made from it automatically.',
    upload: 'Choose image',
    drop: 'or drop it here',
    notSquare: 'The image is not square - it is fitted with transparent margins.',
    small: 'The image is smaller than 128×128 - the icon may look blurry.',
    badImage: 'Could not read this image. Use PNG, JPG or SVG.',
    name: 'Extension name',
    description: 'Description',
    example: 'Example',
    colors: 'Colors',
    primary: 'Primary color',
    primaryHint: 'Headings, buttons, focus borders. Button text is white.',
    separateDark: 'Different color for dark theme',
    dark: 'Dark theme color',
    lowContrast: 'Low contrast with the white button text',
    pickDarker: 'pick a darker shade.',
    reset: 'Reset',
    stepDeps: 'Dependencies installed',
    stepSave: 'Brand saved',
    stepBuild: 'Extension built',
    save: 'Save',
    saving: 'Saving…',
    build: 'Build extension',
    building: 'Building…',
    b_build: 'Extension',
    b_testBuild: 'Test build',
    b_pages: 'Presentation and test page',
    b_zip: 'ZIP for stores',
    done: 'Done! 2 versions are available - for Chrome (chrome/) and for Firefox (firefox/). Release folder:',
    copy: 'Click to copy the path',
    copied: 'Copied',
    openFolder: 'Open extension folder',
    openError: 'Could not open the folder - copy the path and open it yourself.',
    doneHint: 'The editor is read-only now. To continue with the AI agent, close this tab.',
    saveError: 'Could not save',
    buildError: 'Build failed',
    offline: 'The editor is not running any more - ask the AI agent to start it again.',
    fix: 'Fix the highlighted fields first.',
    stillDefault: 'The name or the logo is still GREEN-API. Save anyway?',
    required: 'Required',
    tooLong: 'Too long',
  },
  ru: {
    title: 'Ваш бренд',
    intro: 'Поменяйте логотип, название, описание и цвета - предпросмотр обновляется сразу. Затем нажмите «Сохранить» и «Собрать расширение».',
    logo: 'Логотип',
    logoHint: 'Квадратный PNG или SVG, лучше 512×512, прозрачный фон. Иконки 16/32/48/128 сделаются из него автоматически.',
    upload: 'Выбрать картинку',
    drop: 'или перетащите сюда',
    notSquare: 'Картинка не квадратная - она вписана с прозрачными полями.',
    small: 'Картинка меньше 128×128 - иконка может быть размытой.',
    badImage: 'Не удалось прочитать картинку. Используйте PNG, JPG или SVG.',
    name: 'Название расширения',
    description: 'Описание',
    example: 'Пример',
    colors: 'Цвета',
    primary: 'Основной цвет',
    primaryHint: 'Заголовки, кнопки, рамки полей. Текст на кнопках белый.',
    separateDark: 'Другой цвет для тёмной темы',
    dark: 'Цвет для тёмной темы',
    lowContrast: 'Слабый контраст с белым текстом кнопки',
    pickDarker: 'выберите оттенок темнее.',
    reset: 'Сбросить',
    stepDeps: 'Зависимости установлены',
    stepSave: 'Бренд сохранён',
    stepBuild: 'Расширение собрано',
    save: 'Сохранить',
    saving: 'Сохранение…',
    build: 'Собрать расширение',
    building: 'Сборка…',
    b_build: 'Расширение',
    b_testBuild: 'Тестовая сборка',
    b_pages: 'Презентация и тестовая страница',
    b_zip: 'ZIP для магазинов',
    done: 'Готово! Доступны 2 версии - для Chrome (chrome/) и для Firefox (firefox/). Папка с релизом:',
    copy: 'Нажмите, чтобы скопировать путь',
    copied: 'Скопировано',
    openFolder: 'Открыть папку с расширением',
    openError: 'Не удалось открыть папку - скопируйте путь и откройте её вручную.',
    doneHint: 'Редактирование больше недоступно. Чтобы продолжить с ИИ-агентом, закройте эту вкладку.',
    saveError: 'Не удалось сохранить',
    buildError: 'Сборка не удалась',
    offline: 'Редактор уже не запущен - попросите ИИ-агента запустить его снова.',
    fix: 'Сначала исправьте отмеченные поля.',
    stillDefault: 'Название или логотип всё ещё GREEN-API. Всё равно сохранить?',
    required: 'Обязательно',
    tooLong: 'Слишком длинно',
  },
}

// --- helpers -------------------------------------------------------------------------------------------------

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // clipboard API unavailable (insecure context, permissions) - fall back to a hidden textarea
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

// Contrast ratio of a color against white (the button text color).
function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05)
}

const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v)

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')) }
    img.src = url
  })
}

// Fits the image into a size×size transparent square; downscales in steps for a sharper small icon.
function renderIcon(img: HTMLImageElement, size: number): string {
  const w = img.naturalWidth || 512
  const h = img.naturalHeight || 512
  const scale = Math.min(size / w, size / h)
  const targetW = Math.max(1, Math.round(w * scale))
  const targetH = Math.max(1, Math.round(h * scale))

  let source: CanvasImageSource = img
  let sw = w
  let sh = h
  while (sw / 2 >= targetW * 2 && sh / 2 >= targetH * 2) {
    const step = document.createElement('canvas')
    step.width = Math.round(sw / 2)
    step.height = Math.round(sh / 2)
    const sctx = step.getContext('2d')!
    sctx.imageSmoothingQuality = 'high'
    sctx.drawImage(source, 0, 0, step.width, step.height)
    source = step
    sw = step.width
    sh = step.height
  }

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, Math.round((size - targetW) / 2), Math.round((size - targetH) / 2), targetW, targetH)
  return canvas.toDataURL('image/png')
}

interface ServerStatus {
  build: { state: 'idle' | 'running' | 'done' | 'error'; step: string | null; dir: string | null; error: string | null }
}

// --- component -----------------------------------------------------------------------------------------------

interface Props {
  lang: string
  langs: string[]
  brand: Brand
  initial: Brand
  config: EditorConfig
  onChange: (brand: Brand) => void
}

type Action =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'building'; step: string | null }
  | { kind: 'done'; dir: string }
  | { kind: 'error'; message: string }

export function BrandEditor({ lang, langs, brand, initial, config, onChange }: Props) {
  const t = TEXT[(lang in TEXT ? lang : 'en') as keyof typeof TEXT]
  const [logoWarnings, setLogoWarnings] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const [separateDark, setSeparateDark] = useState(initial.colors.primaryDark !== initial.colors.primary)
  const [action, setAction] = useState<Action>({ kind: 'idle' })
  // JSON of the brand as last saved - the main button is "Build" only while the form still matches it
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [openError, setOpenError] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const snapshot = JSON.stringify(brand)
  const isSaved = savedSnapshot === snapshot
  const building = action.kind === 'building'
  const built = action.kind === 'done'
  const locked = action.kind === 'saving' || building || built

  const api = (url: string, init: RequestInit = {}) =>
    fetch(url, { ...init, headers: { 'Content-Type': 'application/json', 'X-Brand-Token': config.token } })

  const set = (patch: Partial<Brand>) => {
    onChange({ ...brand, ...patch })
    if (action.kind === 'error') setAction({ kind: 'idle' })
  }

  async function useLogo(file: File | undefined) {
    if (!file) return
    try {
      const img = await loadImage(file)
      const w = img.naturalWidth || 512
      const h = img.naturalHeight || 512
      const warnings: string[] = []
      if (w !== h) warnings.push(t.notSquare)
      if (Math.min(w, h) < 128) warnings.push(t.small)
      setLogoWarnings(warnings)
      const icons: Record<string, string> = {}
      for (const size of ICON_SIZES) icons[size] = renderIcon(img, size)
      set({ icons })
    } catch {
      setLogoWarnings([t.badImage])
    }
  }

  const fieldError = (value: string, max: number) => (!value.trim() ? t.required : value.length > max ? t.tooLong : null)
  const errors = langs.flatMap((l) => [
    fieldError(brand.name[l] ?? '', config.nameMax),
    fieldError(brand.description[l] ?? '', config.descriptionMax),
  ]).filter(Boolean).length
    + (isHex(brand.colors.primary) ? 0 : 1) + (isHex(brand.colors.primaryDark) ? 0 : 1)

  const setPrimary = (value: string) => set({
    colors: { primary: value, primaryDark: separateDark ? brand.colors.primaryDark : value },
  })

  async function onSave() {
    if (errors) { setAction({ kind: 'error', message: t.fix }); return }
    const isDefaultBrand = langs.some((l) => /green-?api/i.test(initial.name[l] ?? ''))
    const nameUnchanged = langs.some((l) => brand.name[l] === initial.name[l])
    const logoUnchanged = ICON_SIZES.every((s) => brand.icons[s] === initial.icons[s])
    if (isDefaultBrand && (nameUnchanged || logoUnchanged) && !window.confirm(t.stillDefault)) return

    setAction({ kind: 'saving' })
    const payload = {
      schema: 1,
      name: Object.fromEntries(langs.map((l) => [l, brand.name[l].trim()])),
      description: Object.fromEntries(langs.map((l) => [l, brand.description[l].trim()])),
      colors: { primary: brand.colors.primary.toLowerCase(), primaryDark: brand.colors.primaryDark.toLowerCase() },
      icons: brand.icons,
    }
    try {
      const res = await api(config.api.save, { method: 'POST', body: JSON.stringify(payload) })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.ok) {
        setSavedSnapshot(snapshot)
        setAction({ kind: 'idle' })
      } else {
        setAction({ kind: 'error', message: `${t.saveError}: ${(body.errors ?? [res.statusText]).join('; ')}` })
      }
    } catch {
      setAction({ kind: 'error', message: t.offline })
    }
  }

  async function onBuild() {
    setAction({ kind: 'building', step: null })
    try {
      const res = await api(config.api.build, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.ok) setAction({ kind: 'error', message: `${t.buildError}: ${(body.errors ?? [res.statusText]).join('; ')}` })
    } catch {
      setAction({ kind: 'error', message: t.offline })
    }
  }

  // Heartbeat + "tab closed" beacon: the editor process waits for the tab to close (the AI agent waits for the process).
  useEffect(() => {
    const ping = setInterval(() => { void api(config.api.status).catch(() => undefined) }, HEARTBEAT_MS)
    const closed = () => { navigator.sendBeacon(`${config.api.closed}?token=${encodeURIComponent(config.token)}`) }
    window.addEventListener('pagehide', closed)
    return () => { clearInterval(ping); window.removeEventListener('pagehide', closed) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onCopyPath(dir: string) {
    if (!(await copyText(dir))) return
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_MS)
  }

  async function onOpenFolder() {
    setOpenError(false)
    try {
      const res = await api(config.api.openFolder, { method: 'POST' })
      if (!res.ok) setOpenError(true)
    } catch {
      setOpenError(true)
    }
  }

  // Poll the server while the release is being built.
  useEffect(() => {
    if (!building) return undefined
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      try {
        const res = await api(config.api.status)
        const s = (await res.json()) as ServerStatus
        if (stopped) return
        if (s.build.state === 'done' && s.build.dir) { setAction({ kind: 'done', dir: s.build.dir }); return }
        if (s.build.state === 'error') { setAction({ kind: 'error', message: `${t.buildError}: ${s.build.error ?? ''}` }); return }
        setAction({ kind: 'building', step: s.build.step })
      } catch {
        if (!stopped) setAction({ kind: 'error', message: t.offline })
        return
      }
      timer = setTimeout(tick, 700)
    }
    timer = setTimeout(tick, 400)
    return () => { stopped = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building])

  const contrast = contrastWithWhite(isHex(brand.colors.primary) ? brand.colors.primary : '#000000')
  const darkContrast = contrastWithWhite(isHex(brand.colors.primaryDark) ? brand.colors.primaryDark : '#000000')

  const stepIcon = (done: boolean, active: boolean) => (
    <Icon path={done ? mdiCheckCircle : active ? mdiLoading : mdiCircleOutline} size={0.7} spin={!done && active} />
  )
  const currentStep = building && action.step ? BUILD_STEPS.indexOf(action.step as typeof BUILD_STEPS[number]) : -1

  return (
    <aside className="pv-editor">
      <div className="pv-editor-scroll">
        <h2>{t.title}</h2>
        <p className="pv-desc">{t.intro}</p>

        <fieldset className="pv-field" disabled={locked}>
          <legend>{t.logo}</legend>
          <div
            className={`pv-drop${dragging ? ' pv-drop-active' : ''}`}
            onDragOver={(e: DragEvent) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e: DragEvent) => { e.preventDefault(); setDragging(false); void useLogo(e.dataTransfer.files[0]) }}
          >
            <div className="pv-drop-icons">
              {ICON_SIZES.slice().reverse().map((s) => (
                <img key={s} src={brand.icons[s]} width={Math.min(s, 64)} height={Math.min(s, 64)} alt={`${s}px`} title={`${s}×${s}`} />
              ))}
            </div>
            <button type="button" className="pv-btn" onClick={() => fileInput.current?.click()}>
              <Icon path={mdiImagePlusOutline} size={0.75} /> {t.upload}
            </button>
            <span className="pv-hint">{t.drop}</span>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              hidden
              onChange={(e: ChangeEvent<HTMLInputElement>) => { void useLogo(e.target.files?.[0]); e.target.value = '' }}
            />
          </div>
          <p className="pv-hint">{t.logoHint}</p>
          {logoWarnings.map((w) => <p key={w} className="pv-warn"><Icon path={mdiAlertOutline} size={0.6} /> {w}</p>)}
        </fieldset>

        <fieldset className="pv-field" disabled={locked}>
          <legend>{t.name}</legend>
          {langs.map((l) => {
            const value = brand.name[l] ?? ''
            const error = fieldError(value, config.nameMax)
            return (
              <label key={l} className="pv-input-row">
                <span className="pv-input-lang">{l.toUpperCase()}</span>
                <input className={error ? 'pv-invalid' : ''} value={value} placeholder={initial.name[l]}
                  onChange={(e) => set({ name: { ...brand.name, [l]: e.target.value } })} />
                <span className={`pv-count${value.length > config.nameMax ? ' pv-count-over' : ''}`}>{value.length}/{config.nameMax}</span>
              </label>
            )
          })}
          <p className="pv-hint">{t.example}: {initial.name[lang] ?? initial.name[langs[0]]}</p>
        </fieldset>

        <fieldset className="pv-field" disabled={locked}>
          <legend>{t.description}</legend>
          {langs.map((l) => {
            const value = brand.description[l] ?? ''
            const error = fieldError(value, config.descriptionMax)
            return (
              <label key={l} className="pv-input-row pv-input-row-top">
                <span className="pv-input-lang">{l.toUpperCase()}</span>
                <textarea rows={3} className={error ? 'pv-invalid' : ''} value={value} placeholder={initial.description[l]}
                  onChange={(e) => set({ description: { ...brand.description, [l]: e.target.value } })} />
                <span className={`pv-count${value.length > config.descriptionMax ? ' pv-count-over' : ''}`}>{value.length}/{config.descriptionMax}</span>
              </label>
            )
          })}
          <p className="pv-hint">{t.example}: {initial.description[lang] ?? initial.description[langs[0]]}</p>
        </fieldset>

        <fieldset className="pv-field" disabled={locked}>
          <legend>{t.colors}</legend>
          <label className="pv-color-row">
            <input type="color" value={isHex(brand.colors.primary) ? brand.colors.primary : '#000000'} onChange={(e) => setPrimary(e.target.value)} />
            <span>{t.primary}</span>
            <input className={`pv-hex${isHex(brand.colors.primary) ? '' : ' pv-invalid'}`} value={brand.colors.primary} maxLength={7}
              onChange={(e) => setPrimary(e.target.value)} />
          </label>
          <p className="pv-hint">{t.primaryHint}</p>
          {contrast < 3 && <p className="pv-warn"><Icon path={mdiAlertOutline} size={0.6} /> {t.lowContrast} ({contrast.toFixed(1)}:1) - {t.pickDarker}</p>}

          <label className="pv-check">
            <input type="checkbox" checked={separateDark} onChange={(e) => {
              setSeparateDark(e.target.checked)
              if (!e.target.checked) set({ colors: { ...brand.colors, primaryDark: brand.colors.primary } })
            }} />
            {t.separateDark}
          </label>
          {separateDark && (
            <>
              <label className="pv-color-row">
                <input type="color" value={isHex(brand.colors.primaryDark) ? brand.colors.primaryDark : '#000000'}
                  onChange={(e) => set({ colors: { ...brand.colors, primaryDark: e.target.value } })} />
                <span>{t.dark}</span>
                <input className={`pv-hex${isHex(brand.colors.primaryDark) ? '' : ' pv-invalid'}`} value={brand.colors.primaryDark} maxLength={7}
                  onChange={(e) => set({ colors: { ...brand.colors, primaryDark: e.target.value } })} />
              </label>
              {darkContrast < 3 && <p className="pv-warn"><Icon path={mdiAlertOutline} size={0.6} /> {t.lowContrast} ({darkContrast.toFixed(1)}:1)</p>}
            </>
          )}
        </fieldset>
      </div>

      <div className="pv-editor-footer">
        <ol className="pv-progress">
          <li className="pv-progress-done">{stepIcon(true, false)} {t.stepDeps}</li>
          <li className={isSaved ? 'pv-progress-done' : ''}>{stepIcon(isSaved, action.kind === 'saving')} {t.stepSave}</li>
          <li className={built ? 'pv-progress-done' : ''}>{stepIcon(built, building)} {t.stepBuild}</li>
          {building && BUILD_STEPS.map((key, i) => (
            <li key={key} className={`pv-progress-sub${i < currentStep ? ' pv-progress-done' : ''}`}>
              {stepIcon(i < currentStep, i === currentStep)} {t[`b_${key}`]}
            </li>
          ))}
        </ol>

        {built && (
          <div className="pv-ok">
            <Icon path={mdiCheckCircle} size={0.7} />
            <div>
              {t.done}
              <button type="button" className="pv-path" title={t.copy} onClick={() => void onCopyPath(action.dir)}>
                <code>{action.dir}</code>
                <span className={`pv-path-copy${copied ? ' pv-path-copied' : ''}`}>
                  <Icon path={copied ? mdiCheck : mdiContentCopy} size={0.6} />
                  {copied && t.copied}
                </span>
              </button>
              <span className="pv-hint">{t.doneHint}</span>
            </div>
          </div>
        )}
        {built && openError && <p className="pv-warn"><Icon path={mdiAlertOutline} size={0.6} /> {t.openError}</p>}
        {action.kind === 'error' && <p className="pv-warn"><Icon path={mdiAlertOutline} size={0.6} /> {action.message}</p>}

        <div className="pv-editor-actions">
          <button type="button" className="pv-btn" disabled={locked}
            onClick={() => { setLogoWarnings([]); setAction({ kind: 'idle' }); onChange(initial) }}>
            <Icon path={mdiRestore} size={0.75} /> {t.reset}
          </button>
          {built ? (
            <button type="button" className="pv-btn pv-btn-primary" onClick={() => void onOpenFolder()}>
              <Icon path={mdiFolderOpenOutline} size={0.75} /> {t.openFolder}
            </button>
          ) : isSaved ? (
            <button type="button" className="pv-btn pv-btn-primary" disabled={locked} onClick={() => void onBuild()}>
              <Icon path={mdiPackageVariantClosed} size={0.75} /> {building ? t.building : t.build}
            </button>
          ) : (
            <button type="button" className="pv-btn pv-btn-primary" disabled={locked} onClick={() => void onSave()}>
              <Icon path={mdiContentSaveOutline} size={0.75} /> {action.kind === 'saving' ? t.saving : t.save}
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
