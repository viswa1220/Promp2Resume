// Template registry. A template is a style config that drives BOTH the live
// HTML preview and the PDF/DOCX export, so every template renders distinctly.
//
// style:
//   font:        'serif' | 'sans' | 'mono'
//   accent:      hex color used for headings / rules / sidebar
//   layout:      'single' | 'two-column'   (two-column => left sidebar)
//   headerAlign: 'left' | 'center'
//   sectionStyle:'underline' | 'bar' | 'caps' | 'plain'
//   density:     'compact' | 'normal' | 'spacious'
//   pages:       '1' | '1-2' | '2+' | 'multi'   (guidance, not enforced)
//   fullyStyled: true  = hand-tuned design
//                false = generated variation (functional, refine later)

const T = (id, name, category, pages, fullyStyled, style) => ({ id, name, category, pages, fullyStyled, style: { layout: "single", headerAlign: "left", sectionStyle: "underline", density: "normal", font: "sans", accent: "#222222", ...style } });

export const TEMPLATES = [
  // ---- Blank canvas: shape it entirely by chat ----
  T("custom", "Custom (blank)", "Custom", "1-2", true, { font: "sans", accent: "#7C3AED", sectionStyle: "underline" }),
  // ---- Fully styled, hand-tuned ----
  T("classic", "Classic", "Standard", "1-2", true, { font: "serif", accent: "#1f2937", sectionStyle: "underline" }),
  T("modern", "Modern Blue", "Standard", "1-2", true, { font: "sans", accent: "#2563eb", sectionStyle: "bar", headerAlign: "left" }),
  T("compact", "Compact", "Dense", "1", true, { font: "sans", accent: "#111827", sectionStyle: "caps", density: "compact" }),
  T("sidebar", "Two-Column Sidebar", "Two-column", "1-2", true, { font: "sans", accent: "#0f766e", layout: "two-column", sectionStyle: "caps" }),
  T("minimal", "Minimalist", "Minimal", "1", true, { font: "sans", accent: "#374151", sectionStyle: "plain", density: "spacious", headerAlign: "center" }),
  T("executive", "Executive", "Senior", "1-2", true, { font: "serif", accent: "#7c2d12", sectionStyle: "underline", headerAlign: "center" }),
  T("technical", "Technical", "Engineering", "1-2", true, { font: "mono", accent: "#4338ca", sectionStyle: "bar" }),
  T("academic", "Academic CV", "Long-form", "multi", true, { font: "serif", accent: "#1f2937", sectionStyle: "underline", density: "spacious" }),

  // ---- Generated variations (functional; visual polish to come) ----
  T("modern-green", "Modern Green", "Standard", "1-2", true, { font: "sans", accent: "#059669", sectionStyle: "bar" }),
  T("modern-purple", "Modern Purple", "Standard", "1-2", true, { font: "sans", accent: "#7c3aed", sectionStyle: "bar" }),
  T("modern-rose", "Modern Rose", "Standard", "1-2", true, { font: "sans", accent: "#e11d48", sectionStyle: "bar" }),
  T("slate", "Slate", "Standard", "1-2", true, { font: "sans", accent: "#475569", sectionStyle: "underline" }),
  T("teal-sidebar", "Teal Sidebar", "Two-column", "1-2", true, { font: "sans", accent: "#0d9488", layout: "two-column", sectionStyle: "caps" }),
  T("navy-sidebar", "Navy Sidebar", "Two-column", "1-2", true, { font: "sans", accent: "#1e3a8a", layout: "two-column", sectionStyle: "caps" }),
  T("plum-sidebar", "Plum Sidebar", "Two-column", "1-2", true, { font: "serif", accent: "#86198f", layout: "two-column", sectionStyle: "caps" }),
  T("serif-center", "Centered Serif", "Minimal", "1", true, { font: "serif", accent: "#292524", sectionStyle: "plain", headerAlign: "center", density: "spacious" }),
  T("mono-dark", "Mono", "Engineering", "1-2", true, { font: "mono", accent: "#0f172a", sectionStyle: "caps" }),
  T("mono-indigo", "Mono Indigo", "Engineering", "1-2", true, { font: "mono", accent: "#4f46e5", sectionStyle: "bar" }),
  T("compact-serif", "Compact Serif", "Dense", "1", true, { font: "serif", accent: "#1f2937", sectionStyle: "caps", density: "compact" }),
  T("compact-blue", "Compact Blue", "Dense", "1", true, { font: "sans", accent: "#1d4ed8", sectionStyle: "caps", density: "compact" }),
  T("airy", "Airy", "Minimal", "1-2", true, { font: "sans", accent: "#0891b2", sectionStyle: "plain", density: "spacious" }),
  T("bold-bar", "Bold Bar", "Standard", "1-2", true, { font: "sans", accent: "#b91c1c", sectionStyle: "bar" }),
  T("forest", "Forest", "Standard", "1-2", true, { font: "serif", accent: "#166534", sectionStyle: "underline" }),
  T("amber", "Amber", "Standard", "1-2", true, { font: "sans", accent: "#b45309", sectionStyle: "bar" }),
  T("graphite", "Graphite", "Minimal", "1", true, { font: "sans", accent: "#1f2937", sectionStyle: "plain" }),
  T("executive-navy", "Executive Navy", "Senior", "1-2", true, { font: "serif", accent: "#1e3a8a", sectionStyle: "underline", headerAlign: "center" }),
  T("academic-long", "Academic (Long)", "Long-form", "multi", true, { font: "serif", accent: "#374151", sectionStyle: "underline", density: "spacious" }),
  T("research-cv", "Research CV", "Long-form", "multi", true, { font: "serif", accent: "#0f766e", sectionStyle: "caps", density: "spacious" }),
  T("federal", "Federal / Long", "Long-form", "multi", true, { font: "sans", accent: "#1f2937", sectionStyle: "underline", density: "spacious" }),
  T("two-col-mono", "Two-Column Mono", "Two-column", "1-2", true, { font: "mono", accent: "#334155", layout: "two-column", sectionStyle: "caps" }),

  // ---- Added designs (40 total) ----
  T("crimson-exec", "Crimson Executive", "Senior", "1-2", true, { font: "serif", accent: "#9f1239", sectionStyle: "underline", headerAlign: "center" }),
  T("ocean-sidebar", "Ocean Sidebar", "Two-column", "1-2", true, { font: "sans", accent: "#0369a1", layout: "two-column", sectionStyle: "bar" }),
  T("emerald-center", "Emerald Centered", "Minimal", "1", true, { font: "sans", accent: "#047857", sectionStyle: "plain", headerAlign: "center", density: "spacious" }),
  T("indigo-bar", "Indigo Bar", "Standard", "1-2", true, { font: "sans", accent: "#4338ca", sectionStyle: "bar" }),
  T("charcoal-mono", "Charcoal Mono", "Engineering", "1-2", true, { font: "mono", accent: "#1f2937", sectionStyle: "underline" }),
  T("rose-compact", "Rose Compact", "Dense", "1", true, { font: "sans", accent: "#be123c", sectionStyle: "caps", density: "compact" }),
  T("violet-sidebar", "Violet Sidebar", "Two-column", "1-2", true, { font: "sans", accent: "#7c3aed", layout: "two-column", sectionStyle: "caps" }),
  T("sand-serif", "Sand Serif", "Standard", "1-2", true, { font: "serif", accent: "#92400e", sectionStyle: "underline" }),
  T("steel-minimal", "Steel Minimal", "Minimal", "1", true, { font: "sans", accent: "#334155", sectionStyle: "plain", density: "spacious" }),
];

