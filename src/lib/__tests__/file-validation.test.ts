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

    it("returns null for unknown file type", () => {
      const unknownBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      expect(detectFileType(unknownBytes.buffer)).toBe(null);
    });
  });
});
