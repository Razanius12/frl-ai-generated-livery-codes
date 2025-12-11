import React from 'react';
import { useResponsive, useContainerWidth } from '../hooks/useResponsive';
import { commonStyles } from '../styles/commonStyles';
import { theme } from '../styles/theme';

interface MockShape {
 type: string;
 x: number;
 y: number;
 scaleX: number;
 scaleY: number;
 color: string;
 blend: string;
 rotation: number;
}

interface MockMeta {
 width: number;
 height: number;
 originalWidth: number;
 originalHeight: number;
 layers: number;
}

interface MockResult {
 shapes: MockShape[];
 frlLiveryCodes: string[];
 meta: MockMeta;
}

const mockResult: MockResult = {
 meta: {
  width: 800,
  height: 800,
  originalWidth: 1600,
  originalHeight: 1600,
  layers: 145,
 },
 shapes: [
  {
   type: 'square',
   x: 0.2,
   y: 0.2,
   scaleX: 0.15,
   scaleY: 0.15,
   color: '#FF0000',
   blend: 'normal',
   rotation: 0,
  },
  {
   type: 'square',
   x: 0.5,
   y: 0.3,
   scaleX: 0.2,
   scaleY: 0.2,
   color: '#00FF00',
   blend: 'normal',
   rotation: 45,
  },
  {
   type: 'square',
   x: 0.7,
   y: 0.6,
   scaleX: 0.1,
   scaleY: 0.3,
   color: '#0000FF',
   blend: 'normal',
   rotation: 0,
  },
  {
   type: 'square',
   x: 0.3,
   y: 0.7,
   scaleX: 0.25,
   scaleY: 0.15,
   color: '#FFFF00',
   blend: 'normal',
   rotation: 30,
  },
 ],
 frlLiveryCodes: [
  'SQUARE|1|200|200|120|120|255|0|0|255|0|0',
  'SQUARE|2|400|240|160|160|0|255|0|255|45|0',
  'SQUARE|3|560|480|80|240|0|0|255|255|0|0',
  'SQUARE|4|240|560|200|120|255|255|0|255|30|0',
 ],
};

