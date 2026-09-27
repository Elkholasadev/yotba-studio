export function safeNotificationTarget(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 300 || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return null;
  try { const decoded = decodeURIComponent(value); const parsed = new URL(value, 'https://yotba.invalid'); return parsed.origin === 'https://yotba.invalid' && !decoded.startsWith('//') && !decoded.includes('\\') && !/[\u0000-\u0020\u007f]/.test(decoded) && /^\/(?:$|series(?:\/|\?|#|$)|explore(?:\/|\?|#|$)|library(?:\/|\?|#|$)|home(?:\/|\?|#|$)|settings(?:\/|\?|#|$)|account(?:\/|\?|#|$)|notifications(?:\/|\?|#|$))/.test(decoded) ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null; } catch { return null; }
}
export function validateCampaignInput(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const body = typeof value.body === 'string' ? value.body.trim() : '';
  const targetUrl = safeNotificationTarget(value.targetUrl);
  const audienceType = value.audienceType;
  const seriesId = value.seriesId === null || value.seriesId === undefined || value.seriesId === '' ? null : value.seriesId;
  if (!title || title.length > 100 || /<[^>]*>/.test(title) || /[\u0000-\u001f\u007f]/.test(title) || !body || body.length > 500 || /<[^>]*>/.test(body) || /[\u0000-\u001f\u007f]/.test(body) || !targetUrl || !['ALL','FOLLOWERS','SERIES'].includes(String(audienceType))) return null;
  if (audienceType === 'SERIES' && (typeof seriesId !== 'string' || !/^[a-f\d]{24}$/i.test(seriesId))) return null;
  if (audienceType !== 'SERIES' && seriesId !== null) return null;
  return { title, body, targetUrl, audienceType: audienceType as 'ALL'|'FOLLOWERS'|'SERIES', seriesId: seriesId as string|null };
}
