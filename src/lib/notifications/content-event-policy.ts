export type ContentEventType = 'SERIES_PUBLISHED' | 'SEASON_PUBLISHED' | 'EPISODE_PUBLISHED';

export function contentEventKey(type: ContentEventType, entityId: unknown) {
  return `content:${type}:${String(entityId)}:first-publication`;
}

export function contentEventAvailableAt(...values: Array<Date | string | null | undefined>) {
  const times = values.map(value => value == null ? Date.now() : new Date(value).getTime());
  if (times.some(time => !Number.isFinite(time))) throw new Error('INVALID_PUBLICATION_DATE');
  return new Date(Math.max(...times));
}

export function isPublishTransition(beforeAvailable: boolean, afterAvailable: boolean) {
  return !beforeAvailable && afterAvailable;
}
