import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { env } from '../config/environment';
let _container: ContainerClient | null = null;
export async function getContainer(): Promise<ContainerClient> {
  if (_container) return _container;
  const conn = env.AZURE_STORAGE_CONNECTION_STRING!;
  const name = env.AZURE_STORAGE_CONTAINER || 'tshla';
  const svc = BlobServiceClient.fromConnectionString(conn);
  const cont = svc.getContainerClient(name);
  await cont.createIfNotExists();
  _container = cont;
  return cont;
}
