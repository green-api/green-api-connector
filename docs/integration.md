# Integrating the extension into your product

[Русская версия](integration.ru.md)

The test page lets you check the commands and responses between a page and the extension.

> The test page is not needed to authorize through the extension icon.

1. In the browser, disable the normal version of the extension and install the test one: `test/chrome/` or `test/firefox/manifest.json` from the release. Its name contains `(debug - not for publishing)`.
2. In Chrome, turn on **Allow access to file URLs** in the test extension's **Details** section.
3. Open `test/test-page.html` in the same browser and profile. Wait for the **Extension is connected and ready** status; the log should show an incoming `CONNECTOR_READY` response.
4. Enter the test instance's data and click **Start authorization**. Log in to WhatsApp and wait for `IMPORT_SENT`, or check the reason in `IMPORT_ERROR`. If both `idInstance` and `apiTokenInstance` are filled in, they take precedence over the **Full endpoint URL** field; to use your own endpoint, clear both fields.
5. After testing, remove the test build and install the normal one from `chrome/` or `firefox/`.

The test build trusts local pages (`file://` and `http://localhost`). **Do not publish or distribute `test/`**. For publishing, use only the normal builds or their corresponding ZIP archives. You do not need to enable `DEV_MODE` manually for this check.

A simple HTML and JavaScript integration example is available in [`example/index.html`](../example/index.html): it sends the same commands and shows the extension's responses. When opened locally, it also requires the test build.

## How to work with the extension

Data is transferred between the page and the extension via [`message` events](https://developer.mozilla.org/en-US/docs/Web/API/Window/message_event).

### Outgoing requests

Example request payload:

```json
{ "target": "green-api-connector", "type": "PING" }
```

- `target` - extension marker. Specified in [config.ts](../src/shared/config.ts) via the `CONNECTOR_SOURCE` variable
- `type` - type of the outgoing request

Possible values of the `type` field:

- `PING` - checks that the extension is installed and available on the page
- `START_IMPORT` - starts the authorization process. You must add the endpoint URL to the `url` field, where the [authorization data](#how-to-use-authorization-data) will be sent
- `START_PASSKEY_IMPORT` - same as `START_IMPORT` (backward compatibility)
- `CLEAR_AND_CONTINUE` - clears the data, if any, and starts the authorization process. Can be used if a [response](#incoming-requests) with the `EXISTING_SESSION` type was received, to force the authorization process to start
- `KEEP_AND_CONTINUE` - uses the existing session without clearing the data. Sent in response to the `EXISTING_SESSION` event as an alternative to `CLEAR_AND_CONTINUE`: only one of the two takes effect
- `CANCEL_IMPORT` - cancels the authorization process. If a window with the web version was opened earlier, it will be closed

Example of a request in code:

```js
window.postMessage({
    target: "green-api-connector",
    type: "START_IMPORT",
    url: "https://api.green-api.com/waInstance{{idInstance}}/setAuthCreds/{{apiTokenInstance}}",
  }, "*");
```

### Incoming requests

To receive events, subscribe to `message` events.

To process only the events from the extension, you can filter by the extension marker, for example:

```js
window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "green-api-connector") {
    return;
  }
  // logic for handling the extension's event
});
```

Example of an incoming request payload:

```json
{ 
  "source": "green-api-connector", 
  "type": "CONNECTOR_READY" 
}
```

- `source` - extension marker
- `type` - response type

Possible values of the `type` field:

- `CONNECTOR_READY` - response to `PING`. Also sent upon successful activation on the page
- `IMPORT_SENT` - the data was successfully sent to the endpoint specified in `url`. Has additional fields `name` and `number`.
- `EXISTING_SESSION` - the account is already logged in. The data was not sent to the endpoint
- `IMPORT_ERROR` - an error occurred during synchronization. The reason is given in the additional `reason` field:
  - `import_already_in_progress` - the authorization process is already running
  - `tab_closed` - the authorization tab was closed before the authorization was completed
  - `unexpected_error` - an unexpected error occurred during the authorization process
  - `network` - failed to send the data to the endpoint specified in `url`
  - `http_error` - the server responded with an error. In this case the message has the additional `httpStatus` field with the response code
  - `timeout` - the authorization data did not appear within the allotted time

## How to use authorization data

To authorize an instance, specify a URL in the following format in the `START_IMPORT` request:

```
https://api.green-api.com/waInstance{{idInstance}}/setAuthCreds/{{apiTokenInstance}}
```

- `{{idInstance}}` - instance number from your console
- `{{apiTokenInstance}}` - instance token from your console

For example:

```js
window.postMessage(
  {
    target: "green-api-connector",
    type: "START_IMPORT",
    url: "https://api.green-api.com/waInstance110501234567/setAuthCreds/Jg9ktxJ5d7pfWVT9Whar9qxmVVPMLN4d49C8nmpbjXyNeYq54b",
  },
  "*",
);
```

When using your own backend server, you must proxy the data received from the extension to the target instance.

## Choosing a messenger at build time

The logic specific to a particular messenger (for example, WhatsApp Web) lives in `src/packages/<name>/` and is selected at build time via the `MESSENGER` environment variable:

- `npm run build` - builds the extension with the default messenger (`whatsapp`)
- `npm run build:whatsapp` - explicitly builds the extension with the `whatsapp` messenger

## How to customize the extension

### Configuration

To create an extension with your brand (logo, name, description, colors), use the brand editor: the brand is saved to the `branding/` folder and applied during the build.  

Command to start the brand editor  
```bash
npm run brand-editor -- --lang en
```

The extension's technical settings are set in the [`src/shared/config.ts`](../src/shared/config.ts) file

- `CONNECTOR_SOURCE` - a marker used when sending requests and filtering incoming requests
- `TRUSTED_DOMAINS` - domains on which the extension will be active. A white label enters its own domains in the brand editor ("Trusted domains" -> `trustedDomains` in `branding/brand.json`); they replace this list.
> For example, if you specify `green-api.com`, the extension will also be active on the `console.green-api.com` page.
- `DEV_MODE` - allows the extension to work on `http://localhost` and from an HTML file opened in the browser. Turn it off when publishing the extension.
