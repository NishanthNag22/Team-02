import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { apiError, HttpError, ok } from '@/lib/api';
import { parseStatement } from '@/lib/services/csv-parser';
import { previewImport } from '@/lib/db/imports';
import { MAX_CSV_BYTES } from '@/lib/validation/imports';

export const dynamic = 'force-dynamic';

/** POST /api/imports/preview – multipart form with field "file" (a .csv up to 5 MB). Saves nothing (FR-14). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) throw new HttpError(422, 'Choose a CSV file to upload.');
    if (!file.name.toLowerCase().endsWith('.csv')) throw new HttpError(415, 'Only .csv files can be imported.');
    if (file.size > MAX_CSV_BYTES) throw new HttpError(413, 'The file is larger than 5 MB.');

    let statement;
    try {
      statement = parseStatement(file.name, await file.text());
    } catch (e) {
      throw new HttpError(422, (e as Error).message);
    }
    const rows = await previewImport(user.id, statement);
    return ok({ fileName: file.name, bank: statement.bank, rows, rejected: statement.rejected });
  } catch (err) {
    return apiError(err);
  }
}
