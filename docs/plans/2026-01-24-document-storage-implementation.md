# Document Storage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to attach documents (receipts, contracts, PDFs) to transactions and properties using Supabase Storage.

**Architecture:** Documents stored in Supabase Storage bucket with metadata in PostgreSQL. Direct upload to Supabase via signed URLs. Polymorphic association links documents to either transactions or properties.

**Tech Stack:** Supabase Storage, @supabase/supabase-js, Drizzle ORM, tRPC, React components.

---

### Task 1: Install Supabase client library

**Files:**
- Modify: `package.json`

**Step 1: Install @supabase/supabase-js**

Run: `npm install @supabase/supabase-js`
Expected: Package added to dependencies

**Step 2: Verify installation**

Run: `npm ls @supabase/supabase-js`
Expected: Shows installed version

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @supabase/supabase-js for document storage"
```

---

### Task 2: Add Supabase environment variables

**Files:**
- Modify: `.env.local.example`

**Step 1: Add Supabase Storage variables to example file**

Add to `.env.local.example`:

```
# Supabase Storage
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Step 2: Commit**

```bash
git add .env.local.example
git commit -m "chore: add Supabase Storage env vars to example"
```

---

### Task 3: Create Supabase client utilities

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`

**Step 1: Create browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Step 2: Create server client with service role**

Create `src/lib/supabase/server.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
```

**Step 3: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase client utilities"
```

---

### Task 4: Add documents table to schema

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add document category enum**

Add after `propertyStatusEnum`:

```typescript
export const documentCategoryEnum = pgEnum("document_category", [
  "receipt",
  "contract",
  "depreciation",
  "lease",
  "other",
]);
```

**Step 2: Add documents table**

Add after `propertySales` table:

```typescript
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),

  // Polymorphic - linked to property OR transaction (not both)
  propertyId: uuid("property_id").references(() => properties.id, {
    onDelete: "cascade",
  }),
  transactionId: uuid("transaction_id").references(() => transactions.id, {
    onDelete: "cascade",
  }),

  // File metadata
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  storagePath: text("storage_path").notNull(),

  // Optional categorization
  category: documentCategoryEnum("category").default("other").notNull(),
  description: text("description"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Step 3: Add relations**

Add after `propertySalesRelations`:

```typescript
export const documentsRelations = relations(documents, ({ one }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [documents.propertyId],
    references: [properties.id],
  }),
  transaction: one(transactions, {
    fields: [documents.transactionId],
    references: [transactions.id],
  }),
}));
```

Update `propertiesRelations` to include documents:

```typescript
export const propertiesRelations = relations(properties, ({ one, many }) => ({
  user: one(users, {
    fields: [properties.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
  bankAccounts: many(bankAccounts),
  loans: many(loans),
  sales: many(propertySales),
  documents: many(documents),
}));
```

Update `transactionsRelations` to include documents:

```typescript
export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [transactions.bankAccountId],
    references: [bankAccounts.id],
  }),
  property: one(properties, {
    fields: [transactions.propertyId],
    references: [properties.id],
  }),
  documents: many(documents),
}));
```

**Step 4: Add type exports**

Add after `PropertySale` types:

```typescript
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
```

**Step 5: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(schema): add documents table for file storage"
```

---

### Task 5: Generate and apply database migration

**Files:**
- Create: `drizzle/XXXX_add_documents.sql` (auto-generated)

**Step 1: Generate migration**

Run: `npx drizzle-kit generate`
Expected: Migration file created

**Step 2: Apply migration**

Run: `DATABASE_URL="..." npx drizzle-kit push`
Expected: Schema changes applied

**Step 3: Commit**

```bash
git add drizzle/
git commit -m "chore(db): add migration for documents table"
```

---

### Task 6: Create documents router - getUploadUrl

