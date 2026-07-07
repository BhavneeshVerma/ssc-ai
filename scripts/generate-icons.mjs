import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const COLORS = {
  background: [13, 13, 13, 255],
  panel: [22, 22, 22, 255],
  border: [198, 255, 0, 255],
  borderSoft: [51, 51, 48, 255],
  transparent: [0, 0, 0, 0]
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = rowStart + 1 + x * 4;
      raw[dst] = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      raw[dst + 3] = rgba[src + 3];
    }
  }

  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function makeCanvas(size) {
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = COLORS.background[0];
    pixels[i + 1] = COLORS.background[1];
    pixels[i + 2] = COLORS.background[2];
    pixels[i + 3] = COLORS.background[3];
  }
  return pixels;
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const index = (y * size + x) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function fillRect(pixels, size, x0, y0, x1, y1, color) {
  const startX = Math.max(0, Math.floor(x0));
  const startY = Math.max(0, Math.floor(y0));
  const endX = Math.min(size, Math.ceil(x1));
  const endY = Math.min(size, Math.ceil(y1));
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      setPixel(pixels, size, x, y, color);
    }
  }
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function fillPolygon(pixels, size, points, color) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(...ys)));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInPolygon(x + 0.5, y + 0.5, points)) {
        setPixel(pixels, size, x, y, color);
      }
    }
  }
}

function drawIcon(size) {
  const pixels = makeCanvas(size);
  const scale = size / 512;
  const s = (value) => value * scale;

  fillRect(pixels, size, 0, 0, size, size, COLORS.background);
  fillRect(pixels, size, s(36), s(36), s(476), s(476), COLORS.panel);

  const border = Math.max(2, Math.round(18 * scale));
  fillRect(pixels, size, s(36), s(36), s(476), s(36) + border, COLORS.border);
  fillRect(pixels, size, s(36), s(476) - border, s(476), s(476), COLORS.border);
  fillRect(pixels, size, s(36), s(36), s(36) + border, s(476), COLORS.border);
  fillRect(pixels, size, s(476) - border, s(36), s(476), s(476), COLORS.border);

  fillRect(pixels, size, s(88), s(88), s(424), s(424), COLORS.transparent);
  fillRect(pixels, size, s(88), s(88), s(424), s(98), COLORS.borderSoft);
  fillRect(pixels, size, s(88), s(414), s(424), s(424), COLORS.borderSoft);
  fillRect(pixels, size, s(88), s(88), s(98), s(424), COLORS.borderSoft);
  fillRect(pixels, size, s(414), s(88), s(424), s(424), COLORS.borderSoft);

  const bolt = [
    [286, 78],
    [164, 278],
    [246, 278],
    [220, 434],
    [356, 214],
    [276, 214]
  ].map(([x, y]) => [s(x), s(y)]);

  fillPolygon(pixels, size, bolt, COLORS.border);
  return encodePng(size, size, pixels);
}

function main() {
  const outputs = [
    ['public/icon-192.png', 192],
    ['public/icon-512.png', 512],
    ['public/apple-touch-icon.png', 180]
  ];

  for (const [path, size] of outputs) {
    writeFileSync(path, drawIcon(size));
  }
}

main();
