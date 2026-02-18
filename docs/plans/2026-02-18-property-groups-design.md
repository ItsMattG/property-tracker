# Property Groups Design

## Overview

Allow users to organise properties into custom groups (tags) with optional financial rollup. Groups are an independent filtering dimension alongside entity and purpose. Properties can belong to multiple groups.

## Data Model

### `propertyGroups` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | `defaultRandom()` |
| `userId` | `text` FK → users | `onDelete: cascade`, not null |
| `name` | `text` | Required, max 50 chars |
| `colour` | `text` | Hex from preset palette |
| `sortOrder` | `integer` | User-defined ordering, default 0 |
| `createdAt` | `timestamp` | `defaultNow()` |
| `updatedAt` | `timestamp` | `defaultNow()` |

Unique constraint on `(userId, name)`.

### `propertyGroupAssignments` table (join)

| Column | Type | Notes |
|--------|------|-------|
| `groupId` | `uuid` FK → propertyGroups | `onDelete: cascade` |
| `propertyId` | `uuid` FK → properties | `onDelete: cascade` |

Composite PK on `(groupId, propertyId)`.

### Drizzle Relations

- `propertyGroups` → many `propertyGroupAssignments`
- `propertyGroupAssignments` → one `propertyGroups`, one `properties`
- `properties` → many `propertyGroupAssignments`

## Plan Limits

Add `maxPropertyGroups` to `PLAN_LIMITS`:

| Plan | Limit |
|------|-------|
| Free | 3 |
| Pro | Unlimited |
| Team | Unlimited |
| Lifetime | Unlimited |

Checked server-side in `propertyGroup.create` mutation.

## Backend

### Repository: `PropertyGroupRepository`

Interface `IPropertyGroupRepository`:

- `findByOwner(userId)` — all groups with property count
- `findById(id, userId)` — single group with assigned property IDs
- `create(data: NewPropertyGroup)` → `.returning()`
- `update(id, userId, data: Partial<PropertyGroup>)` → `.returning()`
- `delete(id, userId)`
- `assignProperties(groupId, userId, propertyIds)` — bulk insert into join table
- `unassignProperties(groupId, userId, propertyIds)` — bulk delete from join table
- `findGroupsForProperty(propertyId, userId)` — groups a property belongs to
- `countByOwner(userId)` — for plan limit checking

### Router: `propertyGroupRouter` (registered as `propertyGroup.*`)

| Procedure | Type | Input | Notes |
|-----------|------|-------|-------|
| `list` | `protectedProcedure` | none | Returns all groups with property counts |
| `get` | `protectedProcedure` | `{ id }` | Single group with property IDs |
| `create` | `writeProcedure` | `{ name, colour }` | Checks plan limit |
| `update` | `writeProcedure` | `{ id, name?, colour?, sortOrder? }` | |
| `delete` | `writeProcedure` | `{ id }` | Cascades assignments |
| `assignProperties` | `writeProcedure` | `{ groupId, propertyIds[] }` | Bulk assign |
| `unassignProperties` | `writeProcedure` | `{ groupId, propertyIds[] }` | Bulk unassign |
| `getSummary` | `protectedProcedure` | `{ groupId, period }` | Financial rollup scoped to group's properties |

## UI

### Settings Page: Property Groups (`/settings/property-groups`)

- Listed as new card in Settings "Account" section: icon `FolderOpen`
- Full CRUD: list groups with coloured dots + property count badges
- Create/edit via modal: name input + colour palette picker (8 presets)
- Delete with confirmation dialog
- Each group row shows assigned properties, with ability to add/remove via multi-select

### Properties Page: Filter Integration

- New "Group" filter dropdown alongside entity/purpose filters
- Small coloured dot chips on each `PropertyCard` showing assigned groups
- Group filter is additive (AND with other filters)
- When filtering by a group, show summary banner: total value, equity, cash flow, yield

### Property Edit Form

- Multi-select dropdown to assign/unassign groups for individual property

## Colour Palette

8 preset colours (no custom picker):

| Name | Hex |
|------|-----|
| Blue | `#3B82F6` |
| Green | `#22C55E` |
| Purple | `#8B5CF6` |
| Orange | `#F97316` |
| Pink | `#EC4899` |
| Teal | `#14B8A6` |
| Red | `#EF4444` |
| Yellow | `#EAB308` |

## Decisions

- **Approach**: Join table (not tags array or JSONB) for referential integrity and typed queries
- **Groups are independent**: separate filter dimension from entity and purpose
- **Multi-membership**: a property can belong to multiple groups
- **Financial rollup**: reuses existing `portfolio.getPropertyMetrics` logic scoped to group's property IDs
- **Plan gating**: free users get 3 groups, paid unlimited
- **No nesting**: groups are flat (no sub-groups) — YAGNI
