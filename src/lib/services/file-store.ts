import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from '@/lib/api';

/**
 * Private file storage for the vault (FR-17, SR-07).
 * Files are saved OUTSIDE public/ under generated names, so they can only be downloaded
 * through the authenticated /api/vault/{id}/file route.
 */

export const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedType = (typeof ALLOWED_TYPES)[number];

const EXT: Record<AllowedType, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * Detects the real type from the first bytes (the "magic number"), ignoring the file name and the
 * browser's Content-Type, which a user can fake. Returns null for anything not allowed.
 */
export function detectType(bytes: Uint8Array): AllowedType | null {
  const b = (i: number) => bytes[i];
  if (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46) return 'application/pdf';         // %PDF
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'image/jpeg';
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return 'image/png';
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

export function uploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
}

/** Saves the bytes under a random name. Throws 503 when the storage folder cannot be written (NFR-04). */
export async function saveFile(bytes: Uint8Array, type: AllowedType): Promise<string> {
  const name = `${randomUUID()}.${EXT[type]}`;
  try {
    await mkdir(uploadDir(), { recursive: true });
    await writeFile(path.join(uploadDir(), name), bytes);
  } catch {
    throw new HttpError(503, 'The document vault is unavailable right now. Please try again later.');
  }
  return name;
}

/** Only generated names are accepted, so a stored name can never point outside the folder. */
function safePath(storedName: string): string {
  if (!/^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/.test(storedName)) throw new HttpError(404, 'File not found.');
  return path.join(uploadDir(), storedName);
}

export async function loadFile(storedName: string): Promise<Buffer> {
  try {
    return await readFile(safePath(storedName));
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(404, 'File not found.');
  }
}

export async function removeFile(storedName: string): Promise<void> {
  await unlink(safePath(storedName)).catch(() => undefined);
}