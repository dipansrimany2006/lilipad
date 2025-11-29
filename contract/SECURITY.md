# Security Analysis & Invariants - Lilipad Module

## Code Review Summary

### Safety Guarantees

#### 1. Arithmetic Safety
- **Overflow Protection**: All arithmetic uses Move's built-in overflow checks
- **Type Safety**:
  - `u128` for token amounts and APT (prevents overflow in most scenarios)
  - `u64` for timestamps and IDs
  - `u64` for coin operations (Aptos Coin API requirement)
- **Floor Division**: Price calculations use floor division, protecting against rounding attacks
- **PRECISION Constant**: `1e9` constant ensures accurate price calculations

**Example:**
```move
// Safe computation with PRECISION scaling
let tokens_bought = (apt_amount_u128 * PRECISION) / sale.price_per_token;
```

#### 2. Access Control Enforcement

| Function | Access Control | Validation |
|----------|---------------|------------|
| `register_project` | Any address | Name non-empty, token non-zero |
| `create_sale` | Project owner only | `sale.owner == project.owner` |
| `buy` | Any address | Sale active, within time window |
| `claim` | Stream beneficiary only | `caller == stream.beneficiary` |
| `withdraw_proceeds` | Sale owner only | `caller == sale.owner`, sale ended |
| `lock_lp_position` | Project owner only | `caller == project.owner` |
| `withdraw_locked` | Locker only | `caller == lock.locker`, time >= unlock_ts |

**Critical Checks:**
```move
// Example: Sale creation requires project ownership
let project = table::borrow(&registry.projects, project_id);
assert!(project.owner == owner_addr, E_NOT_OWNER);
```

#### 3. Atomicity Guarantees

**Buy Operation** (Critical Path):
```move
public entry fun buy(...) {
    // 1. Validate sale state (no state changes yet)
    assert!(sale.active, E_SALE_NOT_ACTIVE);
    assert!(now >= sale.start_ts, E_SALE_NOT_STARTED);
    assert!(now <= sale.end_ts, E_SALE_ENDED);

    // 2. Compute tokens (pure calculation)
    let tokens_bought = (apt_amount_u128 * PRECISION) / sale.price_per_token;
    assert!(tokens_bought > 0, E_ZERO_TOKENS_BOUGHT);

    // 3. Transfer APT (atomic coin operation)
    let apt_coins = coin::withdraw<AptosCoin>(buyer, apt_amount);
    coin::merge(&mut escrow.coins, apt_coins);

    // 4. Update sale state (atomic table operations)
    sale.raised_apt = sale.raised_apt + apt_amount_u128;
    sale.tokens_sold = sale.tokens_sold + tokens_bought;

    // 5. Create stream (atomic table insert)
    table::add(&mut registry.streams, stream_id, stream);

    // 6. Emit events (non-reverting)
    event::emit(...);
}
```

**Atomicity Properties:**
- Either all operations succeed, or entire transaction reverts
- No partial state updates possible
- Token accounting always consistent

#### 4. Time-based Security

**Time Window Enforcement:**
```move
// Buy: strict time window
assert!(now >= sale.start_ts, E_SALE_NOT_STARTED);
assert!(now <= sale.end_ts, E_SALE_ENDED);

// Withdraw: only after sale ends
assert!(now > sale.end_ts, E_SALE_NOT_ENDED);

// Unlock: only after lock expires
assert!(now >= lock.unlock_ts, E_LOCK_NOT_EXPIRED);
```

**Timestamp Source:**
- Uses `timestamp::now_seconds()` from Aptos Framework
- Trusted timestamp source (block time)
- Cannot be manipulated by users

#### 5. Vesting Security

**Linear Vesting Formula:**
```move
fun compute_unlocked(stream: &Stream, now: u64): u128 {
    if (now <= stream.start_ts) {
        0  // Nothing unlocked before start
    } else if (now >= stream.end_ts) {
        stream.total_amount  // Fully unlocked after end
    } else {
        // Linear interpolation
        let elapsed = ((now - stream.start_ts) as u128);
        let duration = ((stream.end_ts - stream.start_ts) as u128);
        (stream.total_amount * elapsed) / duration
    }
}
```

**Invariants:**
- `unlocked(t) >= unlocked(t-1)` (monotonic increasing)
- `0 <= unlocked <= total_amount`
- `claimed <= unlocked` (enforced in claim)
- `claimed` never decreases

**Claim Safety:**
```move
let claimable = unlocked - stream.claimed;
assert!(claimable > 0, E_NO_CLAIMABLE);  // Prevent wasteful transactions
stream.claimed = stream.claimed + claimable;  // Update state
```

### Known Limitations (MVP Design Decisions)

