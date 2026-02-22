import { describe, it, expect } from "vitest";
import { validateFileType, detectFileType } from "../file-validation";

describe("file-validation", () => {
  describe("validateFileType", () => {
    it("validates PDF magic bytes", () => {
      // %PDF-1.4
      const pdfBytes = new Uint8Array([
        0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34,
      ]);
      expect(validateFileType(pdfBytes.buffer, "application/pdf")).toBe(true);
    });

    it("rejects invalid PDF", () => {
      const notPdf = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      expect(validateFileType(notPdf.buffer, "application/pdf")).toBe(false);
    });

    it("validates JPEG magic bytes", () => {
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      expect(validateFileType(jpegBytes.buffer, "image/jpeg")).toBe(true);
    });

    it("validates PNG magic bytes", () => {
      const pngBytes = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      expect(validateFileType(pngBytes.buffer, "image/png")).toBe(true);
    });

    it("rejects file with wrong magic bytes for expected type", () => {
      // PNG bytes but expecting JPEG
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      expect(validateFileType(pngBytes.buffer, "image/jpeg")).toBe(false);
    });

    it("validates HEIC magic bytes (ftyp at offset 4)", () => {
      // Real HEIC: 4-byte box size + "ftyp" + "heic" brand
      const heicBytes = new Uint8Array([
        0x00, 0x00, 0x00, 0x18, // box size (24 bytes)
        0x66, 0x74, 0x79, 0x70, // "ftyp"
        0x68, 0x65, 0x69, 0x63, // "heic" brand
      ]);
      expect(validateFileType(heicBytes.buffer, "image/heic")).toBe(true);
    });

    it("validates HEIC with different box size", () => {
      // Different box size but still valid ftyp
      const heicBytes = new Uint8Array([
        0x00, 0x00, 0x00, 0x24, // box size (36 bytes)
        0x66, 0x74, 0x79, 0x70, // "ftyp"
        0x6d, 0x69, 0x66, 0x31, // "mif1" brand
      ]);
      expect(validateFileType(heicBytes.buffer, "image/heic")).toBe(true);
    });

    it("rejects file with null bytes as HEIC (old false positive)", () => {
      // This previously matched the overly generic [0x00, 0x00, 0x00] signature
      const nullBytes = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(validateFileType(nullBytes.buffer, "image/heic")).toBe(false);
    });

    it("rejects random file as HEIC", () => {
      const randomBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
      expect(validateFileType(randomBytes.buffer, "image/heic")).toBe(false);
    });

    it("allows unknown MIME types with warning", () => {
      const unknownBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      expect(validateFileType(unknownBytes.buffer, "application/unknown")).toBe(
        true
      );
    });
  });

  describe("detectFileType", () => {
    it("detects PDF from bytes", () => {
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      expect(detectFileType(pdfBytes.buffer)).toBe("application/pdf");
    });

    it("detects JPEG from bytes", () => {
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      expect(detectFileType(jpegBytes.buffer)).toBe("image/jpeg");
    });

    it("detects PNG from bytes", () => {
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      expect(detectFileType(pngBytes.buffer)).toBe("image/png");
    });

    it("detects HEIC from bytes (ftyp at offset 4)", () => {
      const heicBytes = new Uint8Array([
        0x00, 0x00, 0x00, 0x18, // box size
        0x66, 0x74, 0x79, 0x70, // "ftyp"
        0x68, 0x65, 0x69, 0x63, // "heic" brand
      ]);
      expect(detectFileType(heicBytes.buffer)).toBe("image/heic");
    });

    it("does not detect null bytes as HEIC", () => {
      const nullBytes = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(detectFileType(nullBytes.buffer)).toBe(null);
    });

    it("returns null for unknown file type", () => {
      const unknownBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      expect(detectFileType(unknownBytes.buffer)).toBe(null);
    });
  });
});
