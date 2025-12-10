export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const { analyzeImageAndGenerateSquares, encodeSquareToFrlHex } = require('../../lib/shapeGenerator');
  const formidable = require('formidable');
  const fs = require('fs');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    try {
      if (err) throw err;
      // Determine source: prefer `imageDataUrl` (data URL string), then `imageUrl` or uploaded file
      let source;
      if (fields.imageDataUrl) {
        source = fields.imageDataUrl;
      } else if (fields.imageUrl) {
        source = fields.imageUrl;
      } else if (files?.image) {
        const file = files.image;
        const buf = fs.readFileSync(file.filepath || file.path);
        source = buf;
      } else {
        res.status(400).json({ error: "Provide imageUrl, imageDataUrl, or upload 'image' file." });
        return;
      }

      const opts = {
        baseGridSize: Number(fields.baseGridSize) || 40,
        threshold: Number(fields.threshold) || 16,
        maxSquares: Number(fields.maxSquares) || 200,
        downscalePercent: Number(fields.downscale) || 10,
        capLayers: fields.uncap === 'true' ? false : true,
        maxLayers: Number(fields.maxLayers) || 1500
      };

      let shapes, meta;
      try {
        ({ shapes, meta } = await analyzeImageAndGenerateSquares(source, opts));
      } catch (err) {
        console.error('[api/generate] analyze failed:', err && err.message);
        // Fallback: generate a grid of placeholder squares
        const grid = Math.min(opts.baseGridSize || 16, 64);
        const arr = [];
        for (let yy = 0; yy < grid; yy++) {
          for (let xx = 0; xx < grid && arr.length < (opts.maxSquares || 200); xx++) {
            const x = (xx + 0.5) / grid;
            const y = (yy + 0.5) / grid;
            const c1 = Math.floor((xx / (grid - 1 || 1)) * 255);
            const c2 = Math.floor((yy / (grid - 1 || 1)) * 255);
            const color = '#' + [c1, c2, 128].map(v => v.toString(16).padStart(2, '0')).join('');
            arr.push({
              type: 'square',
              x,
              y,
              scaleX: 1 / grid,
              scaleY: 1 / grid,
              rotation: 0,
              color,
              blend: 'normal'
            });
          }
        }
        shapes = arr;
        meta = { originalWidth: 800, originalHeight: 800, width: 800, height: 800, layers: arr.length, fallback: true };
      }

      const frlHex = shapes.map(s => encodeSquareToFrlHex(s));

      res.status(200).json({ meta, shapes, frlHex });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Internal error' });
    }
  });
}
