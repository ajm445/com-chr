const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src/renderer/src/assets/sprites/chr_idle.png');

async function main() {
  const meta = await sharp(SRC).metadata();
  const frameW = Math.floor(meta.width / 4);
  const frameH = meta.height;

  // Extract first frame
  const rawFrame = await sharp(SRC)
    .extract({ left: 0, top: 0, width: frameW, height: frameH })
    .png()
    .toBuffer();

  // Trim transparent edges
  const firstFrame = await sharp(rawFrame).trim().toBuffer();

  // Pad to square with transparent background
  const trimmedMeta = await sharp(firstFrame).metadata();
  const size = Math.max(trimmedMeta.width, trimmedMeta.height);
  const padded = await sharp(firstFrame)
    .extend({
      top: Math.floor((size - trimmedMeta.height) / 2),
      bottom: Math.ceil((size - trimmedMeta.height) / 2),
      left: Math.floor((size - trimmedMeta.width) / 2),
      right: Math.ceil((size - trimmedMeta.width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  // build/icon.png — 512x512 (electron-builder source)
  await sharp(padded)
    .resize(512, 512, { kernel: 'nearest' })
    .png()
    .toFile(path.join(__dirname, '..', 'build/icon.png'));

  // resources/icon.png — 256x256 (window icon)
  await sharp(padded)
    .resize(256, 256, { kernel: 'nearest' })
    .png()
    .toFile(path.join(__dirname, '..', 'resources/icon.png'));

  // resources/tray.png — 32x32 (tray icon)
  await sharp(padded)
    .resize(32, 32, { kernel: 'nearest' })
    .png()
    .toFile(path.join(__dirname, '..', 'resources/tray.png'));

  // build/icon.ico — multi-size from 256 png
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBufs = await Promise.all(
    icoSizes.map((s) =>
      sharp(padded).resize(s, s, { kernel: 'nearest' }).png().toBuffer()
    )
  );
  const icoBuf = await pngToIco(pngBufs);
  fs.writeFileSync(path.join(__dirname, '..', 'build/icon.ico'), icoBuf);

  console.log('Icons generated successfully.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
