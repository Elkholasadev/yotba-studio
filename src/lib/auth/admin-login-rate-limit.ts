import { createHash } from 'node:crypto';
import mongoose, { Schema, models } from 'mongoose';
import { connectDB } from '@/lib/db/connect';

const WINDOW_MS = 15 * 60_000;
const LIMITS = { ip: 25, account: 20 } as const;

const AdminLoginAttemptSchema = new Schema({
  key: { type: String, required: true },
  windowStart: { type: Date, required: true },
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
}, { versionKey: false });
AdminLoginAttemptSchema.index({ key: 1, windowStart: 1 }, { unique: true });
AdminLoginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const AdminLoginAttempt = models.AdminLoginAttempt ||
  mongoose.model('AdminLoginAttempt', AdminLoginAttemptSchema);

async function increment(scope: keyof typeof LIMITS, identity: string, windowStart: Date): Promise<number> {
  const key = createHash('sha256').update(`${scope}:${identity}`).digest('hex');
  const query = { key, windowStart };
  const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart.getTime() + WINDOW_MS * 2) } };
  try {
    const record = await AdminLoginAttempt.findOneAndUpdate(query, update, { upsert: true, new: true });
    return record.count;
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    const record = await AdminLoginAttempt.findOneAndUpdate(query, { $inc: { count: 1 } }, { new: true });
    if (!record) throw error;
    return record.count;
  }
}

/** Shared across serverless instances; the account limit cannot be evaded by changing IPs. */
export async function allowAdminLoginAttempt(ip: string, email: string): Promise<boolean> {
  if (!await connectDB()) throw new Error('ADMIN_LOGIN_DATABASE_UNAVAILABLE');
  await AdminLoginAttempt.init();
  const windowStart = new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS);
  const [ipCount, accountCount] = await Promise.all([
    increment('ip', ip, windowStart),
    increment('account', email.toLowerCase().trim(), windowStart),
  ]);
  return ipCount <= LIMITS.ip && accountCount <= LIMITS.account;
}