**Files:**
- Create: `src/server/routers/documents.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create documents router with getUploadUrl**

Create `src/server/routers/documents.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { properties, transactions, documents } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { supabaseAdmin } from "@/lib/supabase/server";

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "application/pdf",
] as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const documentsRouter = router({
  /**
   * Get signed upload URL for direct upload to Supabase Storage
   */
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        fileName: z.string().min(1),
        fileType: z.enum(ALLOWED_FILE_TYPES),
        fileSize: z.number().max(MAX_FILE_SIZE, "File size must be under 10MB"),
        propertyId: z.string().uuid().optional(),
        transactionId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { fileName, fileType, fileSize, propertyId, transactionId } = input;

      // XOR validation: exactly one must be provided
      if ((!propertyId && !transactionId) || (propertyId && transactionId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Must provide either propertyId or transactionId (not both)",
        });
      }

      // Validate ownership
      if (propertyId) {
        const property = await ctx.db.query.properties.findFirst({
          where: and(
            eq(properties.id, propertyId),
            eq(properties.userId, ctx.user.id)
          ),
        });
        if (!property) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Property not found",
          });
        }
      }

      if (transactionId) {
        const transaction = await ctx.db.query.transactions.findFirst({
          where: and(
            eq(transactions.id, transactionId),
            eq(transactions.userId, ctx.user.id)
          ),
        });
        if (!transaction) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Transaction not found",
          });
        }
      }

      // Generate unique storage path
      const targetId = propertyId || transactionId;
      const timestamp = Date.now();
      const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `${ctx.user.id}/${targetId}/${timestamp}-${safeFileName}`;

      // Create signed upload URL
      const { data, error } = await supabaseAdmin.storage
        .from("documents")
        .createSignedUploadUrl(storagePath);

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create upload URL",
        });
      }

      return {
        uploadUrl: data.signedUrl,
        storagePath,
        token: data.token,
      };
    }),
});
```

**Step 2: Add to _app.ts**

Modify `src/server/routers/_app.ts`:

```typescript
import { router } from "../trpc";
import { propertyRouter } from "./property";
import { transactionRouter } from "./transaction";
import { bankingRouter } from "./banking";
import { statsRouter } from "./stats";
import { loanRouter } from "./loan";
import { reportsRouter } from "./reports";
import { cgtRouter } from "./cgt";
import { documentsRouter } from "./documents";

export const appRouter = router({
  property: propertyRouter,
  transaction: transactionRouter,
  banking: bankingRouter,
  stats: statsRouter,
  loan: loanRouter,
  reports: reportsRouter,
  cgt: cgtRouter,
  documents: documentsRouter,
});

export type AppRouter = typeof appRouter;
```

**Step 3: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/routers/documents.ts src/server/routers/_app.ts
git commit -m "feat(documents): add getUploadUrl endpoint"
```

---

### Task 7: Add create and list endpoints to documents router

**Files:**
- Modify: `src/server/routers/documents.ts`

**Step 1: Add create endpoint**

Add to `documentsRouter`:

```typescript
  /**
   * Create document record after successful upload
   */
  create: protectedProcedure
    .input(
      z.object({
        storagePath: z.string(),
        fileName: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        propertyId: z.string().uuid().optional(),
        transactionId: z.string().uuid().optional(),
        category: z
          .enum(["receipt", "contract", "depreciation", "lease", "other"])
          .default("other"),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { propertyId, transactionId, ...data } = input;

      // XOR validation
      if ((!propertyId && !transactionId) || (propertyId && transactionId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Must provide either propertyId or transactionId (not both)",
        });
      }

      const [document] = await ctx.db
        .insert(documents)
        .values({
          userId: ctx.user.id,
          propertyId,
          transactionId,
          ...data,
        })
        .returning();

      return document;
    }),

  /**
   * List documents for a property or transaction
   */
  list: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid().optional(),
        transactionId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { propertyId, transactionId } = input;

      let conditions = [eq(documents.userId, ctx.user.id)];

      if (propertyId) {
        conditions.push(eq(documents.propertyId, propertyId));
      }
      if (transactionId) {
        conditions.push(eq(documents.transactionId, transactionId));
      }

      const docs = await ctx.db.query.documents.findMany({
        where: and(...conditions),
        orderBy: (documents, { desc }) => [desc(documents.createdAt)],
      });

      // Generate signed view URLs for each document
      const docsWithUrls = await Promise.all(
        docs.map(async (doc) => {
          const { data } = await supabaseAdmin.storage
            .from("documents")
            .createSignedUrl(doc.storagePath, 3600); // 1 hour

          return {
            ...doc,
            viewUrl: data?.signedUrl || null,
          };
        })
      );

      return docsWithUrls;
    }),
```

