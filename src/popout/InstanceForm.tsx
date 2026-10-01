import { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';
import Icon from '@mdi/react';
import { mdiIdentifier, mdiDotsHorizontal } from '@mdi/js';
import { isImportEvent, type ImportEvent } from '../packages/types';

type ImportErrorEvent = Extract<ImportEvent, { type: 'IMPORT_ERROR' }>;

export function InstanceForm() {
  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setApiTokenInstance] = useState('');
  const [importStatus, setImportStatus] = useState<{ text: string; color: string } | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setImportStatus(null);

    const url = `https://api.green-api.com/waInstance${idInstance}/setAuthCreds/${apiTokenInstance}`;

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
        default: {
          const isInstanceAuthorized = message.httpStatus === 409;
          const errorString = isInstanceAuthorized ? 'formMsgInstanceHasCreds' : 'formMsgImportFailed';
          setImportStatus({ text: browser.i18n.getMessage(errorString), color: 'var(--danger-color)' });
          break
        }
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
          browser.runtime.sendMessage({ type: 'CANCEL_IMPORT' }).catch(() => { });
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
          placeholder={browser.i18n.getMessage('idInstancePlaceholder')}
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
          placeholder={browser.i18n.getMessage('apiTokenPlaceholder')}
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