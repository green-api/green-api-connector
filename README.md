# GREEN-API Connector

> **Версия на русском языке**  
> Версия README на русском языке доступна в [`README.ru.md`](README.ru.md)  

This extension helps retrieve authorization data for an WhatsApp instance when standard authorization methods are not possible. For example, when login is only possible via Passkey.

## How does the extension work?

The extension opens a separate WhatsApp Web window for authorization, after which it sends the data to the endpoint specified in the [request](#outgoing-requests).

## Building
1. Install dependencies
    ```bash
    npm install
    ```
2. Build the extension
    ```bash
    npm run build
    ```
    The build produces a single MV3 artifact that works in both Chrome and Firefox
3. The unpacked browser extension will be in the `dist/` folder

## Quick Start

You can test how the extension works using the test page [`example/index.html`](example/index.html).  
To test locally via the localhost server or through a file, you need to build the extension with the `DEV_MODE` flag enabled from [config.ts](src/shared/config.ts).  

## How to work with the extension

Data is transferred between the page and the extension via [`message` events](https://developer.mozilla.org/en-US/docs/Web/API/Window/message_event).

### Outgoing Requests

Example request payload:
```json
{"target": "green-api-connector", "type": "PING"}
```
* `target` - extension marker. Specified in [config.ts](src/shared/config.ts) via the `CONNECTOR_SOURCE` variable
* `type` - type of outgoing request

Possible values for the `type` field:
* `PING` - checks that the extension is installed and available on the page
* `START_IMPORT` - starts the authorization process. You must add the endpoint URL to the `url` field, where the [authorization data](#how-to-use-authorization-data) will be sent
* `START_PASSKEY_IMPORT` - same as `START_IMPORT` (backward capability)
* `CLEAR_AND_CONTINUE` - clears any existing data and starts the authorization process. Can be used if a [response](#incoming-requests) with the `EXISTING_SESSION` type was received to force the authorization process to start
* `KEEP_AND_CONTINUE` - uses the existing session without clearing any data. Sent in response to the `EXISTING_SESSION` event as an alternative to `CLEAR_AND_CONTINUE`: only one of the two takes effect
* `CANCEL_IMPORT` - cancel the authorization process. If a window with the web version was previously open, it will be closed

Example of a request in code:
```js
window.postMessage({target:"green-api-connector", type:"START_IMPORT", url:"https://example.com"}, '*')
```

### Incoming Requests

To receive events, you must subscribe to `message` events.

To process only events from this extension, you can implement a filter based on the extension marker, for example:
```js
window.addEventListener('message', (event) => {
  if (event.source !== window || event.data?.source !== 'green-api-connector') {
    return 
  }
  // logic for handling events from the extension
})
```

Example of an incoming request payload:
```json
{"source":"green-api-connector","type":"CONNECTOR_READY"}
```
* `source` - extension marker
* `type` - response type

Possible values for the `type` field:
* `CONNECTOR_READY` - response to a PING. Also sent upon successful activation on the page
* `IMPORT_SENT` - data was successfully sent to the endpoint specified in `url`. Includes additional fields `name` and `number`.
* `EXISTING_SESSION` - the user is already logged in. Data was not sent to the endpoint
* `IMPORT_ERROR` - an error occurred during synchronization. The reason is specified in the additional field `reason`:
  * `import_already_in_progress` - the authorization process is already running
  * `tab_closed` - the authorization tab was closed before authorization was completed
  * `unexpected_error` - an unexpected error occurred during the authorization process
  * `network` - failed to send the data to the endpoint specified in `url`
  * `http_error` - the server responded with an error. The message additionally includes the `httpStatus` field with the response status code
  * `timeout` - the authorization data did not appear within the allotted time

## How to Use Authorization Data

To authorize on an instance, you must specify a URL in the following format when making a `START_IMPORT` request:
```
https://api.green-api.com/waInstance{{idInstance}}/setAuthCreds/{{apiTokenInstance}}
```
* `{{idInstance}}` - instance ID from your console
* `{{apiTokenInstance}}` - instance api token from your console

Example:
```js
window.postMessage({target:"green-api-connector", type:"START_IMPORT", url:"https://api.green-api.com/waInstance110501234567/setAuthCreds/Jg9ktxJ5d7pfWVT9Whar9qxmVVPMLN4d49C8nmpbjXyNeYq54b"}, '*')
```

When using your own backend server, you must proxy the data received from the extension to the target instance.

## Choosing a messenger at build time

The extension's messenger-specific logic lives in `src/packages/<name>/` and is selected at build time via the `MESSENGER` environment variable:
* `npm run build` - builds the extension with the default messenger (`whatsapp`)
* `npm run build:whatsapp` - explicitly builds with the `whatsapp` messenger

## How to customize the extension

### Configuration
You can configure the extension via the [`src/shared/config.ts`](src/shared/config.ts) file
* `CONNECTOR_SOURCE` - a marker used when sending requests and filtering incoming requests
* `TRUSTED_DOMAINS` - domains on which the extension will be active. For example, if you specify `green-api.com`, the extension will also be active on the page `console.green-api.com`.
* `DEV_MODE` - allows the extension to run on `http://localhost` and from an HTML file opened in a browser. Recommended to disable when publishing the extension

### Images
To use your own logo, you must replace the files in the `public/icons` folder

### Text
The title and description text in the extension menu are displayed based on data from the `public/_locales` folder

### Colors
You can change the color palette via the CSS file [src/shared/theme.css](src/shared/theme.css)