**Step 2: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/routers/documents.ts
git commit -m "feat(documents): add create and list endpoints"
```

---

### Task 8: Add delete endpoint to documents router

**Files:**
- Modify: `src/server/routers/documents.ts`

**Step 1: Add delete endpoint**

Add to `documentsRouter`:

```typescript
  /**
   * Delete document (removes from storage and database)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Find document and verify ownership
      const document = await ctx.db.query.documents.findFirst({
        where: and(
          eq(documents.id, input.id),
          eq(documents.userId, ctx.user.id)
        ),
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Delete from Supabase Storage
      const { error: storageError } = await supabaseAdmin.storage
        .from("documents")
        .remove([document.storagePath]);

      if (storageError) {
        console.error("Failed to delete from storage:", storageError);
        // Continue anyway - orphaned storage files can be cleaned up later
      }

      // Delete from database
      await ctx.db.delete(documents).where(eq(documents.id, input.id));

      return { success: true };
    }),
```

**Step 2: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/routers/documents.ts
git commit -m "feat(documents): add delete endpoint"
```

---

### Task 9: Add unit tests for documents router

**Files:**
- Create: `src/server/routers/__tests__/documents.test.ts`

**Step 1: Create test file**

Create `src/server/routers/__tests__/documents.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockContext, createTestCaller } from "../../__tests__/test-utils";

// Mock supabase admin
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        createSignedUploadUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: "https://example.com/upload", token: "token123" },
          error: null,
        }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: "https://example.com/view" },
          error: null,
        }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  },
}));

describe("documents router", () => {
  const mockUser = {
    id: "user-1",
    clerkId: "clerk_123",
    email: "test@example.com",
    name: "Test User",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProperty = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    userId: "user-1",
    address: "123 Main St",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUploadUrl", () => {
    it("returns signed upload URL for valid property", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.documents.getUploadUrl({
        fileName: "receipt.pdf",
        fileType: "application/pdf",
        fileSize: 1024,
        propertyId: mockProperty.id,
      });

      expect(result.uploadUrl).toBe("https://example.com/upload");
      expect(result.storagePath).toContain(mockUser.id);
    });

    it("rejects when neither propertyId nor transactionId provided", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
        },
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.documents.getUploadUrl({
          fileName: "receipt.pdf",
          fileType: "application/pdf",
          fileSize: 1024,
        })
      ).rejects.toThrow("Must provide either propertyId or transactionId");
    });

    it("rejects files over 10MB", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
        },
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.documents.getUploadUrl({
          fileName: "large.pdf",
          fileType: "application/pdf",
          fileSize: 15 * 1024 * 1024, // 15MB
          propertyId: mockProperty.id,
        })
      ).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("deletes document from storage and database", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      const mockDocument = {
        id: "doc-1",
        userId: "user-1",
        storagePath: "user-1/prop-1/file.pdf",
      };

      const deleteMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          documents: { findFirst: vi.fn().mockResolvedValue(mockDocument) },
        },
        delete: deleteMock,
      };

      const caller = createTestCaller(ctx);
      const result = await caller.documents.delete({ id: "550e8400-e29b-41d4-a716-446655440001" });

      expect(result.success).toBe(true);
      expect(deleteMock).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/server/routers/__tests__/documents.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/routers/__tests__/documents.test.ts
git commit -m "test(documents): add unit tests for documents router"
```

---

### Task 10: Create FileUpload component

**Files:**
- Create: `src/components/documents/FileUpload.tsx`

**Step 1: Create the component**

Create `src/components/documents/FileUpload.tsx`:

```typescript
"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Upload, X, FileText, Image, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/heic": [".heic"],
  "application/pdf": [".pdf"],
};

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

interface FileUploadProps {
  propertyId?: string;
  transactionId?: string;
  category?: "receipt" | "contract" | "depreciation" | "lease" | "other";
  onUploadComplete?: () => void;
  className?: string;
}

export function FileUpload({
  propertyId,
  transactionId,
  category = "other",
  onUploadComplete,
  className,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const getUploadUrl = trpc.documents.getUploadUrl.useMutation();
  const createDocument = trpc.documents.create.useMutation();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setUploading(true);
      setProgress(0);

      try {
        // Get signed upload URL
        const { uploadUrl, storagePath, token } = await getUploadUrl.mutateAsync({
          fileName: file.name,
          fileType: file.type as any,
          fileSize: file.size,
          propertyId,
          transactionId,
        });

        // Upload directly to Supabase
        setProgress(25);
        const response = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        setProgress(75);

        // Create document record
        await createDocument.mutateAsync({
          storagePath,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          propertyId,
          transactionId,
          category,
        });

        setProgress(100);
        toast.success("Document uploaded successfully");
        onUploadComplete?.();
      } catch (error) {
        console.error("Upload error:", error);
        toast.error("Failed to upload document");
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [propertyId, transactionId, category, getUploadUrl, createDocument, onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: uploading,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50",
        uploading && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <input {...getInputProps()} />

      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Uploading... {progress}%</p>
        </div>
      ) : isDragActive ? (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-8 w-8 text-primary" />
          <p className="text-sm">Drop file here</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drag & drop or click to upload
          </p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, HEIC, PDF up to 10MB
          </p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Install react-dropzone**

Run: `npm install react-dropzone`

**Step 3: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/documents/FileUpload.tsx package.json package-lock.json
git commit -m "feat(documents): add FileUpload component with drag-and-drop"
```

---

### Task 11: Create DocumentList component

**Files:**
- Create: `src/components/documents/DocumentList.tsx`

**Step 1: Create the component**

Create `src/components/documents/DocumentList.tsx`:

```typescript
"use client";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  FileText,
  Image,
  Download,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DocumentListProps {
  propertyId?: string;
  transactionId?: string;
}

export function DocumentList({ propertyId, transactionId }: DocumentListProps) {
  const { data: documents, isLoading, refetch } = trpc.documents.list.useQuery({
    propertyId,
    transactionId,
  });

  const deleteDocument = trpc.documents.delete.useMutation({
    onSuccess: () => {
      toast.success("Document deleted");
      refetch();
    },
    onError: () => {
      toast.error("Failed to delete document");
    },
  });

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this document?")) {
      deleteDocument.mutate({ id });
    }
  };

  const handleView = (doc: { viewUrl: string | null; fileType: string }) => {
    if (doc.viewUrl) {
      window.open(doc.viewUrl, "_blank");
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) {
      return <Image className="h-5 w-5" />;
    }
    return <FileText className="h-5 w-5" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No documents uploaded yet
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <Card
          key={doc.id}
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => handleView(doc)}
        >
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded">
                {getFileIcon(doc.fileType)}
              </div>
              <div>
                <p className="text-sm font-medium truncate max-w-[200px]">
                  {doc.fileName}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-xs">
                    {doc.category}
                  </Badge>
                  <span>
                    {formatDistanceToNow(new Date(doc.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  if (doc.viewUrl) {
                    const a = document.createElement("a");
                    a.href = doc.viewUrl;
                    a.download = doc.fileName;
                    a.click();
                  }
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => handleDelete(doc.id, e)}
                disabled={deleteDocument.isPending}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**Step 2: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/documents/DocumentList.tsx
git commit -m "feat(documents): add DocumentList component"
```

---

### Task 12: Create DocumentsSection component

**Files:**
- Create: `src/components/documents/DocumentsSection.tsx`

**Step 1: Create the combined section component**

Create `src/components/documents/DocumentsSection.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUpload } from "./FileUpload";
import { DocumentList } from "./DocumentList";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

interface DocumentsSectionProps {
  propertyId?: string;
  transactionId?: string;
  title?: string;
  defaultCategory?: "receipt" | "contract" | "depreciation" | "lease" | "other";
  collapsible?: boolean;
}

export function DocumentsSection({
  propertyId,
  transactionId,
  title = "Documents",
  defaultCategory = "other",
  collapsible = true,
}: DocumentsSectionProps) {
  const [isOpen, setIsOpen] = useState(!collapsible);
  const [category, setCategory] = useState(defaultCategory);
  const utils = trpc.useUtils();

  const handleUploadComplete = () => {
    utils.documents.list.invalidate({ propertyId, transactionId });
  };

  const content = (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select
          value={category}
          onValueChange={(v) => setCategory(v as typeof category)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="receipt">Receipt</SelectItem>
            <SelectItem value="contract">Contract</SelectItem>
            <SelectItem value="depreciation">Depreciation</SelectItem>
            <SelectItem value="lease">Lease</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <FileUpload
        propertyId={propertyId}
        transactionId={transactionId}
        category={category}
        onUploadComplete={handleUploadComplete}
      />

      <DocumentList propertyId={propertyId} transactionId={transactionId} />
    </div>
  );

  if (!collapsible) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title}
          </span>
          {isOpen ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </CardTitle>
      </CardHeader>
      {isOpen && <CardContent>{content}</CardContent>}
    </Card>
  );
}
```

**Step 2: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/documents/DocumentsSection.tsx
git commit -m "feat(documents): add DocumentsSection component"
```

---

### Task 13: Add documents section to AddTransactionDialog

**Files:**
- Modify: `src/components/transactions/AddTransactionDialog.tsx`

**Step 1: Add optional document upload after form**

This task adds a "receipt uploaded" indicator to the transaction form. For simplicity, we'll add documents separately after the transaction is created. Skip inline upload for now - users can attach via the Documents section on the property page.

**Step 2: Commit (no changes needed)**

This task is deferred - documents are attached via property-level DocumentsSection instead of inline on transaction creation. This is simpler and avoids complex multi-step flows.

---

### Task 14: Create property documents page/tab

**Files:**
- Create: `src/app/(dashboard)/properties/[id]/documents/page.tsx`

**Step 1: Create the documents page**

Create `src/app/(dashboard)/properties/[id]/documents/page.tsx`:

```typescript
"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { DocumentsSection } from "@/components/documents/DocumentsSection";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PropertyDocumentsPage() {
  const params = useParams();
  const propertyId = params.id as string;

  const { data: property, isLoading } = trpc.property.get.useQuery({
    id: propertyId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Property Not Found</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/properties">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">Documents</h2>
          <p className="text-muted-foreground">
            {property.address}, {property.suburb}
          </p>
        </div>
      </div>

      <DocumentsSection
        propertyId={propertyId}
        title="Property Documents"
        defaultCategory="contract"
        collapsible={false}
      />
    </div>
  );
}
```

**Step 2: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/(dashboard)/properties/[id]/documents/page.tsx
git commit -m "feat(documents): add property documents page"
```

---

### Task 15: Add documents link to properties list

**Files:**
- Modify: `src/app/(dashboard)/properties/page.tsx`

**Step 1: Read current properties page**

Read the file to understand the current structure.

**Step 2: Add documents link to property cards**

Add a "Documents" button/link to each property card that navigates to `/properties/[id]/documents`.

**Step 3: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/(dashboard)/properties/page.tsx
git commit -m "feat(documents): add documents link to properties list"
```

---

### Task 16: Run all tests and verify

**Files:**
- None (verification only)

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix any lint/type issues"
```

---

### Task 17: Final verification

**Files:**
- None (verification only)

**Step 1: Manual testing checklist**

- [ ] Navigate to property documents page
- [ ] Upload a JPG file - should succeed
- [ ] Upload a PDF file - should succeed
- [ ] Try uploading a .exe file - should reject
- [ ] Try uploading a 15MB file - should reject
- [ ] View uploaded document - should open in new tab
- [ ] Delete a document - should remove from list
- [ ] Verify document still accessible via signed URL (within 1 hour)

**Step 2: Push all commits**

```bash
git push origin feature/infrastructure
```
