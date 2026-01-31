import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Set required environment variables for tests
process.env.JWT_SECRET = "test-jwt-secret-for-vitest-minimum-32-chars";

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
