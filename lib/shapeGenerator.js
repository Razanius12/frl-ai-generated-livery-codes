const Jimp = require("jimp");

async function analyzeImageAndGenerateSquares(bufferOrUrl, opts = {}) {
  const {
    baseGridSize = 40,
    threshold = 16,
    maxSquares = 200,
    downscalePercent = 10,
    capLayers = true,
    maxLayers = 1500
  } = opts;

  // Helper to load different kinds of inputs: remote URL, data URL, or Buffer
  async function loadImageInput(input) {
    if (!input) throw new Error('No image source');
    // data URL
    if (typeof input === 'string' && /^data:image\//i.test(input)) {
      const m = input.match(/^data:image\/[a-zA-Z]+;base64,(.*)$/);
      if (!m) throw new Error('Malformed data URL');
      const buf = Buffer.from(m[1], 'base64');
      return await Jimp.read(buf);
    }
    // remote URL
    if (typeof input === 'string' && /^https?:\/\//i.test(input)) {
      const fetchBuffer = async (url) => {
        return new Promise((resolve, reject) => {
          try {
            const urlStr = String(url);
            const lib = urlStr.startsWith('https') ? require('https') : require('http');
            lib.get(urlStr, (res) => {
              if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                try {
                  const next = String(new URL(res.headers.location, urlStr).toString());
                  return resolve(fetchBuffer(next));
                } catch (e) {
                  return reject(e);
                }
              }
              if (res.statusCode !== 200) return reject(new Error('Failed to fetch image: ' + res.statusCode));
              const chunks = [];
              res.on('data', (c) => chunks.push(c));
              res.on('end', () => resolve(Buffer.concat(chunks)));
            }).on('error', reject);
          } catch (e) {
            reject(e);
          }
        });
      };
      const buf = await fetchBuffer(input);
      return await Jimp.read(buf);
    }
    // Buffer
    if (Buffer.isBuffer(input)) return await Jimp.read(input);
    // fallback, let Jimp try to read (file path)
    return await Jimp.read(input);
  }

  const image = await loadImageInput(bufferOrUrl);

  const origW = image.bitmap.width;
  const origH = image.bitmap.height;

  // Determine processing size from downscale percent (percentage of original)
  const pct = Math.max(1, Math.min(100, Number(downscalePercent) || 10));
  const targetW = Math.max(16, Math.round(origW * (pct / 100)));
  const targetH = Math.max(16, Math.round(origH * (pct / 100)));
  image.resize(targetW, targetH);

  const w = image.bitmap.width;
  const h = image.bitmap.height;

  // Sampling function using cell sizes
  function sampleCells(cellW, cellH, maxShapesCap) {
    const out = [];
    for (let y = 0; y < h; y += cellH) {
      for (let x = 0; x < w; x += cellW) {
        let r = 0, g = 0, b = 0, count = 0;
        for (let yy = y; yy < Math.min(y + cellH, h); yy++) {
          for (let xx = x; xx < Math.min(x + cellW, w); xx++) {
            const hex = image.getPixelColor(xx, yy);
            const rgba = Jimp.intToRGBA(hex);
            r += rgba.r; g += rgba.g; b += rgba.b; count++;
          }
        }
        if (count === 0) continue;
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        const brightness = Math.round((r + g + b) / 3);
        if (Math.abs(brightness - 128) > threshold) {
          const cx = x + cellW / 2;
          const cy = y + cellH / 2;
          const size = Math.max(cellW, cellH);
          out.push({
            type: 'square',
            x: Math.round((cx / w) * 1000) / 1000,
            y: Math.round((cy / h) * 1000) / 1000,
            scaleX: Math.round((size / w) * 1000) / 1000,
            scaleY: Math.round((size / h) * 1000) / 1000,
            rotation: 0,
            color: rgbToHex(r, g, b),
            blend: 'normal'
          });
          if (maxShapesCap && out.length >= maxShapesCap) return out;
        }
      }
    }
    return out;
  }

  // Start with a base grid derived from baseGridSize and iteratively increase cell size if capLayers and too many shapes
  let cellW = Math.max(1, Math.floor(w / baseGridSize));
  let cellH = Math.max(1, Math.floor(h / baseGridSize));
  let shapes = sampleCells(cellW, cellH, maxSquares);

  if (capLayers && shapes.length > maxLayers) {
    // Increase cell size until shapes <= maxLayers or cell size exceeds image size
    let attempts = 0;
    while (shapes.length > maxLayers && attempts < 8) {
      const factor = Math.sqrt(shapes.length / maxLayers);
      cellW = Math.max(1, Math.ceil(cellW * factor));
      cellH = Math.max(1, Math.ceil(cellH * factor));
      shapes = sampleCells(cellW, cellH, maxSquares);
      attempts++;
    }
  }

  // If still too many shapes and capLayers=false, optionally trim to maxSquares
  if (!capLayers && shapes.length > maxSquares) {
    shapes = shapes.slice(0, maxSquares);
  }

  return { shapes, meta: { originalWidth: origW, originalHeight: origH, width: w, height: h, layers: shapes.length } };
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substr(0,2), 16);
  const g = parseInt(h.substr(2,2), 16);
  const b = parseInt(h.substr(4,2), 16);
  return [r,g,b];
}

