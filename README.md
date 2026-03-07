# Clipboard Manager (Firefox Extension)

A lightweight clipboard history manager that lives in your Firefox toolbar. Save, browse, copy, and delete text snippets — all stored locally in your browser.

## Features

- 📋 **Clipboard history** — save any text snippet and access it later from the toolbar popup
- ➕ **Quick add** — type or paste text and press Enter to save instantly
- 📑 **One-click copy** — click any saved item or its copy button to copy it back to your clipboard
- 🗑 **Clear individual items or all at once**
- 🔄 **Auto-updates** — Firefox silently updates the extension in the background
- 🔒 **Fully local** — everything is stored in browser storage, nothing is sent anywhere

## Installation

Install the latest signed release directly in Firefox:

**[⬇ Download extension.xpi](https://github.com/mcittkmims/extension/releases/latest/download/extension.xpi)**

1. Click the link above
2. Firefox will prompt you to add the extension — click **Add**

Updates are delivered automatically; no reinstall needed for future versions.

### Development (temporary load)

1. Open Firefox → `about:debugging` → **This Firefox**
2. Click **Load Temporary Add-on...** and select `manifest.json`

## Usage

1. Click the **Clipboard Manager** icon in the Firefox toolbar to open the popup
2. Type or paste text into the input field and click **Add** (or press **Enter**) to save it
3. Click any saved item or the **⌘** button to copy it back to your clipboard
4. Click **✕** next to an item to remove it, or **🗑** in the header to clear everything
5. Click **🗑** in the header to clear all saved items

## File Structure

```
extension/
├── manifest.json        # Extension configuration
├── popup.html           # Toolbar popup UI
├── popup.js             # Clipboard manager logic
├── content.js           # Page-level content script
├── styles.css           # Content script styles
├── background.js        # Background service worker
├── updates.json         # Auto-update manifest (served via GitHub raw)
├── publish.sh           # Release script (sign → GitHub Release)
└── icons/               # Extension icons
```

## Publishing a New Release

Requires `web-ext`, `gh` CLI, and a `.env` file with AMO credentials (see `.env.example`).

```bash
# Bump version in manifest.json, then:
bash publish.sh
```

This will: sign via AMO API → update `updates.json` → push to GitHub → create a GitHub Release.

## Privacy

- All clipboard data is stored locally in browser storage only
- No data is collected or transmitted by the extension

## License
MIT License
