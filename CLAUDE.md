# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lilipad is a Web3 crowdfunding platform built on the Aptos blockchain. It allows users to explore, create, and back blockchain projects with features like fair launches, token management, liquidity locks, and vesting schedules.

## Commands

### Next.js Frontend
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Cloudflare Worker (Backend API)
```bash
cd worker
npm run dev           # Run worker locally with remote D1
npm run dev:local     # Run worker with local D1
npm run deploy        # Deploy worker to Cloudflare
npm run db:init       # Initialize remote D1 database
npm run db:init:local # Initialize local D1 database
```

## Architecture

### Frontend (Next.js 16 + React 19)
- **App Router**: Pages in `app/` directory with file-based routing
- **Pages**: Home (`/`), Fair Launch (`/launch`), Tokens (`/tokens`), Locks (`/locks`), Vesting (`/vesting`), Create Project (`/create-project`)
- **Wallet Integration**: Aptos wallet via `@aptos-labs/wallet-adapter-react`, configured in `components/WalletProvider.tsx`
- **UI Components**: Radix UI primitives with custom styling in `components/ui/`
- **Styling**: Tailwind CSS v4 with `tw-animate-css` for animations

### Backend (Cloudflare Worker)
- **Entry**: `worker/src/index.ts` - Handles all API routes
- **Database**: Cloudflare D1 (SQLite) - Schema in `schema.sql`
- **API Routes**:
  - `GET /api/projects` - List projects (optional filters: `category`, `search`)
  - `GET /api/projects/:id` - Get single project
  - `POST /api/projects` - Create project

### Data Flow
1. Next.js API routes (`app/api/`) proxy requests to Cloudflare Worker
2. Worker connects to D1 database for persistence
3. Worker URL configured via `NEXT_PUBLIC_WORKER_URL` env var

### Key Files
- `constants/index.ts` - Sidebar navigation config and Aptos network settings (NETWORK, MODULE_ADDRESS, APTOS_API_KEY)
- `lib/utils.ts` - Utility functions (cn for className merging)
- `worker/wrangler.toml` - Worker configuration with D1 binding

## Environment Variables

Frontend (`.env.local`):
```
NEXT_PUBLIC_APP_NETWORK=testnet
NEXT_PUBLIC_MODULE_ADDRESS=<aptos-module-address>
NEXT_PUBLIC_APTOS_API_KEY=<aptos-api-key>
NEXT_PUBLIC_WORKER_URL=<cloudflare-worker-url>
```

## Path Aliases

- `@/*` maps to project root (e.g., `@/components`, `@/constants`, `@/lib`)
