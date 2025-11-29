# Lilipad MVP - Modular Launchpad + Vesting + Locking

A secure, modular Move package for Aptos that implements a token launchpad with built-in vesting and locking mechanisms. Designed for 24-hour hackathon MVP with production-ready security principles.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Module Breakdown](#module-breakdown)
3. [Client Flow Guide](#client-flow-guide)
4. [Precision & Math](#precision--math)
5. [Security Invariants](#security-invariants)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [Integration Examples](#integration-examples)

---

## Architecture Overview

### Off-Chain Project Registry

**IMPORTANT**: The project registry is **OFF-CHAIN** (wallet-signed JSON). The Move package does **NOT** store full project metadata. Instead:

- Sales reference an optional `project_pointer` (bytes) — typically an IPFS CID or content hash
- Client UIs must manage project data off-chain and reference the hash
- This keeps on-chain storage minimal and efficient

### Modular Design

```
lilipad/
├── constants.move    - Error codes and PRICE_PRECISION constant
├── events.move       - All event definitions and emission helpers
├── escrow.move       - Separate escrow buckets for sale/vesting/lock
├── launchpad.move    - Sale creation and buying logic
├── vesting.move      - Linear vesting streams
├── locking.move      - Token and LP locking
└── init.move         - Module initialization
```

### Escrow System

Three separate escrow buckets:

1. **Sale Escrow** - Holds tokens for sale and APT proceeds
2. **Vesting Escrow** - Holds tokens reserved for vesting streams
3. **Lock Escrow** - Holds locked tokens (fungible only; LP is opaque)

---

## Module Breakdown

### constants.move

Defines:
- `PRICE_PRECISION`: `1_000_000_000` (1e9) for price calculations
- Error codes for all modules

### events.move

All events emitted by the system:
- `ProjectHashRegistered` - Optional project anchor
- `SaleCreated` - New sale created
- `SaleEscrowDeposited` - Tokens deposited to sale escrow
- `Bought` - Buyer purchases tokens
- `StreamCreated` - Vesting stream created
- `VestingEscrowDeposited` - Tokens deposited to vesting escrow
- `Claimed` - Vested tokens claimed
- `ProceedsWithdrawn` - Sale owner withdraws APT
- `SaleSoftCapReached` - Soft cap milestone reached
- `LockCreated` - Lock created
- `LockEscrowDeposited` - Tokens deposited to lock escrow
- `LockWithdrawn` - Lock withdrawn after unlock time

### escrow.move

Manages three escrow types:
- **Sale escrow**: `create_sale_bucket()`, `deposit_sale_tokens_record()`, `deposit_apt_for_sale()`, `withdraw_sale_apt()`
- **Vesting escrow**: `create_vesting_bucket_with_deposit()`, `transfer_vesting_to_beneficiary()`
- **Lock escrow**: `create_lock_bucket_with_deposit()`, `withdraw_locked_tokens()`

**Key function**: `transfer_sale_to_vesting()` - Atomically moves tokens from sale to vesting escrow during buy.

### launchpad.move

**Sale Resource**:
```move
struct Sale {
    id: u64,
    project_pointer_opt: Option<vector<u8>>,
    owner: address,
    token: address,
    total_tokens: u128,
    tokens_sold: u128,
    price_per_token: u128,
    start_ts: u64,
    end_ts: u64,
    soft_cap: u128,
    raised_apt: u128,
    escrowed: bool,
    soft_cap_reached: bool,
}
```

**Entry Functions**:
- `create_sale()` - Create a new sale (initially `escrowed = false`)
- `deposit_sale_tokens()` - Owner deposits tokens; sets `escrowed = true` when fully funded
- `buy()` - **ATOMIC**: Transfer APT, create vesting stream, reserve tokens
- `withdraw_proceeds()` - Owner withdraws APT after sale ends

### vesting.move

**Stream Resource**:
```move
struct Stream {
    id: u64,
    owner: address,
    beneficiary: address,
    token: address,
    total_amount: u128,
    start_ts: u64,
    end_ts: u64,
    claimed: u128,
    escrowed: bool,
    metadata_opt: Option<vector<u8>>,
}
```

**Entry Functions**:
- `create_stream_with_deposit()` - Create a standalone vesting stream with token deposit
- `claim()` - Beneficiary claims vested tokens (linear vesting formula)

**Friend Function** (called by launchpad):
- `create_stream_from_sale()` - Create stream during buy; tokens transferred from sale escrow

**Vesting Formula** (linear):
```
if now <= start_ts: unlocked = 0
if now >= end_ts: unlocked = total_amount
else: unlocked = total_amount * (now - start_ts) / (end_ts - start_ts)
claimable = unlocked - claimed
```

### locking.move

**Lock Resource**:
```move
struct Lock {
    id: u64,
    locker: address,
    project_pointer_opt: Option<vector<u8>>,
    asset_ref: vector<u8>,
    amount: u128,
    kind: u8,  // 0 = fungible, 1 = LP
    unlock_ts: u64,
    withdrawn: bool,
    escrowed: bool,
    metadata_opt: Option<vector<u8>>,
}
```

**Entry Functions**:
- `create_lock_with_deposit()` - Create fungible token lock with deposit (`escrowed = true`)
- `create_lock_for_lp()` - Create LP lock (opaque reference, `escrowed = false`)
- `withdraw_locked()` - Withdraw after `unlock_ts`

**Lock Kinds**:
- `LOCK_KIND_FUNGIBLE = 0` - On-chain escrow for fungible tokens
- `LOCK_KIND_LP = 1` - Opaque reference; client manages LP custody

---

## Client Flow Guide

### 1. Create Sale Flow

**Deposit-First Model** (recommended for MVP):

```typescript
// Step 1: Owner creates sale
await signAndSubmit({
  function: `${MODULE_ADDRESS}::launchpad::create_sale`,
  type_arguments: [],
  arguments: [
    optionalProjectPointer,  // Option<vector<u8>> - e.g., ["QmIPFSHash..."]
    tokenAddress,            // address
    totalTokens,             // u128
    pricePerToken,           // u128 (scaled by PRICE_PRECISION)
    startTs,                 // u64
    endTs,                   // u64
    softCap,                 // u128
  ],
});

// Step 2: Owner deposits tokens
await signAndSubmit({
  function: `${MODULE_ADDRESS}::launchpad::deposit_sale_tokens`,
  type_arguments: [],
  arguments: [
    saleId,                  // u64
    totalTokens,             // u128
  ],
});

// Note: In production, you'd transfer actual tokens here using FA or Coin primitives
// For hackathon MVP, we assume off-chain token management or manual transfers
```

**When can buyers buy?**
- Only after `sale.escrowed == true` (deposit fully covers `total_tokens`)
- Between `start_ts` and `end_ts`

### 2. Buy Tokens Flow (Atomic)

```typescript
// Buyer purchases tokens
// This is ATOMIC: APT transfer + stream creation happen together
await signAndSubmit({
  function: `${MODULE_ADDRESS}::launchpad::buy`,
  type_arguments: [],
  arguments: [
    saleId,                  // u64
    aptAmount,               // u64 (in Octas, 1 APT = 100_000_000 Octas)
    vestingDurationSecs,     // u64 (e.g., 300 for 5 minutes)
  ],
});

// What happens atomically:
// 1. APT transferred from buyer to sale escrow
// 2. Tokens calculated: tokens_bought = (aptAmount * PRICE_PRECISION) / price_per_token
// 3. Vesting stream created with tokens_bought
// 4. Tokens transferred from sale escrow to vesting escrow
// 5. Events emitted: Bought, StreamCreated
// 6. If soft_cap reached, emit SaleSoftCapReached
```

**Client-side token calculation**:
```typescript
const PRICE_PRECISION = 1_000_000_000;
const tokensBought = (aptAmount * PRICE_PRECISION) / pricePerToken;
```

### 3. Claim Vested Tokens Flow

```typescript
// Step 1: Check claimable amount (view function)
const claimable = await view({
  function: `${MODULE_ADDRESS}::vesting::get_claimable`,
  type_arguments: [],
  arguments: [streamId],
});

// Step 2: Claim if claimable > 0
if (claimable > 0) {
  await signAndSubmit({
    function: `${MODULE_ADDRESS}::vesting::claim`,
    type_arguments: [],
    arguments: [streamId],
  });
}
```

### 4. Withdraw Sale Proceeds Flow

```typescript
// Owner withdraws APT after sale ends
await signAndSubmit({
  function: `${MODULE_ADDRESS}::launchpad::withdraw_proceeds`,
  type_arguments: [],
  arguments: [
    saleId,                  // u64
    recipientAddress,        // address
  ],
});
```

### 5. Create Vesting Stream Flow (Standalone)

```typescript
// Create a vesting stream independent of a sale
await signAndSubmit({
  function: `${MODULE_ADDRESS}::vesting::create_stream_with_deposit`,
  type_arguments: [],
  arguments: [
    beneficiaryAddress,      // address
    tokenAddress,            // address
    totalAmount,             // u128
    startTs,                 // u64
    endTs,                   // u64
    optionalMetadata,        // Option<vector<u8>>
  ],
});
```

### 6. Lock Fungible Tokens Flow

```typescript
// Lock fungible tokens (e.g., for team vesting)
await signAndSubmit({
  function: `${MODULE_ADDRESS}::locking::create_lock_with_deposit`,
  type_arguments: [],
  arguments: [
    optionalProjectPointer,  // Option<vector<u8>>
    tokenAddress,            // address
    amount,                  // u128
    unlockTs,                // u64
    optionalMetadata,        // Option<vector<u8>>
  ],
});
```

### 7. Hyperion LP Lock Flow

**Client-side responsibilities**:
1. Create LP position on Hyperion (off-chain)
2. Get pool ID / position reference and tx hash
3. Create lock record on Lilipad for transparency

```typescript
// Step 1: Add liquidity on Hyperion (client-side)
const hyperionTx = await hyperion.addLiquidity({
  tokenA,
  tokenB,
  amountA,
  amountB,
});

const poolId = hyperionTx.poolId;
const txHash = hyperionTx.hash;

// Step 2: Create lock record on Lilipad
await signAndSubmit({
  function: `${MODULE_ADDRESS}::locking::create_lock_for_lp`,
  type_arguments: [],
  arguments: [
    optionalProjectPointer,           // Option<vector<u8>>
    poolId,                           // vector<u8> - opaque asset_ref
    lpAmount,                         // u128
    unlockTs,                         // u64
    `tx_hash:${txHash},explorer:...`, // Option<vector<u8>> - metadata
  ],
});
```

**Important**: LP locks are **NOT escrowed on-chain**. The client manages custody. The lock record provides transparency and enforces unlock time via the contract.

### 8. Withdraw Locked Assets Flow

```typescript
// Check if lock is ready to withdraw
const isUnlocked = await view({
  function: `${MODULE_ADDRESS}::locking::is_unlocked`,
  type_arguments: [],
  arguments: [lockId],
});

if (isUnlocked) {
  await signAndSubmit({
    function: `${MODULE_ADDRESS}::locking::withdraw_locked`,
    type_arguments: [],
    arguments: [lockId],
  });
}

// For LP locks: client must also withdraw from Hyperion after this
```

---

## Precision & Math

### Price Precision

```
PRICE_PRECISION = 1_000_000_000 (1e9)
```

**Price encoding**:
- If 1 token = 0.001 APT, then `price_per_token = 0.001 * 1e9 = 1_000_000`
- If 1 token = 1 APT, then `price_per_token = 1 * 1e9 = 1_000_000_000`

**Token calculation**:
```
tokens_bought = (apt_amount * PRICE_PRECISION) / price_per_token
```

**Example**:
```
apt_amount = 10000 Octas (0.0001 APT)
price_per_token = 1_000_000 (0.001 APT per token)
tokens_bought = (10000 * 1_000_000_000) / 1_000_000
              = 10_000_000_000
```

### Rounding

All division uses **floor rounding** (default in Move). Dust may remain in escrow.

**Dust handling**: A future `recover_dust` admin function can be added to sweep remaining dust after all claims.

---

## Security Invariants

### 1. Atomicity

**Buy operation is ATOMIC**:
- APT transfer from buyer
- Vesting stream creation
- Token reservation from sale to vesting escrow

All state updates occur within a single transaction. Either all succeed or all revert.

### 2. Escrow-First Rule

Sales cannot accept buys until `sale.escrowed == true`:
```move
assert!(sale.escrowed, E_SALE_NOT_ESCROWED);
```

### 3. Permission Checks

- Only sale owner can `deposit_sale_tokens()` and `withdraw_proceeds()`
- Only stream beneficiary can `claim()`
- Only lock locker can `withdraw_locked()`

### 4. Safe Integer Math

- Use `u128` for token amounts and APT amounts (after casting from `u64` for coin ops)
- Multiply before divide to reduce overflow risk: `(apt * PRECISION) / price`
- Check `tokens_bought > 0` to prevent zero-token purchases

### 5. State Updates Before Transfers

Where possible, update state before external transfers to avoid inconsistent states on revert.

### 6. No Reentrancy

Move's resource model prevents reentrancy attacks. All state mutations are transactional.

---

## Testing

### Running Tests

```bash
cd contract
aptos move test
```

### Test Coverage

The test suite (`tests/lilipad_tests.move`) covers:

1. **Launchpad**:
   - Create sale success
   - Deposit sale tokens and verify escrow
   - Buy fails if not escrowed
   - Buy success (atomic)
   - Soft cap reached
   - Withdraw proceeds

2. **Vesting**:
   - Create stream with deposit
   - Claim before start fails
   - Partial claim (linear vesting)
   - Full claim after end

3. **Locking**:
   - Create fungible lock
   - Create LP lock
   - Withdraw before unlock fails
   - Withdraw after unlock succeeds

### Test Results

All tests pass with proper setup. See `lilipad_tests.move:1` for details.

---

## Deployment

### 1. Compile

```bash
cd contract
aptos move compile --named-addresses lilipad=default
```

### 2. Deploy to Devnet

```bash
aptos move publish --named-addresses lilipad=default --profile default
```

### 3. Initialize

The `init_module` function in `init.move` automatically initializes all modules on deployment.

---

## Integration Examples

### Example: Complete Sale Launch

```typescript
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

const config = new AptosConfig({ network: Network.DEVNET });
const aptos = new Aptos(config);

const MODULE_ADDRESS = "0x..."; // Your deployed address
const PRICE_PRECISION = 1_000_000_000n;

// 1. Create sale
async function createSale() {
  const totalTokens = 1_000_000n;
  const pricePerToken = 1_000_000n; // 0.001 APT per token
  const startTs = Math.floor(Date.now() / 1000);
  const endTs = startTs + 3600; // 1 hour sale
  const softCap = 500_000n;

  const txn = await aptos.transaction.build.simple({
    sender: ownerAddress,
    data: {
      function: `${MODULE_ADDRESS}::launchpad::create_sale`,
      typeArguments: [],
      functionArguments: [
        [], // No project pointer
        tokenAddress,
        totalTokens,
        pricePerToken,
        startTs,
        endTs,
        softCap,
      ],
    },
  });

  const response = await aptos.signAndSubmitTransaction({
    signer: ownerAccount,
    transaction: txn,
  });

  await aptos.waitForTransaction({ transactionHash: response.hash });
  console.log("Sale created!");
}

// 2. Deposit tokens
async function depositTokens(saleId: number) {
  const txn = await aptos.transaction.build.simple({
    sender: ownerAddress,
    data: {
      function: `${MODULE_ADDRESS}::launchpad::deposit_sale_tokens`,
      typeArguments: [],
      functionArguments: [saleId, 1_000_000n],
    },
  });

  const response = await aptos.signAndSubmitTransaction({
    signer: ownerAccount,
    transaction: txn,
  });

  await aptos.waitForTransaction({ transactionHash: response.hash });
  console.log("Tokens deposited!");
}

// 3. Buy tokens
async function buyTokens(saleId: number, aptAmount: number) {
  const vestingDuration = 300; // 5 minutes

  const txn = await aptos.transaction.build.simple({
    sender: buyerAddress,
    data: {
      function: `${MODULE_ADDRESS}::launchpad::buy`,
      typeArguments: [],
      functionArguments: [saleId, aptAmount, vestingDuration],
    },
  });

  const response = await aptos.signAndSubmitTransaction({
    signer: buyerAccount,
    transaction: txn,
  });

  await aptos.waitForTransaction({ transactionHash: response.hash });
  console.log("Tokens bought!");
}

// 4. Claim vested tokens
async function claimTokens(streamId: number) {
  // Check claimable first
  const [claimable] = await aptos.view({
    payload: {
      function: `${MODULE_ADDRESS}::vesting::get_claimable`,
      typeArguments: [],
      functionArguments: [streamId],
    },
  });

  if (claimable > 0) {
    const txn = await aptos.transaction.build.simple({
      sender: beneficiaryAddress,
      data: {
        function: `${MODULE_ADDRESS}::vesting::claim`,
        typeArguments: [],
        functionArguments: [streamId],
      },
    });

    const response = await aptos.signAndSubmitTransaction({
      signer: beneficiaryAccount,
      transaction: txn,
    });

    await aptos.waitForTransaction({ transactionHash: response.hash });
    console.log(`Claimed ${claimable} tokens!`);
  }
}
```

### Example: Project Pointer (IPFS)

```typescript
// Off-chain project data (stored in IPFS)
const projectData = {
  name: "MyToken Launch",
  description: "Revolutionary DeFi token",
  logo: "ipfs://QmLogoHash...",
  website: "https://mytoken.com",
  social: {
    twitter: "https://twitter.com/mytoken",
    discord: "https://discord.gg/mytoken",
  },
};

// Upload to IPFS
const ipfsHash = await uploadToIPFS(projectData);
console.log("Project data IPFS hash:", ipfsHash);

// Use hash in sale creation
const projectPointerOpt = [new TextEncoder().encode(ipfsHash)];

await createSale({
  projectPointerOpt,
  // ... other params
});
```

---

## Notes & Limitations (Hackathon MVP)

1. **Token Transfers**: For the MVP, token transfers are recorded but not executed on-chain. In production, integrate with Fungible Asset (FA) or Coin standards for actual token custody.

2. **LP Integration**: Hyperion integration is client-side only. The contract records LP locks as opaque references. Clients must provide `asset_ref` and `metadata` (tx hash, explorer link).

3. **Access Control**: Sale owner permissions are enforced. For more complex scenarios (e.g., multi-sig, DAO control), extend with Aptos `signer` patterns or governance modules.

4. **Dust Recovery**: Floor division may leave dust in escrow. Add a `recover_dust()` function for admin cleanup.

5. **Price Precision**: 1e9 precision is sufficient for most use cases. Adjust if higher precision needed.

6. **Event Indexing**: All major state changes emit events. Index these with an off-chain service (e.g., The Graph, custom indexer) for UI data.

---

## License

MIT License - see LICENSE file for details.

---

## Support & Contributions

For issues or questions:
- GitHub Issues: [link to repo]
- Discord: [community link]

Contributions welcome! Please submit PRs with tests.

---

**Built for Aptos Hackathon 2025** 🚀
