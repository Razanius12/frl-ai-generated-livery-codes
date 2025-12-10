# FRL AI Generated Codes (Square Livery Generator)

## About This Project

**Status: 18% Complete** — This project is in active development.

This project aims to use **AI-powered image analysis** to generate FRL FR Legends livery codes from any image. The livery code encoding patterns were reverse-engineered with AI assistance in just **3 hours**, discovering the underlying format and how shapes are encoded. The foundation has been laid through pattern discovery, and the next phases will focus on expanding the AI generation capabilities.

**Current Progress:**

- ✅ **Pattern Discovery** — Livery code encoding format reverse-engineered and documented
- ✅ **Shape Encoding** — Square shapes can be encoded into livery code format
- 🔄 **Image-to-Livery Pipeline** — Partially implemented; foundation for intelligent image sampling established
- ⏳ **AI Generation Expansion** — Full automated livery generation from images (in development)

The core vision: instead of manually creating patterns, the application will **intelligently sample images** to detect edges, brightness variations, and color information—then encode them into FRL-compatible livery code format for use in FR Legends.

## Quick Start (Windows PowerShell)

1. Open PowerShell and change to the project folder:

```powershell
Set-Location 'D:\GitHub\frl-ai-generated-livery-codes'
```

1. Install dependencies:

```powershell
npm install
```

1. Run the dev server:

```powershell
npm run dev
```

1. Open [http://localhost:3000](http://localhost:3000), upload or paste an image URL, adjust parameters, and click "Generate Code".

## Features

- **AI Image Sampling** — Analyzes input images to detect edges, brightness, and color information
- **Intelligent Grid-Based Processing** — Divides images into cells and evaluates brightness against threshold to generate squares
- **Adaptive Layer Control** — Automatically adjusts sampling resolution to stay within FRL layer limits (default 1500, uncappable)
- **Image Upload / URL Support** — Process local images or remote URLs
- **Downscale Control** — 1–100% to adjust processing resolution and detail level
- **Base Grid Size** — Controls sampling cell size (lower = simpler output, higher = more detail)
- **Threshold** — Brightness contrast detection to identify edges (higher = fewer squares generated)
- **Live Preview** — Canvas rendering shows generated squares alongside reference image
- **Copy to Clipboard** — One-click copy all livery codes

## How It Works: AI Image-to-Livery Engine

1. **Image Downscaling** — Images are downscaled (1–100%) to optimize processing speed and detail level
2. **Grid-Based Sampling** — The downscaled image is divided into cells based on `baseGridSize`
3. **Brightness Analysis** — Each cell's average brightness is calculated across RGB channels
4. **Threshold Detection** — Cells with brightness deviation > `threshold` are marked for shape generation
5. **Color Extraction** — Average RGB color of qualifying cells is extracted
6. **Square Generation** — Qualifying cells become colored squares positioned and scaled to match the image grid
7. **Layer Optimization** — If total shapes exceed `maxLayers` (1500), cell size is dynamically increased until constraints are met
8. **Livery Code Encoding** — Each generated square is encoded into FRL livery code format (40-character code per shape)

This algorithm intelligently converts any image into a FRL-compatible livery using pure pixel analysis—no manual pattern definition required.

## API

**POST `/api/generate`**

Parameters (multipart/form-data):

- `imageUrl` — Remote image URL (https://...)
- `imageDataUrl` — Data URL from file upload (data:image/...)
- `downscale` — Downscale percentage (1–100, default 10)
- `threshold` — Brightness threshold (default 16)
- `baseGridSize` — Sampling grid size (default 40)
- `uncap` — Boolean; if 'true', allows >1500 layers
- `maxLayers` — Maximum layers cap (default 1500)

**Response:**

```json
{
  "meta": {
    "originalWidth": 1024,
    "originalHeight": 1024,
    "width": 102,
    "height": 102,
    "layers": 256
  },
  "shapes": [
    {
      "type": "square",
      "x": 0.5,
      "y": 0.5,
      "scaleX": 0.05,
      "scaleY": 0.05,
      "rotation": 0,
      "color": "#FF0000",
      "blend": "normal"
    }
  ],
  "frlLiveryCodes": ["000202000000006400640000FFFFFFFF0001", ...]
}
```

## Livery Code Format

See [`FRL_CODE_ANALYSIS.md`](./documentation/FRL_CODE_ANALYSIS.md), [`LAYER_53_ANALYSIS.md`](./documentation/LAYER_53_ANALYSIS.md), and [`LIVERY_CODE_FORMAT.md`](./documentation/LIVERY_CODE_FORMAT.md) for detailed documentation on livery code encoding and layer structure.

Each square is encoded as a 40-character livery code (20 bytes):

- **Bytes 0–1** — Shape type (0x0002 = square)
- **Bytes 2–3** — Position X (signed int16)
- **Bytes 4–5** — Position Y (signed int16)
- **Bytes 6–7** — Scale X (unsigned int16)
- **Bytes 8–9** — Scale Y (unsigned int16)
- **Bytes 10–12** — RGB color (3 bytes)
- **Bytes 13–19** — Opacity, blend mode, and flags

**Example:**

```text
000202000000006400640000FFFFFFFF0001
├─ 0002      = Square type
├─ 0200      = Position X: 512
├─ 0000      = Position Y: 0
├─ 0064      = Scale X: 100
├─ 0064      = Scale Y: 100
├─ 000000    = RGB: black (0,0,0)
└─ FFFFFFFF0001 = White opacity, normal blend
```

## Development & Reverse Engineering

This project was developed in an innovative way:

1. **AI Pattern Discovery** — Using AI assistance, the livery code encoding format was reverse-engineered from documentation in just **3 hours**
2. **Pattern Documentation** — All discovered patterns have been analyzed and documented for shape encoding
3. **Foundation Building** — The groundwork for AI-driven image sampling has been established
4. **In Development** — Full AI generation pipeline to automatically convert images to liveries

The 3-hour achievement represents the rapid discovery and documentation of FRL patterns—the critical foundation for the larger AI generation project now underway.

## Deployment

To deploy on Vercel:

```powershell
npm i -g vercel
vercel login
vercel
```

This creates a public preview URL with auto-generated FRL codes.
