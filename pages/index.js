import { useState, useRef, useEffect } from 'react';

export default function Home(){
  const [imageUrl, setImageUrl] = useState('');
  const [downscale, setDownscale] = useState(10);
  const [uncap, setUncap] = useState(false);
  const [threshold, setThreshold] = useState(16);
  const [baseGridSize, setBaseGridSize] = useState(40);
  const [maxLayers, setMaxLayers] = useState(1500);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef();
  const canvasRef = useRef();
  const meta = result?.meta || {};

  function onChooseFile(e){
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result);
    };
    reader.readAsDataURL(f);
  }

  async function submit(){
    setLoading(true);
    const form = new FormData();
    if (imageUrl && imageUrl.startsWith('data:image/')) {
      form.append('imageDataUrl', imageUrl);
    } else if (imageUrl) {
      form.append('imageUrl', imageUrl);
    }
    form.append('downscale', String(downscale));
    form.append('uncap', uncap ? 'true' : 'false');
    form.append('threshold', String(threshold));
    form.append('baseGridSize', String(baseGridSize));
    form.append('maxLayers', String(maxLayers));

    const res = await fetch('/api/generate', { method: 'POST', body: form });
    const j = await res.json();
    setResult(j);
    setLoading(false);
  }

  // Render canvas preview when result changes
  useEffect(() => {
    if (!result || !result.shapes || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgW = meta?.width || 800;
    const imgH = meta?.height || 800;

    // Scale to fit container
    const containerWidth = 200;
    const scale = Math.min(containerWidth / imgW, containerWidth / imgH);
    canvas.width = Math.round(imgW * scale);
    canvas.height = Math.round(imgH * scale);

    // Clear (white background)
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw shapes
    result.shapes.forEach((shape) => {
      if (shape.type !== 'square') return;

      const x = shape.x * canvas.width;
      const y = shape.y * canvas.height;
      const w = shape.scaleX * canvas.width;
      const h = shape.scaleY * canvas.height;

      const blendMap = {
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
  }, [result, meta]);

  function copyToClipboard() {
    const hex = (result?.frlHex || []).join('\n');
    navigator.clipboard.writeText(hex).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{fontFamily:'system-ui,Segoe UI,Roboto',padding:18,maxWidth:480,margin:'0 auto'}}>
      <h1 style={{fontSize:20,marginBottom:6}}>FRL Square Generator</h1>

      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        <label style={{fontSize:12,fontWeight:600}}>Choose Image</label>
        <input ref={fileInput} type="file" accept="image/*" onChange={onChooseFile} />
        <div style={{fontSize:12,color:'#666'}}>or paste image URL below</div>
        <input style={{width:'100%',padding:8,borderRadius:6,border:'1px solid #ddd'}} value={imageUrl && !imageUrl.startsWith('data:image/') ? imageUrl : ''} onChange={e=>setImageUrl(e.target.value)} placeholder="https://.../image.jpg" />

        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          <label style={{fontSize:12}}>Downscale: {downscale}%</label>
          <input type="range" min={1} max={100} value={downscale} onChange={e=>setDownscale(parseInt(e.target.value,10))} />
        </div>

        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <label style={{fontSize:12}} title="Brightness contrast threshold: higher = fewer squares, lower = more detail">Threshold</label>
          <input type="number" value={threshold} onChange={e=>setThreshold(parseInt(e.target.value||0,10))} style={{width:80,padding:6}} title="Brightness contrast threshold: higher = fewer squares, lower = more detail" />
          <label style={{fontSize:12}} title="Image sampling grid size: lower = simpler, higher = more detail">Base Grid</label>
          <input type="number" value={baseGridSize} onChange={e=>setBaseGridSize(parseInt(e.target.value||1,10))} style={{width:80,padding:6}} title="Image sampling grid size: lower = simpler, higher = more detail" />
        </div>

        <label style={{display:'flex',alignItems:'center',gap:8}}>
          <input type="checkbox" checked={uncap} onChange={e=>setUncap(e.target.checked)} />
          <span style={{fontSize:13}}>Uncap layers (allow &gt;{maxLayers})</span>
        </label>

        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <label style={{fontSize:12}}>Max Layers</label>
          <input type="number" value={maxLayers} onChange={e=>setMaxLayers(parseInt(e.target.value||1500,10))} style={{width:120,padding:6}} />
        </div>

        <button onClick={submit} disabled={loading || !imageUrl} style={{padding:10,borderRadius:8,background:'#6b46c1',color:'white',border:'none'}}>Generate Code</button>
      </div>

      {loading && <p style={{marginTop:12}}>Processing...</p>}

      {result && (
        <div style={{marginTop:16}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
            <div style={{fontSize:16,fontWeight:700}}>Original Size: {meta.originalWidth ?? '-'} x {meta.originalHeight ?? '-'}</div>
            <div style={{fontSize:14}}>Current Size: {meta.width ?? '-'} x {meta.height ?? '-'}</div>
            <div style={{fontSize:14}}>Layers: {meta.layers ?? '-'}</div>
          </div>

          <h3 style={{marginTop:12,fontSize:16}}>FRL Hex Codes</h3>
          <button onClick={copyToClipboard} style={{padding:8,marginBottom:8,borderRadius:6,background:copied?'#10b981':'#3b82f6',color:'white',border:'none',cursor:'pointer'}}>{copied?'✓ Copied!':'Copy All'}</button>
          
          <div style={{maxHeight:200,overflow:'auto',background:'#f6f6f6',padding:10,borderRadius:6,marginBottom:12}}>
            {(result.frlHex || []).map((h,idx)=> (
              <div key={idx} style={{fontFamily:'monospace',fontSize:12,marginBottom:4,wordBreak:'break-all'}}>{h}</div>
            ))}
          </div>

          <h3 style={{marginTop:12,fontSize:16}}>Preview (Reference vs Generated)</h3>
          <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
              <div style={{fontSize:12,fontWeight:600}}>Reference</div>
              <div style={{width:200,height:200,overflow:'hidden',border:'3px solid #ddd',borderRadius:6,background:'white'}}>
                <img src={imageUrl} alt="reference" style={{width:'100%',height:'100%',objectFit:'contain'}} />
              </div>
            </div>

            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
              <div style={{fontSize:12,fontWeight:600}}>Generated</div>
              <div style={{width:200,height:200,overflow:'hidden',border:'3px solid #ddd',borderRadius:6,background:'white'}}>
                <canvas ref={canvasRef} style={{width:'100%',height:'100%',display:'block'}} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
