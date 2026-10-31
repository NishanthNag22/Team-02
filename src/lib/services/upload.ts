import { HttpError } from '@/lib/api';
import { detectType, type AllowedType } from './file-store';

/**
 * Reads the "file" field of a multipart request and checks size and real type (SR-07).
 * 413 when too large, 415 when the type is not in `allowed`.
 */
export async function readUpload(form: FormData | null, maxBytes: number, allowed: readonly AllowedType[], label: string) {
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0) throw new HttpError(422, 'Choose a file to upload.');
  if (file.size > maxBytes) throw new HttpError(413, `The file is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectType(bytes);
  if (!type || !allowed.includes(type)) throw new HttpError(415, `Only ${label} files are allowed.`);
  return { name: file.name, bytes, type };
}