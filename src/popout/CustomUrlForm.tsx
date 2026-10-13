import { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';
import Icon from '@mdi/react';
import { mdiLink } from '@mdi/js';
import { isImportEvent, type ImportEvent } from '../packages/types';

type ImportErrorEvent = Extract<ImportEvent, { type: 'IMPORT_ERROR' }>;

export function CustomUrlForm() {
  const [url, setUrl] = useState('');
  const [importStatus, setImportStatus] = useState<{ text: string; color: string } | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setImportStatus(null);

    browser.runtime.sendMessage(
      { type: 'START_IMPORT', url }
    ).catch(() => { });
  };

  useEffect(() => {
    const handleImportError = (message: ImportErrorEvent) => {
      switch (message.reason) {
        case 'import_already_in_progress':
          setImportStatus({ text: browser.i18n.getMessage('formMsgAlreadyInProgress'), color: 'var(--danger-color)' });
          break
        case 'unexpected_error':
          setImportStatus({ text: browser.i18n.getMessage('formMsgUnexpectedError'), color: 'var(--danger-color)' });
          break
        case 'tab_closed':
          break
        default:
          setImportStatus({ text: browser.i18n.getMessage('formMsgImportFailed'), color: 'var(--danger-color)' });
          break
      }
    }

    const handleMessage = (message: unknown) => {
      if (!isImportEvent(message)) {
        return
      }

      switch (message.type) {
        case 'IMPORT_ERROR':
          handleImportError(message);
          break;
        case 'EXISTING_SESSION':
          setImportStatus({ text: browser.i18n.getMessage('formMsgExistingSession'), color: 'var(--danger-color)' });
          browser.runtime.sendMessage({ type: 'KEEP_AND_CONTINUE' }).catch(() => { });
          break;
        case 'IMPORT_SENT':
          setImportStatus({ text: browser.i18n.getMessage('formMsgImportSent'), color: 'var(--primary-color)' });
          break;
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);

    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  return (
    <form onSubmit={handleSubmit} className="instance-form">
      <p style={{ margin: '0 0 12px 0', color: 'var(--secondary-color)', whiteSpace: 'pre-line' }}>
        {browser.i18n.getMessage('customUrlFormDesc')}
      </p>

      <div className="field-row">
        <span className="field-icon">
          <Icon path={mdiLink} size={1} />
        </span>
        <input
          className="field"
          type="url"
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={browser.i18n.getMessage('customUrlPlaceholder')}
        />
      </div>

      <button type="submit" className="link-button">
        {browser.i18n.getMessage('linkDeviceButton')}
      </button>

      {importStatus && (
        <p style={{ margin: '8px 0 0 0', color: importStatus.color }}>{importStatus.text}</p>
      )}
    </form>
  );
}
