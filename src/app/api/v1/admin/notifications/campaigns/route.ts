import { getCurrentAdmin } from '@/lib/auth';
import { connectDB } from '@/lib/db/connect';
import { AdminAuditLog, Series } from '@/lib/db/models';
import { canManageOperations, jsonError, jsonOk, parseAdminJsonBody } from '@/lib/admin/operations-api';
import { isSameOriginAdminMutation } from '@/lib/admin/access';
import { NotificationCampaign, NotificationCampaignDelivery, UserInboxNotification } from '@/lib/notifications/campaign-models';
import { validateCampaignInput } from '@/lib/notifications/campaign-policy';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('يرجى تسجيل الدخول كمسؤول', 401);
  if (!canManageOperations(admin.role)) return jsonError('ليس لديك صلاحية إدارة الإشعارات', 403);
  if (!await connectDB()) return jsonError('قاعدة البيانات غير متاحة حالياً', 503);
  try {
    await NotificationCampaign.init();
    const [campaigns, series] = await Promise.all([
      NotificationCampaign.find().sort({ createdAt: -1 }).limit(100).select('_id source title body targetUrl audienceType seriesId status createdBy queuedAt completedAt recipientCount errorCode createdAt updatedAt').lean<any[]>(),
      Series.find({ publishedAt: { $ne: null, $lte: new Date() } }).sort({ title: 1 }).select('_id title').lean<any[]>(),
    ]);
    const [inboxCounts, deliveryStats] = await Promise.all([
      campaigns.length ? UserInboxNotification.aggregate([
        { $match: { campaignId: { $in: campaigns.map(item => item._id) } } },
        { $group: { _id: '$campaignId', count: { $sum: 1 } } },
      ]) : [],
      campaigns.length ? NotificationCampaignDelivery.aggregate([
        { $match: { campaignId: { $in: campaigns.map(item => item._id) } } },
        { $group: { _id: { campaignId: '$campaignId', status: '$status' }, count: { $sum: 1 } } },
      ]) : [],
    ]);
    const inboxByCampaign = new Map(inboxCounts.map((item: any) => [String(item._id), item.count]));
    const statsByCampaign = new Map<string, { failedCount: number; skippedCount: number }>();
    for (const stat of deliveryStats) {
      const id = String(stat._id.campaignId);
      const value = statsByCampaign.get(id) || { failedCount: 0, skippedCount: 0 };
      if (stat._id.status === 'FAILED') value.failedCount = stat.count;
      if (stat._id.status === 'SKIPPED') value.skippedCount = stat.count;
      statsByCampaign.set(id, value);
    }
    return jsonOk({ campaigns: campaigns.map(item => ({ ...item, inboxCount: inboxByCampaign.get(String(item._id)) || 0, ...(statsByCampaign.get(String(item._id)) || { failedCount: 0, skippedCount: 0 }), _id: String(item._id), seriesId: item.seriesId ? String(item.seriesId) : null })), series: series.map(item => ({ id: String(item._id), title: item.title })) });
  } catch { return jsonError('تعذر تحميل الحملات', 503); }
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('يرجى تسجيل الدخول كمسؤول', 401);
  if (!canManageOperations(admin.role)) return jsonError('ليس لديك صلاحية إدارة الإشعارات', 403);
  if (!isSameOriginAdminMutation(request)) return jsonError('مصدر الطلب غير صالح', 403);
  const parsed = await parseAdminJsonBody(request, 16 * 1024);
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);
  const input = validateCampaignInput(parsed.body);
  if (!input) return jsonError('راجع نص الإشعار والجمهور والرابط', 400);
  if (!await connectDB()) return jsonError('قاعدة البيانات غير متاحة حالياً', 503);
  try {
    if (input.audienceType === 'SERIES') {
      const series = await Series.findOne({ _id: input.seriesId, publishedAt: { $ne: null, $lte: new Date() } }).select('_id').lean();
      if (!series) return jsonError('المسلسل غير منشور أو غير موجود', 400);
    }
    await NotificationCampaign.init();
    const campaign = await NotificationCampaign.create({ ...input, createdBy: admin.userId, status: 'DRAFT' });
    await AdminAuditLog.create({ adminUserId: admin.userId, action: 'NOTIFICATION_CAMPAIGN_CREATED', targetEntity: 'NotificationCampaign', entityId: String(campaign._id), newState: { title: input.title, audienceType: input.audienceType, seriesId: input.seriesId } });
    return jsonOk({ campaign: { _id: String(campaign._id), title: campaign.title, status: campaign.status } }, 201);
  } catch { return jsonError('تعذر حفظ مسودة الإشعار', 503); }
}
