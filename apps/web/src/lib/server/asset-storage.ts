import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.env.WAYMARK_ASSET_DIR ?? join(process.cwd(), ".data", "assets");

export async function putAsset(key: string, data: Uint8Array) {
  const path = join(root, key);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, data);
}

export function assetPath(key: string) { return join(root, key); }
export async function getAsset(key: string) { return readFile(assetPath(key)); }
export async function removeAsset(key: string) { await unlink(assetPath(key)).catch(() => undefined); }