function encodeSquareToFrlLiveryCode(square) {
  // FRL Livery Code: 40 hex chars (20 bytes)
  // Bytes 0–1:   Shape type (0x0002 = square)
  // Bytes 2–3:   Position X (signed int16)
  // Bytes 4–5:   Position Y (signed int16)
  // Bytes 6–7:   Scale X (unsigned int16)
  // Bytes 8–9:   Scale Y (unsigned int16)
  // Bytes 10–12: RGB Color
  // Bytes 13–14: Opacity (FFFF = full)
  // Bytes 15–19: Mirror + Blend mode
  //   0001 = No mirror, normal blend
  //   0003 = Horizontal mirror
  //   0005 = Vertical mirror
  //   0007 = Horizontal + Vertical mirror

  const buf = Buffer.alloc(20);
  let off = 0;

  // Shape type: 0x0002 = square
  buf.writeUInt16BE(0x0002, off); off += 2;

  // Position X: signed int16 (-32768 to 32767)
  const posX = Math.round((square.x || 0) * 2048 - 1024);
  buf.writeInt16BE(posX, off); off += 2;

  // Position Y: signed int16
  const posY = Math.round((square.y || 0) * 2048 - 1024);
  buf.writeInt16BE(posY, off); off += 2;

  // Scale X and Y: unsigned int16 (0–65535), typically 100 for unit square
  const scaleX = Math.round((square.scaleX || 0.1) * 1000); // map 0..1 to 0..1000
  const scaleY = Math.round((square.scaleY || 0.1) * 1000);
  buf.writeUInt16BE(Math.min(65535, scaleX), off); off += 2;
  buf.writeUInt16BE(Math.min(65535, scaleY), off); off += 2;

  // Color RGB (3 bytes)
  const [r, g, b] = hexToRgb(square.color || '#FFFFFF');
  buf.writeUInt8(r, off); off += 1;
  buf.writeUInt8(g, off); off += 1;
  buf.writeUInt8(b, off); off += 1;

  // Opacity (2 bytes): FFFF = full opacity
  buf.writeUInt16BE(0xFFFF, off); off += 2;

  // Mirror + Blend mode (2 bytes)
  // Determine mirror mode from square properties
  const mirrorH = square.mirrorH || false;
  const mirrorV = square.mirrorV || false;
  let mirrorCode = 0x0001; // default: no mirror
  if (mirrorH && mirrorV) {
    mirrorCode = 0x0007; // both
  } else if (mirrorH) {
    mirrorCode = 0x0003; // horizontal only
  } else if (mirrorV) {
    mirrorCode = 0x0005; // vertical only
  }

  buf.writeUInt16BE(mirrorCode, off); off += 2;

  return buf.toString("hex").toUpperCase();
}

module.exports = { analyzeImageAndGenerateSquares, encodeSquareToFrlLiveryCode };