#### 1. Token Escrow (Off-chain)
**Current Implementation:**
```move
// Note: In production, tokens should be transferred to escrow here
// For hackathon MVP, we assume tokens are managed off-chain or
// transferred separately via a FA/Coin transfer
```

**Security Implications:**
- Contract does NOT hold actual sale tokens
- Relies on off-chain token management
- Events emitted for indexing, but no on-chain token custody

**Mitigation for Production:**
```move
// Add token escrow in create_sale
public entry fun create_sale(...) {
    // Transfer tokens to contract escrow
    let tokens = coin::withdraw<TokenType>(owner, (total_tokens as u64));

    if (!exists<TokenEscrow<TokenType>>(@lilipad)) {
        move_to(owner, TokenEscrow { coins: tokens });
    } else {
        let escrow = borrow_global_mut<TokenEscrow<TokenType>>(@lilipad);
        coin::merge(&mut escrow.coins, tokens);
    };
}
```

#### 2. LP Position Lock (Metadata Only)
**Current Implementation:**
```move
// Lock stores position metadata
struct Lock {
    asset_ref: vector<u8>,  // Opaque identifier
    ...
}

// No actual asset custody
public entry fun lock_lp_position(...) {
    // Just stores lock record
    table::add(&mut registry.locks, lock_id, lock);
    event::emit(Locked { ... });
}
```

**Security Implications:**
- Contract does NOT hold LP positions
- `asset_ref` is metadata only
- Relies on external position registry (e.g., Hyperion)

**Production Integration:**
```move
// Integrate with Hyperion or other LP registry
// Transfer position NFT to contract
// Verify position ownership before locking
```

#### 3. Type Conversion (u128 → u64)
**Potential Issue:**
```move
// Converting u128 to u64 for coin operations
let withdraw_amount = (amount as u64);
let apt_coins = coin::extract(&mut escrow.coins, withdraw_amount);
```

**Risk:**
- If `amount > u64::MAX`, conversion truncates
- APT amounts unlikely to exceed u64::MAX (~ 18.4 billion APT)
- Aptos total supply: 1 billion APT

**Mitigation:**
```move
// Add explicit check for production
assert!(amount <= (U64_MAX as u128), E_AMOUNT_TOO_LARGE);
```

### Invariants & Assertions

#### Global Invariants

1. **Counter Monotonicity:**
   ```
   ∀t: counters(t+1) >= counters(t)
   ```
   Counters only increment, never decrement.

2. **Token Conservation (Per Sale):**
   ```
   tokens_sold + available == total_tokens
   available = total_tokens - tokens_sold
   ```

3. **APT Conservation:**
   ```
   escrow.balance >= Σ(sale.raised_apt) - Σ(withdrawn)
   ```

4. **Vesting Conservation (Per Stream):**
   ```
   0 <= stream.claimed <= stream.total_amount
   stream.claimed <= compute_unlocked(stream, now)
   ```

5. **Lock State:**
   ```
   withdrawn == true ⟹ now >= unlock_ts
   ```

#### Per-Function Invariants

**register_project:**
```
POST: ∃ project : project.id == old(project_counter)
      ∧ project.owner == caller
      ∧ project_counter == old(project_counter) + 1
```

**create_sale:**
```
PRE:  caller == project.owner
      ∧ start_ts < end_ts
      ∧ price_per_token > 0
POST: ∃ sale : sale.id == old(sale_counter)
      ∧ sale.tokens_sold == 0
      ∧ sale.raised_apt == 0
      ∧ sale.active == true
```

**buy:**
```
PRE:  sale.active
      ∧ sale.start_ts <= now <= sale.end_ts
      ∧ tokens_bought <= (sale.total_tokens - sale.tokens_sold)
POST: sale.tokens_sold == old(sale.tokens_sold) + tokens_bought
      ∧ sale.raised_apt == old(sale.raised_apt) + apt_amount
      ∧ ∃ stream : stream.beneficiary == caller
```

**claim:**
```
PRE:  caller == stream.beneficiary
      ∧ unlocked > stream.claimed
POST: stream.claimed == old(stream.claimed) + claimable
      ∧ stream.claimed <= stream.total_amount
```

**withdraw_proceeds:**
```
PRE:  caller == sale.owner
      ∧ now > sale.end_ts
POST: sale.raised_apt == 0
      ∧ escrow.balance == old(escrow.balance) - withdrawn_amount
```

### 🛡️ Attack Vectors & Mitigations

#### 1. Price Manipulation
**Attack:** Set extremely high/low prices to overflow/underflow
**Mitigation:**
- `price_per_token > 0` enforced
- PRECISION scaling prevents precision loss
- u128 prevents realistic overflow
- Floor division favors protocol

