# Document Storage - Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Allow users to attach documents (receipts, contracts, depreciation schedules) to transactions and properties for tax compliance and record-keeping.

**Architecture:** Documents stored in Supabase Storage with metadata in PostgreSQL. Polymorphic association allows linking to either transactions or properties.

**Tech Stack:** Supabase Storage, Drizzle ORM, tRPC, React components.

---

## Data Model

### New documents table

```typescript
documents = pgTable("documents", {
  id: uuid().primaryKey(),
  userId: uuid().references(users.id).notNull(),

  // Polymorphic association - linked to property OR transaction
  propertyId: uuid().references(properties.id),
  transactionId: uuid().references(transactions.id),

  // File metadata
  fileName: text().notNull(),
  fileType: text().notNull(),  // "image/jpeg", "application/pdf", etc.
  fileSize: integer().notNull(), // bytes
  storagePath: text().notNull(), // Supabase storage path

  // Optional categorization
  category: documentCategoryEnum(), // "receipt", "contract", "depreciation", "lease", "other"
  description: text(),

  createdAt: timestamp().defaultNow(),
});
```

### Constraints

- Either `propertyId` OR `transactionId` must be set (not both, not neither)
- File types restricted to: `image/jpeg`, `image/png`, `image/heic`, `application/pdf`
- Max file size: 10MB (10,485,760 bytes)

---

## Supabase Storage Setup

### Bucket configuration

- Name: `documents`
- Public: No (private, requires authentication)
- File size limit: 10MB
- Allowed MIME types: `image/jpeg`, `image/png`, `image/heic`, `application/pdf`
- Path structure: `{userId}/{propertyId|transactionId}/{filename}`

### Row Level Security (RLS) policies

```sql
-- Users can only access their own documents
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### Upload flow

1. Client requests signed upload URL from tRPC
2. tRPC validates user auth, generates signed URL
3. Client uploads directly to Supabase Storage
4. On success, client calls tRPC to create document record

---

## tRPC Router

### documentsRouter endpoints

```typescript
documentsRouter = router({
  // Get signed upload URL
  getUploadUrl: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      fileType: z.enum(["image/jpeg", "image/png", "image/heic", "application/pdf"]),
      fileSize: z.number().max(10485760),
      propertyId: z.string().uuid().optional(),
      transactionId: z.string().uuid().optional(),
    }))
    .mutation()

  // Create document record after successful upload
  create: protectedProcedure
    .input(z.object({
      storagePath: z.string(),
      fileName: z.string(),
      fileType: z.string(),
      fileSize: z.number(),
      propertyId: z.string().uuid().optional(),
      transactionId: z.string().uuid().optional(),
      category: z.enum(["receipt", "contract", "depreciation", "lease", "other"]).optional(),
      description: z.string().optional(),
    }))
    .mutation()

  // List documents for a property or transaction
  list: protectedProcedure
    .input(z.object({
      propertyId: z.string().uuid().optional(),
      transactionId: z.string().uuid().optional(),
    }))
    .query()

  // Delete document (removes from storage + database)
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation()
})
```

### Validation

- `getUploadUrl` validates property/transaction ownership before generating URL
- Either propertyId OR transactionId required (XOR constraint)

---

## UI Components

### FileUpload component (reusable)

- Drag-and-drop zone + click to browse
- Shows upload progress
- Validates file type/size client-side before upload
- Displays thumbnail preview for images, PDF icon for PDFs

### Inline upload on forms

- Transaction form: "Attach Receipt" button below amount field
- Property form: "Attach Document" button in a collapsible section
- Shows attached file thumbnail with remove option

### Documents tab

- Property page: New "Documents" tab alongside existing content
- Grid/list view of all documents
- Click to view/download, hover for delete option
- Filter by category (receipt, contract, etc.)

### Document viewer

- Modal/lightbox for viewing images
- PDF opens in new tab or embedded viewer
- Download button on all documents

---

## Error Handling

- File too large: Client-side validation + server rejection with clear message
- Invalid file type: "Only JPG, PNG, HEIC, and PDF files are supported"
- Upload failed: Retry option, no orphaned database records
- Storage quota exceeded: Surface user-friendly message
- Signed URL expired: URLs valid for 5 minutes, show retry message

---

## Testing

### Unit tests

- `getUploadUrl` validates ownership, rejects invalid file types/sizes
- `create` enforces XOR constraint (propertyId OR transactionId)
- `delete` removes storage file and database record
- `list` returns only user's documents with valid signed URLs

### Manual testing

- Upload JPG, PNG, PDF to property
- Upload receipt to transaction
- View document in lightbox/new tab
- Delete document, verify removed from storage
- Try uploading 15MB file (should reject)
- Try uploading .exe file (should reject)
