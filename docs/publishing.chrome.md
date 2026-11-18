# Publishing the extension to the Chrome Web Store

[Русская версия](publishing.chrome.ru.md)

How to publish the GREEN-API Connector extension or its white label version to the Chrome Web Store.

## Requirements for publishing to the Chrome Web Store

**Account** - a Google account (your company's brand account) → [Developer Dashboard](https://chrome.google.com/webstore/devconsole)  
**Fee** - a one-time registration fee for publishing extensions (about 5 USD)  
**What to upload** - the `release/<name>-<version>-chrome.zip` archive  
**Review** - usually a few days, sometimes up to several weeks

## Step 1. Build the release

Only the ZIP file from the root of the release folder is uploaded to the store.

1. Build the release in the repository root:
   - Use the editor from the ["Quick Start"](../README.md#quick-start) guide
   - Or build the release with a command: `npm run release -- --lang en` (your brand from `branding/`)
     or `npm run release -- --lang en --default-brand` (the standard GREEN-API Connector)
2. Open `release/<name>-<version>/` and take `<name>-<version>-chrome.zip`.
3. To update an already published extension, first bump the version: `npm version patch --no-git-tag-version`,
   then build again. The store does not accept the same version twice.

Before uploading, check:

- Test the extension from `chrome/` manually in the browser: [install the extension locally](./install.browser.md).
- The name and icons are your brand's own (the store rejects someone else's branding or branding that looks like it).

## Step 2. Publish to the Chrome Web Store

1. Register in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) with your
   company's Google account and pay the one-time fee ([Register your developer account](https://developer.chrome.com/docs/webstore/register)).
   The contact email cannot be changed later - choose a shared address, not a personal one
   ([Set up your developer account](https://developer.chrome.com/docs/webstore/set-up-account)).
2. In the developer dashboard, choose **Items** → **New item** → **Choose file** `release/<name>-<version>-chrome.zip` → **Upload**.  
   [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish)
3. Open the uploaded item and fill in the **Store listing** for each language. Recommended description:

   **Product details**

   Note: adjust the text for your company

   ```
   <Your app name> lets you connect a WhatsApp account to the <Your service name> service.

   At the user's request, the extension retrieves the data of the current authorized WhatsApp Web session and securely transfers it to the <Your service name> account. After a successful transfer, the local WhatsApp Web session is closed.

   The extension works only with the WhatsApp Web site and performs the import only after an explicit user action. The retrieved data is used only to connect the account to <Your service name> and to provide the service.
   ```

   **Category**  
   Tools

   **Graphic assets**  
   [Supplying images](https://developer.chrome.com/docs/webstore/images).  
   The 128×128 px icon can be taken from the release folder: `release/<name>-<version>/chrome/icons/icon128.png`

   **Global screenshots**  
   Required:
   - A screenshot of your website with the extension at work
   - A screenshot of WhatsApp Web during authorization via Passkey

   **Additional fields**  
   Specify links to your service's official website

4. Go to the **Privacy** tab  
   [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy).

   Recommended field values:

   **Single purpose**

   ```
   Runs code on the WhatsApp Web page to retrieve the authorized session data required to import the account into <Your product name>.
   ```

   **Permission justification**

   ```
   scripting
   Runs code on the WhatsApp Web page to retrieve the authorized session data required to import the account into <Your product name>.

   tabs
   Creates, activates and closes the WhatsApp Web tab required to import the authorized session.

   browsingData
   Clears the local WhatsApp Web data after the import is complete to prevent conflicts between the local web session and the connected <Your product name> session.

   Host permissions
   Access is required only to the WhatsApp Web page, to retrieve the user's authorized session data at the user's request and to import it into <Your product name>. The extension does not interact with other websites.
   ```

   **Data usage**  
   Check:
   - Authentication information
   - Personal communications

   **Privacy policy**  
   Specify the link to your product's privacy policy

5. Go to the **Distribution** tab

   **Payments**  
   Free of charge

   **Visibility**  
   Choose who can access the extension: your users via a link (Unlisted), everyone (Public, the default) or a private group

   **Distribution**  
   Choose the regions you need

6. Once all forms are filled in for the required languages, you can click **Submit for review**.  
   If you uncheck automatic publishing, you will have 30 days after the review to publish manually.

> A new developer account can initially publish no more than two extensions.

## After submission

[Chrome Web Store review process](https://developer.chrome.com/docs/webstore/review-process).

The review result is sent to the developer account's email. The review usually takes a few days, sometimes up to several weeks.  
A new account, a new extension and permissions such as `browsingData` and host access make the review longer.

If more than three weeks have passed, contact Google support.

**If rejected.** The reason is given in the email and in the dashboard. Most often it is the permission justification, a privacy policy that does not match the form, or the description. Fix it, bump the version, build again and resubmit.

## Sources

- [Register your developer account](https://developer.chrome.com/docs/webstore/register)
- [Set up your developer account](https://developer.chrome.com/docs/webstore/set-up-account)
- [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish)
- [Supplying images](https://developer.chrome.com/docs/webstore/images)
- [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Chrome Web Store review process](https://developer.chrome.com/docs/webstore/review-process)
- [Manifest - name](https://developer.chrome.com/docs/extensions/reference/manifest/name), [Manifest - description](https://developer.chrome.com/docs/extensions/reference/manifest/description)
