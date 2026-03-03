# Clipboard AI Assistant (Firefox Extension)

A floating AI chat assistant that works on any website. Attach images, ask questions, and get AI-powered answers — all from a small draggable button that stays out of your way.

## Features

- 🌐 **Works on any website** — not limited to a specific domain
- 🤖 **Multi-provider AI** — Gemini, OpenAI (GPT), Anthropic (Claude), OpenRouter, and Grok
- 💬 **Chat interface** — clean floating panel with Markdown and LaTeX rendering
- 🖼️ **Image attachments** — drag & drop, click to browse, or paste (Ctrl+V / Cmd+V)
- 🔢 **Math rendering** — KaTeX renders inline and display LaTeX in responses
- 🧲 **Draggable button** — move it anywhere on the page; position is saved per-browser
- 👻 **Unobtrusive** — semi-transparent until hovered

## Installation

### Step 1: Install the Extension in Firefox

#### Temporary (Development)

1. Open Firefox and go to `about:debugging`
2. Click **This Firefox** in the left sidebar
3. Click **Load Temporary Add-on...**
4. Select `manifest.json` from the extension folder

#### Permanent

1. ZIP the extension folder
2. Submit to [Firefox Add-ons](https://addons.mozilla.org/developers/)

### Step 2: Configure an AI Provider

1. Click the floating button on any page and open **⚙ Settings**, or click the toolbar icon
2. Choose a **Provider** (e.g. Gemini)
3. Choose a **Model**
4. Paste your **API Key**
5. Click **Save**

API key sources:
| Provider | Key source |
|---|---|
| Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Anthropic | [console.anthropic.com](https://console.anthropic.com) |
| OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) |
| Grok | [console.x.ai](https://console.x.ai) |

## Usage

1. Open any webpage — the small clipboard button appears in the bottom-right corner (or wherever you last left it)
2. **Drag** the button to reposition it; a short **click** opens/closes the chat
3. Optionally attach an image via drag & drop, click, or paste
4. Type your question in the **"Add to clipboard..."** field and press **Enter**
5. The AI response renders with full Markdown and LaTeX support

## File Structure

```
extension/
├── manifest.json        # Extension configuration
├── content.js           # Floating UI injection & drag logic
├── styles.css           # Floating panel styles
├── background.js        # API request relay (CORS bypass)
├── popup.html           # Toolbar popup
├── popup.js             # Toolbar popup logic
├── katex/               # Bundled KaTeX for math rendering
└── README.md            # Documentation
```

## Supported AI Models

| Provider | Example Models |
|---|---|
| Gemini | Gemini 2.5 Pro/Flash, Gemini 3 Flash Preview |
| OpenAI | GPT-4o, GPT-5 series |
| Anthropic | Claude Sonnet 4.6, Claude Opus 4.6 |
| OpenRouter | Any model via OpenRouter routing |
| Grok | Grok 3, Grok 4 |

## Troubleshooting

**"API key not configured" error**
- Click ⚙ in the chat panel and save a valid key for the selected provider

**Button not visible**
- It starts near the bottom-right; scroll or check if it's hidden behind page content
- Reload the page to reset its position if it ends up off-screen

**Image won't attach**
- Supported formats: PNG, JPEG, WEBP, GIF
- Try a smaller file if the request times out

## Privacy

- API keys are stored locally in browser storage only
- Requests are sent directly from your browser to the selected AI provider
- No data is collected or transmitted by the extension itself

## License

MIT License
