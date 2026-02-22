// Magic byte signature with optional offset (defaults to 0)
interface MagicSignature {
  bytes: number[];
  offset?: number;
}

// Magic bytes for common file types
const MAGIC_BYTES: Record<string, MagicSignature[]> = {
  // PDF: %PDF
  "application/pdf": [{ bytes: [0x25, 0x50, 0x44, 0x46] }],
  // JPEG: FFD8FF
  "image/jpeg": [{ bytes: [0xff, 0xd8, 0xff] }],
  // PNG: 89504E47
  "image/png": [{ bytes: [0x89, 0x50, 0x4e, 0x47] }],
  // HEIC/HEIF: ISO Base Media File Format — "ftyp" at offset 4
  // Bytes 0-3 are the box size (varies), bytes 4-7 are always "ftyp" (0x66747970)
  "image/heic": [
    { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  ],
};

/**
 * Validate file content matches expected MIME type using magic bytes
 */
export function validateFileType(
  buffer: ArrayBuffer,
  expectedMimeType: string
): boolean {
  const bytes = new Uint8Array(buffer);
  const signatures = MAGIC_BYTES[expectedMimeType];

  if (!signatures) {
    // Unknown type - allow but log warning
    console.warn(`No magic bytes defined for ${expectedMimeType}`);
    return true;
  }

  // Check if any signature matches
  return signatures.some((sig) =>
    sig.bytes.every((byte, index) => bytes[(sig.offset ?? 0) + index] === byte)
  );
}

/**
 * Detect file type from magic bytes
 */
export function detectFileType(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer);

  for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
    const matches = signatures.some((sig) =>
      sig.bytes.every((byte, index) => bytes[(sig.offset ?? 0) + index] === byte)
    );
    if (matches) {
      return mimeType;
    }
  }

  return null;
}
