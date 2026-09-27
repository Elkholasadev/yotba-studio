'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, Loader2, Plus, RefreshCw, Send, X } from 'lucide-react';

type Series = { id: string; title: string };
type Campaign = { _id: string; source?: 'ADMIN'|'CONTENT'; title: string; body: string; targetUrl: string; audienceType: 'ALL'|'FOLLOWERS'|'SERIES'; seriesId: string|null; status: string; queuedAt?: string; completedAt?: string; recipientCount: number; inboxCount: number; failedCount: number; skippedCount: number; errorCode?: string };
type Notice = (type: 'success'|'error', msg: string) => void;
const statusLabel: Record<string, string> = { DRAFT: 'مسودة', QUEUED: 'في انتظار الإرسال', PROCESSING: 'قيد الإرسال', COMPLETED: 'مكتملة', CANCELLED: 'ملغاة', FAILED: 'تعذّر الإرسال' };

export function NotificationCampaignsPanel({ onNotice }: { onNotice: Notice }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string|null>(null);
  const [form, setForm] = useState({ title: '', body: '', targetUrl: '/', audienceType: 'ALL' as Campaign['audienceType'], seriesId: '' });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/admin/notifications/campaigns', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر تحميل الحملات');
      setCampaigns(data.campaigns || []); setSeries(data.series || []);
    } catch (error) { onNotice('error', error instanceof Error ? error.message : 'تعذر تحميل الحملات'); }
    finally { setLoading(false); }
  }, [onNotice]);
  useEffect(() => { void refresh(); }, [refresh]);

  function edit(item: Campaign) {
    setSelected(item._id);
    setForm({ title: item.title, body: item.body, targetUrl: item.targetUrl, audienceType: item.audienceType, seriesId: item.seriesId || '' });
  }
  function reset() { setSelected(null); setForm({ title: '', body: '', targetUrl: '/', audienceType: 'ALL', seriesId: '' }); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await fetch(selected ? `/api/v1/admin/notifications/campaigns/${selected}` : '/api/v1/admin/notifications/campaigns', {
        method: selected ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, seriesId: form.audienceType === 'SERIES' ? form.seriesId : null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر حفظ المسودة');
      onNotice('success', selected ? 'تم تحديث المسودة' : 'تم حفظ المسودة'); reset(); await refresh();
    } catch (error) { onNotice('error', error instanceof Error ? error.message : 'تعذر حفظ المسودة'); }
    finally { setSaving(false); }
  }
  async function action(item: Campaign, actionName: 'queue'|'cancel'|'delete') {
    const confirmText = actionName === 'queue' ? 'ستُضاف الحملة إلى قائمة الإرسال، وسيعالجها العامل في دورته المجدولة التالية. هل تريد إرسال الحملة؟' : actionName === 'cancel' ? 'إيقاف إرسال هذه الحملة وما تبقى منها؟' : 'حذف المسودة؟';
    if (!window.confirm(confirmText)) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/admin/notifications/campaigns/${item._id}${actionName === 'queue' ? '/queue' : actionName === 'cancel' ? '/cancel' : ''}`, { method: actionName === 'delete' ? 'DELETE' : 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر تنفيذ الإجراء');
      onNotice('success', actionName === 'queue' ? 'أُضيفت الحملة إلى قائمة الإرسال' : actionName === 'cancel' ? 'تم إيقاف ما تبقى من الحملة' : 'تم حذف المسودة');
      if (selected === item._id) reset(); await refresh();
    } catch (error) { onNotice('error', error instanceof Error ? error.message : 'تعذر تنفيذ الإجراء'); }
    finally { setSaving(false); }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-lg font-bold text-editorial-ivory"><BellRing className="h-5 w-5 text-crimson"/> الحملات والإشعارات</h2><p className="mt-1 text-xs text-editorial-muted">إشعارات النشر تُنشأ تلقائياً: المسلسلات والمواسم الجديدة للجميع، والحلقات الجديدة للمتابعين فقط. ويمكنك إرسال حملة يدوية من هنا.</p></div>
      <button type="button" onClick={() => { reset(); document.getElementById('notification-campaign-title')?.focus(); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-crimson px-4 text-sm font-bold text-white"><Plus className="h-4 w-4"/> حملة جديدة</button>
    </div>

    <form onSubmit={save} className="grid gap-3 rounded-xl border border-border-subtle bg-surface-elevated p-4 md:grid-cols-2">
      <label className="text-xs text-editorial-secondary">عنوان الإشعار<input id="notification-campaign-title" required maxLength={100} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-editorial-ivory" /></label>
      <label className="text-xs text-editorial-secondary">رابط داخلي يبدأ بـ /<input required maxLength={300} value={form.targetUrl} onChange={e => setForm({ ...form, targetUrl: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-editorial-ivory" /></label>
      <label className="text-xs text-editorial-secondary md:col-span-2">نص الإشعار<textarea required maxLength={500} rows={3} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-editorial-ivory" /></label>
      <label className="text-xs text-editorial-secondary">الجمهور<select value={form.audienceType} onChange={e => setForm({ ...form, audienceType: e.target.value as Campaign['audienceType'] })} className="mt-1 min-h-11 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-editorial-ivory"><option value="ALL">كل الحسابات النشطة</option><option value="FOLLOWERS">متابعو المسلسلات</option><option value="SERIES">متابعو مسلسل محدد</option></select></label>
      {form.audienceType === 'SERIES' && <label className="text-xs text-editorial-secondary">المسلسل<select required value={form.seriesId} onChange={e => setForm({ ...form, seriesId: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-editorial-ivory"><option value="">اختر مسلسلاً منشوراً</option>{series.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
      <div className="flex flex-wrap gap-2 md:col-span-2"><button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-crimson px-4 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}{selected ? 'حفظ التعديلات' : 'حفظ كمسودة'}</button>{selected && <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-subtle px-4 text-sm text-editorial-secondary"><X className="h-4 w-4"/> إلغاء التعديل</button>}</div>
    </form>

    <div className="flex items-center justify-between"><h3 className="font-bold text-editorial-ivory">الحملات الأخيرة</h3><button type="button" onClick={() => void refresh()} className="inline-flex min-h-10 items-center gap-2 px-3 text-xs text-editorial-secondary"><RefreshCw className="h-3.5 w-3.5"/> تحديث</button></div>
    {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-crimson"/></div> : campaigns.length === 0 ? <p className="rounded-xl border border-border-subtle p-5 text-sm text-editorial-muted">لا توجد حملات بعد.</p> : <div className="space-y-3">{campaigns.map(item => <article key={item._id} className="rounded-xl border border-border-subtle bg-surface-elevated p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="font-bold text-editorial-ivory">{item.title}</h4>{item.source === 'CONTENT' && <span className="text-[11px] text-editorial-muted">إشعار نشر تلقائي</span>}<span className="rounded-full bg-surface px-2 py-1 text-[11px] text-editorial-secondary">{statusLabel[item.status] || item.status}</span></div><p className="mt-1 text-sm text-editorial-secondary">{item.body}</p><p className="mt-2 text-xs text-editorial-muted">{item.audienceType === 'ALL' ? 'كل الحسابات النشطة' : item.audienceType === 'FOLLOWERS' ? 'متابعو المسلسلات' : series.find(s => s.id === item.seriesId)?.title || 'مسلسل محدد'} · المستهدفون {item.recipientCount || 0} · صندوق الوارد {item.inboxCount || 0} · تعذّر تنبيه الجهاز {item.failedCount || 0} · تم تخطيه {item.skippedCount || 0}</p></div><div className="flex flex-wrap gap-2">{item.status === 'DRAFT' && <><button disabled={saving} onClick={() => edit(item)} className="min-h-10 rounded-lg border border-border-subtle px-3 text-xs text-editorial-secondary">تعديل</button><button disabled={saving} onClick={() => void action(item, 'delete')} className="min-h-10 rounded-lg border border-border-subtle px-3 text-xs text-editorial-secondary">حذف</button><button disabled={saving} onClick={() => void action(item, 'queue')} className="min-h-10 rounded-lg bg-crimson px-3 text-xs font-bold text-white disabled:opacity-50">إرسال الحملة</button></>}{['QUEUED', 'PROCESSING'].includes(item.status) && <button disabled={saving} onClick={() => void action(item, 'cancel')} className="min-h-10 rounded-lg border border-amber-700/50 px-3 text-xs text-amber-200">{item.recipientCount ? 'إيقاف المتبقي' : 'إلغاء الإرسال'}</button>}</div></div></article>)}</div>}
  </div>;
}
