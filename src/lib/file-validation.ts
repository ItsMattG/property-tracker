// Magic bytes for common file types
const MAGIC_BYTES: Record<string, number[][]> = {
  // PDF: %PDF
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
  // JPEG: FFD8FF
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  // PNG: 89504E47
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  // HEIC: various ftyp boxes
  "image/heic": [
    [0x00, 0x00, 0x00], // ftyp box (variable length prefix)
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
  return signatures.some((signature) =>
    signature.every((byte, index) => bytes[index] === byte)
  );
}

/**
 * Detect file type from magic bytes
 */
export function detectFileType(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer);

  for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
    const matches = signatures.some((signature) =>
      signature.every((byte, index) => bytes[index] === byte)
    );
    if (matches) {
      return mimeType;
    }
  }

  return null;
}
