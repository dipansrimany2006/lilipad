# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lilipad is a Next.js 16 application for token management on the Aptos blockchain. It provides:
- **Fair Launch (ILO)**: Create and participate in token sales with soft caps and vesting
- **Token Locks**: Time-based token locking with withdrawal after unlock
- **Vesting Streams**: Linear token vesting to beneficiaries over time
- **Token Creation**: Create new fungible tokens on Aptos

## Development Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

### Smart Contract Integration

The app interacts with Aptos Move modules deployed at the address in `NEXT_PUBLIC_MODULE_ADDRESS`. Key modules:
- `token` - Token creation, minting, burning
- `locking` - Time-based token locks
- `vesting` - Linear vesting streams
- `launchpad` - Fair launch/ILO sales

All contract interactions are centralized in `lib/lilipadClient.ts`, which provides:
- View functions for reading chain state (`getTokenInfo`, `getLock`, `getStream`, `getSale`)
- Transaction payload builders (`buildCreateTokenPayload`, `buildCreateLockWithDepositPayload`, etc.)
- Wallet token utilities (`getWalletFungibleAssets`)
- Amount formatting/parsing helpers

### Wallet Integration

Uses `@aptos-labs/wallet-adapter-react` for wallet connectivity:
- `WalletProvider` component wraps the app in `components/WalletProvider.tsx`
- Network and API key configured via environment variables
- Use `useWallet()` hook to access `account`, `connected`, `signAndSubmitTransaction`

### Page Structure

Each feature has a main page and optional detail pages:
- `/` - Project explorer homepage
- `/launch` - Fair launch listing and creation (multi-step form with project/token/details/review)
- `/locks` - Token locks list, create lock form with token selector
- `/locks/[id]` - Lock detail with analytics
- `/vesting` - Vesting streams with claim functionality
- `/vesting/[id]` - Stream detail with vesting chart
- `/tokens` - Token management
- `/create-project` - Project creation flow

### UI Components

- Uses Radix UI primitives (`@radix-ui/react-*`) with Tailwind CSS
- Custom `MagicCard` component for gradient-bordered cards
- Shadcn-style components in `components/ui/`
- Charts via Recharts (`recharts`)
- Icons from `lucide-react` and `@tabler/icons-react`

### Data Persistence

- Locks, streams, and sales are stored in localStorage for local tracking
- Keys like `lilipad_created_locks`, `lilipad_created_streams`, `lilipad_sales`
- Owner mappings stored separately: `lilipad_lock_owner_{id}`

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_APP_NETWORK=testnet    # or mainnet
NEXT_PUBLIC_MODULE_ADDRESS=0x...    # Deployed contract address
NEXT_PUBLIC_APTOS_API_KEY=          # Optional Aptos API key
```

## Key Patterns

### Transaction Flow
1. Build payload using `build*Payload` function from `lilipadClient`
2. Call `signAndSubmitTransaction({ data: payload })`
3. Wait for confirmation with `aptos.waitForTransaction({ transactionHash })`
4. Update localStorage and local state on success

### Token Amount Handling
- Use `parseTokenAmount(amount, decimals)` to convert human-readable to raw
- Use `formatTokenBalance(balance, decimals)` for display
- APT uses 8 decimals; launchpad prices use `PRICE_PRECISION` (1e9 scaling)

### Timestamp Handling
- All timestamps in contracts are Unix seconds
- Use `Math.floor(Date.now() / 1000)` for current time
- Convert JS Date to timestamp: `Math.floor(date.getTime() / 1000)`
