/** "HUF — Hungarian forint", or just "HUF" when the display name is empty or the code again. */
export function assetLabel(code: string, name: string): string {
  return name && name !== code ? `${code} — ${name}` : code;
}

/** The second line of an asset option: the name, unless it only repeats the code. */
export function assetSubtitle(code: string, name: string): string | undefined {
  return name && name !== code ? name : undefined;
}
