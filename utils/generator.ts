// utils/generator.ts
// Server-side generator utilities for converting pixel arrays into FRL livery codes.
// Each function is commented succinctly to explain its purpose.

// Convert a signed 16-bit integer to a 4-char uppercase hex string (allows negatives)
export function toSignedHex(value: number): string {
  // Clamp to int16 and convert to 2-byte hex representation
  const int16 = Math.max(-32768, Math.min(32767, Math.floor(value)));
  const unsigned = int16 < 0 ? 0x10000 + int16 : int16;
  return unsigned.toString(16).padStart(4, '0').toUpperCase();
}

// Find horizontal strips of identical color (excluding the background color)
export function findHorizontalStrips(
  pixels: Uint8Array,
  width: number,
  height: number,
  targetR: number,
  targetG: number,
  targetB: number,
  tolerance: number
) {
  const strips: Array<any> = [];
  const usedPixels = new Set<string>();

  for (let y = 0; y < height; y++) {
    let currentStrip: any = null;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];

      const key = `${x},${y}`;

      // skip background-like pixels
      if (
        a !== 0 &&
        (Math.abs(r - targetR) > tolerance || Math.abs(g - targetG) > tolerance || Math.abs(b - targetB) > tolerance) &&
        !usedPixels.has(key)
      ) {
        if (!currentStrip) {
          currentStrip = { startX: x, y, color: { r, g, b }, length: 1 };
        } else {
          const c = currentStrip.color;
          if (r === c.r && g === c.g && b === c.b) {
            currentStrip.length++;
          } else {
            if (currentStrip.length > 1) {
              strips.push(currentStrip);
              for (let i = currentStrip.startX; i < currentStrip.startX + currentStrip.length; i++) usedPixels.add(`${i},${y}`);
            }
            currentStrip = { startX: x, y, color: { r, g, b }, length: 1 };
          }
        }
      } else {
        if (currentStrip && currentStrip.length > 1) {
          strips.push(currentStrip);
          for (let i = currentStrip.startX; i < currentStrip.startX + currentStrip.length; i++) usedPixels.add(`${i},${y}`);
        }
        currentStrip = null;
      }
    }
    if (currentStrip && currentStrip.length > 1) {
      strips.push(currentStrip);
      for (let i = currentStrip.startX; i < currentStrip.startX + currentStrip.length; i++) usedPixels.add(`${i},${currentStrip.y}`);
    }
  }

  return { strips, usedPixels };
}

// Build the FRL livery code string from pixel data.
// - pixels: Uint8Array of RGBA bytes
// - width/height: dimensions
// - spriteId: placeholder string for sprite (e.g. '0002')
// - maxLayers: optional cap (kept for compatibility)
export function generateFRLCode(
  pixels: Uint8Array,
  width: number,
  height: number,
  spriteId = '0002',
  maxLayers = 1300
): string {
  // Header used in original generator
  let pixelData = 'FFFF00000000006400640000FFFFFFFF0001\n<\n';

  // Find most frequent color (assumed background)
  const colorCount: Record<string, number> = {};
  let maxCount = 0;
  let bgColor = { r: 255, g: 255, b: 255 };
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a === 0) continue;
    const key = `${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`;
    colorCount[key] = (colorCount[key] || 0) + 1;
    if (colorCount[key] > maxCount) {
      maxCount = colorCount[key];
      const [r, g, b] = key.split(',').map((v) => parseInt(v, 10));
      bgColor = { r, g, b };
    }
  }

  // Background sprite entry removed: generator will no longer inject
  // a background sprite into the output. Background color is still
  // detected and used to exclude background-like pixels from layers.

  const tolerance = 10;
  const { strips, usedPixels } = findHorizontalStrips(pixels, width, height, bgColor.r, bgColor.g, bgColor.b, tolerance);

  // Add horizontal strips as sprite entries
  // Use center-origin: positions are emitted as offsets from image center (in 1/8 pixel units)
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);
  for (const strip of strips) {
    const posX = toSignedHex(Math.floor((strip.startX - halfW) * 8));
    const posY = toSignedHex(Math.floor((strip.y - halfH) * 8));
    // Use full 1/8-pixel units for sizes (no shrink). Use a height of 8 (one pixel) for strips.
    const xSize = Math.floor(strip.length * 8).toString(16).padStart(4, '0').toUpperCase();
    const ySize = '0008';
    const colorHex = `${strip.color.r.toString(16).padStart(2, '0')}${strip.color.g.toString(16).padStart(2, '0')}${strip.color.b.toString(16).padStart(2, '0')}`.toUpperCase();
    pixelData += `  ${spriteId}${posX}${posY}${xSize}${ySize}0000${colorHex}FF0001\n`;
  }

  // Single pixels not in strips
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`;
      if (usedPixels.has(key)) continue;
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];
      if (
        a !== 0 &&
        (Math.abs(r - bgColor.r) > tolerance || Math.abs(g - bgColor.g) > tolerance || Math.abs(b - bgColor.b) > tolerance)
      ) {
        // Emit positions relative to image center (signed). Client will map back.
        const posX = toSignedHex(Math.floor((x - halfW) * 8));
        const posY = toSignedHex(Math.floor((y - halfH) * 8));
        // Use full pixel size for single pixels (8 in 1/8-px units)
        const xSize = '0008';
        const ySize = '0008';
        const colorHex = `${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
        pixelData += `  ${spriteId}${posX}${posY}${xSize}${ySize}0000${colorHex}FF0001\n`;
      }
    }
  }

  pixelData += '>';
  return pixelData;
}

export default { toSignedHex, findHorizontalStrips, generateFRLCode };