export const DEFAULT_TEMPLATE_ID = "classic";

export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID);
}

// ---- Layout knobs the chat editor can change (the "style" override layer) ----
// A resume can carry a `style` override object; it merges over the chosen
// template's style. This is what lets the chat box change LAYOUT, not just text.
export const STYLE_DEFAULTS = {
  font: "sans",                    // serif | sans | mono
  accent: "#7C3AED",               // any hex
  layout: "single",                // single | two-column
  headerAlign: "left",             // left | center
  sectionStyle: "underline",       // underline | bar | caps | plain
  density: "normal",               // compact | normal | spacious
  nameSize: 24,                    // header name font size (px)
  uppercaseName: false,            // ALL-CAPS name
  accentName: true,                // colour the name with the accent
  projectTechPlacement: "newline", // newline | inline  (tech under the project name vs beside)
  experienceMetaPlacement: "inline", // inline | newline (dates beside role vs below)
  skillsLayout: "inline",          // inline (Go • Python) | bullets | columns
  skillsColumns: 2,                // 1-4: column count when skillsLayout = "columns"
  bulletStyle: "disc",             // disc | dash | none
  showDividers: true,              // section header rules / borders
};

// Allowed values, embedded in the AI prompt so it only returns valid styles.
export const STYLE_SCHEMA = `{
  "font": "serif|sans|mono",
  "accent": "#hexcolor",
  "layout": "single|two-column",
  "headerAlign": "left|center",
  "sectionStyle": "underline|bar|caps|plain",
  "density": "compact|normal|spacious",
  "nameSize": 18-36,
  "uppercaseName": true|false,
  "accentName": true|false,
  "projectTechPlacement": "newline|inline",
  "experienceMetaPlacement": "inline|newline",
  "skillsLayout": "inline|bullets|columns",
  "bulletStyle": "disc|dash|none",
  "showDividers": true|false
}`;

// Final style = defaults < template < per-resume override.
export function resolveStyle(template, override) {
  return { ...STYLE_DEFAULTS, ...(template?.style || {}), ...(override || {}) };
}

export const FONT_STACKS = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  mono: '"SF Mono", "JetBrains Mono", "Courier New", monospace',
};

export const PDF_FONTS = {
  serif: { regular: "Times-Roman", bold: "Times-Bold", italic: "Times-Italic" },
  sans: { regular: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique" },
  mono: { regular: "Courier", bold: "Courier-Bold", italic: "Courier-Oblique" },
};
