# Optional raster art (Nano Banana / Gemini)

Vector silhouettes in the app are the default. To use **AI-generated** images that match `avalon_visual_prompts.md`:

1. In Cursor, enable **nano-banana** MCP and configure `GEMINI_API_KEY` (see project `mcp.json`).
2. Call the MCP tool **`generate_image`** with the prompts below (append the **Global Prompt** from that doc to each).
3. Save outputs here as **PNG** (square, ~512–1024px):

| File | Suggested prompt (abbrev.; add global line from visual pack) |
|------|----------------------------------------------------------------|
| `hero-good.png` | Generic Good Character + dark `#0c0f14` background |
| `hero-evil.png` | Generic Evil Character + same dark background |

4. Refresh the app: the home hero tries these files first and **falls back** to SVG if missing or broken.

**Global prompt** (always include, from `avalon_visual_prompts.md`):

`minimal fantasy character, dark background, high contrast lighting, soft glow, cinematic, clean composition, mobile game UI style, vector illustration, no text, centered character`

If the API returns **429 / quota**, wait or upgrade billing; the UI still works with built-in SVGs.
