# Copilot Instructions

## "publish" command

When the user says **publish** (or "release", "ship it", etc.), do the following steps in order:

### 1. Bump the version
Ask the user for the new version number if they haven't provided one.
Update `"version"` in `manifest.json` to the new value.

### 2. Run the publish script
Run in the terminal:
```bash
bash publish.sh
```

**Important:** After running the script, wait silently for it to fully complete. Do NOT interrupt, check on it, or run any other commands until the script exits on its own. The AMO signing step can take several minutes.

This script will automatically:
- Sign the extension via the AMO API (`web-ext sign`)
- Update `updates.json` with the new version and download URL
- Commit and push `manifest.json` + `updates.json` to GitHub
- Create a GitHub Release tagged `v{version}` and upload the signed `extension.xpi`

### Prerequisites (one-time setup, remind the user if not done)
- `npm install -g web-ext`
- `brew install gh && gh auth login`
- Copy `.env.example` → `.env` and fill in `AMO_JWT_ISSUER` and `AMO_JWT_SECRET`
  from https://addons.mozilla.org/developers/addon/api/key/

### Notes
- Credentials live in `.env` (gitignored — never commit it)
- The signed `.xpi` lands in `web-ext-artifacts/` (gitignored)
- `updates.json` always keeps all past versions so older Firefox installs can still update
