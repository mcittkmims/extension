#!/bin/bash
# Package the Firefox extension cleanly, without .git, .DS_Store, or macOS metadata.
# Run this from the extension directory: bash package.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT="$SCRIPT_DIR/../extension.zip"

rm -f "$OUTPUT"

cd "$SCRIPT_DIR"
bun run build
zip -r -X "$OUTPUT" . \
    -x "*.git*" \
    -x ".DS_Store" \
    -x "*/.DS_Store" \
    -x "node_modules/*" \
    -x ".vite-build/*" \
    -x "src/*" \
    -x "scripts/*" \
    -x "bun.lock" \
    -x "package.json" \
    -x "tsconfig.json" \
    -x "eslint.config.mjs" \
    -x ".prettierrc.json" \
    -x ".prettierignore" \
    -x ".editorconfig" \
    -x "vite.config.ts" \
    -x "package.sh" \
    -x "README.md"

echo "Created: $OUTPUT"
