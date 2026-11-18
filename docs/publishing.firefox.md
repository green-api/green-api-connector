# Publishing the extension to Firefox Add-ons

[Русская версия](publishing.firefox.ru.md)

How to publish the GREEN-API Connector extension or its white label version to Firefox Add-ons.

## Requirements for publishing to Firefox Add-ons

**Account** - a Mozilla account → [Add-on Developer Hub](https://addons.mozilla.org/developers/)  
**Fee** - none  
**What to upload** - `release/<name>-<version>-firefox.zip` + a source code archive  
**Review** - signing within 24 hours; a manual review may take longer

## Step 1. Build the release

Only the ZIP file from the root of the release folder is uploaded to the store.

1. Build the release in the repository root:
   - Use the editor from the ["Quick Start"](../README.md#quick-start) guide. In the **Firefox ID** field, enter a
     unique add-on ID in one of these formats - `connector@your-company.com` or `@connector`.
   - Or build the release with a command: `npm run release -- --lang en` (your brand from `branding/`)
     or `npm run release -- --lang en --default-brand` (the standard GREEN-API Connector)
2. Open `release/<name>-<version>/` and take `<name>-<version>-firefox.zip`.
3. To update an already published extension, first bump the version: `npm version patch --no-git-tag-version`,
   then build again. The store does not accept the same version twice.

Before uploading, check:

- The name and icons are your brand's own (the store rejects someone else's branding or branding that looks like it).
- `browser_specific_settings.gecko.id` in `firefox/manifest.json` is your ID, not `@green-api-connector` (it belongs
  to the official GREEN-API build). The first upload claims the ID for the add-on forever
  ([about the add-on ID](https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id/)).
- Test the extension from `firefox/` manually in the browser: [install the extension locally](./install.browser.md).

The `data_collection_permissions` field (type `authenticationInfo`), required for new add-ons, is already in the
manifest ([Firefox data collection consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)).

## Step 2. Prepare the source code archive

The extension is built with Vite: the code is bundled and minified, so Mozilla requires the sources from which the
reviewer can build exactly the same ZIP ([source code requirements](https://extensionworkshop.com/documentation/publish/source-code-submission/)).

1. Commit all changes, including the `branding/` folder - without it the standard GREEN-API Connector is built.
2. Create an archive of the commit in the repository root:

   ```bash
   git archive --format=zip -o release/<name>-<version>-source.zip HEAD
   ```

   The archive contains only the files in git: no `node_modules/`, `dist/` or `release/`.

## Step 3. Publish to Firefox Add-ons

1. Sign in to the [Add-on Developer Hub](https://addons.mozilla.org/developers/) with your company's Mozilla account
   and click **Submit a New Add-on**
   ([Mozilla's guide to submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)).
2. Choose how to distribute the add-on:
   - **On this site** - the add-on is listed on addons.mozilla.org.
3. Upload `release/<name>-<version>-firefox.zip` and wait for the automatic validation. Errors must be fixed,
   warnings do not block publishing. For compatibility, keep only **Firefox** (not Firefox for Android).
4. To the question **"Do you need to submit source code?"** answer **Yes** and upload the archive from step 2 in the
   source code field.
5. Fill in the **Describe Add-on** section
   ([how to create an appealing listing](https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/)).

   Note: adjust the texts for your company

   **Name** - taken from the manifest.

   **Summary** (up to 250 characters)

   ```
   Connects a WhatsApp account to <Your service name>: transfers the authorized WhatsApp Web session data at the user's request.
   ```

   **Description**

   ```
   <Your app name> lets you connect a WhatsApp account to the <Your service name> service.

   At the user's request, the extension retrieves the data of the current authorized WhatsApp Web session and securely transfers it to the <Your service name> account. After a successful transfer, the local WhatsApp Web session is closed.

   The extension works only with the WhatsApp Web site and performs the import only after an explicit user action. The retrieved data is used only to connect the account to <Your service name> and to provide the service.
   ```

6. Further down on the same page:
   - **Categories** (up to 3) - **Social & Communication**;
   - **Support email** and **Support website** URL - your contacts;
   - **License** - **MIT License**.

7. Check **This add-on has a Privacy Policy** and paste the policy text: what data is processed, where it is sent
   (only to the user's instance), that the extension does not store it and removes the WhatsApp Web data from the
   browser after the transfer. Add a link to the privacy policy on your website.

   In **Notes for Reviewers**, paste the build instructions (in English):

   ```
   The extension is bundled and minified with Vite 5; the source code archive contains the full repository.
   Requirements: Node.js 22 (18+), npm 10; Windows, Linux or macOS.
   Build:
     npm ci
     npm run release -- --lang en
   Result: release/<name>-<version>/firefox/ - identical to the uploaded <name>-<version>-firefox.zip.
   The brand (name, icons, colors, add-on ID) is applied at build time from the branding/ folder.
   "Unsafe assignment to innerHTML" warnings come from the bundled react-dom library.
   ```

8. Click **Submit Version**.

## After submission

[Signing and distribution overview](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).

The review result is sent to the developer account's email. Signing and publishing take up to 24 hours; a manual
review may take longer.

**If rejected.** The reason is given in the email and in the Developer Hub. Most often it is source code that does
not produce the same ZIP, the privacy policy or the description. Fix it, bump the version, build again and resubmit.

**Updating the version:**

1. `npm version patch --no-git-tag-version`, then `npm run release` and a new source archive (step 2).
2. The add-on in the Developer Hub → **Upload New Version** → the new `-firefox.zip` and the source archive.

## Sources

- [Submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
- [Source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/)
- [Firefox built-in data collection consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)
- [Extensions and the add-on ID](https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id/)
- [Create an appealing listing](https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/)
- [Signing and distribution overview](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)