#### 2. Time-based Attacks
**Attack:** Buy just before sale end, claim immediately
**Mitigation:**
- Vesting period enforced per-sale
- Linear unlocking prevents instant claims
- Time window strictly validated

#### 3. Reentrancy
**Attack:** Re-enter claim during token transfer
**Mitigation:**
- Move language prevents reentrancy
- No external calls during execution
- State updated before events

#### 4. Front-running
**Attack:** Watch mempool, front-run buy transactions
**Mitigation:**
- Inherent to blockchain (not fixable at contract level)
- Consider batch auctions for fairness (future enhancement)
- First-come-first-served model

#### 5. Denial of Service
**Attack:** Buy all tokens immediately at sale start
**Mitigation:**
- Intended behavior (public sale)
- Consider per-user limits (future enhancement)
- Consider whitelist/tiers (future enhancement)

#### 6. Precision Attacks
**Attack:** Send tiny APT amounts to get free tokens due to rounding
**Mitigation:**
```move
// Compute tokens with PRECISION scaling
let tokens_bought = (apt_amount_u128 * PRECISION) / sale.price_per_token;

// Explicitly reject zero tokens
assert!(tokens_bought > 0, E_ZERO_TOKENS_BOUGHT);
```
- Floor division favors protocol
- Zero token purchases rejected

### 🔍 Testing Recommendations

#### Unit Tests (Implemented)
-  Project registration
-  Sale creation with ownership validation

#### Integration Tests (Recommended)
```move
#[test]
fun test_full_sale_lifecycle()

#[test]
fun test_vesting_linear_unlocking()

#[test]
fun test_multiple_buyers()

#[test]
fun test_claim_progression()

#[test]
fun test_withdraw_after_sale()

#[test]
fun test_lock_unlock_lifecycle()
```

#### Edge Cases (Recommended)
```move
#[test]
#[expected_failure(abort_code = E_SALE_NOT_STARTED)]
fun test_buy_before_start()

#[test]
#[expected_failure(abort_code = E_SALE_ENDED)]
fun test_buy_after_end()

#[test]
#[expected_failure(abort_code = E_INSUFFICIENT_TOKENS)]
fun test_buy_exceeds_supply()

#[test]
#[expected_failure(abort_code = E_NO_CLAIMABLE)]
fun test_claim_before_vesting()

#[test]
#[expected_failure(abort_code = E_NOT_OWNER)]
fun test_unauthorized_withdrawal()
```

#### Invariant Tests
```move
#[test]
fun test_token_conservation()

#[test]
fun test_apt_conservation()

#[test]
fun test_vesting_monotonicity()

#[test]
fun test_counter_monotonicity()
```

###  Security Checklist

- [x] Integer overflow protection (u128 for amounts)
- [x] Access control on sensitive operations
- [x] Time window validation
- [x] Atomicity of state updates
- [x] Event emission for all state changes
- [x] Input validation (non-zero, non-empty)
- [x] Vesting formula correctness
- [x] Counter uniqueness (monotonic increment)
- [x] No reentrancy vulnerabilities (Move guarantee)
- [x] Clear error messages
- [ ] On-chain token escrow (MVP limitation)
- [ ] On-chain LP position custody (MVP limitation)
- [ ] Comprehensive test suite (partial)
- [ ] Formal verification (future work)

### 🚀 Production Hardening Recommendations

1. **Add Token Escrow:**
   - Integrate with Aptos Coin/FA
   - Lock tokens during sale creation
   - Release on claim

2. **Add Overflow Checks:**
   ```move
   const U64_MAX: u128 = 18446744073709551615;
   assert!(amount <= U64_MAX, E_AMOUNT_TOO_LARGE);
   ```

3. **Add Emergency Controls:**
   - Pause functionality
   - Admin role for emergencies
   - Upgrade mechanism

4. **Add Rate Limiting:**
   - Per-user buy limits
   - Cooldown periods
   - Anti-whale measures

5. **Add Comprehensive Events:**
   - Sale state changes
   - Emergency actions
   - Configuration updates

6. **Gas Optimization:**
   - Batch operations
   - Storage optimization
   - Efficient data structures

7. **Formal Verification:**
   - Prove invariants
   - Model checking
   - Symbolic execution

### 📚 References

- [Aptos Move Book](https://aptos.dev/move/book/)
- [Move Security Guidelines](https://github.com/move-language/move/blob/main/language/documentation/book/src/SUMMARY.md)
- [Aptos Framework](https://github.com/aptos-labs/aptos-framework)

---

**Security Status: HACKATHON MVP** 

This contract is designed for hackathon demonstration purposes. For production deployment, implement all recommended hardening measures and conduct comprehensive audits.
