import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");

// ── Brand Colors ──
const C = {
  primary: "#0057B8",      // MDLinx blue
  primaryDark: "#003D82",
  accent: "#00A3E0",       // lighter blue accent
  bg: "#FFFFFF",
  bgAlt: "#F0F5FA",
  text: "#1A1A2E",
  textLight: "#5A6B80",
  white: "#FFFFFF",
  border: "#D0DFED",
};

// ── Dimensions ──
type Format = "tiktok" | "instagram";
const DIMS: Record<Format, { w: number; h: number }> = {
  tiktok:    { w: 1080, h: 1920 },
  instagram: { w: 1080, h: 1350 },
};

// ── Content Types ──
interface TitleSlide    { type: "title"; headline: string; subtitle: string }
interface ContentSlide  { type: "content"; heading: string; bullets: string[] }
interface CitationSlide { type: "citation"; sources: string[] }
interface CTASlide      { type: "cta"; text: string; handle: string }
type Slide = TitleSlide | ContentSlide | CitationSlide | CTASlide;

interface CarouselPayload {
  slides: Slide[];
}

// ── Sample Content ──
const SAMPLE: CarouselPayload = {
  slides: [
    {
      type: "title",
      headline: "Seed Oils and Inflammation",
      subtitle: "What the Evidence Actually Says",
    },
    {
      type: "content",
      heading: "Omega-6 ≠ Automatic Inflammation",
      bullets: [
        "Linoleic acid is the primary omega-6 in seed oils",
        "Systematic reviews show no increase in inflammatory markers from LA intake",
        "The omega-6:omega-3 ratio theory is oversimplified",
      ],
    },
    {
      type: "content",
      heading: "What RCTs Actually Show",
      bullets: [
        "Replacing saturated fat with LA lowers LDL cholesterol",
        "No consistent evidence of increased CRP or IL-6",
        "AHA recommends 5–10% of calories from omega-6",
        "Most negative claims cite animal or in-vitro studies",
      ],
    },
    {
      type: "content",
      heading: "Where Nuance Matters",
      bullets: [
        "Ultra-processed foods ≠ seed oils alone — confounding matters",
        "Oxidized oils (reheated frying oil) are a separate issue",
        "Individual genetics (FADS variants) may modulate response",
      ],
    },
    {
      type: "citation",
      sources: [
        "Fritsche KL. Lipids. 2015;50(4):387-397",
        "Marklund M et al. Circulation. 2019;139(21)",
        "Sacks FM et al. Circulation. 2017;136(24)",
        "AHA Dietary Fats Advisory, 2017",
      ],
    },
    {
      type: "cta",
      text: "Follow MDLinx for evidence-based health content",
      handle: "@MDLinx",
    },
  ],
};

