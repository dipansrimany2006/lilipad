module lilipad::escrow {
    use std::signer;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_std::table::{Self, Table};
    use lilipad::constants;
    use lilipad::events;

    /// Sale escrow bucket for a specific sale
    struct SaleEscrowBucket has store, drop {
        token: address,
        token_balance: u128,
        apt_balance: u128,
    }

    /// Vesting escrow bucket for a specific stream
    struct VestingEscrowBucket has store, drop {
        token: address,
        balance: u128,
    }

    /// Lock escrow bucket for a specific lock
    struct LockEscrowBucket has store, drop {
        kind: u8, // 0 = fungible token, 1 = LP position
        token: address,
        asset_ref: vector<u8>,
        balance: u128,
    }

    /// Global sale escrow storage
    struct SaleEscrow has key {
        buckets: Table<u64, SaleEscrowBucket>,
        apt_coins: Coin<AptosCoin>,
    }

    /// Global vesting escrow storage
    struct VestingEscrow has key {
        buckets: Table<u64, VestingEscrowBucket>,
    }

    /// Global lock escrow storage
    struct LockEscrow has key {
        buckets: Table<u64, LockEscrowBucket>,
    }

    /// Initialize escrow storage (called by module init)
    public fun init_escrow(account: &signer) {
        let addr = signer::address_of(account);
        assert!(!exists<SaleEscrow>(addr), constants::e_already_initialized());
        assert!(!exists<VestingEscrow>(addr), constants::e_already_initialized());
        assert!(!exists<LockEscrow>(addr), constants::e_already_initialized());

        move_to(account, SaleEscrow {
            buckets: table::new(),
            apt_coins: coin::zero<AptosCoin>(),
        });

        move_to(account, VestingEscrow {
            buckets: table::new(),
        });

        move_to(account, LockEscrow {
            buckets: table::new(),
        });
    }

    // ========================================
    // Sale Escrow Functions
    // ========================================

    /// Create a new sale escrow bucket
    public fun create_sale_bucket(sale_id: u64, token: address) acquires SaleEscrow {
        let escrow = borrow_global_mut<SaleEscrow>(@lilipad);
        assert!(!table::contains(&escrow.buckets, sale_id), constants::e_already_initialized());

        table::add(&mut escrow.buckets, sale_id, SaleEscrowBucket {
            token,
            token_balance: 0,
            apt_balance: 0,
        });
    }

    /// Record token deposit to sale escrow (called after deposit-first flow)
    /// Note: In a production system, you would transfer actual tokens here
    /// For the hackathon MVP, we're tracking balances and assuming off-chain token management
    public fun deposit_sale_tokens_record(
        sale_id: u64,
        depositor: address,
        token: address,
        amount: u128,
    ) acquires SaleEscrow {
        let escrow = borrow_global_mut<SaleEscrow>(@lilipad);
        assert!(table::contains(&escrow.buckets, sale_id), constants::e_sale_not_found());

        let bucket = table::borrow_mut(&mut escrow.buckets, sale_id);
        assert!(bucket.token == token, constants::e_invalid_token());

        bucket.token_balance = bucket.token_balance + amount;

        events::emit_sale_escrow_deposited(
            sale_id,
            depositor,
            token,
            amount,
            bucket.token_balance,
        );
    }

    /// Deposit APT from buyer (called during buy)
    public fun deposit_apt_for_sale(
        buyer: &signer,
        sale_id: u64,
        apt_amount: u64,
    ) acquires SaleEscrow {
        let escrow = borrow_global_mut<SaleEscrow>(@lilipad);
        assert!(table::contains(&escrow.buckets, sale_id), constants::e_sale_not_found());

        // Transfer APT from buyer to escrow
        let apt_coins = coin::withdraw<AptosCoin>(buyer, apt_amount);
        coin::merge(&mut escrow.apt_coins, apt_coins);

        // Update APT balance in sale bucket
        let bucket = table::borrow_mut(&mut escrow.buckets, sale_id);
        bucket.apt_balance = bucket.apt_balance + (apt_amount as u128);
    }

    /// Transfer tokens from sale escrow to vesting escrow (called during buy)
    public fun transfer_sale_to_vesting(
        sale_id: u64,
        stream_id: u64,
        token: address,
        amount: u128,
    ) acquires SaleEscrow, VestingEscrow {
        // Deduct from sale escrow
        let sale_escrow = borrow_global_mut<SaleEscrow>(@lilipad);
        assert!(table::contains(&sale_escrow.buckets, sale_id), constants::e_sale_not_found());

        let sale_bucket = table::borrow_mut(&mut sale_escrow.buckets, sale_id);
        assert!(sale_bucket.token_balance >= amount, constants::e_insufficient_escrow());
        sale_bucket.token_balance = sale_bucket.token_balance - amount;

        // Add to vesting escrow
        let vesting_escrow = borrow_global_mut<VestingEscrow>(@lilipad);
        if (!table::contains(&vesting_escrow.buckets, stream_id)) {
            table::add(&mut vesting_escrow.buckets, stream_id, VestingEscrowBucket {
                token,
                balance: 0,
            });
        };

        let vesting_bucket = table::borrow_mut(&mut vesting_escrow.buckets, stream_id);
        vesting_bucket.balance = vesting_bucket.balance + amount;

        events::emit_vesting_escrow_deposited(stream_id, @lilipad, token, amount);
    }

    /// Withdraw APT proceeds from sale escrow (called by sale owner)
    public fun withdraw_sale_apt(
        sale_id: u64,
        to: address,
        amount: u128,
    ) acquires SaleEscrow {
        let escrow = borrow_global_mut<SaleEscrow>(@lilipad);
        assert!(table::contains(&escrow.buckets, sale_id), constants::e_sale_not_found());

        let bucket = table::borrow_mut(&mut escrow.buckets, sale_id);
        assert!(bucket.apt_balance >= amount, constants::e_insufficient_escrow());

        bucket.apt_balance = bucket.apt_balance - amount;

        // Transfer APT to recipient
        let withdraw_amount = (amount as u64);
        let apt_coins = coin::extract(&mut escrow.apt_coins, withdraw_amount);
        coin::deposit(to, apt_coins);
    }

    // ========================================
    // Vesting Escrow Functions
    // ========================================

    /// Create a new vesting escrow bucket and deposit tokens
    public fun create_vesting_bucket_with_deposit(
        stream_id: u64,
        depositor: address,
        token: address,
        amount: u128,
    ) acquires VestingEscrow {
        let escrow = borrow_global_mut<VestingEscrow>(@lilipad);
        assert!(!table::contains(&escrow.buckets, stream_id), constants::e_already_initialized());

        table::add(&mut escrow.buckets, stream_id, VestingEscrowBucket {
            token,
            balance: amount,
        });

        events::emit_vesting_escrow_deposited(stream_id, depositor, token, amount);
    }

    /// Transfer tokens from vesting escrow to beneficiary (called during claim)
    /// Note: In production, this would transfer actual tokens
    public fun transfer_vesting_to_beneficiary(
        stream_id: u64,
        _to: address,
        amount: u128,
    ) acquires VestingEscrow {
        let escrow = borrow_global_mut<VestingEscrow>(@lilipad);
        assert!(table::contains(&escrow.buckets, stream_id), constants::e_stream_not_found());

        let bucket = table::borrow_mut(&mut escrow.buckets, stream_id);
        assert!(bucket.balance >= amount, constants::e_insufficient_escrow());

        bucket.balance = bucket.balance - amount;

        // In production: transfer actual tokens to beneficiary here
        // For MVP: we assume off-chain token management or FA/Coin transfers
    }

    // ========================================
    // Lock Escrow Functions
    // ========================================

    /// Create a lock escrow bucket with deposit (for fungible tokens)
    public fun create_lock_bucket_with_deposit(
        lock_id: u64,
        depositor: address,
        kind: u8,
        token: address,
        asset_ref: vector<u8>,
        amount: u128,
    ) acquires LockEscrow {
        let escrow = borrow_global_mut<LockEscrow>(@lilipad);
        assert!(!table::contains(&escrow.buckets, lock_id), constants::e_already_initialized());

        table::add(&mut escrow.buckets, lock_id, LockEscrowBucket {
            kind,
            token,
            asset_ref,
            balance: amount,
        });

        if (kind == 0) { // Fungible token lock
            events::emit_lock_escrow_deposited(lock_id, depositor, token, amount);
        };
    }

    /// Withdraw locked tokens (called after unlock time)
    public fun withdraw_locked_tokens(
        lock_id: u64,
        _to: address,
        amount: u128,
    ) acquires LockEscrow {
        let escrow = borrow_global_mut<LockEscrow>(@lilipad);
        assert!(table::contains(&escrow.buckets, lock_id), constants::e_lock_not_found());

        let bucket = table::borrow_mut(&mut escrow.buckets, lock_id);
        assert!(bucket.balance >= amount, constants::e_insufficient_escrow());

        bucket.balance = bucket.balance - amount;

        // In production: transfer actual tokens to recipient here
    }

    // ========================================
    // View Functions
    // ========================================

    #[view]
    public fun get_sale_escrow_balance(sale_id: u64): (u128, u128) acquires SaleEscrow {
        let escrow = borrow_global<SaleEscrow>(@lilipad);
        if (!table::contains(&escrow.buckets, sale_id)) {
            return (0, 0)
        };

        let bucket = table::borrow(&escrow.buckets, sale_id);
        (bucket.token_balance, bucket.apt_balance)
    }

    #[view]
    public fun get_vesting_escrow_balance(stream_id: u64): u128 acquires VestingEscrow {
        let escrow = borrow_global<VestingEscrow>(@lilipad);
        if (!table::contains(&escrow.buckets, stream_id)) {
            return 0
        };

        let bucket = table::borrow(&escrow.buckets, stream_id);
        bucket.balance
    }

    #[view]
    public fun get_lock_escrow_balance(lock_id: u64): u128 acquires LockEscrow {
        let escrow = borrow_global<LockEscrow>(@lilipad);
        if (!table::contains(&escrow.buckets, lock_id)) {
            return 0
        };

        let bucket = table::borrow(&escrow.buckets, lock_id);
        bucket.balance
    }

    // ========================================
    // Test-only Functions
    // ========================================

    #[test_only]
    public fun init_escrow_for_test(account: &signer) {
        init_escrow(account);
    }
}
