import browser from 'webextension-polyfill';
import Icon from '@mdi/react';
import { mdiArrowTopRightBoldBoxOutline } from '@mdi/js';

export function App() {
  const extName = browser.i18n.getMessage('extName');
  const extDescription = browser.i18n.getMessage('extDescription');

  const openInstanceAuthPopup = async () => {
    await browser.runtime.sendMessage({ type: "OPEN_POPOUT" });
    window.close();
  };

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
        {extName}
      </h3>
      <p style={{ margin: '0 0 12px 0', color: 'var(--secondary-color)' }}>{extDescription}</p>
      <button 
        onClick={() => openInstanceAuthPopup()} 
        className="link-button" 
        style={{ 
          width: "100%"
        }}
      >
        {browser.i18n.getMessage('openInstanceAuthForm')}
        <Icon 
          path={mdiArrowTopRightBoldBoxOutline} 
          size={0.75} 
          style={{
            marginLeft: "5px"
          }}
        />
      </button>
    </div>
  )
}
