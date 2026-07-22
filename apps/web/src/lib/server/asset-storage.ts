import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const root = process.env.WAYMARK_ASSET_DIR ?? join(process.cwd(), ".data", "assets");
const bucket = process.env.STORAGE_BUCKET;
const s3 = process.env.STORAGE_ENDPOINT && bucket && process.env.STORAGE_ACCESS_KEY_ID && process.env.STORAGE_SECRET_ACCESS_KEY
  ? new S3Client({ region: process.env.STORAGE_REGION ?? "auto", endpoint: process.env.STORAGE_ENDPOINT, credentials: { accessKeyId: process.env.STORAGE_ACCESS_KEY_ID, secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY } })
  : null;

function assertStorageConfigured() {
  if (process.env.NODE_ENV === "production" && !s3) throw new Error("Persistent asset storage is not configured.");
}

export async function putAsset(key: string, data: Uint8Array) {
  assertStorageConfigured();
  if (s3 && bucket) { await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data })); return; }
  const path = join(root, key);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, data);
}

export function assetPath(key: string) { return join(root, key); }
export async function getAsset(key: string) {
  assertStorageConfigured();
  if (s3 && bucket) { const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key })); return result.Body ? new Uint8Array(await result.Body.transformToByteArray()) : new Uint8Array(); }
  return readFile(assetPath(key));
}
export async function removeAsset(key: string) {
  assertStorageConfigured();
  if (s3 && bucket) { await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); return; }
  await unlink(assetPath(key)).catch(() => undefined);
}
