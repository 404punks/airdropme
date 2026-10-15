export function profileNotice(notice?: string): string | null {
  if (!notice) return null;
  const text = notice.trim();
  if (!text) return null;
  if (/profile registered from public pump\.fun data/i.test(text)) {
    return joinNotice("Profile information was retrieved from publicly available Pump.fun data.", text, /profile registered from public pump\.fun data\.?/i);
  }
  if (/stored snapshot refreshed/i.test(text)) {
    return joinNotice("Your points were refreshed from the latest public data.", text, /stored snapshot refreshed\.?/i);
  }
  if (/already registered/i.test(text)) {
    return joinNotice("This profile was already checked. Showing the latest stored points.", text, /this profile is already registered\. showing the latest stored snapshot\.?/i);
  }
  return text;
}

function joinNotice(base: string, text: string, pattern: RegExp): string {
  const extra = text.replace(pattern, "").trim();
  return extra ? `${base} ${extra}` : base;
}
