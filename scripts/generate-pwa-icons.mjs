import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const iconsDir = path.resolve(__dirname, '../public/icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. Standard (rounded/translucent corners) SVG
const createStandardSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#090d16" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35" />
      <stop offset="45%" stop-color="#818cf8" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#020617" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="cube-top" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
    <linearGradient id="cube-left" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#4338ca" />
    </linearGradient>
    <linearGradient id="cube-right" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#c084fc" />
      <stop offset="100%" stop-color="#7e22ce" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.7" />
    </filter>
  </defs>

  <!-- Background tile with smooth squircle border -->
  <rect width="512" height="512" rx="112" fill="url(#bg)" />
  <rect width="512" height="512" rx="112" fill="url(#glow)" />
  <rect width="504" height="504" x="4" y="4" rx="108" fill="none" stroke="#38bdf8" stroke-width="3" stroke-opacity="0.3" />

  <!-- Loomis Elliptical Orbit Rings -->
  <ellipse cx="256" cy="254" rx="195" ry="74" fill="none" stroke="#38bdf8" stroke-width="4" stroke-dasharray="14 10" opacity="0.45" transform="rotate(-18 256 254)" />
  <ellipse cx="256" cy="254" rx="195" ry="74" fill="none" stroke="#c084fc" stroke-width="3" stroke-dasharray="10 8" opacity="0.4" transform="rotate(35 256 254)" />

  <!-- 3D Geometric Facet / Mannequin Plane Motif -->
  <g filter="url(#shadow)">
    <!-- Top Isometric Plane -->
    <path d="M256,128 L364,190 L256,252 L148,190 Z" fill="url(#cube-top)" />
    <!-- Left Plane -->
    <path d="M148,190 L256,252 L256,370 L148,308 Z" fill="url(#cube-left)" />
    <!-- Right Plane -->
    <path d="M256,252 L364,190 L364,308 L256,370 Z" fill="url(#cube-right)" />

    <!-- Contour Wireframe Guide Lines -->
    <path d="M202,159 L310,221" stroke="#e0f2fe" stroke-width="3" stroke-linecap="round" stroke-opacity="0.75" />
    <path d="M202,221 L202,339" stroke="#e0e7ff" stroke-width="3" stroke-linecap="round" stroke-opacity="0.75" />
    <path d="M310,221 L310,339" stroke="#f3e8ff" stroke-width="3" stroke-linecap="round" stroke-opacity="0.75" />

    <!-- Pigment Wells / Palette Swatches -->
    <circle cx="148" cy="190" r="14" fill="#38bdf8" stroke="#ffffff" stroke-width="3.5" />
    <circle cx="256" cy="128" r="14" fill="#f59e0b" stroke="#ffffff" stroke-width="3.5" />
    <circle cx="364" cy="190" r="14" fill="#ec4899" stroke="#ffffff" stroke-width="3.5" />
    <circle cx="256" cy="370" r="14" fill="#10b981" stroke="#ffffff" stroke-width="3.5" />

    <!-- Central Focal Axis Vertex -->
    <circle cx="256" cy="252" r="16" fill="#ffffff" />
    <circle cx="256" cy="252" r="9" fill="#0284c7" />
  </g>
</svg>
`;

// 2. Maskable SVG (Full bleed square with no rounding, safe area within central 80%)
const createMaskableSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs>
    <linearGradient id="mbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#090d16" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <radialGradient id="mglow" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.4" />
      <stop offset="45%" stop-color="#818cf8" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#020617" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="mcube-top" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
    <linearGradient id="mcube-left" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#4338ca" />
    </linearGradient>
    <linearGradient id="mcube-right" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#c084fc" />
      <stop offset="100%" stop-color="#7e22ce" />
    </linearGradient>
    <filter id="mshadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.75" />
    </filter>
  </defs>

  <!-- Full Bleed Square for Maskable Safe Zone -->
  <rect width="512" height="512" fill="url(#mbg)" />
  <rect width="512" height="512" fill="url(#mglow)" />

  <!-- Loomis Elliptical Orbit Rings (scaled strictly inside safe zone r <= 200) -->
  <g transform="translate(256, 256) scale(0.88) translate(-256, -256)">
    <ellipse cx="256" cy="254" rx="195" ry="74" fill="none" stroke="#38bdf8" stroke-width="4" stroke-dasharray="14 10" opacity="0.45" transform="rotate(-18 256 254)" />
    <ellipse cx="256" cy="254" rx="195" ry="74" fill="none" stroke="#c084fc" stroke-width="3" stroke-dasharray="10 8" opacity="0.4" transform="rotate(35 256 254)" />

    <!-- 3D Geometric Facet / Mannequin Plane Motif -->
    <g filter="url(#mshadow)">
      <path d="M256,128 L364,190 L256,252 L148,190 Z" fill="url(#mcube-top)" />
      <path d="M148,190 L256,252 L256,370 L148,308 Z" fill="url(#mcube-left)" />
      <path d="M256,252 L364,190 L364,308 L256,370 Z" fill="url(#mcube-right)" />

      <path d="M202,159 L310,221" stroke="#e0f2fe" stroke-width="3" stroke-linecap="round" stroke-opacity="0.75" />
      <path d="M202,221 L202,339" stroke="#e0e7ff" stroke-width="3" stroke-linecap="round" stroke-opacity="0.75" />
      <path d="M310,221 L310,339" stroke="#f3e8ff" stroke-width="3" stroke-linecap="round" stroke-opacity="0.75" />

      <circle cx="148" cy="190" r="14" fill="#38bdf8" stroke="#ffffff" stroke-width="3.5" />
      <circle cx="256" cy="128" r="14" fill="#f59e0b" stroke="#ffffff" stroke-width="3.5" />
      <circle cx="364" cy="190" r="14" fill="#ec4899" stroke="#ffffff" stroke-width="3.5" />
      <circle cx="256" cy="370" r="14" fill="#10b981" stroke="#ffffff" stroke-width="3.5" />

      <circle cx="256" cy="252" r="16" fill="#ffffff" />
      <circle cx="256" cy="252" r="9" fill="#0284c7" />
    </g>
  </g>
</svg>
`;

async function generate() {
  console.log('Generating PWA icons...');

  // 192x192 standard
  await sharp(Buffer.from(createStandardSvg(192)))
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'icon-192x192.png'));
  console.log('Generated icon-192x192.png');

  // 512x512 standard
  await sharp(Buffer.from(createStandardSvg(512)))
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'icon-512x512.png'));
  console.log('Generated icon-512x512.png');

  // 192x192 maskable
  await sharp(Buffer.from(createMaskableSvg(192)))
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'icon-maskable-192x192.png'));
  console.log('Generated icon-maskable-192x192.png');

  // 512x512 maskable
  await sharp(Buffer.from(createMaskableSvg(512)))
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'icon-maskable-512x512.png'));
  console.log('Generated icon-maskable-512x512.png');

  // 180x180 apple-touch-icon
  await sharp(Buffer.from(createStandardSvg(180)))
    .resize(180, 180)
    .png()
    .toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // 32x32 favicon png
  await sharp(Buffer.from(createStandardSvg(32)))
    .resize(32, 32)
    .png()
    .toFile(path.join(iconsDir, 'icon-32x32.png'));
  console.log('Generated icon-32x32.png');

  // 16x16 favicon png
  await sharp(Buffer.from(createStandardSvg(16)))
    .resize(16, 16)
    .png()
    .toFile(path.join(iconsDir, 'icon-16x16.png'));
  console.log('Generated icon-16x16.png');

  console.log('All icons generated successfully!');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