export default function Home(): React.ReactElement {
 const { isMobile, windowWidth } = useResponsive();
 const [backgroundMode, setBackgroundMode] = React.useState<'tilemap' | 'color'>('tilemap');
 const [backgroundColor, setBackgroundColor] = React.useState<string>('#ffffff');
 const canvasRef = React.useRef<HTMLCanvasElement>(null);
 const canvasContainerRef = React.useRef<HTMLDivElement>(null);
 const tilemapImageRef = React.useRef<HTMLImageElement>(null);
 const containerWidth = useContainerWidth(canvasContainerRef as React.RefObject<HTMLDivElement & HTMLElement>);

 // Draw canvas preview
 React.useEffect((): void => {
  if (!mockResult || !mockResult.shapes || !canvasRef.current) return;
  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const boxSize = 8;
  const boxesW = 64;
  const boxesH = 64;
  const tilemapPixelW = boxesW * boxSize;
  const tilemapPixelH = boxesH * boxSize;

  // Scale to fit container dynamically
  const scale = Math.min(containerWidth / tilemapPixelW, containerWidth / tilemapPixelH);
  canvas.width = Math.round(tilemapPixelW * scale);
  canvas.height = Math.round(tilemapPixelH * scale);

  // Draw background based on mode
  if (backgroundMode === 'tilemap') {
   // Draw tilemap if loaded
   if (tilemapImageRef.current && tilemapImageRef.current.complete) {
    const tileImg = tilemapImageRef.current;
    const pattern = ctx.createPattern(tileImg, 'repeat');
    if (pattern) {
     ctx.fillStyle = pattern;
     ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
   } else {
    // Fallback to white if tilemap not loaded
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
   }
  } else {
   // Draw color background
   ctx.fillStyle = backgroundColor;
   ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Draw shapes
  mockResult.shapes.forEach((shape): void => {
   if (shape.type !== 'square') return;

   const x = shape.x * canvas.width;
   const y = shape.y * canvas.height;
   const w = shape.scaleX * canvas.width;
   const h = shape.scaleY * canvas.height;

   const blendMap: Record<string, GlobalCompositeOperation> = {
    'normal': 'source-over',
    'add': 'lighten',
    'soft add': 'screen',
    'multiply': 'multiply',
    '2x multiply': 'darken',
    'lighter': 'lighten',
    'darker': 'darken',
    'replace': 'copy'
   };
   ctx.globalCompositeOperation = blendMap[shape.blend] || 'source-over';
   ctx.fillStyle = shape.color || '#000000';
   ctx.save();
   ctx.translate(x, y);
   if (shape.rotation) ctx.rotate((shape.rotation * Math.PI) / 180);
   ctx.fillRect(-w / 2, -h / 2, w, h);
   ctx.restore();
  });

  ctx.globalCompositeOperation = 'source-over';
 }, [backgroundMode, backgroundColor, containerWidth]);

 const meta = mockResult.meta;

 return (
  <div style={commonStyles.container(isMobile)}>
   <h1 style={commonStyles.heading1(isMobile)}>FRL AI Livery Generator</h1>
   <div style={commonStyles.muted()}>by <a href="https://github.com/razanius12" target="_blank" rel="noopener noreferrer">Razanius12</a></div>

   <div style={commonStyles.flexColumn(isMobile ? theme.spacing.sm : theme.spacing.lg)}>
    <label style={commonStyles.label(isMobile, true)}>Choose Image</label>
    <input type="file" accept="image/*" disabled style={commonStyles.input(isMobile)} />
    <div style={commonStyles.muted()}>or paste image URL below</div>
    <input style={commonStyles.input(isMobile)} placeholder="https://.../image.jpg" disabled />

    <div style={commonStyles.flexColumn(theme.spacing.sm)}>
     <label style={commonStyles.label(isMobile)}>Downscale: 10%</label>
     <input type="range" min={1} max={100} value={10} disabled />
    </div>

    <div style={isMobile ? commonStyles.flexColumn(theme.spacing.sm) : commonStyles.flexRow(theme.spacing.md, 'center')}>
     <div style={{ ...commonStyles.flexRow(theme.spacing.md, 'center'), flex: isMobile ? 1 : 'auto', width: isMobile ? '100%' : 'auto' }}>
      <label style={commonStyles.label(isMobile)} title="Brightness contrast threshold: higher = fewer squares, lower = more detail">Threshold</label>
      <input type="number" value={16} style={{ flex: 1, padding: isMobile ? 8 : 6, fontSize: theme.fontSizes.sm }} disabled />
     </div>
     <div style={{ ...commonStyles.flexRow(theme.spacing.md, 'center'), flex: isMobile ? 1 : 'auto', width: isMobile ? '100%' : 'auto' }}>
      <label style={commonStyles.label(isMobile)} title="Image sampling grid size: lower = simpler, higher = more detail">Base Grid</label>
      <input type="number" value={40} style={{ flex: 1, padding: isMobile ? 8 : 6, fontSize: theme.fontSizes.sm }} disabled />
     </div>
    </div>

    <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
     <input type="checkbox" disabled />
     <span style={commonStyles.label(isMobile)}>Uncap layers (allow &gt;1500)</span>
    </label>

    <div style={isMobile ? commonStyles.flexColumn(theme.spacing.sm) : commonStyles.flexRow(theme.spacing.md, 'center')}>
     <label style={commonStyles.label(isMobile)}>Max Layers</label>
     <input type="number" value={1500} style={{ ...commonStyles.input(isMobile), flex: isMobile ? 1 : 0 }} disabled />
    </div>

    <button disabled style={commonStyles.button(isMobile, 'primary')}>Generate Code</button>
   </div>

   <div style={{ marginTop: isMobile ? theme.spacing.md : theme.spacing.xl }}>
    <div style={commonStyles.flexColumn(theme.spacing.xs)}>
     <div style={{ fontSize: isMobile ? theme.fontSizes.lg : theme.fontSizes.xl, fontWeight: 700, textAlign: 'center' }}>Original Size: {meta.originalWidth} x {meta.originalHeight}</div>
     <div style={{ fontSize: isMobile ? theme.fontSizes.md : theme.fontSizes.lg }}>Current Size: {meta.width} x {meta.height}</div>
     <div style={{ fontSize: isMobile ? theme.fontSizes.md : theme.fontSizes.lg }}>Layers: {meta.layers}</div>
    </div>

    <h3 style={commonStyles.heading3(isMobile)}>FRL Livery Codes</h3>
    <button disabled style={{ ...commonStyles.button(isMobile, 'secondary'), marginBottom: theme.spacing.sm }}>Copy All</button>

    <div style={commonStyles.codeBlock(isMobile)}>
     {mockResult.frlLiveryCodes.map((code: string, idx: number): React.ReactElement => (
      <div key={idx} style={commonStyles.codeText(isMobile)}>{code}</div>
     ))}
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
       <div style={{ ...commonStyles.flexCenter(), width: '100%', height: '100%', background: theme.colors.surface, fontSize: theme.fontSizes.sm, color: theme.colors.placeholder }}>
        (Mock Reference Image)
       </div>
      </div>
     </div>

     <div style={{ ...commonStyles.flexColumn(theme.spacing.xs), flex: 1, alignItems: 'center' }}>
      <div style={{ ...commonStyles.label(isMobile, true), textAlign: 'center' }}>Generated</div>
      <div ref={canvasContainerRef} style={commonStyles.canvas(isMobile, backgroundMode === 'color' ? backgroundColor : theme.colors.background)}>
       <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
     </div>
    </div>
   </div>
  </div>
 )
}
