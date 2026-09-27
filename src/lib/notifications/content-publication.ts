type DateLike = Date | string | null | undefined;

function dateIsCurrent(value: DateLike, now: Date) {
  if (value == null) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= now.getTime();
}

export function isSeriesPublished(series: { publishedAt?: DateLike } | null | undefined, now = new Date()) {
  return Boolean(series && dateIsCurrent(series.publishedAt, now));
}

export function isSeasonAvailable(season: { releaseStatus?: string | null; publishedAt?: DateLike } | null | undefined, now = new Date()) {
  if (!season || (season.releaseStatus && season.releaseStatus !== 'AVAILABLE')) return false;
  if (season.publishedAt == null) return true;
  return dateIsCurrent(season.publishedAt, now);
}

export function isContentPlayable(params: {
  series?: { publishedAt?: DateLike } | null;
  season?: { releaseStatus?: string | null; publishedAt?: DateLike } | null;
  episode?: { publishDate?: DateLike } | null;
  now?: Date;
}) {
  const now = params.now || new Date();
  const episode = params.episode;
  const episodePublished = Boolean(episode && (episode.publishDate == null || dateIsCurrent(episode.publishDate, now)));
  return isSeriesPublished(params.series, now) && isSeasonAvailable(params.season, now) && episodePublished;
}
