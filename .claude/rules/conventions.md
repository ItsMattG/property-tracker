# Cross-Cutting Conventions

## Import Ordering

```tsx
"use client";                                    // 1. Directive
import { useState } from "react";                // 2. React
import Link from "next/link";                    // 3. Next.js
import { Plus } from "lucide-react";             // 4. Third-party
import { Button } from "@/components/ui/button"; // 5. Internal UI
import { MyCard } from "@/components/my/MyCard";  // 6. Internal app
import { trpc } from "@/lib/trpc/client";        // 7. Internal lib
import { MyHelper } from "./MyHelper";            // 8. Relative
```

Not enforced by lint, but follow this general grouping: directive > framework > libs > internal > relative.

## Naming Conventions

| DO | DON'T |
|----|-------|
| `handleX` for internal handlers, `onX` for callback props | Mix naming conventions |
| `key={item.id}` for dynamic lists | `key={index}` for dynamic data |
| `key={i}` only for static/non-reorderable lists | `key={item.id}` for skeleton placeholders |
| Event handler naming: `const handleDelete = () => {}` | `const deleteHandler = () => {}` |

## "use client" Directive

Only add `"use client"` when the component needs hooks or interactivity. Do not add it to every file.

## Type Patterns

- UI components: inline types in function signature (`React.ComponentProps<"div">`)
- App components: file-local `interface` (NOT exported)
- Never export prop interfaces from UI components
- Use `z.infer<typeof schema>` for form types — never manually duplicate

## Lucide Icons

| DO | DON'T |
|----|-------|
| `import { Plus, Building2 } from "lucide-react"` | `import * as Icons from "lucide-react"` (kills tree-shaking) |
| `<Plus className="w-4 h-4" />` | `<Plus size={16} />` (use Tailwind classes) |
