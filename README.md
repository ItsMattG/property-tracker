# PropertyTracker

Australian property investment tracking - "Your spreadsheet, automated."

## Features

- **Australian Bank Feeds**: Connect all major Australian banks via Basiq open banking
- **ATO Tax Categories**: Every expense maps to the correct ATO category
- **Automatic Categorization**: Smart transaction categorization with manual override
- **CSV Export**: One-click export for your accountant
- **Multi-Entity Support**: Track properties across personal, trust, and company ownership

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Authentication**: Clerk
- **Database**: PostgreSQL (Supabase) with Drizzle ORM
- **API**: tRPC
- **Bank Feeds**: Basiq
- **Styling**: Tailwind CSS + shadcn/ui
- **Theme**: Forest (green) with multiple theme options

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (Supabase recommended)
- Clerk account
- Basiq account (for bank feeds)

### Setup

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy the environment template and fill in your credentials:

```bash
cp .env.local.example .env.local
```

3. Configure the following environment variables:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Database (Supabase)
DATABASE_URL=postgresql://...

# Basiq (Optional - for bank feeds)
BASIQ_API_KEY=...
BASIQ_SERVER_URL=https://au-api.basiq.io
```

4. Push the database schema:

```bash
npm run db:push
```

5. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Webhooks

Configure webhooks in your service dashboards:

- **Clerk**: Point to `/api/webhooks/clerk`
- **Basiq**: Point to `/api/webhooks/basiq`

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run E2E tests
- `npm run db:push` - Push schema to database
- `npm run db:studio` - Open Drizzle Studio

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Protected dashboard pages
│   └── api/               # API routes and webhooks
├── components/            # React components
│   ├── layout/           # Layout components (Sidebar, Header)
│   ├── properties/       # Property-related components
│   ├── transactions/     # Transaction-related components
│   └── ui/               # shadcn/ui components
├── lib/                   # Utility functions
│   ├── categories.ts     # ATO category definitions
│   ├── trpc/             # tRPC client setup
│   └── utils.ts          # General utilities
├── server/               # Server-side code
│   ├── db/               # Database schema and connection
│   ├── routers/          # tRPC routers
│   └── services/         # External service integrations
└── styles/               # CSS and theme files
```

## License

Private - All rights reserved.
