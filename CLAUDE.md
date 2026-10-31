# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Get AI Tools** - an open-source AI Tools Directory built with Next.js 14 (App Router). It's an AI navigation
and discovery platform that allows users to discover, submit, and explore AI tools. The project features multi-language
support, SEO optimization, and connects to a crawler system for automatic content collection.

## Development Commands

### Package Manager

- **Primary**: pnpm (>=8.0.0) - use `pnpm` for all commands
- **Node**: >=20.0.0 (specified in `.nvmrc`)

### Common Development Tasks

```bash
# Install dependencies
pnpm i

# Development server
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code with Prettier
pnpm prettier
```

### Code Quality Tools

- **ESLint**: Airbnb config with TypeScript support
- **Prettier**: With import sorting and Tailwind CSS plugin
- **Husky**: Pre-commit hooks for lint-staged

## Architecture

### Core Structure

```
app/[locale]/          # Internationalized routes with dynamic locale
├── (with-footer)/     # Route groups for layout organization
├── layout.tsx         # Root layout with i18n provider
└── page.tsx          # Homepage

components/           # Reusable React components
├── ui/               # shadcn/ui component library
├── home/             # Homepage components
├── auth/             # Authentication components
└── [feature]/        # Feature-specific components

lib/                  # Utilities and constants
├── constants.ts      # Application constants
├── utils.ts          # Utility functions (cn for className merging)
└── utils/            # Additional utilities

db/                   # D1 binding, queries, and row types
migrations/           # Wrangler D1 migrations

messages/             # Internationalization JSON files (9 languages)
```

### Key Technical Stack

- **Framework**: Next.js 14 with App Router (React Server Components)
- **UI**: shadcn/ui + Tailwind CSS
- **Runtime**: OpenNext on Cloudflare Workers
- **Database**: Cloudflare D1
- **i18n**: next-intl with middleware-based routing
- **Forms**: react-hook-form + zod validation
- **Notifications**: sonner (toasts)
- **Markdown**: react-markdown
- **Theming**: next-themes

### Internationalization Architecture

- Uses `[locale]` dynamic segment in App Router (e.g., `/en`, `/zh-CN`)
- Middleware (`/middlewares/`) handles locale detection and routing
- Translation files in `/messages/` directory (9 languages)
- SEO optimized with locale-specific sitemaps

### Database Integration

- **Cloudflare D1**: SQLite-compatible serverless database bound as `DB`
- **Tables**: `web_navigation` (AI tools), `navigation_category` (categories), `submit` (user submissions),
  `crawler_candidate`
- **Migrations**: Located in `/migrations/`
- **Queries**: Configured in `/db/d1.ts` and `/db/queries.ts`

## Environment Variables

Required environment variables (see `.env.example`):

```bash
# Site configuration
NEXT_PUBLIC_SITE_URL="https://your-domain.com"

# Cloudflare D1 is provided by the DB binding in wrangler.jsonc

# Built-in crawler and discovery
CRON_SECRET="cron-auth-key"
REVIEW_AUTH_KEY="review-auth-key"
GITHUB_TOKEN="optional-github-token"
DISCOVERY_GITHUB_TOPICS="ai,llm,generative-ai"
CRAWL_BATCH_SIZE="5"
CRAWL_CONCURRENCY="2"
CRAWL_REQUEST_TIMEOUT_MS="7000"

# Authentication keys
CRON_AUTH_KEY="cron-auth-key"
CRAWLER_WORKER_KEY="crawler-worker-key"

# Analytics and contact
GOOGLE_TRACKING_ID="G-XXXXXXX"
GOOGLE_ADSENSE_URL="https://adsense-url"
CONTACT_US_EMAIL="contact@email.com"
```

## Code Style Guidelines

### ESLint Configuration

- Extends: `next/core-web-vitals`, `prettier`, `airbnb`, `airbnb-typescript`
- JSX quotes: Single quotes preferred (`jsx-quotes: ["error", "prefer-single"]`)
- React in JSX scope: Disabled (Next.js doesn't require React import)

### Prettier Configuration

- Single quotes for JS/JSX/TS
- 120 character print width
- Import sorting with `@ianvs/prettier-plugin-sort-imports`
- Tailwind CSS class sorting with `prettier-plugin-tailwindcss`
- Import order: React → Next.js → Built-ins → Third-party → Internal

### Component Patterns

- Use shadcn/ui components from `/components/ui/` as base
- Class name merging: Use `cn()` utility from `lib/utils.ts`
- Server Components: Default to React Server Components where possible
- Client Components: Use `"use client"` directive only when necessary

## Database Operations

### Common Database Tasks

1. **Initialize database**: Run `pnpm db:migrate:local` (or the reviewed remote equivalent)
2. **Add AI tools**: Review built-in crawler candidates or manually insert into `web_navigation`
3. **Update content**: Modify `web_navigation` with proper Markdown formatting
4. **Manage categories**: Use `navigation_category` for tool categorization

### Built-in crawler

- `/api/cron/discover` discovers candidates; `/api/cron/process` consumes bounded waves within a time budget
- Sources are user submissions, Show HN, and GitHub topics
- `/api/crawl/review/[id]` approves or rejects reviewed candidates

## Deployment

### Cloudflare deployment

- Build with `pnpm build:cloudflare` and deploy with `pnpm deploy:cloudflare`
- D1 and R2 bindings plus the daily cron are configured in `wrangler.jsonc`
- Follow `docs/cloudflare-d1-migration.md` before any production cutover

### Build Considerations

- Internationalization requires locale-specific builds
- Sitemap generation: Dynamic with locale support
- Image optimization: Next.js Image component with remote patterns configured

## Important Notes

1. **Node Version**: Must use Node >=20.0.0 (check `.nvmrc`)
2. **Package Manager**: Use pnpm exclusively (yarn/npm disabled in `package.json`)
3. **Database**: Cloudflare D1 binding `DB` is required
4. **Crawler**: Apply D1 migrations and configure Cron/review keys before enabling Cron
5. **Internationalization**: All routes are locale-prefixed, middleware handles redirects
6. **SEO**: Dynamic sitemaps, robots.txt, and meta tags are implemented

## File References

- **Internationalization config**: `i18n.ts`
- **Next.js config**: `next.config.mjs`
- **Tailwind config**: `tailwind.config.ts`
- **shadcn/ui config**: `components.json`
- **TypeScript config**: `tsconfig.json`
- **Database migration**: `migrations/0001_initial.sql` and `docs/cloudflare-d1-migration.md`
