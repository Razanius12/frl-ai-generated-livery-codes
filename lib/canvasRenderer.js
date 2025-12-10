// Server-side canvas rendering is tricky; instead, use client-side canvas in React
// This helper generates a canvas data URL from shapes (for use in Next.js with node-canvas, 
// or return a function for client-side rendering).

// Client-side renderer: call from React to draw shapes on canvas
function renderShapesToCanvas(canvasRef, shapes, meta, containerWidth = 400) {
  if (!canvasRef.current || !shapes || shapes.length === 0) return;

  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imgW = meta?.width || 800;
  const imgH = meta?.height || 800;

  // Scale canvas to fit container width
  const scale = Math.min(containerWidth / imgW, containerWidth / imgH);
  canvas.width = Math.round(imgW * scale);
  canvas.height = Math.round(imgH * scale);

  // Clear canvas (white background)
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw each shape (square only for now)
  shapes.forEach((shape) => {
    if (shape.type !== 'square') return;

    // Positions and scales are normalized 0..1
    const x = shape.x * canvas.width;
    const y = shape.y * canvas.height;
    const w = shape.scaleX * canvas.width;
    const h = shape.scaleY * canvas.height;

    // Apply blend mode
    const blendMode = {
      'normal': 'source-over',
      'add': 'lighten',
      'soft add': 'screen',
      'multiply': 'multiply',
      '2x multiply': 'darken',
      'lighter': 'lighten',
      'darker': 'darken',
      'replace': 'copy'
    }[shape.blend] || 'source-over';
    ctx.globalCompositeOperation = blendMode;

    // Draw square centered at (x, y)
    ctx.fillStyle = shape.color || '#000000';
    ctx.save();
    ctx.translate(x, y);
    if (shape.rotation) ctx.rotate((shape.rotation * Math.PI) / 180);
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  });

  ctx.globalCompositeOperation = 'source-over';
}

module.exports = { renderShapesToCanvas };
