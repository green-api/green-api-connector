> **For AI agents** (Claude Code, Codex, Cursor, Copilot, Gemini and others): read [`AGENTS.md`](AGENTS.md) first and rely on it when working with this repository - it contains the instructions and ready-made scenarios: build & install, White label (your own brand), and - after the build - publishing to the Chrome Web Store or Firefox Add-ons.

# GREEN-API Connector

[Версия на русском языке](README.ru.md) 

The extension helps retrieve authorization data for a WhatsApp instance when it cannot be authorized by the standard methods. For example, when login is only possible via Passkey.

## How does the extension work?

The extension opens a separate WhatsApp Web window for authorization, after which it sends the account's authorization data to the endpoint specified in the [request](docs/integration.md#outgoing-requests).

## Quick Start

You can use an AI agent to make working with the repository easier: send the agent a link to the repository and ask it to help you build the extension.

#### Two scenarios are available for working with the extension.  
> Requires [Node.js](https://nodejs.org) 18 or newer

### 1. Build the GREEN-API application

To get the extension with the standard GREEN-API name, logo and colors, run:

```bash
npm run release -- --lang en --default-brand
```

The script installs missing dependencies and creates the `release/<name>-<version>/` folder. The `--default-brand` option builds the standard extension.

After building, install the extension [in your browser](docs/install.browser.md) or submit it for publication in the [Chrome Web Store](docs/publishing.chrome.md) or [Firefox Add-ons](docs/publishing.firefox.md).

### 2. Create your own "White label" application

In the editor you can upload your logo, enter a name and description in English and Russian, choose colors and immediately see how the extension will look. We recommend working in your own repository (a fork of the original repository): the brand is stored separately, so it is easier to receive GREEN-API updates later.

Start the editor:

```bash
npm run brand-editor -- --lang en
```

The local editor page opens in your browser. If it does not open automatically, follow the URL printed in the terminal.

1. If an **Install dependencies** button is shown, click it and wait for the full editor to load.
2. Upload your logo (a square 512×512 PNG or SVG is recommended), fill in the required description fields and choose the primary color. If you will publish the extension to Firefox Add-ons, enter your own **Firefox ID** - a unique add-on ID in one of these formats - `connector@your-company.com` or `@connector`. If your own site will start the authorization, enter its domain in **"Trusted domains"** (e.g. `partner.com`, subdomains included; the GREEN-API sites are always trusted) - before the first publication.
3. Click **Save**. The editor writes the brand to the `branding/` folder.
4. Click **Build extension** and wait for it to finish. The editor shows the release path and an **Open extension folder** button.
5. Close the editor tab after the build — the local server stops.

After building, install the extension [in your browser](docs/install.browser.md) or submit it for publication in the [Chrome Web Store](docs/publishing.chrome.md) or [Firefox Add-ons](docs/publishing.firefox.md).

### Working with the release build

After the extension is built, the following files are available:

```text
release/
└── <extension_name>/
    ├── <extension_name>-chrome.zip - extension archive for publishing in the Chrome Web Store
    ├── <extension_name>-firefox.zip - extension archive for publishing in Firefox Add-ons
    ├── chrome/ - unpacked extension for Chrome (installed in the browser in developer mode)
    ├── firefox/ - unpacked extension for Firefox (installed in the browser in developer mode)
    ├── preview.html - preview page of the finished extension
    ├── README.txt - release instructions
    └── test/ - folder for working with the extension in debug mode (for developers)
        ├── chrome/
        ├── firefox/
        └── test-page.html
```

The debug builds in `test/chrome/` and `test/firefox/` have a `(debug - not for publishing)` suffix in their name and the description "This extension was built in debug mode. Warning! Not for publishing.". This distinguishes them from the normal builds in the browser's extension list.

## Integrating the extension into your product

Checking commands and responses with the test page is described in a separate [guide to integrating the extension into your White label product](docs/integration.md).

## Brand

For your own logo, name, description and colors, use the editor from the **Create your own "White label" application** scenario above.   
The brand is stored only in `branding/` and is applied on top of the default GREEN-API appearance during the build. You do not need to change `public/icons`, `public/_locales`, `src/shared/theme.css` or the HTML titles manually.

After the extension is built, you can view the saved brand in the `release/<extension_name>/preview.html` file.

## License
This project is licensed under the [MIT License](LICENSE).
