import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { apiError, ok } from '@/lib/api';
import { listNotifications, markAllRead, markRead } from '@/lib/db/notifications';

export const dynamic = 'force-dynamic';

/** GET /api/notifications – my reminders and unread count; new reminders are created as needed (FR-24). */
export async function GET() {
  try {
    const user = await requireUser();
    return ok(await listNotifications(user.id));
  } catch (err) {
    return apiError(err);
  }
}

const readSchema = z.union([z.object({ id: z.number().int().positive() }), z.object({ all: z.literal(true) })]);

/** POST /api/notifications {id} or {all: true} – mark as read (FR-24). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = readSchema.parse(await req.json());
    const changed = 'all' in body ? await markAllRead(user.id) : await markRead(user.id, body.id);
    return ok({ changed });
  } catch (err) {
    return apiError(err);
  }
}
