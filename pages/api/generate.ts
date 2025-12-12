import type { NextApiRequest, NextApiResponse } from 'next';
import { generateFRLCode } from '../../utils/generator';

// POST API: accepts JSON { width, height, pixelsBase64, spriteId }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { width, height, pixelsBase64, spriteId } = req.body || {};
    if (!width || !height || !pixelsBase64) return res.status(400).json({ error: 'Missing parameters' });

    // Decode base64 RGBA bytes into Uint8Array
    const buffer = Buffer.from(pixelsBase64, 'base64');
    const pixels = new Uint8Array(buffer);

    // Generate FRL code on server
    const code = generateFRLCode(pixels, Number(width), Number(height), spriteId || '0002');

    return res.status(200).json({ code });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
