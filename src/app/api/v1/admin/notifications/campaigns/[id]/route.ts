import { isValidObjectId } from 'mongoose';
import { getCurrentAdmin } from '@/lib/auth';
import { connectDB } from '@/lib/db/connect';
import { AdminAuditLog, Series } from '@/lib/db/models';
import { canManageOperations, jsonError, jsonOk, parseAdminJsonBody } from '@/lib/admin/operations-api';
import { isSameOriginAdminMutation } from '@/lib/admin/access';
import { NotificationCampaign } from '@/lib/notifications/campaign-models';
import { validateCampaignInput } from '@/lib/notifications/campaign-policy';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('يرجى تسجيل الدخول كمسؤول', 401);
  if (!canManageOperations(admin.role)) return jsonError('ليس لديك صلاحية إدارة الإشعارات', 403);
  if (!isSameOriginAdminMutation(request)) return jsonError('مصدر الطلب غير صالح', 403);
  const { id } = await context.params;
  if (!isValidObjectId(id)) return jsonError('الحملة غير موجودة', 404);
  const parsed = await parseAdminJsonBody(request, 16 * 1024);
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);
  const input = validateCampaignInput(parsed.body);
  if (!input) return jsonError('راجع نص الإشعار والجمهور والرابط', 400);
  if (!await connectDB()) return jsonError('قاعدة البيانات غير متاحة حالياً', 503);
  try {
    if (input.audienceType === 'SERIES' && !await Series.exists({ _id: input.seriesId, publishedAt: { $ne: null, $lte: new Date() } })) return jsonError('المسلسل غير منشور أو غير موجود', 400);
    const result = await NotificationCampaign.findOneAndUpdate({ _id: id, status: 'DRAFT' }, { $set: input }, { new: true }).select('_id status title').lean<any>();
    if (!result) return jsonError('يمكن تعديل المسودات فقط', 409);
    await AdminAuditLog.create({ adminUserId: admin.userId, action: 'NOTIFICATION_CAMPAIGN_UPDATED', targetEntity: 'NotificationCampaign', entityId: id, newState: { title: input.title, audienceType: input.audienceType, seriesId: input.seriesId } });
    return jsonOk({ campaign: { ...result, _id: String(result._id) } });
  } catch { return jsonError('تعذر تحديث المسودة', 503); }
}

export async function DELETE(request: Request, context: Context) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('يرجى تسجيل الدخول كمسؤول', 401);
  if (!canManageOperations(admin.role)) return jsonError('ليس لديك صلاحية إدارة الإشعارات', 403);
  if (!isSameOriginAdminMutation(request)) return jsonError('مصدر الطلب غير صالح', 403);
  const { id } = await context.params;
  if (!isValidObjectId(id)) return jsonError('الحملة غير موجودة', 404);
  if (!await connectDB()) return jsonError('قاعدة البيانات غير متاحة حالياً', 503);
  try {
    const result = await NotificationCampaign.findOneAndDelete({ _id: id, status: 'DRAFT' }).select('_id').lean<any>();
    if (!result) return jsonError('يمكن حذف المسودات فقط', 409);
    await AdminAuditLog.create({ adminUserId: admin.userId, action: 'NOTIFICATION_CAMPAIGN_DELETED', targetEntity: 'NotificationCampaign', entityId: id });
    return jsonOk({ deleted: true });
  } catch { return jsonError('تعذر حذف المسودة', 503); }
}
