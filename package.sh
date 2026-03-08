#!/bin/bash
# Package the Firefox extension from dist/. Run from the extension directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT="$SCRIPT_DIR/extension.zip"

rm -f "$OUTPUT"

cd "$SCRIPT_DIR"
bun run build

cd "$SCRIPT_DIR/dist"
zip -r -X "$OUTPUT" .

printf 'Created: %s\n' "$OUTPUT"
