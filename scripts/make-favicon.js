const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_LOGO = path.join(ROOT, 'public', 'logo.png');

async function makeSquare(size, padRatio = 0.72) {
  const bugSize = Math.round(size * padRatio);
  const bug = await sharp(SRC_LOGO)
    .resize(bugSize, bugSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([{ input: bug, gravity: 'center' }])
    .png()
    .toBuffer();
}

function buildIco(pngBuffers) {
  // pngBuffers: array of {size, buffer}
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + dirEntrySize * count;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  const imageBuffers = [];

  for (const { size, buffer } of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buffer.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset of image data
    offset += buffer.length;
    dirEntries.push(entry);
    imageBuffers.push(buffer);
  }

  return Buffer.concat([header, ...dirEntries, ...imageBuffers]);
}

async function main() {
  const sizes = [16, 32, 48];
  const pngBuffers = [];
  for (const size of sizes) {
    const buffer = await makeSquare(size);
    pngBuffers.push({ size, buffer });
  }

  const ico = buildIco(pngBuffers);
  fs.writeFileSync(path.join(ROOT, 'src', 'app', 'favicon.ico'), ico);
  fs.writeFileSync(path.join(ROOT, 'public', 'favicon.ico'), ico);

  // Extra sizes for other uses
  const png32 = await makeSquare(32);
  fs.writeFileSync(path.join(ROOT, 'public', 'favicon-32x32.png'), png32);

  const png180 = await makeSquare(180, 0.68);
  fs.writeFileSync(path.join(ROOT, 'public', 'apple-touch-icon.png'), png180);

  const png512 = await makeSquare(512, 0.68);
  fs.writeFileSync(path.join(ROOT, 'public', 'icon-512.png'), png512);

  const png192 = await makeSquare(192, 0.68);
  fs.writeFileSync(path.join(ROOT, 'public', 'icon-192.png'), png192);

  console.log('Favicon generated.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
