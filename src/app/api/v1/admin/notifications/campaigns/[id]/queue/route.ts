import { isValidObjectId } from 'mongoose';
import { getCurrentAdmin } from '@/lib/auth';
import { connectDB } from '@/lib/db/connect';
import { AdminAuditLog, Series } from '@/lib/db/models';
import { canManageOperations, jsonError, jsonOk } from '@/lib/admin/operations-api';
import { isSameOriginAdminMutation } from '@/lib/admin/access';
import { NotificationCampaign } from '@/lib/notifications/campaign-models';

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
    const draft = await NotificationCampaign.findOne({ _id: id, status: 'DRAFT' }).lean<any>();
    if (!draft) return jsonError('المسودة غير موجودة أو تم إرسالها بالفعل', 409);
    if (draft.audienceType === 'SERIES' && !await Series.exists({ _id: draft.seriesId, publishedAt: { $ne: null, $lte: new Date() } })) return jsonError('المسلسل لم يعد منشوراً', 409);
    const queuedAt = new Date();
    const result = await NotificationCampaign.findOneAndUpdate({ _id: id, status: 'DRAFT' }, { $set: { status: 'QUEUED', queuedAt, fanoutComplete: false, recipientCursor: null, recipientCount: 0, errorCode: null } }, { new: true }).select('_id status queuedAt').lean<any>();
    if (!result) return jsonError('تم تحديث المسودة من مسؤول آخر', 409);
    await AdminAuditLog.create({ adminUserId: admin.userId, action: 'NOTIFICATION_CAMPAIGN_QUEUED', targetEntity: 'NotificationCampaign', entityId: id, newState: { queuedAt, audienceType: draft.audienceType, seriesId: draft.seriesId } });
    return jsonOk({ campaign: { ...result, _id: String(result._id) } });
  } catch { return jsonError('تعذر جدولة الإشعار', 503); }
}
