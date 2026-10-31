import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { apiError, HttpError, parseId } from '@/lib/api';
import { getStoredFile } from '@/lib/db/documents';
import { loadFile } from '@/lib/services/file-store';

export const dynamic = 'force-dynamic';
type Ctx = { params: { id: string } };

/**
 * GET /api/vault/{id}/file – authenticated download (FR-17, SR-05, SR-07).
 * Only the owner gets the bytes; nosniff stops the browser guessing a different type.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser();
    const doc = await getStoredFile(user.id, parseId(params.id));
    if (!doc) throw new HttpError(404, 'Document not found');
    const bytes = await loadFile(doc.storedName);
    const disposition = req.nextUrl.searchParams.get('download') ? 'attachment' : 'inline';
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': doc.mimeType,
        'Content-Length': String(bytes.length),
        'Content-Disposition': `${disposition}; filename="${doc.fileName.replace(/[^\w.\- ]/g, '_')}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    return apiError(err);
  }
}