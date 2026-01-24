import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock Supabase for all tests
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUploadUrl: vi.fn(),
        createSignedUrl: vi.fn(),
        remove: vi.fn(),
        uploadToSignedUrl: vi.fn(),
      }),
    },
  },
}));
