import { requireUser } from '@/lib/auth/session';
import { apiError } from '@/lib/api';
import { statementData } from '@/lib/db/statement';
import { buildStatement } from '@/lib/services/pdf-statement';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET /api/reports/statement – downloadable PDF net worth statement (FR-23). Never cached (SR-09). */
export async function GET() {
  try {
    const user = await requireUser();
    const data = await statementData(user.id);
    const pdf = await buildStatement(data);
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="wealthwise-statement-${data.generatedOn}.pdf"`,
        'Content-Length': String(pdf.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
