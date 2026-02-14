# UI Components Quick Reference

> Import all UI components from `@/components/ui/<name>`. See `src/components/CLAUDE.md` for full usage patterns.

## Component Table

| Component | Import | Key Props | Usage |
|-----------|--------|-----------|-------|
| **Button** | `@/components/ui/button` | `variant` (default/destructive/outline/secondary/ghost/link), `size` (default/sm/lg/icon/icon-sm/icon-lg), `asChild` | `<Button variant="destructive" size="sm">Delete</Button>` |
| **Badge** | `@/components/ui/badge` | `variant` (default/secondary/destructive/outline/warning), `asChild` | `<Badge variant="warning">Pending</Badge>` |
| **Card** | `@/components/ui/card` | Compound: `Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter` | `<Card><CardHeader><CardTitle>Title</CardTitle></CardHeader><CardContent>...</CardContent></Card>` |
| **Dialog** | `@/components/ui/dialog` | `open, onOpenChange`. Content: `showCloseButton` (default true) | See `src/components/CLAUDE.md` modals section |
| **AlertDialog** | `@/components/ui/alert-dialog` | Content: `size` ("default"/"sm"). Action/Cancel: `variant, size` | See `src/components/CLAUDE.md` modals section |
| **Sheet** | `@/components/ui/sheet` | Content: `side` (right/left/top/bottom) | `<SheetContent side="right">...</SheetContent>` |
| **Select** | `@/components/ui/select` | Trigger: `size` ("sm"/"default"). Compound: Select, SelectTrigger, SelectValue, SelectContent, SelectItem | Wrap in FormControl for forms |
| **DropdownMenu** | `@/components/ui/dropdown-menu` | Compound: DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem | Trigger uses `asChild` with Button |
| **Tooltip** | `@/components/ui/tooltip` | Compound: TooltipProvider, Tooltip, TooltipTrigger, TooltipContent. Trigger uses `asChild` | Wrap trigger element, not the content |
| **Input** | `@/components/ui/input` | Standard `<input>` props | `<Input placeholder="Enter value" {...field} />` |
| **Textarea** | `@/components/ui/textarea` | Standard `<textarea>` props | `<Textarea rows={4} {...field} />` |
| **Table** | `@/components/ui/table` | Compound: Table, TableHeader, TableBody, TableRow, TableHead, TableCell | Standard HTML table structure |
| **Tabs** | `@/components/ui/tabs` | TabsList: `variant` ("default"/"line"). Compound: Tabs, TabsList, TabsTrigger, TabsContent | `<Tabs defaultValue="tab1">...</Tabs>` |
| **Form** | `@/components/ui/form` | Compound: Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription | See `src/components/CLAUDE.md` forms section |
| **Skeleton** | `@/components/ui/skeleton` | Base: `className` | `<Skeleton className="h-4 w-full" />` |
| **DataSkeleton** | `@/components/ui/data-skeleton` | `variant` ("card"/"list"/"table"), `count` | `<DataSkeleton variant="card" count={3} />` |
| **ChartSkeleton** | `@/components/ui/chart-skeleton` | `height` | `<ChartSkeleton height={300} />` |
| **EmptyState** | `@/components/ui/empty-state` | `icon`, `title`, `description`, `action: { label, onClick }` | `<EmptyState icon={Building2} title="No items" ... />` |
| **ErrorState** | `@/components/ui/error-state` | `message`, `onRetry` | `<ErrorState message="Failed" onRetry={refetch} />` |
| **Pagination** | `@/components/ui/pagination` | `currentPage`, `totalPages`, `onPageChange`, `isLoading` | `<Pagination currentPage={page} totalPages={10} onPageChange={setPage} />` |
| **Accordion** | `@/components/ui/accordion` | Compound: Accordion, AccordionItem, AccordionTrigger, AccordionContent | `<Accordion type="single" collapsible>...</Accordion>` |
| **Popover** | `@/components/ui/popover` | Compound: Popover, PopoverTrigger, PopoverContent | Trigger uses `asChild` |
| **Calendar** | `@/components/ui/calendar` | Date picker primitive | Usually combined with Popover |
| **Switch** | `@/components/ui/switch` | `checked`, `onCheckedChange` | `<Switch checked={val} onCheckedChange={setVal} />` |
| **Checkbox** | `@/components/ui/checkbox` | `checked`, `onCheckedChange` | Wrap in FormControl for forms |
| **Slider** | `@/components/ui/slider` | `value`, `onValueChange`, `min`, `max`, `step` | `<Slider value={[val]} onValueChange={([v]) => setVal(v)} />` |
| **Progress** | `@/components/ui/progress` | `value` (0-100) | `<Progress value={75} />` |
| **Separator** | `@/components/ui/separator` | `orientation` ("horizontal"/"vertical") | `<Separator />` |
| **Collapsible** | `@/components/ui/collapsible` | `open`, `onOpenChange` | Used in sidebar section groups |
| **Label** | `@/components/ui/label` | `htmlFor` | `<Label htmlFor="name">Name</Label>` |
| **Alert** | `@/components/ui/alert` | `variant` ("default"/"destructive"). Compound: Alert, AlertTitle, AlertDescription | `<Alert variant="destructive"><AlertTitle>Error</AlertTitle>...</Alert>` |

## Domain-Specific Skeletons

| Component | Import | Props |
|-----------|--------|-------|
| `PropertyCardSkeleton` | `@/components/skeletons` | — |
| `PropertyListSkeleton` | `@/components/skeletons` | `count` |
| `TransactionSkeleton` | `@/components/skeletons` | — |
| `TransactionTableSkeleton` | `@/components/skeletons` | — |
| `LoanCardSkeleton` | `@/components/skeletons` | — |

## Key Conventions

- **No forwardRef** — Use `React.ComponentProps<"div">` for native elements, `React.ComponentProps<typeof Primitive.X>` for Radix
- **CVA for variants** — Always export `xVariants` alongside the component
- **data-slot** — Every Radix wrapper gets `data-slot="component-name"` for CSS targeting
- **asChild** — Use `<Button asChild><Link href="...">...</Link></Button>` to render Button as Link
- **Portals** — All overlays (Dialog, Sheet, Select, Tooltip, DropdownMenu, Popover) use Radix portals automatically
- **Toaster** — Already rendered in root layout. Just `import { toast } from "sonner"` and call `toast.success()`
