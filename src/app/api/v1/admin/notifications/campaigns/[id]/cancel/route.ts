import { isValidObjectId } from 'mongoose';
import { getCurrentAdmin } from '@/lib/auth';
import { connectDB } from '@/lib/db/connect';
import { AdminAuditLog } from '@/lib/db/models';
import { canManageOperations, jsonError, jsonOk } from '@/lib/admin/operations-api';
import { isSameOriginAdminMutation } from '@/lib/admin/access';
import { NotificationCampaign, NotificationCampaignDelivery } from '@/lib/notifications/campaign-models';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('يرجى تسجيل الدخول كمسؤول', 401);
  if (!canManageOperations(admin.role)) return jsonError('ليس لديك صلاحية إدارة الإشعارات', 403);
  if (!isSameOriginAdminMutation(request)) return jsonError('مصدر الطلب غير صالح', 403);
  const { id } = await context.params;
  if (!isValidObjectId(id)) return jsonError('الحملة غير موجودة', 404);
  if (!await connectDB()) return jsonError('قاعدة البيانات غير متاحة حالياً', 503);
  try {
    const result = await NotificationCampaign.findOneAndUpdate({ _id: id, status: { $in: ['QUEUED', 'PROCESSING'] } }, { $set: { status: 'CANCELLED', dispatchLeaseExpiresAt: new Date(0) } }, { new: true }).select('_id status recipientCount').lean<any>();
    if (!result) return jsonError('يمكن إيقاف الحملات المجدولة أو الجارية فقط', 409);
    // A current network request cannot be recalled, but all unclaimed future push jobs stop.
    await NotificationCampaignDelivery.updateMany({ campaignId: id, status: 'PENDING' }, { $set: { status: 'SKIPPED', errorCode: 'CAMPAIGN_CANCELLED' } });
    await AdminAuditLog.create({ adminUserId: admin.userId, action: 'NOTIFICATION_CAMPAIGN_CANCELLED', targetEntity: 'NotificationCampaign', entityId: id });
    return jsonOk({ campaign: { ...result, _id: String(result._id) } });
  } catch { return jsonError('تعذر إلغاء الإشعار', 503); }
}
