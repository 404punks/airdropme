export function profileNotice(notice?: string): string | null {
  if (!notice) return null;
  const text = notice.trim();
  if (!text) return null;
  if (/profile registered from public pump\.fun data/i.test(text)) {
    const extra = text.replace(/profile registered from public pump\.fun data\.?/i, "").trim();
    return extra || null;
  }
  if (/stored snapshot refreshed/i.test(text)) {
    return joinNotice("Your USDC was refreshed from the latest public data.", text, /stored snapshot refreshed\.?/i);
  }
  if (/already registered/i.test(text)) {
    return joinNotice("This profile was already checked. Showing the latest stored USDC.", text, /this profile is already registered\. showing the latest stored snapshot\.?/i);
  }
  return text;
}

function joinNotice(base: string, text: string, pattern: RegExp): string {
  const extra = text.replace(pattern, "").trim();
  return extra ? `${base} ${extra}` : base;
}
