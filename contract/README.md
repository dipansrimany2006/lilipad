# Lilipad - Aptos Token Sale and Vesting Platform

A comprehensive Move module for token sales with linear vesting and LP position locking on Aptos blockchain.

## Overview

Lilipad provides a complete solution for:
- **Project Registration**: Register projects with associated token addresses
- **Token Sales**: Create time-bound token sales with configurable pricing
- **Vesting Streams**: Automatic linear vesting for purchased tokens
- **Proceeds Management**: Secure withdrawal of raised APT after sale completion
- **LP Lock**: Lock liquidity provider positions with time-based unlocks

## Architecture

### Resources

#### Registry
Global storage for all projects, sales, streams, and locks with atomic counters.

#### Project
```move
struct Project {
    id: u64,
    owner: address,
    name: vector<u8>,
    token: address,
    created_at: u64,
}
```

#### Sale
```move
struct Sale {
    id: u64,
    project_id: u64,
    owner: address,
    token: address,
    total_tokens: u128,
    tokens_sold: u128,
    price_per_token: u128,  // APT per token (with PRECISION)
    start_ts: u64,
    end_ts: u64,
    raised_apt: u128,
    active: bool,
    vesting_duration: u64,
}
```

#### Stream
```move
struct Stream {
    id: u64,
    sale_id: u64,
    beneficiary: address,
    token: address,
    total_amount: u128,
    start_ts: u64,
    end_ts: u64,
    claimed: u128,
}
```

#### Lock
```move
struct Lock {
    id: u64,
    project_id: u64,
    locker: address,
    asset_ref: vector<u8>,  // Opaque reference to LP position
    amount: u128,
    unlock_ts: u64,
    withdrawn: bool,
}
```

## Entry Functions

### 1. Register Project
```move
public entry fun register_project(
    account: &signer,
    name: vector<u8>,
    token: address,
)
```

**Parameters:**
- `account`: Project owner's signer
- `name`: Project name (non-empty)
- `token`: Token contract address (non-zero)

**Events:** `ProjectRegistered`

**Example:**
```bash
aptos move run \
    --function-id 'default::lilipad::register_project' \
    --args 'string:My Token Project' 'address:0x123...'
```

### 2. Create Sale
```move
public entry fun create_sale(
    owner: &signer,
    project_id: u64,
    token: address,
    total_tokens: u128,
    price_per_token: u128,
    start_ts: u64,
    end_ts: u64,
    vesting_duration: u64,
)
```

**Parameters:**
- `owner`: Must be project owner
- `project_id`: ID of registered project
- `token`: Token being sold
- `total_tokens`: Total tokens available for sale
- `price_per_token`: Price in APT (scaled by PRECISION = 1e9)
- `start_ts`: Sale start timestamp (Unix seconds)
- `end_ts`: Sale end timestamp (Unix seconds)
- `vesting_duration`: Vesting period in seconds (e.g., 300 for 5 minutes)

**Validations:**
- Caller must be project owner
- `start_ts < end_ts`
- `price_per_token > 0`
- `total_tokens > 0`
- `vesting_duration > 0`

**Events:** `SaleCreated`

**Example:**
```bash
# Create sale with 1M tokens at 0.001 APT per token
# Price calculation: 0.001 APT * 1e9 = 1,000,000
aptos move run \
    --function-id 'default::lilipad::create_sale' \
    --args \
        u64:0 \
        address:0x123... \
        u128:1000000 \
        u128:1000000 \
        u64:1700000000 \
        u64:1700086400 \
        u64:300
```

### 3. Buy Tokens
```move
public entry fun buy(
    buyer: &signer,
    sale_id: u64,
    apt_amount: u64,
)
```

**Parameters:**
- `buyer`: Token buyer's signer
- `sale_id`: ID of active sale
- `apt_amount`: Amount of APT to spend (in octas)

**Process:**
1. Validates sale is active and within time window
2. Computes tokens: `(apt_amount * PRECISION) / price_per_token`
3. Transfers APT from buyer to escrow
4. Creates vesting stream for buyer
5. Updates sale state atomically

**Validations:**
- Sale must be active
- Current time within `[start_ts, end_ts]`
- Computed tokens > 0
- Sufficient tokens available

**Events:** `Bought`, `StreamCreated`

**Example:**
```bash
# Buy with 1 APT (100000000 octas)
aptos move run \
    --function-id 'default::lilipad::buy' \
    --args u64:0 u64:100000000
```

### 4. Claim Vested Tokens
```move
public entry fun claim(
    caller: &signer,
    stream_id: u64,
)
```

**Vesting Formula:**
```
if now <= start_ts: unlocked = 0
else if now >= end_ts: unlocked = total_amount
else: unlocked = total_amount * (now - start_ts) / (end_ts - start_ts)

claimable = unlocked - claimed
```

