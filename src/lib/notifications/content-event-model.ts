import { Schema, model, models } from 'mongoose';

// Keep this schema byte-for-byte compatible with yotba/src/lib/notifications/content-event-model.ts.
const contentNotificationEventSchema = new Schema({
  eventKey: { type: String, required: true, unique: true, maxlength: 160 },
  type: { type: String, enum: ['SERIES_PUBLISHED', 'SEASON_PUBLISHED', 'EPISODE_PUBLISHED'], required: true },
  entityId: { type: Schema.Types.ObjectId, required: true },
  seriesId: { type: Schema.Types.ObjectId, ref: 'Series', required: true, index: true },
  seasonId: { type: Schema.Types.ObjectId, ref: 'Season', default: null },
  episodeId: { type: Schema.Types.ObjectId, ref: 'Episode', default: null },
  availableAt: { type: Date, required: true, index: true },
  state: { type: String, enum: ['PENDING', 'PROCESSING', 'PROJECTED', 'SKIPPED'], default: 'PENDING', index: true },
  nextAttemptAt: { type: Date, default: Date.now },
  leaseId: String,
  leaseExpiresAt: Date,
  attempts: { type: Number, default: 0 },
  campaignId: { type: Schema.Types.ObjectId, ref: 'NotificationCampaign', default: null },
  errorCode: String,
}, { timestamps: true });

contentNotificationEventSchema.index({ state: 1, availableAt: 1, nextAttemptAt: 1 });
contentNotificationEventSchema.index({ state: 1, leaseExpiresAt: 1 });

export const ContentNotificationEvent = models.ContentNotificationEvent || model('ContentNotificationEvent', contentNotificationEventSchema);
