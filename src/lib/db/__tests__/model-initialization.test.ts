import assert from 'node:assert/strict';
import { Mongoose, Schema } from 'mongoose';

async function main() {
  const db = new Mongoose();
  db.set('autoCreate', false);
  db.connection.config.autoCreate = false;

  // Reproduce the sticky initialization failure behind the production error:
  // retrying a healthy write cannot repair an already rejected init promise.
  const failed = db.model('CachedInitFailure', new Schema({ key: { type: String, unique: true } }));
  let indexCalls = 0;
  const timeout = Object.assign(new Error('connection pool timeout'), { name: 'MongoWaitQueueTimeoutError' });
  failed.ensureIndexes = async () => { indexCalls++; throw timeout; };
  await assert.rejects(failed.init(), (error) => error === timeout);
  failed.ensureIndexes = async () => { indexCalls++; };
  await assert.rejects(failed.init(), (error) => error === timeout);
  assert.equal(indexCalls, 1);

  // With runtime provisioning disabled, init must not acquire any connection
  // for DDL, even when the schema contains unique indexes.
  db.set('autoIndex', false);
  const runtime = db.model('RuntimeOnly', new Schema({ key: { type: String, unique: true } }));
  runtime.createCollection = async () => { throw new Error('Unexpected runtime collection provisioning'); };
  runtime.ensureIndexes = async () => { throw new Error('Unexpected runtime index provisioning'); };
  await runtime.init();
  await runtime.init();
  console.log('Model initialization regression tests passed');
}

const watchdog = setTimeout(() => { console.error('Initialization test did not complete'); process.exit(1); }, 5000);
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => clearTimeout(watchdog));
