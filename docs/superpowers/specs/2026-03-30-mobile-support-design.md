# Mobile Support Design

**Date:** 2026-03-30
**Branch:** `fix/mobile-v2` (new branch off `main`)
**Source context:** Integrates and improves on PR #20 (`fix/mobile`), which was branched off an older version and is not being merged directly.

---

## Goal

Make the extension fully functional on mobile browsers by fixing:
1. Screenshot capture (native API unavailable on mobile)
2. Button drag (mouse events don't fire on touch screens)
3. Chat panel resize (same root cause as drag)
4. Button tap-to-close (chat wouldn't close when tapping the button again)
5. Crash on load due to `browser.menus` being undefined on mobile Firefox

All existing desktop behavior must remain unchanged.

---

## Architecture

No new files. All changes are targeted edits to existing files. `isMobile` is a single boolean on `OverlayState` that gates mobile-specific code paths.

---

## Changes by File

### `src/content/types.ts`
Add `isMobile: boolean` to `OverlayState` interface.

### `src/content/state.ts`
Initialize `isMobile: false` in `createOverlayState()`.

### `src/content/app.ts`
- Import `html2canvas` at the top.
- After `createOverlayState()`, set `state.isMobile` via user-agent regex (same pattern as PR #20).
- Replace both inline `captureTab` arrow functions with a single shared `captureTab` function:
  - If `state.isMobile`: call `html2canvas(document.body)` directly, return `{ success, base64, mimeType: "image/png" }`.
  - Otherwise: call `browser.runtime.sendMessage({ type: "captureTab" })` as before (no fallback — desktop native capture works reliably).

### `src/background/lifecycle.ts`
Wrap `browser.menus.removeAll()` and `browser.menus.onClicked.addListener()` in `if (browser.menus)` guard. Mobile Firefox does not expose this API and crashes without the guard.

### `src/content/events/drag.ts`
Replace all `mousedown`/`mousemove`/`mouseup` listeners with `pointerdown`/`pointermove`/`pointerup`:
- On `pointerdown` on `aiButton`: call `event.currentTarget.setPointerCapture(event.pointerId)` so subsequent pointer events are received even if the finger slides off the element.
- Drag threshold: `4` px when `event.pointerType === "mouse"`, `8` px for `"touch"` or `"pen"`.
- On `pointerup` with no drag (`!state.dragMoved`): call `chat.toggle()`. This fixes tap-to-close on mobile (same code path as desktop click).
- Resize corner gets the same pointer event treatment. `setPointerCapture` called on `pointerdown` there too.
- Desktop behavior is identical — pointer events fire for mouse input with `pointerType === "mouse"`, so no behavioral change for existing desktop users.

### `src/content/events/runtime.ts`
Add a `pointerdown` listener on `document`:
```ts
document.addEventListener("pointerdown", (event) => {
  if (state.isMobile && state.isOpen && !chatbox.contains(event.target as Node)) {
    chat.close();
  }
});
```
This closes the chat when tapping outside it on mobile.

### `src/content/messages.ts`
Port `imageBase64` support from PR #20:
- Add `imageBase64?: string | null` to `StoredChatMessage` interface.
- Include `imageBase64` in the equality check to prevent duplicate suppression.
- Pass `imageBase64` through `appendMessage` and `addUserMessage`.
- When rendering a user message that has `imageBase64`, prepend a clickable `<img>` element above the text.
- Persist and restore `imageBase64` in `loadHistory`.

### `package.json` + `bun.lock`
Add `html2canvas@^1.4.1` as a runtime dependency.

---

## Data Flow (screenshot path)

```
quiz trigger
  → runQuizRequest (quiz-shared.ts)
    → captureTab() [app.ts]
        mobile: html2canvas(document.body) → base64 PNG
        desktop: browser.runtime.sendMessage("captureTab") → base64 PNG
    → sendToAI(prompt, base64, "image/png", contextMessages)
    → AI response displayed
```

---

## Out of Scope

- `quiz-shared.ts` ordering change from PR #20 (show user message after screenshot) — not porting; current behavior on main is acceptable and the change introduces edge-case complexity.
- Any UI layout changes for mobile (font size, panel sizing, etc.).
- Detection of mobile via feature detection instead of user-agent — user-agent is sufficient here and consistent with the existing approach.
