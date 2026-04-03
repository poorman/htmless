/**
 * Extract basic metadata (dimensions) from an image buffer without any
 * external dependencies.  Supports PNG and JPEG header parsing.
 */
export async function extractMetadata(
  buffer: Buffer,
  mimeType: string,
): Promise<{ width?: number; height?: number }> {
  if (mimeType === 'image/png') {
    return parsePngDimensions(buffer);
  }

  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return parseJpegDimensions(buffer);
  }

  if (mimeType === 'image/gif') {
    return parseGifDimensions(buffer);
  }

  // Non-image or unsupported format
  return {};
}

// ─── PNG ────────────────────────────────────────────────────────────
// PNG IHDR chunk starts at byte 16. Width at offset 16 (4 bytes BE),
// height at offset 20 (4 bytes BE).

function parsePngDimensions(buf: Buffer): { width?: number; height?: number } {
  // Minimum valid PNG is ~33 bytes (signature + IHDR)
  if (buf.length < 24) return {};

  // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] !== 0x89 ||
    buf[1] !== 0x50 ||
    buf[2] !== 0x4e ||
    buf[3] !== 0x47
  ) {
    return {};
  }

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);

  return { width, height };
}

// ─── JPEG ───────────────────────────────────────────────────────────
// Walk SOF markers to find frame dimensions.

function parseJpegDimensions(buf: Buffer): { width?: number; height?: number } {
  if (buf.length < 4) return {};

  // Check JPEG SOI marker: FF D8
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return {};

  let offset = 2;

  while (offset < buf.length - 1) {
    // Find next marker
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = buf[offset + 1];

    // SOF markers (SOF0 through SOF15, except SOF4/DHT and SOF12/DAC)
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      if (offset + 9 > buf.length) return {};

      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }

    // Skip to next marker — segment length is at offset+2 (2 bytes BE)
    if (offset + 3 >= buf.length) return {};
    const segmentLength = buf.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }

  return {};
}

// ─── GIF ────────────────────────────────────────────────────────────
// Width at byte 6 (LE uint16), height at byte 8 (LE uint16).

function parseGifDimensions(buf: Buffer): { width?: number; height?: number } {
  if (buf.length < 10) return {};

  // Check GIF signature
  const sig = buf.subarray(0, 3).toString('ascii');
  if (sig !== 'GIF') return {};

  const width = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);

  return { width, height };
}
