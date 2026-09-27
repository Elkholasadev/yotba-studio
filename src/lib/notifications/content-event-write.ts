import type { ClientSession } from 'mongoose';
import { ContentNotificationEvent } from './content-event-model';
import { NotificationCampaign } from './campaign-models';
import { contentEventKey, type ContentEventType } from './content-event-policy';

export async function enqueueContentEvent(
  session: ClientSession,
  type: ContentEventType,
  ids: { entityId: any; seriesId: any; seasonId?: any; episodeId?: any },
  availableAt: Date,
) {
  const now = new Date();
  const eventKey = contentEventKey(type, ids.entityId);
  const pending = await ContentNotificationEvent.updateOne(
    { eventKey, state: 'PENDING', campaignId: null },
    { $set: { type, ...ids, availableAt, nextAttemptAt: now, state: 'PENDING', errorCode: null, leaseId: null, leaseExpiresAt: null } },
    { session },
  );
  if (pending.matchedCount) return;
  const skipped = await ContentNotificationEvent.findOne({ eventKey, state: 'SKIPPED', campaignId: null }).session(session).select('_id').lean<any>();
  if (skipped && !await NotificationCampaign.exists({ sourceEventKey: eventKey }).session(session)) {
    await ContentNotificationEvent.updateOne(
      { _id: skipped._id, state: 'SKIPPED', campaignId: null },
      { $set: { type, ...ids, availableAt, nextAttemptAt: now, state: 'PENDING', errorCode: null, leaseId: null, leaseExpiresAt: null } },
      { session },
    );
    return;
  }
  await ContentNotificationEvent.updateOne(
    { eventKey },
    { $setOnInsert: { eventKey, type, ...ids, availableAt, nextAttemptAt: now, state: 'PENDING', attempts: 0 } },
    { upsert: true, session, setDefaultsOnInsert: true },
  );
}
