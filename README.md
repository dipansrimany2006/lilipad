# Lilipad

A comprehensive Initial Liquidity Offering (ILO) and Launchpad platform built on the Aptos blockchain. Lilipad provides a complete solution for token creation, fair launches, vesting schedules, token locking, and decentralized trading.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Contract Addresses](#contract-addresses)
- [Usage Guide](#usage-guide)
- [Security](#security)
- [License](#license)

## Overview

Lilipad is a full-stack Web3 application that enables projects to launch tokens on Aptos with built-in vesting mechanisms and liquidity locking. The platform combines a modern Next.js frontend, Cloudflare Workers backend, and Move smart contracts to deliver a seamless token launch experience.

### Key Capabilities

- **Token Creation**: Create fungible tokens with configurable supply and metadata
- **Fair Launch Sales**: Time-bounded token sales with soft cap support and automatic vesting
- **Linear Vesting**: Progressive token unlocks with claimable releases
- **Token and LP Locking**: Time-locked deposits for fungible tokens and liquidity positions
- **DEX Integration**: Swap functionality through Hyperion and LiquidSwap
- **Portfolio Management**: Unified dashboard for vesting streams, locks, and asset holdings

## Features

### Fair Launch / Launchpad

- Create time-bounded token sales with configurable pricing in APT
- Soft cap validation with automatic vesting stream creation
- Escrow management for secure token and APT handling
- Proceeds withdrawal for project owners after sale completion

### Token Management

- Create fungible tokens following the Aptos Fungible Asset standard
- Mint and burn capabilities with access control
- Token metadata storage with icon and project URIs
- Full integration with wallet adapters

### Vesting Streams

- Linear vesting schedules with customizable start and end timestamps
- Progressive token unlocks calculated on-chain
- Claimable tokens computed via linear interpolation
- Support for custom vesting metadata

### Token Locking

- Lock fungible tokens and LP positions with time-based unlocks
- Support for Hyperion concentrated liquidity positions
- Withdrawal functionality only available after unlock time
- On-chain lock state with off-chain position custody

### Trading

- Swap tokens through multiple DEX providers
- Support for Hyperion (concentrated liquidity) and LiquidSwap (classic AMM)
- Price impact calculation and slippage protection
- Token pair discovery via DexScreener API

### Staking Vault

- Integration with Amnis Finance staking protocol
- Support for stAPT (Staked APT) and amAPT tokens
- Stake and unstake operations on mainnet and testnet

## Architecture

```
Frontend (Next.js)
       |
       v
API Routes (/api/projects)
       |
       v
Cloudflare Workers (D1 SQLite)
       |
       v
Aptos Blockchain (Move Contracts)
       |
       v
DEX Integrations (Hyperion, LiquidSwap)
```

### Data Flow

1. **Frontend**: Users interact with React components using the `useWallet()` hook
2. **API Proxy**: Next.js API routes forward requests to Cloudflare Workers
3. **Worker**: CRUD operations on D1 database for project metadata storage
4. **Blockchain**: Direct calls via client libraries using `@aptos-labs/ts-sdk`
5. **DEX**: Price data and swaps through Hyperion SDK and LiquidSwap

## Smart Contracts

The Move smart contracts are located in the `contract/sources/` directory:

| Module | Description |
|--------|-------------|
| `launchpad.move` | Token sales with escrow, soft caps, and automatic vesting |
| `token.move` | Fungible asset creation, minting, and burning |
| `vesting.move` | Linear vesting streams with claimable releases |
| `locking.move` | Time-locked token and LP position deposits |
| `escrow.move` | Holds tokens and APT during sales until conditions are met |
| `events.move` | On-chain event emissions for indexing |
| `constants.move` | Shared error codes and precision values |
| `init.move` | Module initialization |

### Launchpad Sale Flow

1. Owner creates sale via `create_sale()` with token, price, timing, and soft cap
2. Owner deposits tokens to escrow via `deposit_sale_tokens()`
3. Buyers purchase tokens via `buy()` - APT is escrowed and vesting stream is created
4. After sale ends, owner withdraws APT via `withdraw_proceeds()`
5. Buyers claim vested tokens progressively via `vesting::claim()`

### Vesting Formula

```
if now <= start_ts: unlocked = 0
else if now >= end_ts: unlocked = total_amount
else: unlocked = total_amount * (now - start_ts) / (end_ts - start_ts)

claimable = unlocked - claimed
```

### Price Precision

All prices use `PRICE_PRECISION = 1e9` for accurate calculations:
- To set a price of 0.001 APT per token: `price_per_token = 0.001 * 1e9 = 1,000,000`
- Token calculation: `tokens = (apt_amount * PRECISION) / price_per_token`

## Tech Stack

### Frontend

| Technology | Version |
|------------|---------|
| Next.js | 16.0.5 |
| React | 19.2.0 |
| TypeScript | 5.x |
| Tailwind CSS | 4.x |
| Radix UI (shadcn/ui) | Latest |

### Blockchain

| Technology | Version |
|------------|---------|
| @aptos-labs/ts-sdk | 5.1.5 |
| @aptos-labs/wallet-adapter-react | 7.2.2 |
| @hyperionxyz/sdk | 0.0.24 |
| Move Language | Aptos Framework (mainnet) |

### Backend

| Technology | Description |
|------------|-------------|
| Cloudflare Workers | Serverless API |
| D1 | SQLite database for project metadata |

### Additional Libraries

| Library | Purpose |
|---------|---------|
| Motion | Animations |
| Recharts | Chart visualizations |
| date-fns | Date manipulation |
| Lucide React | Icons |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Aptos CLI (for contract deployment)
- Cloudflare account (for Worker deployment)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/lilipad.git
cd lilipad
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables (see [Environment Variables](#environment-variables))

4. Run the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### Building for Production

```bash
npm run build
npm run start
```

### Smart Contract Development

```bash
cd contract

# Compile contracts
aptos move compile

# Run tests
aptos move test

# Deploy to testnet
aptos move publish --profile testnet --named-addresses lilipad=default
```

### Worker Development

```bash
cd worker

# Local development
npm run dev:local

# Deploy to Cloudflare
npm run deploy

# Initialize D1 database
npm run db:init
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Cloudflare Worker URL
NEXT_PUBLIC_WORKER_URL=https://your-worker.workers.dev

# Aptos network (testnet or mainnet)
NEXT_PUBLIC_APP_NETWORK=testnet

# Deployed Move module address
NEXT_PUBLIC_MODULE_ADDRESS=0x...

# Optional: Aptos API key for higher rate limits
NEXT_PUBLIC_APTOS_API_KEY=your-api-key

# Optional: Default DEX provider (hyperion or liquidswap)
NEXT_PUBLIC_DEFAULT_DEX=hyperion
```

## Project Structure

```
lilipad/
|-- app/                           # Next.js App Router
|   |-- layout.tsx                 # Root layout with providers
|   |-- page.tsx                   # Home/Projects listing
|   |-- api/                       # API routes (proxy to Worker)
|   |   +-- projects/              # Project CRUD endpoints
|   |-- create-project/            # Project creation page
|   |-- launch/                    # Fair launch page
|   |-- tokens/                    # Token creation page
|   |-- trade/                     # DEX trading interface
|   |-- vesting/                   # Vesting streams management
|   |-- locks/                     # Token locks management
|   |-- vault/                     # Staking vault (Amnis)
|   |-- portfolio/                 # User portfolio dashboard
|   +-- project/[id]/              # Project detail page
|
|-- components/                    # React components
|   |-- navbar.tsx                 # Navigation bar
|   |-- app-sidebar.tsx            # Sidebar navigation
|   |-- WalletProvider.tsx         # Wallet adapter provider
|   |-- WalletSelector.tsx         # Wallet connection UI
|   +-- ui/                        # shadcn/ui components
|
|-- lib/                           # Client libraries
|   |-- lilipadClient.ts           # Core Aptos interactions
|   |-- hyperionClient.ts          # Hyperion DEX integration
|   |-- liquidswapClient.ts        # LiquidSwap integration
|   |-- dexClient.ts               # DEX abstraction layer
|   |-- dexscreenerClient.ts       # Price/chart data
|   +-- utils.ts                   # General utilities
|
|-- constants/                     # Configuration
|   +-- index.ts                   # Network config, module address
|
|-- contract/                      # Move smart contracts
|   |-- Move.toml                  # Package configuration
|   |-- sources/                   # Move modules
|   +-- tests/                     # Contract tests
|
|-- worker/                        # Cloudflare Worker
|   +-- ...                        # Worker source files
|
+-- public/                        # Static assets
    +-- image/                     # Logos and images
```

## API Reference

### Project Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | Fetch all projects |
| POST | `/api/projects` | Create a new project |
| GET | `/api/projects/[id]` | Get project by ID |
| PUT | `/api/projects/[id]` | Update project |
| DELETE | `/api/projects/[id]` | Delete project |

### Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": { ... }
}
```

Or in case of an error:

```json
{
  "success": false,
  "error": "Error message"
}
```

## Contract Addresses

### Testnet Deployment

| Property | Value |
|----------|-------|
| Network | Aptos Testnet |
| Module Address | `0xd9d962cbfbf59c05cea301c35b38cf4a113bf692940f6cecde6318082e0242c9` |
| Explorer | [View on Aptos Explorer](https://explorer.aptoslabs.com/account/0xd9d962cbfbf59c05cea301c35b38cf4a113bf692940f6cecde6318082e0242c9?network=testnet) |

### Module Functions

Entry functions are called using the format:
```
{MODULE_ADDRESS}::{module_name}::{function_name}
```

Examples:
- `0xd9d9...42c9::launchpad::create_sale`
- `0xd9d9...42c9::launchpad::buy`
- `0xd9d9...42c9::vesting::claim`
- `0xd9d9...42c9::locking::create_lock_with_deposit`

## Usage Guide

### Creating a Token Sale

1. Create a project with metadata on the platform
2. Navigate to the Launch page
3. Configure sale parameters:
   - Token address
   - Total tokens for sale
   - Price per token (in APT)
   - Start and end timestamps
   - Vesting duration
   - Soft cap (optional)
4. Deposit tokens to escrow
5. Share the sale link with potential buyers

### Purchasing Tokens

1. Connect your Aptos wallet
2. Navigate to an active sale
3. Enter the amount of APT to spend
4. Confirm the transaction
5. A vesting stream is automatically created
6. Claim vested tokens as they unlock

### Creating a Token Lock

1. Navigate to the Locks page
2. Select the token or LP position to lock
3. Set the unlock timestamp
4. Confirm the transaction
5. Withdraw tokens after the unlock time

### Trading Tokens

1. Navigate to the Trade page
2. Select input and output tokens
3. Choose DEX provider (Hyperion or LiquidSwap)
4. Enter the swap amount
5. Review price impact and slippage
6. Confirm the swap transaction

## Security

### Smart Contract Security

- **Atomicity**: All operations are atomic with no partial state updates
- **Access Control**: Owner verification on all sensitive operations
- **Arithmetic Safety**: Uses u128 for amounts, u64 for timestamps
- **Time Validation**: Strict enforcement of sale and lock time windows
- **No Reentrancy**: Move language prevents reentrancy attacks

### Error Codes

| Code | Constant | Description |
|------|----------|-------------|
| 1 | E_NOT_INITIALIZED | Registry not initialized |
| 2 | E_ALREADY_INITIALIZED | Registry already exists |
| 3 | E_NOT_OWNER | Caller is not owner |
| 4 | E_INVALID_NAME | Invalid project name |
| 5 | E_INVALID_TOKEN | Invalid token address |
| 6 | E_INVALID_TIME_RANGE | Start time >= end time |
| 7 | E_INVALID_PRICE | Price is zero |
| 8 | E_INVALID_AMOUNT | Amount is zero or invalid |
| 9 | E_PROJECT_NOT_FOUND | Project does not exist |
| 10 | E_SALE_NOT_FOUND | Sale does not exist |
| 11 | E_STREAM_NOT_FOUND | Stream does not exist |
| 12 | E_LOCK_NOT_FOUND | Lock does not exist |
| 13 | E_SALE_NOT_ACTIVE | Sale is not active |
| 14 | E_SALE_NOT_STARTED | Sale has not started |
| 15 | E_SALE_ENDED | Sale has ended |
| 16 | E_INSUFFICIENT_TOKENS | Not enough tokens available |
| 17 | E_NO_CLAIMABLE | No tokens to claim |
| 18 | E_ALREADY_WITHDRAWN | Already withdrawn |
| 19 | E_LOCK_NOT_EXPIRED | Lock period not over |
| 20 | E_SALE_NOT_ENDED | Sale still ongoing |
| 21 | E_ZERO_TOKENS_BOUGHT | Computed tokens is zero |
| 22 | E_NOT_BENEFICIARY | Not stream beneficiary |

### Known Limitations

1. Token escrow is managed at the application level for the MVP
2. LP position locks store metadata only; actual custody is via the DEX
3. No refund mechanism for failed sales in the current version
4. Front-running is possible in buy operations

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT

---

Built for the Aptos ecosystem.
