# Slide Generator — MDLinx Carousel

Generates branded medical carousel slides as PNG images using Satori (JSX → SVG) and resvg (SVG → PNG). No browser or Puppeteer needed.

## Quick Start

```bash
cd skills/slide-gen
bash run.sh
```

Output lands in `output/tiktok/` and `output/instagram/`.

## Formats

| Format    | Size       | Ratio |
|-----------|------------|-------|
| TikTok    | 1080×1920  | 9:16  |
| Instagram | 1080×1350  | 4:5   |

## Slide Types

- **title** — Headline + subtitle on blue gradient
- **content** — Heading + bullet points on white
- **citation** — Numbered source list
- **cta** — Call-to-action with handle badge

## Content Payload

Edit the `SAMPLE` object in `generate.ts` or import a JSON file. Shape:

```ts
interface CarouselPayload {
  slides: (TitleSlide | ContentSlide | CitationSlide | CTASlide)[];
}
```

## Integration

To use programmatically, extract `renderSlide()` and the `main()` pipeline into importable functions. The script is self-contained with no framework dependencies beyond satori + resvg.

## Customization

- **Colors:** Edit the `C` object at the top of `generate.ts`
- **Fonts:** Fetched from jsDelivr (Inter 400/700). Swap URLs for other fonts.
- **Safe zone:** 10% horizontal / 8% vertical padding by default
