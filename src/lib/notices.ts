export function profileNotice(notice?: string): string | null {
  if (!notice) return null;
  const text = notice.trim();
  if (!text) return null;
  if (/profile registered from public pump\.fun data/i.test(text)) {
    return "Profile information was retrieved from publicly available Pump.fun data.";
  }
  if (/stored snapshot refreshed/i.test(text)) {
    return "Your points were refreshed from the latest public data.";
  }
  if (/already registered/i.test(text)) {
    return "This profile was already checked. Showing the latest stored points.";
  }
  return text;
}
