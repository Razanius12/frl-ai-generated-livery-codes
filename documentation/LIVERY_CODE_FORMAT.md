# Livery Code Format Summary

## What is a Livery Code?

A **livery code** is a 40-character hexadecimal string (20 bytes) that encodes a single shape in the FRL (FR Legends) format. Instead of manually drawing or pixel-painting designs, livery codes allow you to represent visual elements programmatically as structured binary data.

Each livery code defines:

- **Shape type** (e.g., square, circle)
- **Position** on the canvas (X, Y coordinates)
- **Size** (scale width and height)
- **Color** (RGB)
- **Opacity** (transparency level)
- **Blend mode** (how the shape blends with layers below)
- **Mirror modes** (horizontal, vertical, or both)
- **Visibility** (shown or hidden)

## Livery Code Structure (40 Hex Characters)

A livery code has this exact format:

``` text
AABBCCCCDDDDEEEEFFFFGGGGHHHHIIJJKKLL
```

### Byte-by-Byte Breakdown

| Hex Chars | Bytes | Field | Type | Range | Example | Description |
|-----------|-------|-------|------|-------|---------|-------------|
| AA | 0–1 | Shape Type | uint16 | 0001–FFFF | 0002 | Shape identifier (0002 = square) |
| BB CC | 2–3 | Position X | int16 | -32768–32767 | 0200 | X coordinate (signed) |
| DD DD | 4–5 | Position Y | int16 | -32768–32767 | 0000 | Y coordinate (signed) |
| EE EE | 6–7 | Scale X | int16 | -32768–32767 | 0064 | Width (negative = horizontal flip) |
| FF FF | 8–9 | Scale Y | int16 | -32768–32767 | 0064 | Height (negative = vertical flip) |
| GG GG HH | 10–12 | Color RGB | 3 bytes | 000000–FFFFFF | FF0000 | 24-bit RGB color |
| II JJ | 13–14 | Opacity | uint16 | 0000–FFFF | FFFF | Alpha (FF = opaque, 00 = transparent) |
| KK KK | 15–18 | Blend Flags | uint32 | Varies | FFFFFFFF | Reserved blend mode flags |
| LL | 19 | Mirror + Visibility | uint8 | 00–07 | 01 | See table below |

### Mirror + Visibility Encoding (Last 2 Hex Characters)

The last byte encodes both mirroring and visibility as a single value:

| Code | Binary | Visibility | Mirror Mode | Description |
|------|--------|-----------|-------------|-------------|
| 01 | 0001 | Visible ✅ | None | No mirroring |
| 00 | 0000 | Hidden ❌ | None | No mirroring |
| 03 | 0011 | Visible ✅ | Horizontal | Left-right mirror |
| 02 | 0010 | Hidden ❌ | Horizontal | Left-right mirror |
| 05 | 0101 | Visible ✅ | Vertical | Top-bottom mirror |
| 04 | 0100 | Hidden ❌ | Vertical | Top-bottom mirror |
| 07 | 0111 | Visible ✅ | Both | 4-way mirror (H + V) |
| 06 | 0110 | Hidden ❌ | Both | 4-way mirror (H + V) |

**Key insight:** Odd codes = visible, Even codes = hidden.

## Complete Livery Code Example

``` text
000202000000006400640000FFFFFFFF0001
│││││││││││││││││││││││││││││││││││││
├─ 0002      = Shape type: square
├─ 0200      = Position X: 512 (0x0200 = 512 in decimal)
├─ 0000      = Position Y: 0
├─ 0064      = Scale X: 100 (0x0064 = 100 in decimal)
├─ 0064      = Scale Y: 100
├─ 000000    = Color: black (RGB 0,0,0)
├─ FFFF      = Opacity: fully opaque (FF = 255)
├─ FFFFFF    = Blend flags: reserved
└─ 0001      = Mirror + Visibility: visible, no mirror
```

This represents a **100×100 black square** positioned at coordinates (512, 0) on the canvas.

## Why "Livery Code" Instead of "Hex"?

While livery codes are indeed stored as **hexadecimal strings**, the term "hex" is misleading because:

1. **Hex is just encoding** — It's how the binary data is represented as text
2. **Livery code is the format** — It's the actual structured data that FRL understands
3. **Context matters** — In racing games, "livery" refers to paint jobs and visual designs

Using "livery code" is more precise and communicates that these are **FRL shape definitions for liveries**, not just generic hexadecimal data.

## Generation Workflow

When the AI image-to-livery generator processes an image:

1. **Image Analysis** → Detect brightness, edges, and colors
2. **Grid Sampling** → Divide image into cells
3. **Shape Generation** → Create squares from bright/dark cells
4. **Livery Code Encoding** → Convert each square to a 40-char livery code
5. **Output** → Array of livery codes ready for import into FR Legends

Each generated shape becomes a single livery code string that can be:

- **Copied and pasted** into FR Legends
- **Stacked** with other livery codes (up to 1500+ layers)
- **Mixed** with manually-created designs
- **Exported** for sharing or archival

## Layer Limits and Optimization

- **Default limit:** 1500 layers per livery
- **Each layer** = 1 livery code (1 shape)
- **Optimization:** If image sampling produces too many shapes, the grid cell size automatically increases until the layer count is within limits
- **Uncapped mode:** Can generate >1500 layers if explicitly enabled
