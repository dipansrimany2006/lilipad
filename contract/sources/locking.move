module lilipad::locking {
    use std::signer;
    use std::option::{Self, Option};
    use aptos_framework::timestamp;
    use aptos_std::table::{Self, Table};
    use lilipad::constants;
    use lilipad::events;
    use lilipad::escrow;

    // Lock kinds
    const LOCK_KIND_FUNGIBLE: u8 = 0;
    const LOCK_KIND_LP: u8 = 1;

    /// Lock resource
    struct Lock has store, drop, copy {
        id: u64,
        locker: address,
        project_pointer_opt: Option<vector<u8>>, // Optional project reference
        asset_ref: vector<u8>,                   // Opaque reference (token address for fungible, LP pool ID for LP)
        amount: u128,
        kind: u8,                                // 0 = fungible token, 1 = LP position
        unlock_ts: u64,
        withdrawn: bool,
        escrowed: bool,
        metadata_opt: Option<vector<u8>>,        // Optional metadata (e.g., tx hash, explorer link)
    }

    /// Global lock registry
    struct LockRegistry has key {
        lock_counter: u64,
        locks: Table<u64, Lock>,
    }

    /// Initialize locking module
    public fun init_locking(account: &signer) {
        let addr = signer::address_of(account);
        assert!(!exists<LockRegistry>(addr), constants::e_already_initialized());

        move_to(account, LockRegistry {
            lock_counter: 0,
            locks: table::new(),
        });
    }

    /// Create a lock for fungible tokens with deposit (atomic deposit variant)
    public entry fun create_lock_with_deposit(
        locker: &signer,
        project_pointer_opt: Option<vector<u8>>,
        token: address,
        amount: u128,
        unlock_ts: u64,
        metadata_opt: Option<vector<u8>>,
    ) acquires LockRegistry {
        let locker_addr = signer::address_of(locker);
        let now = timestamp::now_seconds();

        // Validate parameters
        assert!(token != @0x0, constants::e_invalid_token());
        assert!(amount > 0, constants::e_invalid_amount());
        assert!(unlock_ts > now, constants::e_invalid_time_range());

        let registry = borrow_global_mut<LockRegistry>(@lilipad);

        let lock_id = registry.lock_counter;
        registry.lock_counter = lock_id + 1;

        // Create asset_ref from token address for fungible tokens
        let asset_ref = token_address_to_bytes(token);

        // Create lock
        let lock = Lock {
            id: lock_id,
            locker: locker_addr,
            project_pointer_opt,
            asset_ref,
            amount,
            kind: LOCK_KIND_FUNGIBLE,
            unlock_ts,
            withdrawn: false,
            escrowed: true,
            metadata_opt,
        };

        table::add(&mut registry.locks, lock_id, lock);

        // Deposit tokens to lock escrow
        escrow::create_lock_bucket_with_deposit(
            lock_id,
            locker_addr,
            LOCK_KIND_FUNGIBLE,
            token,
            asset_ref,
            amount,
        );

        events::emit_lock_created(
            lock_id,
            locker_addr,
            project_pointer_opt,
            LOCK_KIND_FUNGIBLE,
            token,
            asset_ref,
            amount,
            unlock_ts,
            metadata_opt,
        );
    }

    /// Create a lock for LP position (opaque reference)
    /// Client provides asset_ref and metadata (e.g., Hyperion tx hash, pool ID)
    /// This is for transparency/auditability; actual LP custody is managed client-side
    public entry fun create_lock_for_lp(
        locker: &signer,
        project_pointer_opt: Option<vector<u8>>,
        asset_ref: vector<u8>,     // LP pool ID or opaque reference
        amount: u128,               // LP token amount or position size
        unlock_ts: u64,
        metadata_opt: Option<vector<u8>>, // Should include tx hash, explorer link, etc.
    ) acquires LockRegistry {
        let locker_addr = signer::address_of(locker);
        let now = timestamp::now_seconds();

        // Validate parameters
        assert!(amount > 0, constants::e_invalid_amount());
        assert!(unlock_ts > now, constants::e_invalid_time_range());

        let registry = borrow_global_mut<LockRegistry>(@lilipad);

        let lock_id = registry.lock_counter;
        registry.lock_counter = lock_id + 1;

        // Create lock (escrowed=false for LP since custody is client-side)
        // However, the lock is recorded on-chain for transparency
        let lock = Lock {
            id: lock_id,
            locker: locker_addr,
            project_pointer_opt,
            asset_ref,
            amount,
            kind: LOCK_KIND_LP,
            unlock_ts,
            withdrawn: false,
            escrowed: false, // LP locks are not escrowed on-chain
            metadata_opt,
        };

        table::add(&mut registry.locks, lock_id, lock);

        // Create escrow bucket for tracking (balance will be 0 for LP)
        escrow::create_lock_bucket_with_deposit(
            lock_id,
            locker_addr,
            LOCK_KIND_LP,
            @0x0, // No token address for LP
            asset_ref,
            0, // No on-chain balance for LP
        );

        events::emit_lock_created(
            lock_id,
            locker_addr,
            project_pointer_opt,
            LOCK_KIND_LP,
            @0x0,
            asset_ref,
            amount,
            unlock_ts,
            metadata_opt,
        );
    }

    /// Withdraw locked tokens after unlock time
    public entry fun withdraw_locked(
        requester: &signer,
        lock_id: u64,
    ) acquires LockRegistry {
        let requester_addr = signer::address_of(requester);
        let now = timestamp::now_seconds();

        let registry = borrow_global_mut<LockRegistry>(@lilipad);
        assert!(table::contains(&registry.locks, lock_id), constants::e_lock_not_found());

        let lock = table::borrow_mut(&mut registry.locks, lock_id);

        // Validate permissions and state
        assert!(lock.locker == requester_addr, constants::e_not_locker());
        assert!(now >= lock.unlock_ts, constants::e_lock_not_expired());
        assert!(!lock.withdrawn, constants::e_already_withdrawn());

        // Mark as withdrawn
        lock.withdrawn = true;

        // Transfer tokens if escrowed
        if (lock.escrowed && lock.kind == LOCK_KIND_FUNGIBLE) {
            escrow::withdraw_locked_tokens(lock_id, requester_addr, lock.amount);
        };

        events::emit_lock_withdrawn(
            lock_id,
            requester_addr,
            lock.amount,
        );

        // Note: For LP locks, client must handle the actual LP withdrawal/unlock
        // The on-chain state change only records that the lock period has expired
    }

    // ========================================
    // Helper Functions
    // ========================================

    /// Convert token address to bytes for asset_ref
    fun token_address_to_bytes(token: address): vector<u8> {
        // Simple conversion: use address as bytes
        // In production, you might want a more sophisticated encoding
        std::bcs::to_bytes(&token)
    }

    // ========================================
    // View Functions
    // ========================================

    #[view]
    public fun get_lock(lock_id: u64): (
        u64,                    // id
        address,                // locker
        Option<vector<u8>>,     // project_pointer_opt
        vector<u8>,             // asset_ref
        u128,                   // amount
        u8,                     // kind
        u64,                    // unlock_ts
        bool,                   // withdrawn
        bool,                   // escrowed
        Option<vector<u8>>,     // metadata_opt
    ) acquires LockRegistry {
        let registry = borrow_global<LockRegistry>(@lilipad);
        assert!(table::contains(&registry.locks, lock_id), constants::e_lock_not_found());

        let lock = table::borrow(&registry.locks, lock_id);
        (
            lock.id,
            lock.locker,
            lock.project_pointer_opt,
            lock.asset_ref,
            lock.amount,
            lock.kind,
            lock.unlock_ts,
            lock.withdrawn,
            lock.escrowed,
            lock.metadata_opt,
        )
    }

    #[view]
    public fun get_lock_counter(): u64 acquires LockRegistry {
        let registry = borrow_global<LockRegistry>(@lilipad);
        registry.lock_counter
    }

    #[view]
    public fun is_unlocked(lock_id: u64): bool acquires LockRegistry {
        let registry = borrow_global<LockRegistry>(@lilipad);
        assert!(table::contains(&registry.locks, lock_id), constants::e_lock_not_found());

        let lock = table::borrow(&registry.locks, lock_id);
        let now = timestamp::now_seconds();
        now >= lock.unlock_ts
    }

    #[view]
    public fun lock_kind_fungible(): u8 {
        LOCK_KIND_FUNGIBLE
    }

    #[view]
    public fun lock_kind_lp(): u8 {
        LOCK_KIND_LP
    }

    // ========================================
    // Test-only Functions
    // ========================================

    #[test_only]
    public fun init_locking_for_test(account: &signer) {
        init_locking(account);
    }
}
