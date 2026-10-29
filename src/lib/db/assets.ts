import { query } from './postgres';
import { DEFAULT_LIQUIDITY, type AssetInput } from '@/lib/validation/assets';

export interface Asset {
  id: number;
  name: string;
  assetType: string;
  liquidity: string;
  purchaseValue: number;
  currentValue: number;
  purchaseDate: string;
  valuationDate: string;
  notes: string | null;
}

const COLUMNS = `id, name, asset_type, liquidity, purchase_value, current_value,
  to_char(purchase_date, 'YYYY-MM-DD') AS purchase_date,
  to_char(valuation_date, 'YYYY-MM-DD') AS valuation_date, notes`;

function toAsset(r: Record<string, unknown>): Asset {
  return {
    id: Number(r.id),
    name: String(r.name),
    assetType: String(r.asset_type),
    liquidity: String(r.liquidity),
    purchaseValue: Number(r.purchase_value),
    currentValue: Number(r.current_value),
    purchaseDate: String(r.purchase_date),
    valuationDate: String(r.valuation_date),
    notes: (r.notes as string | null) ?? null,
  };
}

function values(userId: number, a: AssetInput) {
  return [
    userId,
    a.name,
    a.assetType,
    a.liquidity ?? DEFAULT_LIQUIDITY[a.assetType],
    a.purchaseValue,
    a.currentValue,
    a.purchaseDate,
    a.valuationDate ?? new Date().toISOString().slice(0, 10),
    a.notes || null,
  ];
}

export async function listAssets(userId: number): Promise<Asset[]> {
  const rows = await query(`SELECT ${COLUMNS} FROM assets WHERE user_id = $1 ORDER BY current_value DESC, id`, [userId]);
  return rows.map(toAsset);
}

export async function getAsset(userId: number, id: number): Promise<Asset | null> {
  const rows = await query(`SELECT ${COLUMNS} FROM assets WHERE id = $1 AND user_id = $2`, [id, userId]);
  return rows[0] ? toAsset(rows[0]) : null;
}

export async function createAsset(userId: number, a: AssetInput): Promise<Asset> {
  const rows = await query(
    `INSERT INTO assets (user_id, name, asset_type, liquidity, purchase_value, current_value,
                         purchase_date, valuation_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${COLUMNS}`,
    values(userId, a),
  );
  return toAsset(rows[0]);
}

/** Ownership is part of the WHERE clause, so another user's asset is simply "not found" (SR-05). */
export async function updateAsset(userId: number, id: number, a: AssetInput): Promise<Asset | null> {
  const rows = await query(
    `UPDATE assets SET name = $2, asset_type = $3, liquidity = $4, purchase_value = $5, current_value = $6,
                       purchase_date = $7, valuation_date = $8, notes = $9
      WHERE user_id = $1 AND id = $10
      RETURNING ${COLUMNS}`,
    [...values(userId, a), id],
  );
  return rows[0] ? toAsset(rows[0]) : null;
}

export async function deleteAsset(userId: number, id: number): Promise<boolean> {
  const rows = await query('DELETE FROM assets WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
  return rows.length > 0;
}
