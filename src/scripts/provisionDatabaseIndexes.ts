import { loadEnvConfig } from '@next/env';
import mongoose from 'mongoose';

// Explicit, additive provisioning. Never use syncIndexes(): it can drop indexes
// belonging to the shared Platform schema.
loadEnvConfig(process.cwd(), true);

async function main() {
  const { connectDB } = await import('../lib/db/connect');
  await import('../lib/db/models');
  await import('../lib/notifications/content-event-model');
  await import('../lib/notifications/campaign-models');
  if (!await connectDB()) throw new Error('MONGODB_URI is not configured');
  for (const model of Object.values(mongoose.models)) {
    await model.createCollection();
    await model.createIndexes();
    console.log(`Provisioned ${model.modelName}`);
  }
}

main().catch(() => {
  // Raw database errors may include private connection details.
  console.error('Database provisioning failed; check connectivity and index conflicts before retrying.');
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