**Validations:**
- Caller must be stream beneficiary
- `claimable > 0`

**Events:** `Claimed`

**Example:**
```bash
aptos move run \
    --function-id 'default::lilipad::claim' \
    --args u64:0
```

### 5. Withdraw Sale Proceeds
```move
public entry fun withdraw_proceeds(
    owner: &signer,
    sale_id: u64,
    to: address,
)
```

**Parameters:**
- `owner`: Sale owner's signer
- `sale_id`: ID of completed sale
- `to`: Recipient address for APT

**Validations:**
- Caller must be sale owner
- Current time > `end_ts`
- Sale has raised APT

**Events:** `ProceedsWithdrawn`

**Example:**
```bash
aptos move run \
    --function-id 'default::lilipad::withdraw_proceeds' \
    --args u64:0 address:0x456...
```

### 6. Lock LP Position
```move
public entry fun lock_lp_position(
    caller: &signer,
    project_id: u64,
    asset_ref: vector<u8>,
    amount: u128,
    unlock_ts: u64,
)
```

**Parameters:**
- `caller`: Project owner (can be extended to authorized lockers)
- `project_id`: ID of project
- `asset_ref`: Opaque identifier for LP position (e.g., Hyperion position ID)
- `amount`: Amount/value being locked
- `unlock_ts`: Unix timestamp when unlock is allowed

**Notes:**
- For MVP, actual LP position custody is managed off-chain
- `asset_ref` stores position identifier for reconciliation
- Contract records lock state on-chain

**Events:** `Locked`

### 7. Withdraw Locked Position
```move
public entry fun withdraw_locked(
    caller: &signer,
    lock_id: u64,
)
```

**Validations:**
- Caller must be locker
- Current time >= `unlock_ts`
- Lock not already withdrawn

**Events:** `LockWithdrawn`

## View Functions

### Get Project
```move
#[view]
public fun get_project(project_id: u64): Project
```

### Get Sale
```move
#[view]
public fun get_sale(sale_id: u64): (u64, u64, address, address, u128, u128, u128, u64, u64, u128, bool)
```

Returns: `(id, project_id, owner, token, total_tokens, tokens_sold, price_per_token, start_ts, end_ts, raised_apt, active)`

### Get Stream
```move
#[view]
public fun get_stream(stream_id: u64): Stream
```

### Get Lock
```move
#[view]
public fun get_lock(lock_id: u64): Lock
```

### Get Claimable Amount
```move
#[view]
public fun get_claimable(stream_id: u64): u128
```

Returns the amount currently claimable from a stream.

### Get Counters
```move
#[view]
public fun get_counters(): (u64, u64, u64, u64)
```

Returns: `(project_counter, sale_counter, stream_counter, lock_counter)`

## Events

All events are emitted for off-chain indexing:

- `ProjectRegistered(project_id, owner, token, name)`
- `SaleCreated(sale_id, project_id, owner, token, total_tokens, price_per_token, start_ts, end_ts)`
- `Bought(sale_id, buyer, tokens_bought, apt_spent, stream_id)`
- `StreamCreated(stream_id, sale_id, beneficiary, token, total_amount, start_ts, end_ts)`
- `Claimed(stream_id, beneficiary, token, amount)`
- `ProceedsWithdrawn(sale_id, to, amount)`
- `Locked(lock_id, project_id, locker, asset_ref, amount, unlock_ts)`
- `LockWithdrawn(lock_id, to, amount)`

## Safety & Invariants

### Arithmetic Safety
- Uses `u128` for token amounts and APT to prevent overflow
- Uses `u64` for timestamps and IDs
- Floor division for price calculations (buyers receive floor amount)
- PRECISION constant (1e9) for accurate price calculations

### Access Control
- Project ownership enforced for sale creation
- Sale ownership enforced for proceeds withdrawal
- Beneficiary verification for claims
- Locker verification for lock withdrawals

### Time-based Security
- Sale time window strictly enforced
- Vesting computed based on linear interpolation
- Lock unlock time validated
- Proceeds only withdrawable after sale end

### Atomicity
- Buy operation atomically:
  1. Validates sale state
  2. Transfers APT
  3. Creates stream
  4. Updates sale counters
- No partial state updates possible

### Token Accounting
- `tokens_sold + remaining = total_tokens` (enforced in buy)
- `stream.claimed <= stream.total_amount` (enforced in claim)
- Vesting prevents over-claiming

## Deployment

### 1. Compile
```bash
aptos move compile --dev
```

### 2. Test
```bash
aptos move test --dev
```

