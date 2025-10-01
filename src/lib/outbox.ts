import { getContainer } from '@/lib/azureBlob';
import crypto from 'crypto';
import { env } from '../config/environment';
export type OutboxItem = {
  id: string;
  ts: string;
  type: 'patient_summary_ready' | 'avatar_share_granted';
  payload: any;
  status: 'pending' | 'sent' | 'error';
  attempts: number;
  lastError?: string;
};
export async function enqueue(item: Omit<OutboxItem, 'id' | 'ts' | 'status' | 'attempts'>) {
  const id = 'obx-' + Date.now();
  const data: OutboxItem = {
    id,
    ts: new Date().toISOString(),
    status: 'pending',
    attempts: 0,
    ...item,
  };
  const cont = await getContainer();
  const blob = cont.getBlockBlobClient(`outbox/${id}.json`);
  await blob.upload(JSON.stringify(data), Buffer.byteLength(JSON.stringify(data)), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
    overwrite: true as any,
  });
  return id;
}
export function sign(body: any) {
  const key = env.INTEGRATION_HMAC_SECRET || 'dev';
  const payload = JSON.stringify(body);
  const sig = crypto.createHmac('sha256', key).update(payload).digest('hex');
  return { payload, sig };
}
