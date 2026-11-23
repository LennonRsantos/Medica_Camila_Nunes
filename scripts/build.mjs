// Copies the deployable site into dist/ (Vercel's output directory, see vercel.json).
// Runs after Sass has compiled styles.css; only these files are published.
// HTML pages get their Bootstrap Icons as an inline SVG sprite, so the icon font CSS (render-blocking) is not shipped.
// styles.css is inlined into each page: no extra round trip before first paint on mobile.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const out = 'dist';
const pages = ['index.html', 'privacidade.html'];
const files = ['styles.css', 'script.js', 'assets', 'robots.txt', 'sitemap.xml', 'llms.txt'];

const iconCss = /\s*<!-- Bootstrap Icons[^>]*-->\s*<link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net\/npm\/bootstrap-icons[^>]*>/;
const iconTag = /<i class="bi bi-([a-z0-9-]+)([^"]*)" aria-hidden="true"><\/i>/g;
const cssLink = /<link rel="stylesheet" href="styles\.css">/;
const css = readFileSync('styles.css', 'utf8');
const svgCache = new Map();

// Each icon's paths go once into a hidden sprite; every use is a small <svg><use></svg>
const symbol = (name) => {
  const raw = readFileSync(`node_modules/bootstrap-icons/icons/${name}.svg`, 'utf8');
  const [, viewBox, body] = raw.match(/<svg[^>]*?(viewBox="[^"]+")[^>]*>([\s\S]*)<\/svg>/);
  return `<symbol id="bi-${name}" ${viewBox}>${body.replace(/\s*\n\s*/g, '')}</symbol>`;
};

const svg = (name, extra) => {
  if (!svgCache.has(name)) svgCache.set(name, symbol(name));
  return `<svg class="bi bi-${name}${extra}" aria-hidden="true" focusable="false"><use href="#bi-${name}"/></svg>`;
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
files.forEach((file) => cpSync(file, `${out}/${file}`, { recursive: true }));

pages.forEach((page) => {
  const html = readFileSync(page, 'utf8');
  if (!iconCss.test(html)) throw new Error(`${page}: Bootstrap Icons <link> not found`);
  if (!cssLink.test(html)) throw new Error(`${page}: styles.css <link> not found`);
  svgCache.clear();
  const built = html.replace(iconCss, '').replace(cssLink, () => `<style>${css}</style>`).replace(iconTag, (_, name, extra) => svg(name, extra));
  if (/<i class="bi|bootstrap-icons/.test(built)) throw new Error(`${page}: icon left unconverted`);
  const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${[...svgCache.values()].join('')}</svg>`;
  // Sprite goes last: its bytes stay out of the first round trip; <use> resolves symbols defined later
  writeFileSync(`${out}/${page}`, built.replace('</body>', () => `  ${sprite}\n</body>`));
});

console.log(`Site built in ${out}/: ${[...pages, ...files].join(', ')}`);
