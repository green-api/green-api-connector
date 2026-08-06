import { useEffect, useState } from 'react';
import Icon from '@mdi/react';
import { mdiIdentifier, mdiDotsHorizontal } from '@mdi/js';
import { CONNECTOR_SOURCE } from '../shared/config';

export function InstanceForm() {
  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setApiTokenInstance] = useState('');
  const [importStatus, setImportStatus] = useState<{ text: string; color: string } | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setImportStatus(null);

    const url = `https://api.green-api.com/waInstance${idInstance}/setAuthCreds/${apiTokenInstance}`;

    window.postMessage(
      { target: CONNECTOR_SOURCE, type: 'START_PASSKEY_IMPORT', url },
      '*',
    );
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window || event.data?.source !== CONNECTOR_SOURCE) {
        return;
      }

      const data = event.data as { type?: string; reason?: string };

      switch (data.type) {
        case 'IMPORT_ERROR':
          if (data.reason === 'import_already_in_progress') {
            setImportStatus({ text: chrome.i18n.getMessage('formMsgAlreadyInProgress'), color: 'var(--danger-color)' });
          } else if (data.reason === 'unexpected_error') {
            setImportStatus({ text: chrome.i18n.getMessage('formMsgUnexpectedError'), color: 'var(--danger-color)' });
          }
          break;
        case 'EXISTING_SESSION':
          setImportStatus({ text: chrome.i18n.getMessage('formMsgExistingSession'), color: 'var(--danger-color)' });
          window.postMessage({ target: CONNECTOR_SOURCE, type: 'CANCEL_IMPORT'},'*',);
          break;
        case 'IMPORT_SENT':
          setImportStatus({ text: chrome.i18n.getMessage('formMsgImportSent'), color: 'var(--primary-color)' });
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <form onSubmit={handleSubmit} className="instance-form">
      <div key="id" className="field-row">
        <span className="field-icon">
          <Icon path={mdiIdentifier} size={1} />
        </span>
        <input
          className="field"
          type="text"
          required
          value={idInstance}
          onChange={(event) => setIdInstance(event.target.value)}
          placeholder={chrome.i18n.getMessage('idInstancePlaceholder')}
        />
      </div>

      <div key="token" className="field-row">
        <span className="field-icon">
          <Icon path={mdiDotsHorizontal} size={1} />
        </span>
        <input
          className="field"
          type="password"
          required
          value={apiTokenInstance}
          onChange={(event) => setApiTokenInstance(event.target.value)}
          placeholder={chrome.i18n.getMessage('apiTokenPlaceholder')}
        />
      </div>

      <button type="submit" className="link-button">
        {chrome.i18n.getMessage('linkDeviceButton')}
      </button>

      {importStatus && (
        <p style={{ margin: '8px 0 0 0', color: importStatus.color }}>{importStatus.text}</p>
      )}
    </form>
  );
}