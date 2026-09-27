import { Schema, model, models } from 'mongoose';

const campaignSchema = new Schema({
  title: { type: String, required: true, maxlength: 100 },
  body: { type: String, required: true, maxlength: 500 },
  targetUrl: { type: String, required: true, maxlength: 300 },
  audienceType: { type: String, enum: ['ALL', 'FOLLOWERS', 'SERIES'], required: true },
  seriesId: { type: Schema.Types.ObjectId, ref: 'Series', default: null },
  status: { type: String, enum: ['DRAFT', 'QUEUED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED'], default: 'DRAFT', index: true },
  source: { type: String, enum: ['ADMIN', 'CONTENT'], default: 'ADMIN' },
  sourceEventKey: { type: String, maxlength: 160 },
  contentEvent: {
    type: { type: String, enum: ['SERIES', 'SEASON', 'EPISODE'] },
    entityId: String, seriesId: String, seasonId: String, episodeId: String,
    seriesTitle: String, seasonNumber: Number, episodeTitle: String,
  },
  createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser', required: function (this: { source?: string }) { return this.source !== 'CONTENT'; } },
  queuedAt: Date,
  completedAt: Date,
  recipientCursor: String,
  dispatchLeaseId: String,
  dispatchLeaseExpiresAt: Date,
  recipientCount: { type: Number, default: 0 },
  fanoutComplete: { type: Boolean, default: false },
  errorCode: String,
}, { timestamps: true });
campaignSchema.index({ status: 1, queuedAt: 1 });
campaignSchema.index({ sourceEventKey: 1 }, { unique: true, sparse: true });

const deliverySchema = new Schema({
  campaignId: { type: Schema.Types.ObjectId, ref: 'NotificationCampaign', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['PENDING', 'SENDING', 'SENT', 'SKIPPED', 'FAILED'], default: 'PENDING' },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  leaseId: String,
  leaseExpiresAt: Date,
  firstAttemptAt: Date,
  sentAt: Date,
  errorCode: String,
  deliveredDeviceIds: [{ type: Schema.Types.ObjectId, ref: 'PushDevice' }],
  pushReceipts: [{ receiptId: String, deviceId: { type: Schema.Types.ObjectId, ref: 'PushDevice' } }],
  receiptDueAt: Date,
  receiptsChecked: { type: Boolean, default: true },
  receiptAttempts: { type: Number, default: 0 },
}, { timestamps: true });
deliverySchema.index({ campaignId: 1, userId: 1 }, { unique: true });
deliverySchema.index({ status: 1, nextAttemptAt: 1 });
deliverySchema.index({ status: 1, receiptsChecked: 1, receiptDueAt: 1 });

const inboxSchema = new Schema({
  campaignId: { type: Schema.Types.ObjectId, ref: 'NotificationCampaign', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 100 },
  body: { type: String, required: true, maxlength: 500 },
  targetUrl: { type: String, required: true, maxlength: 300 },
  readAt: { type: Date, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });
inboxSchema.index({ campaignId: 1, userId: 1 }, { unique: true });
inboxSchema.index({ userId: 1, createdAt: -1, _id: -1 });
inboxSchema.index({ userId: 1, readAt: 1 });

const pushDeviceSchema = new Schema({
  token: { type: String, required: true, unique: true, maxlength: 200 },
  nativeToken: { type: String, maxlength: 4096, select: false },
  nativeProvider: { type: String, enum: ['FCM', 'APNS'] },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sessionId: { type: Schema.Types.ObjectId, ref: 'NativeSession', required: true, index: true },
  platform: { type: String, enum: ['ios', 'android'], required: true },
  active: { type: Boolean, default: true, index: true },
  lastRegisteredAt: { type: Date, default: Date.now },
  lastTestAt: { type: Date, default: null },
}, { timestamps: true });
pushDeviceSchema.index({ userId: 1, active: 1 });
pushDeviceSchema.index({ sessionId: 1, platform: 1, active: 1 });
// Invalid/retired tokens are retained briefly for diagnostics, then removed.
pushDeviceSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { active: false } });

export const NotificationCampaign = models.NotificationCampaign || model('NotificationCampaign', campaignSchema);
export const NotificationCampaignDelivery = models.NotificationCampaignDelivery || model('NotificationCampaignDelivery', deliverySchema);
export const UserInboxNotification = models.UserInboxNotification || model('UserInboxNotification', inboxSchema);
export const PushDevice = models.PushDevice || model('PushDevice', pushDeviceSchema);
