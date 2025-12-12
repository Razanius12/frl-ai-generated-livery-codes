import React from 'react';
import Link from 'next/link';
import { useResponsive, useContainerWidth } from '../hooks/useResponsive';
import { commonStyles } from '../styles/commonStyles';
import { theme } from '../styles/theme';
import { uint8ToBase64, estimateLayers, ensureTinted } from '../utils/uiHelpers';

// Placeholder samples removed — UI shows nothing until an image is loaded.

export default function Home(): React.ReactElement {
  const { isMobile, windowWidth } = useResponsive();
  const [backgroundMode, setBackgroundMode] = React.useState<'tilemap' | 'color'>('tilemap');
  const [backgroundColor, setBackgroundColor] = React.useState<string>('#ffffff');
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = React.useRef<HTMLDivElement>(null);
  const tilemapImageRef = React.useRef<HTMLImageElement>(null);
  const containerWidth = useContainerWidth(canvasContainerRef as React.RefObject<HTMLDivElement & HTMLElement>);

  // Client state for uploaded image and generation
  const [uploadedName, setUploadedName] = React.useState<string | null>(null);
  const [processedWidth, setProcessedWidth] = React.useState<number | null>(null);
  const [processedHeight, setProcessedHeight] = React.useState<number | null>(null);
  const [needsRegenerate, setNeedsRegenerate] = React.useState<boolean>(false);
  const [generatedImgW, setGeneratedImgW] = React.useState<number | null>(null);
  const [generatedImgH, setGeneratedImgH] = React.useState<number | null>(null);
  const processedPixelsBase64Ref = React.useRef<string | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [generatedCode, setGeneratedCode] = React.useState<string | null>(null);
  // layer cap state (toggleable via Uncap checkbox)
  const [maxLayersState, setMaxLayersState] = React.useState<number>(1300);
  const [uncap, setUncap] = React.useState<boolean>(false);
  const originalImageRef = React.useRef<HTMLImageElement | null>(null);
  const [originalSize, setOriginalSize] = React.useState<{ w: number; h: number } | null>(null);
  const [layersCount, setLayersCount] = React.useState<number | null>(null);
  const [scalePercent, setScalePercent] = React.useState<number>(100);
  const [urlInput, setUrlInput] = React.useState<string>('');
  const [referenceSrc, setReferenceSrc] = React.useState<string | null>(null);
  const spriteCacheRef = React.useRef<Record<string, HTMLImageElement>>({});
  const [spriteVersion, setSpriteVersion] = React.useState(0);
  const bgCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const tintedCacheRef = React.useRef<Record<string, HTMLCanvasElement>>({});

  // tinted canvases cached in `tintedCacheRef`; use imported `ensureTinted` helper.

  // Draw canvas preview (placeholder shapes) onto the top canvas; background goes to the bg canvas
  React.useEffect((): void => {
    // Do not draw placeholders when no image is loaded; clear canvases instead.
    if (!originalSize) {
      if (bgCanvasRef.current) {
        const c = bgCanvasRef.current;
        const ctx = c.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, c.width, c.height);
      }
      if (canvasRef.current) {
        const c = canvasRef.current;
        const ctx = c.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, c.width, c.height);
      }
      return;
    }
    if (!canvasRef.current || !bgCanvasRef.current) return;
    const canvas = canvasRef.current;
    const bgCanvas = bgCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const bgCtx = bgCanvas.getContext('2d');
    if (!ctx || !bgCtx) return;

    const boxSize = 8;
    const boxesW = 64;
    const boxesH = 64;
    const tilemapPixelW = boxesW * boxSize;
    const tilemapPixelH = boxesH * boxSize;

    // Determine pixel size for square canvas (preserve 1:1 display)
    const containerRect = canvasContainerRef.current?.getBoundingClientRect();
    const availW = containerRect ? containerRect.width : containerWidth || tilemapPixelW;
    const availH = containerRect ? containerRect.height : containerWidth || tilemapPixelH;
    const scale = Math.min(availW / tilemapPixelW, availH / tilemapPixelH) || 1;
    const pxW = Math.round(tilemapPixelW * scale);
    const pxH = Math.round(tilemapPixelH * scale);

    canvas.width = pxW;
    canvas.height = pxH;
    bgCanvas.width = pxW;
    bgCanvas.height = pxH;

    // Draw background on bg canvas
    if (backgroundMode === 'tilemap') {
      if (tilemapImageRef.current && tilemapImageRef.current.complete) {
        const tileImg = tilemapImageRef.current;
        const pattern = bgCtx.createPattern(tileImg, 'repeat');
        if (pattern) {
          bgCtx.fillStyle = pattern;
          bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
        }
      } else if (tilemapImageRef.current) {
        tilemapImageRef.current.onload = () => setSpriteVersion((v) => v + 1);
        bgCtx.fillStyle = '#ffffff';
        bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
      } else {
        bgCtx.fillStyle = '#ffffff';
        bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
      }
    } else {
      bgCtx.fillStyle = backgroundColor;
      bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    }

    // Clear top canvas (no placeholders)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [backgroundMode, backgroundColor, containerWidth, spriteVersion, originalSize]);

  // Draw generated preview when `generatedCode` is available.
  React.useEffect(() => {
    if (!generatedCode || !canvasRef.current || !bgCanvasRef.current) return;
    const canvas = canvasRef.current;
    const bgCanvas = bgCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const bgCtx = bgCanvas.getContext('2d');
    if (!ctx || !bgCtx) return;

    // Prepare canvas size matching previous logic
    const boxSize = 8;
    const boxesW = 64;
    const boxesH = 64;
    const tilemapPixelW = boxesW * boxSize;
    const tilemapPixelH = boxesH * boxSize;
    const containerRect = canvasContainerRef.current?.getBoundingClientRect();
    const availW = containerRect ? containerRect.width : containerWidth || tilemapPixelW;
    const availH = containerRect ? containerRect.height : containerWidth || tilemapPixelH;
    const scale = Math.min(availW / tilemapPixelW, availH / tilemapPixelH) || 1;
    const pxW = Math.round(tilemapPixelW * scale);
    const pxH = Math.round(tilemapPixelH * scale);
    canvas.width = pxW;
    canvas.height = pxH;
    bgCanvas.width = pxW;
    bgCanvas.height = pxH;

    // Draw background onto bg canvas
    if (backgroundMode === 'tilemap') {
      if (tilemapImageRef.current && tilemapImageRef.current.complete) {
        const tileImg = tilemapImageRef.current;
        const pattern = bgCtx.createPattern(tileImg, 'repeat');
        if (pattern) {
          bgCtx.fillStyle = pattern;
          bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
        }
      } else if (tilemapImageRef.current) {
        tilemapImageRef.current.onload = () => setSpriteVersion((v) => v + 1);
        bgCtx.fillStyle = '#ffffff';
        bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
      } else {
        bgCtx.fillStyle = '#ffffff';
        bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
      }
    } else {
      bgCtx.fillStyle = backgroundColor;
      bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    }

    // Parse generated code lines and draw each sprite into a centered letterboxed area
    const lines = generatedCode.split('\n').map((l) => l.trim()).filter(Boolean);

    const parseLine = (line: string) => {
      const m = line.match(/^([0-9A-Fa-f]{4})([0-9A-Fa-f]{4})([0-9A-Fa-f]{4})([0-9A-Fa-f]{4})([0-9A-Fa-f]{4})([0-9A-Fa-f]{4})([0-9A-Fa-f]{6})([0-9A-Fa-f]{2})/);
      if (!m) return null;
      const [, spriteId, posX, posY, xSize, ySize, rot, colorHex, opacity] = m;
      const hexToSigned = (h: string) => {
        const v = parseInt(h, 16);
        return v > 0x7fff ? v - 0x10000 : v;
      };
      return {
        spriteId,
        posX: hexToSigned(posX),
        posY: hexToSigned(posY),
        xSize: parseInt(xSize, 16),
        ySize: parseInt(ySize, 16),
        rot: hexToSigned(rot),
        colorHex,
        opacity: parseInt(opacity, 16),
      };
    };

    const imgW = generatedImgW || processedWidth || 64;
    const imgH = generatedImgH || processedHeight || 64;

    // Compute letterboxed area inside the square canvas where the image should be drawn
    const scaleFit = Math.min(canvas.width / imgW, canvas.height / imgH);
    const imageDrawW = imgW * scaleFit;
    const imageDrawH = imgH * scaleFit;
    const offsetX = Math.round((canvas.width - imageDrawW) / 2);
    const offsetY = Math.round((canvas.height - imageDrawH) / 2);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const line of lines) {
      if (line.startsWith('FFFF') || line === '<' || line === '>') continue;
      const entry = parseLine(line);
      if (!entry) continue;

      // Convert FRL units (1/8px) back to image pixels and center-origin
      const imgX = (entry.posX) / 8 + imgW / 2;
      const imgY = (entry.posY) / 8 + imgH / 2;
      const imgWpx = entry.xSize / 8;
      const imgHpx = entry.ySize / 8;

      // Map to letterboxed canvas coords
      const drawX = offsetX + imgX * scaleFit;
      const drawY = offsetY + imgY * scaleFit;
      const drawW = Math.max(1, imgWpx * scaleFit);
      const drawH = Math.max(1, imgHpx * scaleFit);

      try {
        const spriteIdKey = entry.spriteId;
        let spr = spriteCacheRef.current[spriteIdKey];
        if (!spr) {
          spr = new Image();
          spr.crossOrigin = 'Anonymous';
          spr.onload = () => setSpriteVersion((v) => v + 1);
          spr.onerror = () => { };
          spr.src = `/sprite/${spriteIdKey}.png`;
          spriteCacheRef.current[spriteIdKey] = spr;
        }

        ctx.save();
        ctx.globalAlpha = (entry.opacity || 255) / 255;
        const cx = drawX + drawW / 2;
        const cy = drawY + drawH / 2;
        ctx.translate(cx, cy);
        if (entry.rot) ctx.rotate((entry.rot * Math.PI) / 180);
        if (spr.complete && (spr.naturalWidth || spr.naturalHeight)) {
          const tw = Math.max(1, Math.round(drawW));
          const th = Math.max(1, Math.round(drawH));
          const tinted = ensureTinted(tintedCacheRef.current, spr as HTMLImageElement, entry.colorHex, entry.opacity, tw, th);
          if (tinted) {
            ctx.drawImage(tinted, -drawW / 2, -drawH / 2, drawW, drawH);
          } else {
            ctx.drawImage(spr, -drawW / 2, -drawH / 2, drawW, drawH);
          }
        } else {
          ctx.fillStyle = `#${entry.colorHex}`;
          ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
        }
        ctx.restore();
      } catch (err) {
        ctx.save();
        ctx.fillStyle = `#${entry.colorHex}`;
        ctx.globalAlpha = (entry.opacity || 255) / 255;
        ctx.fillRect(drawX, drawY, drawW, drawH);
        ctx.restore();
      }
    }
  }, [generatedCode, containerWidth, backgroundMode, backgroundColor, generatedImgW, generatedImgH, spriteVersion]);

  // Client helpers are provided by imported utilities (`uint8ToBase64`, `estimateLayers`, `ensureTinted`).

  // Load file and auto-downscale until layers <= maxLayers (client-side preprocessing)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploadedName(file.name);
    const reader = new FileReader();
    reader.onload = function (ev) {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = async function () {
        originalImageRef.current = img;
        setOriginalSize({ w: img.width, h: img.height });
        setReferenceSrc(ev.target?.result as string);
        // process with current scalePercent
        await processImageFromImage(img, scalePercent);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Process an Image element into a downscaled pixel buffer respecting scalePercent and maxLayers
  const processImageFromImage = async (img: HTMLImageElement, startPercent: number) => {
    const off = document.createElement('canvas');
    const ctx = off.getContext('2d');
    if (!ctx) return;

    const maxDim = 400;
    // start with user-provided percent as multiplier
    let scale = Math.min(1, startPercent / 100, maxDim / Math.max(img.width, img.height));

    let finalData: ImageData | null = null;
    for (let iter = 0; iter < 12; iter++) {
      off.width = Math.max(1, Math.round(img.width * scale));
      off.height = Math.max(1, Math.round(img.height * scale));
      ctx.clearRect(0, 0, off.width, off.height);
      ctx.drawImage(img, 0, 0, off.width, off.height);
      const imageData = ctx.getImageData(0, 0, off.width, off.height);
      const estimate = estimateLayers(imageData);
      setLayersCount(estimate.nonBg);
      // enforce safety cap at 10k layers: if user uncapped and result >10k, re-enable cap
      let localCap = uncap ? Number.MAX_SAFE_INTEGER : maxLayersState;
      if (estimate.nonBg > 10000) {
        if (uncap) {
          alert('Layer count exceeded 10,000. Re-enabling layer cap to avoid browser slowdown.');
          setUncap(false);
          setMaxLayersState(1300);
        }
        localCap = 1300; // enforce cap to force further downscaling
      }

      if (estimate.nonBg <= localCap || (off.width <= 8 || off.height <= 8)) {
        finalData = imageData;
        // update slider to reflect the actual used scale with 2 decimals
        const percentUsed = Number((scale * 100).toFixed(2));
        setScalePercent(percentUsed);
        break;
      }
      // reduce scale and try again
      scale *= 0.7;
    }

    if (!finalData) {
      off.width = Math.max(1, Math.round(img.width * scale));
      off.height = Math.max(1, Math.round(img.height * scale));
      ctx.drawImage(img, 0, 0, off.width, off.height);
      finalData = ctx.getImageData(0, 0, off.width, off.height);
      const estimate = estimateLayers(finalData);
      setLayersCount(estimate.nonBg);
      const percentUsed = Number((scale * 100).toFixed(2));
      setScalePercent(percentUsed);
    }

    const pixelsBase64 = uint8ToBase64(finalData.data);
    processedPixelsBase64Ref.current = pixelsBase64;
    setProcessedWidth(finalData.width);
    setProcessedHeight(finalData.height);
  };

  // Handle paste URL
  const handleLoadFromUrl = async () => {
    if (!urlInput) return;
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = async () => {
        originalImageRef.current = img;
        setOriginalSize({ w: img.width, h: img.height });
        setReferenceSrc(urlInput);
        await processImageFromImage(img, scalePercent);
      };
      img.onerror = () => alert('Failed to load image from URL (CORS or invalid URL)');
      img.src = urlInput;
    } catch (err) {
      alert('Failed to load image URL');
    }
  };

  // Call server API to generate code
  const handleGenerate = async () => {
    if (!processedPixelsBase64Ref.current || !processedWidth || !processedHeight) {
      alert('Please upload an image first (processed).');
      return;
    }
    setGenerating(true);
    setGeneratedCode(null);
    try {
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ width: processedWidth, height: processedHeight, pixelsBase64: processedPixelsBase64Ref.current, spriteId: '0002' })
      });
      const data = await resp.json();
      if (data?.code) {
        setGeneratedCode(data.code);
        // snapshot the processed image dimensions used to produce this code
        setGeneratedImgW(processedWidth);
        setGeneratedImgH(processedHeight);
        setNeedsRegenerate(false);
        // Pre-warm tinted sprites for faster preview rendering
        try {
          const lines = data.code.split('\n').map((l: string) => l.trim()).filter(Boolean);
          const uniqueKeys = new Map<string, { spriteId: string; colorHex: string; opacity: number }>();
          for (const l of lines) {
            if (l.startsWith('FFFF') || l === '<' || l === '>') continue;
            const m = l.match(/^([0-9A-Fa-f]{4})(?:[0-9A-Fa-f]{4}){5}([0-9A-Fa-f]{6})([0-9A-Fa-f]{2})/);
            if (!m) continue;
            const spriteId = l.slice(0, 4);
            const colorHex = m[1];
            const opacity = parseInt(m[2], 16);
            const k = `${spriteId}-${colorHex}-${opacity}`;
            if (!uniqueKeys.has(k)) uniqueKeys.set(k, { spriteId, colorHex, opacity });
          }
          // For each unique key, ensure sprite image is loaded and tinted
          uniqueKeys.forEach(({ spriteId, colorHex, opacity }) => {
            const spritePath = `/sprite/${spriteId}.png`;
            let spr = spriteCacheRef.current[spriteId];
            if (!spr) {
              spr = new Image();
              spr.crossOrigin = 'Anonymous';
              spr.src = spritePath;
              spr.onload = () => {
                ensureTinted(tintedCacheRef.current, spr as HTMLImageElement, colorHex, opacity);
                setSpriteVersion((v) => v + 1);
              };
              spriteCacheRef.current[spriteId] = spr;
            } else if (spr.complete) {
              // create tinted immediately
              ensureTinted(tintedCacheRef.current, spr as HTMLImageElement, colorHex, opacity);
            } else {
              spr.onload = () => {
                ensureTinted(tintedCacheRef.current, spr as HTMLImageElement, colorHex, opacity);
                setSpriteVersion((v) => v + 1);
              };
            }
          });
        } catch (e) {
          // ignore pre-warm errors
        }
        // Count generated drawable lines (exclude headers and markers)
        const lines = data.code.split('\n').map((l: string) => l.trim()).filter(Boolean);
        const count = lines.filter((l: string) => !(l.startsWith('FFFF') || l === '<' || l === '>')).length;
        setLayersCount(count);
      } else alert(data.error || 'Generation failed');
    } catch (err) {
      alert('Generation request failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={commonStyles.container(isMobile)}>
      <h1 style={commonStyles.heading1(isMobile)}>FRL AI Livery Generator</h1>
      <div style={{ ...commonStyles.muted(), display: 'flex', alignItems: 'center' }}>by&nbsp;
        <Link href="https://github.com/razanius12" target="_blank" rel="noopener noreferrer">
          Razanius12
        </Link>
        {/* custom style align text to right */}
        <Link href="/documentation" style={{ marginLeft: 'auto'}}>Documentation</Link>
      </div>
      <br />

      <div style={commonStyles.flexColumn(isMobile ? theme.spacing.sm : theme.spacing.lg)}>
        <label style={commonStyles.label(isMobile, true)}>Choose Image</label>
        <input id="imageInput" type="file" accept="image/*" onChange={handleFileChange} style={commonStyles.input(isMobile)} />
        <div style={commonStyles.muted()}>or paste image URL below</div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: theme.spacing.sm }}>
          <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} style={{ ...commonStyles.input(isMobile), flex: 1 }} placeholder="https://.../image.jpg" />
          <button onClick={handleLoadFromUrl} style={{ ...commonStyles.button(isMobile, 'secondary'), width: isMobile ? '100%' : 'auto' }}>Load</button>
        </div>

        {originalSize && (
          <>
            <div style={commonStyles.flexColumn(theme.spacing.sm)}>
              <label style={commonStyles.label(isMobile)}>Downscale: {scalePercent.toFixed(2)}%</label>
              <input
                type="range"
                min={1}
                max={100}
                step={0.01}
                value={scalePercent}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setScalePercent(v);
                  // reprocess using original image if present (for next generation)
                  if (originalImageRef.current) processImageFromImage(originalImageRef.current, v);
                  // mark generated code as stale if there is one
                  if (generatedCode) setNeedsRegenerate(true);
                }}
              />
            </div>
            {needsRegenerate && (
              <div style={{ color: '#b35e00', fontSize: theme.fontSizes.xs, marginTop: theme.spacing.xs }}>
                Downscale changed — press "Generate Code" to update the generated preview.
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
              <input
                type="checkbox"
                checked={uncap}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setUncap(checked);
                  setMaxLayersState(checked ? Number.MAX_SAFE_INTEGER : 1300);
                }}
              />
              <span style={commonStyles.label(isMobile)}>Uncap layers (allow &gt;1300)</span>
            </label>

            <button onClick={handleGenerate} style={commonStyles.button(isMobile, 'primary')}>{generating ? 'Generating...' : 'Generate Code'}</button>
          </>
        )}
      </div>

      {originalSize && (
        <div style={{ marginTop: isMobile ? theme.spacing.md : theme.spacing.xl }}>
          <div style={commonStyles.flexColumn(theme.spacing.xs)}>
            <div style={{ fontSize: isMobile ? theme.fontSizes.lg : theme.fontSizes.xl, fontWeight: 700, textAlign: 'center' }}>Original Size: {originalSize && `${originalSize.w} x ${originalSize.h}`}</div>
            <div style={{ fontSize: isMobile ? theme.fontSizes.md : theme.fontSizes.lg }}>Current Size: {processedWidth && processedHeight ? `${processedWidth} x ${processedHeight}` : '—'}</div>
            <div style={{ fontSize: isMobile ? theme.fontSizes.md : theme.fontSizes.lg }}>Layers: {layersCount ?? '—'}</div>
          </div>

          <h3 style={commonStyles.heading3(isMobile)}>FRL Livery Codes</h3>
          <button
            disabled={!generatedCode}
            onClick={() => {
              if (!generatedCode) return;
              navigator.clipboard.writeText(generatedCode).then(() => alert('Copied to clipboard')).catch(() => alert('Failed to copy to clipboard'));
            }}
            style={{ ...commonStyles.button(isMobile, 'secondary'), marginBottom: theme.spacing.sm }}
          >
            Copy All
          </button>

          <div style={commonStyles.codeBlock(isMobile)}>
            {generatedCode ? (
              generatedCode.split('\n').map((code: string, idx: number) => (
                <div key={idx} style={commonStyles.codeText(isMobile)}>{code}</div>
              ))
            ) : (
              <div style={{ color: theme.colors.placeholder }}>No generated code yet — press "Generate Code".</div>
            )}
          </div>

          <h3 style={commonStyles.heading3(isMobile)}>Preview (Reference vs Generated)</h3>

          <div style={{ marginBottom: theme.spacing.lg, display: 'flex', gap: theme.spacing.sm, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.fontSizes.sm }}>
              <input
                type="radio"
                name="bg"
                value="tilemap"
                checked={backgroundMode === 'tilemap'}
                onChange={(e): void => setBackgroundMode(e.target.value as 'tilemap' | 'color')}
              />
              Tilemap
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.fontSizes.sm }}>
              <input
                type="radio"
                name="bg"
                value="color"
                checked={backgroundMode === 'color'}
                onChange={(e): void => setBackgroundMode(e.target.value as 'tilemap' | 'color')}
              />
              Color
            </label>
            {backgroundMode === 'color' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs }}>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e): void => setBackgroundColor(e.target.value)}
                  style={{ cursor: 'pointer' }}
                />
              </label>
            )}
          </div>

          {/* Hidden image to preload tilemap */}
          <img ref={tilemapImageRef} src="/canvasbg.png" style={{ display: 'none' }} alt="tilemap" />

          <div style={isMobile ? commonStyles.flexColumn(theme.spacing.lg) : commonStyles.flexRow(theme.spacing.lg, 'flex-start')}>
            <div style={{ ...commonStyles.flexColumn(theme.spacing.xs), flex: 1, alignItems: 'center' }}>
              <div style={{ ...commonStyles.label(isMobile, true), textAlign: 'center' }}>Reference</div>
              <div style={commonStyles.canvas(isMobile, theme.colors.background)}>
                {referenceSrc ? (
                  <img src={referenceSrc} alt="reference" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : null}
              </div>
            </div>

            <div style={{ ...commonStyles.flexColumn(theme.spacing.xs), flex: 1, alignItems: 'center' }}>
              <div style={{ ...commonStyles.label(isMobile, true), textAlign: 'center' }}>Generated</div>
              <div ref={canvasContainerRef} style={{ ...commonStyles.canvas(isMobile, backgroundMode === 'color' ? backgroundColor : theme.colors.background), position: 'relative' }}>
                <canvas ref={bgCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
                <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