// ── Load a font (we'll use Inter from Google Fonts cache or a local fallback) ──
async function loadFont(): Promise<ArrayBuffer> {
  // Try to fetch Inter Bold + Regular
  const urls = [
    "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff",
    "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff",
  ];
  const buffers: { data: ArrayBuffer; name: string; weight: number; style: "normal" }[] = [];
  for (const [i, url] of urls.entries()) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Font fetch failed: ${url}`);
    buffers.push({
      data: await res.arrayBuffer(),
      name: "Inter",
      weight: i === 0 ? 700 : 400,
      style: "normal" as const,
    });
  }
  return buffers as any; // satori accepts font array
}

// ── Shared wrappers ──
function safe(w: number, h: number) {
  const px = Math.round(w * 0.1);
  const py = Math.round(h * 0.08);
  return { px, py };
}

function logoPlaceholder() {
  return {
    display: "flex" as const,
    alignItems: "center" as const,
    fontSize: 28,
    fontWeight: 700,
    color: C.primary,
    letterSpacing: "-0.02em",
  };
}

function slideNumber(n: number, total: number) {
  return {
    position: "absolute" as const,
    bottom: 40,
    right: 50,
    fontSize: 24,
    color: C.textLight,
  };
}

// ── Slide Renderers (return satori-compatible JSX object trees) ──
// Satori uses React-like objects: { type, props, children }

function h(type: string, props: Record<string, any>, ...children: any[]): any {
  const flat = children.flat(Infinity).filter((c: any) => c != null);
  return { type, props: { ...props, children: flat.length === 1 ? flat[0] : flat.length === 0 ? undefined : flat } };
}

function renderTitle(slide: TitleSlide, w: number, h_: number, idx: number, total: number) {
  const { px, py } = safe(w, h_);
  return h("div", {
    style: {
      display: "flex", flexDirection: "column", width: w, height: h_,
      background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
      padding: `${py}px ${px}px`, justifyContent: "center", alignItems: "center",
      fontFamily: "Inter", position: "relative",
    },
  },
    h("div", { style: { ...logoPlaceholder(), color: C.white, position: "absolute", top: 40, left: 50 } }, "MDLinx"),
    h("div", {
      style: {
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", flex: 1, textAlign: "center", gap: 24,
      },
    },
      h("div", { style: { fontSize: 64, fontWeight: 700, color: C.white, lineHeight: 1.15, maxWidth: "90%" } }, slide.headline),
      h("div", { style: { fontSize: 36, color: "rgba(255,255,255,0.85)", lineHeight: 1.4, maxWidth: "85%" } }, slide.subtitle),
    ),
    h("div", { style: slideNumber(idx, total) as any }, `${idx + 1} / ${total}`),
  );
}

function renderContent(slide: ContentSlide, w: number, h_: number, idx: number, total: number) {
  const { px, py } = safe(w, h_);
  return h("div", {
    style: {
      display: "flex", flexDirection: "column", width: w, height: h_,
      background: C.bg, padding: `${py}px ${px}px`,
      fontFamily: "Inter", position: "relative",
    },
  },
    h("div", { style: { ...logoPlaceholder(), marginBottom: 12 } }, "MDLinx"),
    h("div", { style: { display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 36, paddingLeft: 20, paddingRight: 20 } },
      h("div", { style: { fontSize: 48, fontWeight: 700, color: C.primary, lineHeight: 1.2 } }, slide.heading),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 28 } },
        ...slide.bullets.map((b) =>
          h("div", { style: { display: "flex", alignItems: "flex-start", gap: 18 } },
            h("div", { style: { width: 14, height: 14, borderRadius: 7, background: C.accent, marginTop: 10, flexShrink: 0 } }),
            h("div", { style: { fontSize: 34, color: C.text, lineHeight: 1.45 } }, b),
          )
        ),
      ),
    ),
    h("div", { style: { ...slideNumber(idx, total) as any, color: C.textLight } }, `${idx + 1} / ${total}`),
  );
}

function renderCitation(slide: CitationSlide, w: number, h_: number, idx: number, total: number) {
  const { px, py } = safe(w, h_);
  return h("div", {
    style: {
      display: "flex", flexDirection: "column", width: w, height: h_,
      background: C.bgAlt, padding: `${py}px ${px}px`,
      fontFamily: "Inter", position: "relative",
    },
  },
    h("div", { style: { ...logoPlaceholder(), marginBottom: 12 } }, "MDLinx"),
    h("div", { style: { display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 20, paddingLeft: 20, paddingRight: 20 } },
      h("div", { style: { fontSize: 40, fontWeight: 700, color: C.primary, marginBottom: 20 } }, "Sources"),
      ...slide.sources.map((s, i) =>
        h("div", { style: { display: "flex", gap: 14, alignItems: "flex-start" } },
          h("div", { style: { fontSize: 26, color: C.accent, fontWeight: 700, flexShrink: 0 } }, `${i + 1}.`),
          h("div", { style: { fontSize: 26, color: C.textLight, lineHeight: 1.5 } }, s),
        )
      ),
    ),
    h("div", { style: { ...slideNumber(idx, total) as any, color: C.textLight } }, `${idx + 1} / ${total}`),
  );
}

function renderCTA(slide: CTASlide, w: number, h_: number, idx: number, total: number) {
  const { px, py } = safe(w, h_);
  return h("div", {
    style: {
      display: "flex", flexDirection: "column", width: w, height: h_,
      background: `linear-gradient(180deg, ${C.primaryDark} 0%, ${C.primary} 100%)`,
      padding: `${py}px ${px}px`, justifyContent: "center", alignItems: "center",
      fontFamily: "Inter", position: "relative",
    },
  },
    h("div", { style: { ...logoPlaceholder(), color: C.white, position: "absolute", top: 40, left: 50 } }, "MDLinx"),
    h("div", {
      style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 40, textAlign: "center" },
    },
      h("div", { style: { fontSize: 52, fontWeight: 700, color: C.white, lineHeight: 1.25, maxWidth: "85%" } }, slide.text),
      h("div", {
        style: {
          fontSize: 36, fontWeight: 700, color: C.white,
          background: C.accent, padding: "20px 48px", borderRadius: 60,
        },
      }, slide.handle),
    ),
    h("div", { style: { ...slideNumber(idx, total) as any, color: "rgba(255,255,255,0.6)" } }, `${idx + 1} / ${total}`),
  );
}

function renderSlide(slide: Slide, w: number, h_: number, idx: number, total: number) {
  switch (slide.type) {
    case "title":    return renderTitle(slide, w, h_, idx, total);
    case "content":  return renderContent(slide, w, h_, idx, total);
    case "citation": return renderCitation(slide, w, h_, idx, total);
    case "cta":      return renderCTA(slide, w, h_, idx, total);
  }
}

// ── Main ──
async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Load fonts
  const fontUrls = [
    { url: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff", weight: 700 },
    { url: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff", weight: 400 },
  ];
  const fonts = await Promise.all(
    fontUrls.map(async ({ url, weight }) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch font: ${url}`);
      return { name: "Inter", data: await res.arrayBuffer(), weight, style: "normal" as const };
    })
  );

  const payload = SAMPLE;
  const total = payload.slides.length;
  const formats: Format[] = ["tiktok", "instagram"];

  for (const fmt of formats) {
    const { w, h: h_ } = DIMS[fmt];
    const fmtDir = join(OUTPUT_DIR, fmt);
    mkdirSync(fmtDir, { recursive: true });

    for (let i = 0; i < payload.slides.length; i++) {
      const slide = payload.slides[i];
      const tree = renderSlide(slide, w, h_, i, total);

      const svg = await satori(tree, { width: w, height: h_, fonts });
      const resvg = new Resvg(svg, { fitTo: { mode: "width", value: w } });
      const png = resvg.render().asPng();

      const filename = `${String(i + 1).padStart(2, "0")}-${slide.type}.png`;
      writeFileSync(join(fmtDir, filename), png);
      console.log(`✓ ${fmt}/${filename}`);
    }
  }

  console.log(`\nDone! ${total * formats.length} slides generated in ${OUTPUT_DIR}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