### 3. Deploy to Testnet
```bash
aptos move publish \
    --profile testnet \
    --named-addresses lilipad=default
```

### 4. Deploy to Mainnet
```bash
aptos move publish \
    --profile mainnet \
    --named-addresses lilipad=default
```

## Usage Flow

### Complete Token Sale Flow

1. **Project Owner:**
   ```bash
   # Register project
   register_project("My DeFi Token", token_address)

   # Create sale (1M tokens, 0.001 APT each, 5min vesting)
   create_sale(
       project_id: 0,
       token: token_address,
       total_tokens: 1000000,
       price_per_token: 1000000,  # 0.001 * 1e9
       start_ts: now,
       end_ts: now + 86400,  # 24 hours
       vesting_duration: 300  # 5 minutes
   )
   ```

2. **Buyers:**
   ```bash
   # Buy tokens with 10 APT
   buy(sale_id: 0, apt_amount: 1000000000)
   # Receives stream_id: 0

   # Wait for vesting...

   # Claim vested tokens
   claim(stream_id: 0)

   # Claim again after more time
   claim(stream_id: 0)
   ```

3. **Project Owner:**
   ```bash
   # After sale ends, withdraw APT
   withdraw_proceeds(sale_id: 0, to: owner_address)

   # Lock LP position (from Hyperion or other DEX)
   lock_lp_position(
       project_id: 0,
       asset_ref: b"hyperion-pos-12345",
       amount: 500000,
       unlock_ts: now + 7776000  # 90 days
   )
   ```

4. **After Lock Period:**
   ```bash
   # Withdraw locked LP position
   withdraw_locked(lock_id: 0)
   ```

## Price Calculations

### Setting Price
```
Desired price: 0.001 APT per token
On-chain price: 0.001 * PRECISION = 0.001 * 1e9 = 1,000,000
```

### Computing Tokens
```
APT amount: 10 APT = 1,000,000,000 octas
Tokens = (1,000,000,000 * 1e9) / 1,000,000 = 10,000 tokens
```

## Error Codes

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
| 9 | E_PROJECT_NOT_FOUND | Project doesn't exist |
| 10 | E_SALE_NOT_FOUND | Sale doesn't exist |
| 11 | E_STREAM_NOT_FOUND | Stream doesn't exist |
| 12 | E_LOCK_NOT_FOUND | Lock doesn't exist |
| 13 | E_SALE_NOT_ACTIVE | Sale is not active |
| 14 | E_SALE_NOT_STARTED | Sale hasn't started |
| 15 | E_SALE_ENDED | Sale has ended |
| 16 | E_INSUFFICIENT_TOKENS | Not enough tokens available |
| 17 | E_NO_CLAIMABLE | No tokens to claim |
| 18 | E_ALREADY_WITHDRAWN | Already withdrawn |
| 19 | E_LOCK_NOT_EXPIRED | Lock period not over |
| 20 | E_SALE_NOT_ENDED | Sale still ongoing |
| 21 | E_ZERO_TOKENS_BOUGHT | Computed tokens is zero |
| 22 | E_NOT_BENEFICIARY | Not stream beneficiary |

## Limitations & Future Enhancements

### Current MVP Limitations
1. **Token Escrow**: Token custody is managed off-chain; contract assumes tokens are available
2. **LP Positions**: Lock function stores metadata only; actual position custody via Hyperion/DEX
3. **Single Token Type**: Designed for fungible tokens (Coin/FA)
4. **No Refunds**: No refund mechanism for failed sales

### Potential Enhancements
1. Full on-chain token escrow with FA integration
2. Multi-tier pricing (early bird, whitelist)
3. Vesting cliff support
4. Refund mechanism for unsuccessful sales
5. Partial sale closing
6. Sale pausability
7. Whitelist/KYC integration
8. Multi-token sales (bundles)
9. Auction-style sales
10. Governance integration

## Testing

Run comprehensive tests:
```bash
aptos move test --dev

# With coverage
aptos move test --dev --coverage

# Verbose output
aptos move test --dev --verbose
```

### Test Coverage
- ✅ Project registration
- ✅ Sale creation with validations
- ✅ Token purchase (planned)
- ✅ Vesting claim (planned)
- ✅ Proceeds withdrawal (planned)
- ✅ LP lock/unlock (planned)

## Security Considerations

1. **Reentrancy**: Not applicable in Move (no external calls during execution)
2. **Integer Overflow**: Prevented by Move's built-in checks and careful u128 usage
3. **Access Control**: Strict owner checks on all sensitive operations
4. **Time Manipulation**: Uses block timestamp (trusted in Aptos)
5. **Front-running**: Possible in buy operations; consider batch auctions for fairness

## License

MIT

## Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Built for the Aptos Hackathon** 🚀
