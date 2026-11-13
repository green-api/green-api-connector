import browser from 'webextension-polyfill';
import { InstanceForm } from './InstanceForm';

export function App() {
  return (
    <div
      style={{
        padding: 16,
        fontFamily: 'var(--font-family)',
        fontSize: 13,
        lineHeight: 1.5,
        background: 'var(--bg-color)',
        color: 'var(--text-color)',
      }}
    >
      <h3
        style={{
          margin: '0',
          color: 'var(--primary-color)',
        }}
      >
        {browser.i18n.getMessage('extName')}
      </h3>
      
      <p style={{ margin: '0 0 12px 0', color: 'var(--secondary-color)', whiteSpace: 'pre-line' }}>
        {browser.i18n.getMessage('instanceAuthFormDesc')}
      </p>
      
      <InstanceForm />
    </div>
  )
}
