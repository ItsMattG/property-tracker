# Docker Local Development Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Docker Compose setup for local PostgreSQL development, replacing the need for remote Supabase database during local development.

**Architecture:** Single Postgres 16 container with persistent volume. Developers run `docker compose up -d` to start the database, then use existing `pnpm dev` workflow. Data persists across restarts but can be wiped with `docker compose down -v`.

**Tech Stack:** Docker, Docker Compose, PostgreSQL 16 Alpine

---

### Task 1: Create docker-compose.yml

**Files:**
- Create: `docker-compose.yml`

**Step 1: Create the docker-compose file**

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: property-tracker-db
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: property_tracker
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

**Step 2: Verify the file is valid**

Run: `docker compose config`
Expected: YAML output with no errors

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose for local postgres"
```

---

### Task 2: Create .dockerignore

**Files:**
- Create: `.dockerignore`

**Step 1: Create the dockerignore file**

```
node_modules
.next
.git
.env
.env.*
!.env.local.example
*.log
coverage
test-results
playwright-report
.playwright-mcp
```

**Step 2: Commit**

```bash
git add .dockerignore
git commit -m "chore: add dockerignore"
```

---

### Task 3: Update .env.local.example with Docker instructions

**Files:**
- Modify: `.env.local.example`

**Step 1: Add Docker DATABASE_URL option**

Add this comment block after line 10 (after the existing DATABASE_URL line):

```
# Database (Supabase)
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# For local Docker development, use:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/property_tracker
```

**Step 2: Commit**

```bash
git add .env.local.example
git commit -m "docs: add docker database url to env example"
```

---

### Task 4: Test the Docker setup

**Files:**
- None (manual verification)

**Step 1: Start the database**

Run: `docker compose up -d`
Expected: Container starts successfully

**Step 2: Verify container is healthy**

Run: `docker compose ps`
Expected: `property-tracker-db` shows status "healthy"

**Step 3: Test database connection**

Run: `docker compose exec db psql -U postgres -d property_tracker -c "SELECT 1;"`
Expected: Returns `1`

**Step 4: Stop without removing data**

Run: `docker compose down`
Expected: Container stops, volume preserved

---

### Task 5: Update README with Docker instructions

**Files:**
- Modify: `README.md`

**Step 1: Find the "Getting Started" or setup section and add Docker instructions**

Add a new section after the existing setup instructions:

```markdown
## Local Development with Docker

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Quick Start

1. Start the local PostgreSQL database:
   ```bash
   docker compose up -d
   ```

2. Update your `.env.local` with the local database URL:
   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/property_tracker
   ```

3. Run database migrations:
   ```bash
   pnpm db:push
   ```

4. (Optional) Seed with demo data:
   ```bash
   pnpm seed:demo
   ```

5. Start the development server:
   ```bash
   pnpm dev
   ```

### Database Commands

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start database (background) |
| `docker compose down` | Stop database (keeps data) |
| `docker compose down -v` | Stop and wipe all data |
| `docker compose logs -f db` | View database logs |
| `pnpm db:studio` | Open Drizzle Studio GUI |

### Resetting the Database

To start fresh:
```bash
docker compose down -v
docker compose up -d
pnpm db:push
pnpm seed:demo
```
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add docker local development instructions"
```

---

### Task 6: Verify full workflow

**Files:**
- None (integration test)

**Step 1: Reset and test complete workflow**

```bash
# Ensure clean state
docker compose down -v

# Start fresh
docker compose up -d

# Wait for healthy
docker compose ps

# Create .env.local if needed with Docker DATABASE_URL
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/property_tracker

# Run migrations
pnpm db:push

# Seed demo data
pnpm seed:demo

# Start app
pnpm dev
```

Expected: App starts on localhost:3000, can sign in and see demo data

**Step 2: Final commit (if any changes needed)**

```bash
git status
# If clean, no commit needed
```

---

### Task 7: Create PR

**Step 1: Push branch**

```bash
git push -u origin feature/docker-setup
```

**Step 2: Create PR**

```bash
gh pr create --title "feat: add Docker local development setup" --body "$(cat <<'EOF'
## Summary
- Add docker-compose.yml with PostgreSQL 16 for local development
- Add .dockerignore
- Update README with Docker setup instructions
- Update .env.local.example with Docker DATABASE_URL

## Usage
```bash
docker compose up -d
# Update DATABASE_URL in .env.local
pnpm db:push
pnpm dev
```

## Test plan
- [ ] `docker compose up -d` starts Postgres
- [ ] `docker compose ps` shows healthy container
- [ ] `pnpm db:push` runs migrations successfully
- [ ] `pnpm seed:demo` seeds data
- [ ] `pnpm dev` starts app and connects to local DB
- [ ] `docker compose down -v` wipes data

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 3: Wait for CI**

```bash
gh pr checks --watch
```
