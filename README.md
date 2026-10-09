# Copy OpenProject Link

A Manifest V3 extension for copying the current page as a Markdown link. Click the extension icon or choose **Copy Page Link as Markdown** from the context menu. No popups, additional tabs, or system notifications appear.

## Install without building

The ready-to-use extension is in the **`extension`** folder. You do not need Node.js or any dependencies to use it.

### Google Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension` folder inside the downloaded or cloned project. This folder contains `manifest.json`.
5. Pin the extension to the toolbar using the extensions menu.

### Yandex Browser

1. Open `browser://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder.
4. If the page displays an extensions catalog, open `chrome://extensions` and load the extension there instead.

The browser must support Manifest V3, `chrome.offscreen`, and `chrome.runtime.getContexts` (Chromium 116+). Corporate policies may prevent the installation of unpacked extensions. Integration testing was performed in Microsoft Edge 155; Chrome and Yandex Browser were not tested separately.

To install from a ZIP you built yourself, extract it to a permanent folder and select that folder. See the build command below; generated archives are not stored in the repository. Keep the folder after installation, as the browser loads the extension files from it. After changing the code, click **Reload** on the extension card.

## Usage

Open a page and click the icon to copy a Markdown link with the page title. The right-click menu offers two choices under **Copy Page Link as Markdown**:

- **Use page title** — use the full page title as the link text.
- **Use work package ID** — use the ID in parentheses in an OpenProject page title as the link text, for example `[112554](https://host/work_packages/112554)`.

The toolbar icon always uses the page title, regardless of the last menu choice. Paste the result with Ctrl+V. Even when the menu is opened on a link or inside an iframe, the extension copies the tab's top-level page.

ID mode supports numeric and project-prefixed markers such as `(112554)`, `(OP-20237)`, and `(#112554)`. A leading `#` is preserved in the link text when present in the title; it is not added when absent and does not affect the URL. If several parentheses contain valid IDs, the last one is used. If the page is not OpenProject or its title contains no valid ID marker, the clipboard stays unchanged and the icon shows an error with an explanation.

After a successful copy, the logo displays a green check mark for two seconds. On failure, a red `!` appears for four seconds, with an explanation in the icon's tooltip. Copying may be unavailable on internal browser pages, extension stores, and other documents that prohibit script injection. If reading the page fails, the clipboard is left unchanged. For local files, enable **Allow access to file URLs** in the extension's settings if the browser provides this option.

Example for a page titled `Task title`:

```text
https://host/projects/demo/work_packages/OP-42/activity?facet=all#comment
→ [Task title](https://host/work_packages/OP-42)

https://host/notifications/details/112554/files?facet=all
→ [Task title](https://host/work_packages/112554)
```

URLs are normalized only when `<meta name="openproject_initializer">` is present in the document's `head`. Ordinary pages and unrecognized routes retain their query strings and fragments. The link text uses either the full `document.title` or its work package ID marker, depending on the selected mode. Markdown characters are escaped, and parentheses in URLs are encoded to keep the link valid.

## URL normalization

- `/projects/{project}/work_packages/{id}` becomes `/work_packages/{id}`.
- The complete work package ID is preserved across all supported subsections, including `/wikis`.
- For OpenProject installations under a subpath, that prefix is preserved: `/op/projects/demo/work_packages/42/activity` → `/op/work_packages/42`.

## Privacy and permissions

The extension uses no servers, analytics, registration, network requests, or persistent content scripts. URLs and titles are not stored. Page data is read only when you invoke the extension and is used to write text to the clipboard. The hidden clipboard document closes after each operation.

| Permission | Purpose |
| --- | --- |
| `activeTab` | Temporary access to the tab where you invoke the extension |
| `scripting` | Read `document.title`, the URL, and the OpenProject meta marker from the main document |
| `contextMenus` | Add the right-click menu item |
| `clipboardWrite` | Write Markdown as plain text |
| `offscreen` | Access the clipboard without a visible window, including on HTTP pages |

The extension does not request persistent host permissions, `tabs`, `clipboardRead`, `storage`, or `notifications`.

## Development

```sh
node --test
node scripts/check.mjs
node scripts/package.mjs
```

These commands require Node.js 20+ and no npm packages. The final command creates a ZIP containing only the contents of `extension`. Source files and tests are in the project root; the folder you load into the browser is `extension`.

Icons are already included. To regenerate them from `assets/default.svg` and `assets/success.svg`:

```sh
npm install
npm run icons
```

The only development dependency is `sharp`; it is not included in the extension. The source SVG files are in `assets`.

## Architecture

Components are in `extension/src`:

- `page-info-provider.js` and `openproject-detector.js` — read the page title and URL, and detect OpenProject.
- `work-package-url-resolver.js` — normalize work package URLs.
- `work-package-id.js` — share the ID format and extract the ID marker from a page title.
- `markdown-formatter.js` and `link-builder.js` — build the Markdown link.
- `clipboard-service.js` and `offscreen.js` — write text to the clipboard.
- `background.js` and `extension-actions.js` — handle toolbar clicks and context menu actions.
- `feedback.js` — show the result on the extension icon.

The modern Clipboard API is used when it is available in the service worker. Otherwise, a hidden `chrome.offscreen` document uses a DOM bridge based on `document.execCommand('copy')`: the Async Clipboard API requires focus, which a hidden document cannot receive.

Automated tests are in `tests`. An additional browser check is available in `scripts/browser-smoke.mjs`. To run it, install Playwright separately (`npm install --no-save playwright`) and set `COPY_LINK_BROWSER` to the path of a Chromium-compatible browser.
