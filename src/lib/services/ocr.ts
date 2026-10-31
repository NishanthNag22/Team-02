import path from 'node:path';
import { createWorker } from 'tesseract.js';
import { HttpError } from '@/lib/api';
import { extractReceiptFields, type ReceiptFields } from './receipt-fields';

/**
 * Server-side OCR with tesseract.js (FR-16). The English model is loaded from node_modules,
 * so no internet connection is needed and the image never leaves the server.
 */
const LANG_PATH = path.join(process.cwd(), 'node_modules', '@tesseract.js-data', 'eng', '4.0.0_best_int');

export interface OcrResult extends ReceiptFields { confidence: number; text: string }

export async function scanReceipt(image: Uint8Array): Promise<OcrResult> {
  let worker;
  try {
    worker = await createWorker('eng', 1, { langPath: LANG_PATH, cacheMethod: 'none', gzip: true });
    const { data } = await worker.recognize(Buffer.from(image));
    return { ...extractReceiptFields(data.text), confidence: Math.round(data.confidence), text: data.text };
  } catch (e) {
    console.error('[ocr] failed:', e);
    throw new HttpError(422, 'The image could not be read. Try a clearer, well-lit photo.');
  } finally {
    await worker?.terminate();
  }
}