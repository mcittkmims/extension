export const OPENCODE_DEFAULT_URL = "http://127.0.0.1:4096";

export function normalizeOpenCodeUrl(url: string | null | undefined): string {
  const raw = (url || "").trim();
  if (!raw) {
    return OPENCODE_DEFAULT_URL;
  }

  return raw.replace(/\/$/, "");
}
