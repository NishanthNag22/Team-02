import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { ruleSchema } from '@/lib/validation/rules';
import { applyRuleToExisting, createRule, listRules } from '@/lib/db/rules';
import { apiError, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/rules – my rules and the system rules (FR-15) */
export async function GET() {
  try {
    const user = await requireUser();
    return ok({ rules: await listRules(user.id) });
  } catch (err) {
    return apiError(err);
  }
}

/** POST /api/rules – add my own rule and re-categorise my matching transactions (FR-15) */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const rule = await createRule(user.id, ruleSchema.parse(await req.json()));
    const recategorised = await applyRuleToExisting(user.id, rule);
    return ok({ rule, recategorised }, 201);
  } catch (err) {
    return apiError(err);
  }
}
