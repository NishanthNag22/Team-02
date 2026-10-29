import { query, withTransaction } from './postgres';
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

export interface Valuation {
  valuationDate: string;
  value: number;
  source: string;
}

/** Creates the asset and its first valuation point in one transaction (FR-06). */
export async function createAsset(userId: number, a: AssetInput): Promise<Asset> {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO assets (user_id, name, asset_type, liquidity, purchase_value, current_value,
                           purchase_date, valuation_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${COLUMNS}`,
      values(userId, a),
    );
    const asset = toAsset(rows[0]);
    await client.query(
      `INSERT INTO asset_valuations (asset_id, valuation_date, value, source) VALUES ($1, $2, $3, 'manual-entry')`,
      [asset.id, asset.valuationDate, asset.currentValue],
    );
    return asset;
  });
}

/** Ownership is part of the WHERE clause, so another user's asset is simply "not found" (SR-05). */
export async function updateAsset(userId: number, id: number, a: AssetInput): Promise<Asset | null> {
  return withTransaction(async (client) => {
    const before = await client.query<{ current_value: string; valuation_date: string }>(
      `SELECT current_value, to_char(valuation_date, 'YYYY-MM-DD') AS valuation_date
         FROM assets WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [id, userId],
    );
    if (before.rows.length === 0) return null;

    const { rows } = await client.query(
      `UPDATE assets SET name = $2, asset_type = $3, liquidity = $4, purchase_value = $5, current_value = $6,
                         purchase_date = $7, valuation_date = $8, notes = $9
        WHERE user_id = $1 AND id = $10
        RETURNING ${COLUMNS}`,
      [...values(userId, a), id],
    );
    const asset = toAsset(rows[0]);

    // A revaluation (new value or new valuation date) adds a history point; editing only the name does not.
    const old = before.rows[0];
    if (Number(old.current_value) !== asset.currentValue || old.valuation_date !== asset.valuationDate) {
      await client.query(
        `INSERT INTO asset_valuations (asset_id, valuation_date, value, source) VALUES ($1, $2, $3, 'revaluation')`,
        [asset.id, asset.valuationDate, asset.currentValue],
      );
    }
    return asset;
  });
}

/** Valuation history, oldest first. Ownership checked through the assets table. */
export async function getValuationHistory(userId: number, assetId: number): Promise<Valuation[]> {
  const rows = await query(
    `SELECT to_char(v.valuation_date, 'YYYY-MM-DD') AS valuation_date, v.value, v.source
       FROM asset_valuations v
       JOIN assets a ON a.id = v.asset_id
      WHERE v.asset_id = $1 AND a.user_id = $2
      ORDER BY v.valuation_date, v.id`,
    [assetId, userId],
  );
  return rows.map((r) => ({ valuationDate: String(r.valuation_date), value: Number(r.value), source: String(r.source) }));
}

export async function deleteAsset(userId: number, id: number): Promise<boolean> {
  const rows = await query('DELETE FROM assets WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
  return rows.length > 0;
}
