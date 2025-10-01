import { getContainer } from './azureBlob';
export async function getJson(path: string): Promise<any | null> {
  const cont = await getContainer();
  const blob = cont.getBlockBlobClient(path);
  try {
    const r = await blob.download();
    const buf = await streamToBuffer(r.readableStreamBody!);
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
}
export async function putJson(path: string, data: any) {
  const cont = await getContainer();
  const blob = cont.getBlockBlobClient(path);
  const body = JSON.stringify(data);
  await blob.upload(body, Buffer.byteLength(body), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
    overwrite: true as any,
  });
}
function streamToBuffer(stream: NodeJS.ReadableStream) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', d => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
