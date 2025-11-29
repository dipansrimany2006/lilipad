module lilipad::vesting {
    use std::signer;
    use std::option::{Self, Option};
    use aptos_framework::timestamp;
    use aptos_std::table::{Self, Table};
    use lilipad::constants;
    use lilipad::events;
    use lilipad::escrow;

    friend lilipad::launchpad;

    /// Vesting stream resource
    struct Stream has store, drop, copy {
        id: u64,
        owner: address,          // Creator of the stream
        beneficiary: address,    // Recipient of vested tokens
        token: address,
        total_amount: u128,
        start_ts: u64,
        end_ts: u64,
        claimed: u128,
        escrowed: bool,
        metadata_opt: Option<vector<u8>>, // Optional metadata (e.g., sale reference)
    }

    /// Global stream registry
    struct StreamRegistry has key {
        stream_counter: u64,
        streams: Table<u64, Stream>,
    }

    /// Initialize vesting module
    public fun init_vesting(account: &signer) {
        let addr = signer::address_of(account);
        assert!(!exists<StreamRegistry>(addr), constants::e_already_initialized());

        move_to(account, StreamRegistry {
            stream_counter: 0,
            streams: table::new(),
        });
    }

    /// Create a vesting stream with token deposit (atomic deposit variant)
    public entry fun create_stream_with_deposit(
        owner: &signer,
        beneficiary: address,
        token: address,
        total_amount: u128,
        start_ts: u64,
        end_ts: u64,
        metadata_opt: Option<vector<u8>>,
    ) acquires StreamRegistry {
        let owner_addr = signer::address_of(owner);

        // Validate parameters
        assert!(token != @0x0, constants::e_invalid_token());
        assert!(start_ts < end_ts, constants::e_invalid_time_range());
        assert!(total_amount > 0, constants::e_invalid_amount());

        let registry = borrow_global_mut<StreamRegistry>(@lilipad);

        let stream_id = registry.stream_counter;
        registry.stream_counter = stream_id + 1;

        // Create stream
        let stream = Stream {
            id: stream_id,
            owner: owner_addr,
            beneficiary,
            token,
            total_amount,
            start_ts,
            end_ts,
            claimed: 0,
            escrowed: true,
            metadata_opt,
        };

        table::add(&mut registry.streams, stream_id, stream);

        // Deposit tokens to vesting escrow
        escrow::create_vesting_bucket_with_deposit(
            stream_id,
            owner_addr,
            token,
            total_amount,
        );

        events::emit_stream_created(
            stream_id,
            owner_addr,
            beneficiary,
            token,
            total_amount,
            start_ts,
            end_ts,
            metadata_opt,
        );
    }

    /// Create a stream from a sale purchase (friend function, called by launchpad)
    /// Tokens are transferred from sale escrow to vesting escrow atomically
    public(friend) fun create_stream_from_sale(
        sale_id: u64,
        beneficiary: address,
        token: address,
        total_amount: u128,
        start_ts: u64,
        end_ts: u64,
        metadata_opt: Option<vector<u8>>,
    ): u64 acquires StreamRegistry {
        let registry = borrow_global_mut<StreamRegistry>(@lilipad);

        let stream_id = registry.stream_counter;
        registry.stream_counter = stream_id + 1;

        // Create stream
        let stream = Stream {
            id: stream_id,
            owner: @lilipad, // Sale contract is the owner
            beneficiary,
            token,
            total_amount,
            start_ts,
            end_ts,
            claimed: 0,
            escrowed: true,
            metadata_opt,
        };

        table::add(&mut registry.streams, stream_id, stream);

        // Transfer tokens from sale escrow to vesting escrow (ATOMIC)
        escrow::transfer_sale_to_vesting(sale_id, stream_id, token, total_amount);

        events::emit_stream_created(
            stream_id,
            @lilipad,
            beneficiary,
            token,
            total_amount,
            start_ts,
            end_ts,
            metadata_opt,
        );

        stream_id
    }

    /// Claim vested tokens from a stream
    public entry fun claim(
        beneficiary: &signer,
        stream_id: u64,
    ) acquires StreamRegistry {
        let beneficiary_addr = signer::address_of(beneficiary);
        let now = timestamp::now_seconds();

        let registry = borrow_global_mut<StreamRegistry>(@lilipad);
        assert!(table::contains(&registry.streams, stream_id), constants::e_stream_not_found());

        let stream = table::borrow_mut(&mut registry.streams, stream_id);
        assert!(stream.beneficiary == beneficiary_addr, constants::e_not_beneficiary());
        assert!(stream.escrowed, constants::e_stream_not_escrowed());

        // Compute claimable amount
        let unlocked = compute_unlocked(stream, now);
        let claimable = unlocked - stream.claimed;

        assert!(claimable > 0, constants::e_no_claimable());

        // Update stream state
        stream.claimed = stream.claimed + claimable;

        // Transfer tokens from vesting escrow to beneficiary
        escrow::transfer_vesting_to_beneficiary(stream_id, beneficiary_addr, claimable);

        events::emit_claimed(
            stream_id,
            beneficiary_addr,
            stream.token,
            claimable,
        );
    }

    // ========================================
    // Helper Functions
    // ========================================

    /// Compute unlocked tokens for a stream at a given time (linear vesting)
    fun compute_unlocked(stream: &Stream, now: u64): u128 {
        if (now <= stream.start_ts) {
            0
        } else if (now >= stream.end_ts) {
            stream.total_amount
        } else {
            // Linear vesting: unlocked = total_amount * (now - start_ts) / (end_ts - start_ts)
            let elapsed = ((now - stream.start_ts) as u128);
            let duration = ((stream.end_ts - stream.start_ts) as u128);
            (stream.total_amount * elapsed) / duration
        }
    }

    // ========================================
    // View Functions
    // ========================================

    #[view]
    public fun get_stream(stream_id: u64): (
        u64,                    // id
        address,                // owner
        address,                // beneficiary
        address,                // token
        u128,                   // total_amount
        u64,                    // start_ts
        u64,                    // end_ts
        u128,                   // claimed
        bool,                   // escrowed
        Option<vector<u8>>,     // metadata_opt
    ) acquires StreamRegistry {
        let registry = borrow_global<StreamRegistry>(@lilipad);
        assert!(table::contains(&registry.streams, stream_id), constants::e_stream_not_found());

        let stream = table::borrow(&registry.streams, stream_id);
        (
            stream.id,
            stream.owner,
            stream.beneficiary,
            stream.token,
            stream.total_amount,
            stream.start_ts,
            stream.end_ts,
            stream.claimed,
            stream.escrowed,
            stream.metadata_opt,
        )
    }

    #[view]
    public fun get_claimable(stream_id: u64): u128 acquires StreamRegistry {
        let registry = borrow_global<StreamRegistry>(@lilipad);
        assert!(table::contains(&registry.streams, stream_id), constants::e_stream_not_found());

        let stream = table::borrow(&registry.streams, stream_id);
        let now = timestamp::now_seconds();
        let unlocked = compute_unlocked(stream, now);
        unlocked - stream.claimed
    }

    #[view]
    public fun get_stream_counter(): u64 acquires StreamRegistry {
        let registry = borrow_global<StreamRegistry>(@lilipad);
        registry.stream_counter
    }

    // ========================================
    // Test-only Functions
    // ========================================

    #[test_only]
    public fun init_vesting_for_test(account: &signer) {
        init_vesting(account);
    }

    #[test_only]
    public fun compute_unlocked_test(stream: &Stream, now: u64): u128 {
        compute_unlocked(stream, now)
    }
}
