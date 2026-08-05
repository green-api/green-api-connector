import { useEffect } from 'react';
import { InstanceForm } from './InstanceForm';
import { CONNECTOR_SOURCE } from '../shared/config';

function cancelOnClose() {
  const messageEvent = new MessageEvent('message', {
    data: { target: CONNECTOR_SOURCE, type: 'CANCEL_IMPORT' },
    source: window,
  });
  window.dispatchEvent(messageEvent);
}

export function App() {
  useEffect(() => {
    window.addEventListener('pagehide', cancelOnClose)
    return () => window.removeEventListener('pagehide', cancelOnClose)
  })

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
        {chrome.i18n.getMessage('extName')}
      </h3>
      
      <p style={{ margin: '0 0 12px 0', color: 'var(--secondary-color)', whiteSpace: 'pre-line' }}>
        {chrome.i18n.getMessage('instanceAuthFormDesc')}
      </p>
      
      <InstanceForm />
    </div>
  )
}
