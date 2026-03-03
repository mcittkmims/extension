# Clipboard AI Assistant (Firefox Extension)

A floating AI chat assistant that works on any website. Attach images, ask questions, and get AI-powered answers — all from a small draggable button that stays out of your way.

## Features

- 🌐 **Works on any website** — not limited to a specific domain
- 🤖 **Multi-provider AI** — Gemini, OpenAI (GPT), Anthropic (Claude), OpenRouter, and Grok
- 💬 **Chat interface** — clean floating panel with Markdown and LaTeX rendering
- 🖼️ **Image attachments** — drag & drop, click to browse, or paste (Ctrl+V / Cmd+V)
- 🔢 **Math rendering** — KaTeX renders inline and display LaTeX in responses
- 🧲 **Draggable button** — move it anywhere on the page; position is saved per-browser
- ⌨️ **Keyboard shortcut** — Alt+C (Option+C on Mac) opens/closes the chat from anywhere
- 👻 **Unobtrusive** — semi-transparent until hovered
- 🔄 **Auto-updates** — Firefox silently updates the extension in the background

## Installation

Install the latest signed release directly in Firefox:

**[⬇ Download extension.xpi](https://github.com/mcittkmims/extension/releases/download/v1.3/extension.xpi)**

1. Click the link above
2. Firefox will prompt you to add the extension — click **Add**

Updates are delivered automatically; no reinstall needed for future versions.

### Development (temporary load)

1. Open Firefox → `about:debugging` → **This Firefox**
2. Click **Load Temporary Add-on...** and select `manifest.json`

## Setup

1. Click the floating button on any page (or press **Alt+C**) to open the chat
2. Click **⚙ Settings** inside the chat panel
3. Choose a **Provider** and **Model**
4. Paste your **API Key** — it's saved locally and never leaves your browser

API key sources:
| Provider | Key source |
|---|---|
| Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Anthropic | [console.anthropic.com](https://console.anthropic.com) |
| OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) |
| Grok | [console.x.ai](https://console.x.ai) |

## Usage

1. Open any webpage — the small clipboard button appears in the bottom-right corner
2. Press **Alt+C** (or click the button) to open/close the chat
3. **Drag** the button to reposition it anywhere on the page
4. Optionally attach an image via drag & drop, click, or paste
5. Type your question and press **Enter**
6. Responses render with full Markdown and LaTeX support

## File Structure

```
extension/
├── manifest.json        # Extension configuration
├── content.js           # Floating UI, drag logic, Markdown/KaTeX renderer
├── styles.css           # Floating panel styles
├── background.js        # API request relay (CORS bypass)
├── popup.html           # Toolbar popup
├── popup.js             # Toolbar popup logic
├── updates.json         # Auto-update manifest (served via GitHub raw)
├── publish.sh           # Release script (sign → GitHub Release)
├── katex/               # Bundled KaTeX for math rendering
└── icons/               # Extension icons
```

## Supported AI Models

| Provider | Example Models |
|---|---|
| Gemini | Gemini 2.5 Pro/Flash |
| OpenAI | GPT-4o, o3 |
| Anthropic | Claude Sonnet, Claude Opus |
| OpenRouter | Any model via OpenRouter routing |
| Grok | Grok 3, Grok 4 |

## Publishing a New Release

Requires `web-ext`, `gh` CLI, and a `.env` file with AMO credentials (see `.env.example`).

```bash
# Bump version in manifest.json, then:
bash publish.sh
```

This will: sign via AMO API → update `updates.json` → push to GitHub → create a GitHub Release.

## Troubleshooting

**"API key not configured" error**
- Open ⚙ Settings in the chat panel and save a valid key for the selected provider

**Button not visible**
- It starts near the bottom-right; check if it's hidden behind page content
- Reload the page to reset its position if it ends up off-screen

**Image won't attach**
- Supported formats: PNG, JPEG, WEBP, GIF
- Try a smaller file if the request times out

## Privacy

- API keys are stored locally in browser storage only
- Requests go directly from your browser to the selected AI provider
- No data is collected or transmitted by the extension itself

## License
MIT License
