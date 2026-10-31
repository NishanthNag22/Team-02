import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/** An error that carries the HTTP status to return (401, 403, 404, 409, ...). */
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * One place that turns any error into a safe JSON response (SR-08).
 * Never returns stack traces or raw database messages.
 */
export function apiError(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json({ error: 'Validation failed', fields: err.flatten().fieldErrors }, { status: 422 });
  }
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const pg = err as { code?: string };
  if (pg?.code === '23505') return NextResponse.json({ error: 'That record already exists.' }, { status: 409 });
  if (pg?.code === '23514') return NextResponse.json({ error: 'A value was rejected by the database.' }, { status: 422 });
  if (pg?.code === '23503') return NextResponse.json({ error: 'Referenced record does not exist.' }, { status: 422 });
  // Invalid values only the database can catch, e.g. the impossible date 2026-02-30 (SR-06)
  if (pg?.code && ['22007', '22008', '22003', '22P02'].includes(pg.code)) {
    return NextResponse.json({ error: 'A value is not valid (for example an impossible date or a number out of range).' }, { status: 422 });
  }

  console.error('[api] unhandled error:', err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

/** Parses a route id like /api/assets/12. Anything else is a 404. */
export function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'Not found.');
  return id;
}
