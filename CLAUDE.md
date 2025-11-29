<!--
 Copyright 2025 abhirupinspace

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
-->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lilipad is an Initial Liquidity Offering (ILO) and Launchpad platform built on the Aptos blockchain. It combines a Next.js 16 frontend, Cloudflare Workers backend, and Move smart contracts.

## Commands

### Frontend (Next.js)
```bash
npm run dev        # Development server on port 3000
npm run build      # Production build
npm run lint       # ESLint
```

### Worker (Cloudflare)
```bash
cd worker
npm run dev        # Local dev server on port 8787
npm run deploy     # Deploy to Cloudflare
npm run db:init    # Initialize D1 database (remote)
npm run db:init:local  # Initialize D1 database (local)
```

### Smart Contracts (Move)
```bash
cd contract
aptos move compile
aptos move test
```

## Architecture

```
├── app/                    # Next.js App Router (pages, layouts, API routes)
├── components/             # React components (sidebar, navbar, ui/)
├── lib/lilipadClient.ts    # Core SDK wrapper for Aptos blockchain calls (751 lines)
├── constants/              # Network config, module address, sidebar links
├── worker/                 # Cloudflare Workers API (D1 SQLite database)
└── contract/sources/       # Move modules: launchpad, token, locking, vesting, escrow
```

### Data Flow
1. **Frontend** → User interacts with React components
2. **API Proxy** → `/app/api/projects/route.ts` forwards to Cloudflare Worker
3. **Worker** → CRUD operations on D1 database (projects storage)
4. **Blockchain** → Direct calls via `lilipadClient.ts` using `@aptos-labs/ts-sdk`

### Key Files
- `lib/lilipadClient.ts` - All Aptos blockchain interactions (view calls, transactions, balance queries)
- `worker/src/index.ts` - Worker routes: GET/POST `/api/projects`, GET `/api/projects/:id`
- `contract/sources/` - 8 Move modules handling launchpad, tokens, locking, vesting, escrow

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS v4, shadcn/ui (Radix)
- **Blockchain**: Aptos Testnet, @aptos-labs/ts-sdk, wallet-adapter-react
- **Backend**: Cloudflare Workers, D1 (SQLite)
- **Contracts**: Move language

## Environment Variables

```
NEXT_PUBLIC_WORKER_URL      # Cloudflare Worker URL (default: http://localhost:8787)
NEXT_PUBLIC_APP_NETWORK     # Aptos network (testnet/mainnet)
NEXT_PUBLIC_MODULE_ADDRESS  # Deployed Move module address
NEXT_PUBLIC_APTOS_API_KEY   # Optional Aptos RPC key
```

## Conventions

- All interactive pages use `"use client"` directive
- Components: PascalCase (`AppSidebar.tsx`), files: kebab-case (`app-sidebar.tsx`)
- API responses: `{ success: boolean, data/error }`
- Wallet state via `useWallet()` hook from wallet adapter
- State management: local useState, React Context for wallet only
