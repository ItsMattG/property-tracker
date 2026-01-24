# Capital Gains Tracking - Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Track property cost base while owning, calculate CGT with 50% discount when selling, archive sold properties.

**Architecture:** New `property_sales` table stores sale events with calculated CGT. Cost base derived from purchase price + capital transactions. Properties get `status` field for active/sold state.

**Tech Stack:** Drizzle ORM, tRPC, React components, existing UI patterns from Tax Reports.

---

## Data Model

### Properties table additions

```typescript
// Add to properties table
status: pgEnum("property_status", ["active", "sold"]).default("active"),
soldAt: date("sold_at"),  // Settlement date when sold
```

### New property_sales table

```typescript
propertySales = pgTable("property_sales", {
  id: uuid().primaryKey(),
  propertyId: uuid().references(properties.id).notNull(),
  userId: uuid().references(users.id).notNull(),

  // Sale details
  salePrice: decimal(12, 2).notNull(),
  settlementDate: date().notNull(),
  contractDate: date(),

  // Selling costs (manual entry)
  agentCommission: decimal(12, 2).default("0"),
  legalFees: decimal(12, 2).default("0"),
  marketingCosts: decimal(12, 2).default("0"),
  otherSellingCosts: decimal(12, 2).default("0"),

  // Calculated fields (stored for historical accuracy)
  costBase: decimal(12, 2).notNull(),
  capitalGain: decimal(12, 2).notNull(),
  discountedGain: decimal(12, 2),
  heldOverTwelveMonths: boolean().notNull(),

  createdAt: timestamp().defaultNow(),
});
```

### Cost base sources

- `properties.purchasePrice`
- Transactions where `transactionType = 'capital'` and `propertyId` matches
- Categories: stamp_duty, conveyancing, buyers_agent_fees, initial_repairs

---

## CGT Calculation Service

### Cost base calculation

```typescript
function calculateCostBase(property, capitalTransactions) {
  const purchasePrice = Number(property.purchasePrice);

  const acquisitionCosts = capitalTransactions
    .filter(t => ['stamp_duty', 'conveyancing', 'buyers_agent_fees', 'initial_repairs'].includes(t.category))
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  return purchasePrice + acquisitionCosts;
}
```

### CGT calculation at sale

```typescript
function calculateCapitalGain(costBase, salePrice, sellingCosts, purchaseDate, settlementDate) {
  const totalSellingCosts = agentCommission + legalFees + marketingCosts + otherCosts;
  const netProceeds = salePrice - totalSellingCosts;
  const capitalGain = netProceeds - costBase;

  const heldMonths = monthsBetween(purchaseDate, settlementDate);
  const heldOverTwelveMonths = heldMonths >= 12;
  const discountedGain = heldOverTwelveMonths && capitalGain > 0
    ? capitalGain * 0.5
    : capitalGain;

  return { costBase, capitalGain, discountedGain, heldOverTwelveMonths };
}
```

### Key rules

- Capital losses are not discounted (only gains)
- Discount only applies if held >= 12 months
- Selling costs reduce the gain, not the cost base

---

## UI Components

### Property page - Cost Base summary card

```
┌─────────────────────────────────────────┐
│ Cost Base                               │
├─────────────────────────────────────────┤
│ Purchase Price          $850,000        │
│ Stamp Duty               $35,200        │
│ Conveyancing              $1,800        │
│ Buyer's Agent             $8,500        │
│ Initial Repairs           $4,500        │
├─────────────────────────────────────────┤
│ Total Cost Base         $900,000        │
└─────────────────────────────────────────┘
```

Clicking opens the full CGT report page for that property.

### CGT Report page (`/reports/cgt`)

- Lists all properties with current cost base
- Shows "Record Sale" button per property
- Sold properties show the CGT calculation result
- Filter: Active / Sold / All

### Record Sale dialog

- Sale price, settlement date, contract date (optional)
- Selling costs section: agent commission, legal, marketing, other
- "Pull from transactions" button to auto-fill selling costs
- Preview of CGT calculation before confirming
- Confirm archives the property

### Archived properties view

- Accessed via filter on Properties page or CGT report
- Shows sold properties with sale details
- Read-only (can view but not edit transactions)

---

## tRPC Router

### cgtRouter endpoints

```typescript
cgtRouter = router({
  // Get cost base for a single property
  getCostBase: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query()

  // Get CGT summary for all properties
  getSummary: protectedProcedure
    .query()

  // Record a property sale
  recordSale: protectedProcedure
    .input(z.object({
      propertyId: z.string().uuid(),
      salePrice: z.string(),
      settlementDate: z.string(),
      contractDate: z.string().optional(),
      agentCommission: z.string().default("0"),
      legalFees: z.string().default("0"),
      marketingCosts: z.string().default("0"),
      otherSellingCosts: z.string().default("0"),
    }))
    .mutation()

  // Get selling costs from transactions (for auto-fill)
  getSellingCosts: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query()

  // Get sale details for a sold property
  getSaleDetails: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query()
})
```

---

## Error Handling

### Validation rules

- Sale price must be positive
- Settlement date must be after purchase date
- Can't record sale for already-sold property
- Property ownership validated before any operation

### Edge cases

- **Capital loss**: discountedGain equals capitalGain (no discount on losses)
- **Same-day sale**: held < 12 months (no discount)
- **No capital transactions**: Cost base = purchase price only
- **Negative selling costs**: Rejected (must be >= 0)

### Data integrity

- `recordSale` is transactional: creates sale record AND updates property status atomically
- Cost base calculated and stored at sale time for historical accuracy
- Sale record stores userId for multi-tenancy queries

### Archived property behavior

- Transactions page: Archived properties excluded from property filter dropdown
- Property page: Shows "Sold" badge, cost base card shows final sale summary
- New transactions: Can't be assigned to archived properties

---

## Testing

### Unit tests for CGT service

- `calculateCostBase` with various transaction combinations
- `calculateCapitalGain` with gain scenario (verify 50% discount)
- `calculateCapitalGain` with loss scenario (verify no discount)
- `calculateCapitalGain` at exactly 12 months boundary
- Edge case: no capital transactions

### Router tests

- `getCostBase` returns correct breakdown
- `recordSale` creates sale record and archives property
- `recordSale` rejects already-sold property
- `recordSale` validates ownership
- `getSummary` excludes other users' properties

### Test data scenarios

1. Property held 6 months, sold at gain - no discount
2. Property held 2 years, sold at gain - 50% discount
3. Property held 2 years, sold at loss - no discount
4. Property with $0 acquisition costs
