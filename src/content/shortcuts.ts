export type ShortcutDef = {
  code: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
};

export const DEFAULT_SHORTCUTS: Record<string, ShortcutDef> = {
  toggleChat: { code: "KeyC", altKey: true },
  runQuizScreenshot: { code: "KeyQ", altKey: true },
  increaseOpacity: { code: "KeyA", altKey: true },
  decreaseOpacity: { code: "KeyZ", altKey: true },
  openTikTok: { code: "Delete", altKey: true }
};

function normalize(def: Partial<ShortcutDef>): ShortcutDef {
  const raw = def.code || "";
  // treat left/right modifiers the same by stripping suffixes
  const code = raw.replace(/(Left|Right)$/i, "");
  return {
    code,
    altKey: !!def.altKey,
    ctrlKey: !!def.ctrlKey,
    shiftKey: !!def.shiftKey,
    metaKey: !!def.metaKey
  };
}

export function formatShortcut(def: ShortcutDef | null): string {
  if (!def || !def.code) return "";
  const parts: string[] = [];
  if (def.ctrlKey) parts.push("Ctrl");
  if (def.metaKey) parts.push("Meta");
  if (def.altKey) parts.push("Alt");
  if (def.shiftKey) parts.push("Shift");
  // map code like KeyA -> A, ArrowUp -> ArrowUp, Delete -> Del
  let keyName = (def.code || "").replace(/(Left|Right)$/i, "");
  if (keyName.startsWith("Key")) keyName = keyName.slice(3);
  if (keyName.startsWith("Digit")) keyName = keyName.slice(5);
  if (keyName === "Delete") keyName = "Del";
  // avoid duplicating when the main key is itself a modifier (Shift/Alt/...)
  if (["Shift", "Control", "Alt", "Meta"].includes(keyName)) {
    // if it's a modifier key, we've already included it in parts
    return parts.length > 0 ? parts.join("+") : keyName;
  }
  parts.push(keyName);
  return parts.join("+");
}

export function matchEvent(ev: KeyboardEvent, def: ShortcutDef | null): boolean {
  if (!def || !def.code) return false;
  if (ev.code !== def.code) return false;
  if (!!ev.altKey !== !!def.altKey) return false;
  if (!!ev.ctrlKey !== !!def.ctrlKey) return false;
  if (!!ev.shiftKey !== !!def.shiftKey) return false;
  if (!!ev.metaKey !== !!def.metaKey) return false;
  return true;
}

export async function loadShortcuts(): Promise<Record<string, ShortcutDef>> {
  try {
    const res = await browser.storage.local.get("shortcuts");
    const raw = (res.shortcuts as Record<string, Partial<ShortcutDef>> | undefined) || {};
    const out: Record<string, ShortcutDef> = {};
    for (const k of Object.keys(DEFAULT_SHORTCUTS)) {
      out[k] = normalize(Object.assign({}, DEFAULT_SHORTCUTS[k], raw[k] || {}));
    }
    // include any extra keys present in storage
    for (const k of Object.keys(raw)) {
      if (!out[k]) out[k] = normalize(raw[k]);
    }
    return out;
  } catch (e) {
    return { ...DEFAULT_SHORTCUTS };
  }
}

export async function saveShortcuts(shortcuts: Record<string, ShortcutDef>): Promise<void> {
  try {
    await browser.storage.local.set({ shortcuts });
  } catch (e) {
    // best-effort
  }
}

export async function saveShortcut(key: string, def: ShortcutDef): Promise<void> {
  try {
    const cur = (await loadShortcuts()) || {};
    cur[key] = normalize(def);
    await saveShortcuts(cur);
  } catch (e) {
    // ignore
  }
}

function canonicalCode(code: string): string {
  if (!code) return "";
  if (code.startsWith("Key")) return code;
  if (code.startsWith("Digit")) return code;
  if (code.startsWith("Arrow")) return code;
  const mods = ["Shift", "Control", "Alt", "Meta"];
  for (const m of mods) {
    if (code.startsWith(m)) return m;
  }
  return code;
}

export function isSameShortcut(a: ShortcutDef | null, b: ShortcutDef | null): boolean {
  if (!a || !b) return false;
  if (Boolean(a.altKey) !== Boolean(b.altKey)) return false;
  if (Boolean(a.ctrlKey) !== Boolean(b.ctrlKey)) return false;
  if (Boolean(a.shiftKey) !== Boolean(b.shiftKey)) return false;
  if (Boolean(a.metaKey) !== Boolean(b.metaKey)) return false;
  const ca = canonicalCode(a.code || "");
  const cb = canonicalCode(b.code || "");
  return ca === cb;
}

export function findConflict(shortcuts: Record<string, ShortcutDef>, def: ShortcutDef, excludeKey?: string): string | null {
  for (const k of Object.keys(shortcuts)) {
    if (excludeKey && k === excludeKey) continue;
    const other = shortcuts[k];
    if (isSameShortcut(def, other)) return k;
  }
  return null;
}
