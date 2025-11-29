#[test_only]
module lilipad::lilipad_tests {
    use std::signer;
    use std::option;
    use aptos_framework::timestamp;
    use aptos_framework::account;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use lilipad::init;
    use lilipad::constants;
    use lilipad::launchpad;
    use lilipad::vesting;
    use lilipad::locking;
    use lilipad::escrow;

    // Test helper: setup test environment
    fun setup_test(
        framework: &signer,
        admin: &signer,
    ) {
        // Create accounts
        account::create_account_for_test(signer::address_of(admin));

        // Initialize timestamp
        timestamp::set_time_has_started_for_testing(framework);

        // Initialize AptosCoin
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(framework);

        // Initialize Lilipad modules
        init::init_module_for_test(admin);

        // Cleanup capabilities
        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    // Test helper: mint APT to an account
    fun mint_apt(_framework: &signer, to: address, amount: u64) {
        aptos_coin::mint(_framework, to, amount);
    }

    // ========================================
    // LAUNCHPAD TESTS
    // ========================================

    #[test(framework = @0x1, admin = @lilipad, owner = @0x123)]
    fun test_create_sale_success(
        framework: &signer,
        admin: &signer,
        owner: &signer,
    ) {
        setup_test(framework, admin);
        account::create_account_for_test(signer::address_of(owner));

        let now = timestamp::now_seconds();
        let start = now + 100;
        let end = start + 3600;

        // Create sale
        launchpad::create_sale(
            owner,
            option::some(b"QmTestHash123"),
            @0x456,
            1000000,
            1000,
            start,
            end,
            500000,
        );

        // Verify sale
        let (
            id,
            _project_pointer,
            sale_owner,
            token,
            total_tokens,
            tokens_sold,
            price,
            _start,
            _end,
            soft_cap,
            raised,
            escrowed,
            soft_cap_reached
        ) = launchpad::get_sale(0);

        assert!(id == 0, 1);
        assert!(sale_owner == signer::address_of(owner), 2);
        assert!(token == @0x456, 3);
        assert!(total_tokens == 1000000, 4);
        assert!(tokens_sold == 0, 5);
        assert!(price == 1000, 6);
        assert!(soft_cap == 500000, 7);
        assert!(raised == 0, 8);
        assert!(!escrowed, 9); // Not escrowed yet
        assert!(!soft_cap_reached, 10);
    }

    #[test(framework = @0x1, admin = @lilipad, owner = @0x123)]
    fun test_deposit_sale_tokens(
        framework: &signer,
        admin: &signer,
        owner: &signer,
    ) {
        setup_test(framework, admin);
        account::create_account_for_test(signer::address_of(owner));

        let now = timestamp::now_seconds();
        let start = now + 100;
        let end = start + 3600;

        // Create sale
        launchpad::create_sale(
            owner,
            option::none(),
            @0x456,
            1000000,
            1000,
            start,
            end,
            500000,
        );

        // Deposit tokens
        launchpad::deposit_sale_tokens(owner, 0, 1000000);

        // Verify escrow balance
        let (token_balance, _apt_balance) = escrow::get_sale_escrow_balance(0);
        assert!(token_balance == 1000000, 1);

        // Verify sale is now escrowed
        let (
            _id, _pp, _owner, _token, _total, _sold, _price, _start, _end, _soft_cap, _raised, escrowed, _scr
        ) = launchpad::get_sale(0);
        assert!(escrowed, 2);
    }

    #[test(framework = @0x1, admin = @lilipad, owner = @0x123, buyer = @0x789)]
    #[expected_failure(abort_code = 21)] // E_SALE_NOT_ESCROWED
    fun test_buy_fails_if_not_escrowed(
        framework: &signer,
        admin: &signer,
        owner: &signer,
        buyer: &signer,
    ) {
        setup_test(framework, admin);
        account::create_account_for_test(signer::address_of(owner));
        account::create_account_for_test(signer::address_of(buyer));

        let now = timestamp::now_seconds();

        // Create sale
        launchpad::create_sale(
            owner,
            option::none(),
            @0x456,
            1000000,
            1000,
            now,
            now + 3600,
            500000,
        );

        // Mint APT to buyer
        mint_apt(framework, signer::address_of(buyer), 100000);

        // Try to buy without depositing tokens first - should fail
        launchpad::buy(buyer, 0, 10000, 300);
    }

    #[test(framework = @0x1, admin = @lilipad, owner = @0x123, buyer = @0x789)]
    fun test_buy_success_atomic(
        framework: &signer,
        admin: &signer,
        owner: &signer,
        buyer: &signer,
    ) {
        setup_test(framework, admin);
        account::create_account_for_test(signer::address_of(owner));
        account::create_account_for_test(signer::address_of(buyer));

        let now = timestamp::now_seconds();

        // Create sale
        // Price: 1 token = 100 octas (0.000001 APT)
        // So price_per_token = 100 * 1_000_000_000 / 1 = 100_000_000_000
        let price_per_token = 100_000_000_000u128; // 100 octas per token
        launchpad::create_sale(
            owner,
            option::none(),
            @0x456,
            1000000,
            price_per_token,
            now,
            now + 3600,
            500000,
        );

        // Deposit tokens
        launchpad::deposit_sale_tokens(owner, 0, 1000000);

        // Mint APT to buyer
        let apt_amount = 10000u64; // 10000 octas
        mint_apt(framework, signer::address_of(buyer), apt_amount);

        // Buy tokens
        launchpad::buy(buyer, 0, apt_amount, 300);

        // Verify sale state
        let (
            _id, _pp, _owner, _token, _total, tokens_sold, _price, _start, _end, _soft_cap, raised, _escrowed, _scr
        ) = launchpad::get_sale(0);

        // tokens_bought = (apt_amount * PRECISION) / price_per_token
        // = (10000 * 1_000_000_000) / 100_000_000_000 = 100
        let expected_tokens = (apt_amount as u128) * constants::price_precision() / price_per_token;
        assert!(tokens_sold == expected_tokens, 1);
        assert!(raised == (apt_amount as u128), 2);

        // Verify stream was created
        let stream_id = 0u64;
        let (
            _sid, _sowner, beneficiary, token, total_amount, _start, _end, claimed, escrowed, _metadata
        ) = vesting::get_stream(stream_id);

        assert!(beneficiary == signer::address_of(buyer), 3);
        assert!(token == @0x456, 4);
        assert!(total_amount == expected_tokens, 5);
        assert!(claimed == 0, 6);
        assert!(escrowed, 7);
    }

    #[test(framework = @0x1, admin = @lilipad, owner = @0x123, buyer = @0x789)]
    fun test_soft_cap_reached(
        framework: &signer,
        admin: &signer,
        owner: &signer,
        buyer: &signer,
    ) {
        setup_test(framework, admin);
        account::create_account_for_test(signer::address_of(owner));
        account::create_account_for_test(signer::address_of(buyer));

        let now = timestamp::now_seconds();
        let soft_cap = 10000u128;
        let price_per_token = 100_000_000_000u128; // 100 octas per token

        // Create sale with low soft cap
        launchpad::create_sale(
            owner,
            option::none(),
            @0x456,
            1000000,
            price_per_token,
            now,
            now + 3600,
            soft_cap,
        );

        // Deposit tokens
        launchpad::deposit_sale_tokens(owner, 0, 1000000);

        // Mint and buy enough to reach soft cap
        let apt_amount = 10000u64;
        mint_apt(framework, signer::address_of(buyer), apt_amount);
        launchpad::buy(buyer, 0, apt_amount, 300);

        // Verify soft cap reached
        let (
            _id, _pp, _owner, _token, _total, _sold, _price, _start, _end, _sc, raised, _escrowed, soft_cap_reached
        ) = launchpad::get_sale(0);

        assert!(raised >= soft_cap, 1);
        assert!(soft_cap_reached, 2);
    }

    #[test(framework = @0x1, admin = @lilipad, owner = @0x123, buyer = @0x789)]
    fun test_withdraw_proceeds(
        framework: &signer,
        admin: &signer,
        owner: &signer,
        buyer: &signer,
    ) {
        setup_test(framework, admin);
        account::create_account_for_test(signer::address_of(owner));
        account::create_account_for_test(signer::address_of(buyer));

        let now = timestamp::now_seconds();
        let price_per_token = 100_000_000_000u128; // 100 octas per token

        // Create sale
        launchpad::create_sale(
            owner,
            option::none(),
            @0x456,
            1000000,
            price_per_token,
            now,
            now + 3600,
            500000,
        );

        // Deposit tokens
        launchpad::deposit_sale_tokens(owner, 0, 1000000);

        // Buy tokens
        let apt_amount = 10000u64;
        mint_apt(framework, signer::address_of(buyer), apt_amount);
        launchpad::buy(buyer, 0, apt_amount, 300);

        // Fast forward past sale end
        timestamp::fast_forward_seconds(3601);

        // Withdraw proceeds
        let initial_balance = coin::balance<AptosCoin>(signer::address_of(owner));
        launchpad::withdraw_proceeds(owner, 0, signer::address_of(owner));
        let final_balance = coin::balance<AptosCoin>(signer::address_of(owner));

        assert!(final_balance - initial_balance == apt_amount, 1);
    }

    // ========================================
    // VESTING TESTS
    // ========================================

    #[test(framework = @0x1, admin = @lilipad, owner = @0x123, beneficiary = @0x789)]
    fun test_create_stream_with_deposit(
        framework: &signer,
        admin: &signer,
        owner: &signer,
        beneficiary: &signer,
    ) {
        setup_test(framework, admin);
        account::create_account_for_test(signer::address_of(owner));
        account::create_account_for_test(signer::address_of(beneficiary));

        let now = timestamp::now_seconds();

        // Create stream
        vesting::create_stream_with_deposit(
            owner,
            signer::address_of(beneficiary),
            @0x456,
            1000000,
            now,
            now + 300,
            option::none(),
        );

        // Verify stream
        let (
            id, stream_owner, ben, token, total, start, end, claimed, escrowed, _metadata
        ) = vesting::get_stream(0);

        assert!(id == 0, 1);
        assert!(stream_owner == signer::address_of(owner), 2);
        assert!(ben == signer::address_of(beneficiary), 3);
        assert!(token == @0x456, 4);
        assert!(total == 1000000, 5);
        assert!(start == now, 6);
        assert!(end == now + 300, 7);
        assert!(claimed == 0, 8);
        assert!(escrowed, 9);
    }

    #[test(framework = @0x1, admin = @lilipad, owner = @0x123, beneficiary = @0x789)]
    #[expected_failure(abort_code = 15)] // E_NO_CLAIMABLE
    fun test_claim_before_start_fails(
        framework: &signer,
        admin: &signer,
        owner: &signer,
        beneficiary: &signer,
    ) {
        setup_test(framework, admin);
        account::create_account_for_test(signer::address_of(owner));
        account::create_account_for_test(signer::address_of(beneficiary));

        let now = timestamp::now_seconds();

        // Create stream starting in future
        vesting::create_stream_with_deposit(
            owner,
            signer::address_of(beneficiary),
            @0x456,
            1000000,
            now + 100,
            now + 400,
            option::none(),
        );

        // Try to claim before start - should fail
        vesting::claim(beneficiary, 0);
    }

    #[test(framework = @0x1, admin = @lilipad, owner = @0x123, beneficiary = @0x789)]
    fun test_claim_partial(
        framework: &signer,
        admin: &signer,
        owner: &signer,
        beneficiary: &signer,
    ) {
        setup_test(framework, admin);
        account::create_account_for_test(signer::address_of(owner));
        account::create_account_for_test(signer::address_of(beneficiary));

        let now = timestamp::now_seconds();
        let duration = 300u64;
        let total_amount = 1000000u128;

        // Create stream
        vesting::create_stream_with_deposit(
            owner,
            signer::address_of(beneficiary),
            @0x456,
            total_amount,
            now,
            now + duration,
            option::none(),
        );

        // Fast forward to 50% vesting
        timestamp::fast_forward_seconds(duration / 2);

        // Claim
        vesting::claim(beneficiary, 0);

        // Verify claimed amount (should be ~50%)
        let (
            _id, _owner, _ben, _token, _total, _start, _end, claimed, _escrowed, _metadata
        ) = vesting::get_stream(0);

        let expected_claimed = total_amount / 2;
        assert!(claimed == expected_claimed, 1);

        // Verify claimable is now 0 (just claimed)
        let claimable = vesting::get_claimable(0);
        assert!(claimable == 0, 2);
    }

    #[test(framework = @0x1, admin = @lilipad, owner = @0x123, beneficiary = @0x789)]
    fun test_claim_full_after_end(
        framework: &signer,
        admin: &signer,
        owner: &signer,
        beneficiary: &signer,
    ) {
        setup_test(framework, admin);
        account::create_account_for_test(signer::address_of(owner));
        account::create_account_for_test(signer::address_of(beneficiary));

        let now = timestamp::now_seconds();
        let duration = 300u64;
        let total_amount = 1000000u128;

        // Create stream
        vesting::create_stream_with_deposit(
            owner,
            signer::address_of(beneficiary),
            @0x456,
            total_amount,
            now,
            now + duration,
            option::none(),
        );

        // Fast forward past end
        timestamp::fast_forward_seconds(duration + 1);

        // Claim all
        vesting::claim(beneficiary, 0);

        // Verify full amount claimed
        let (
            _id, _owner, _ben, _token, _total, _start, _end, claimed, _escrowed, _metadata
        ) = vesting::get_stream(0);

        assert!(claimed == total_amount, 1);
    }

    // ========================================
    // LOCKING TESTS
    // ========================================

    #[test(framework = @0x1, admin = @lilipad, locker = @0x123)]
    fun test_create_fungible_lock(
        framework: &signer,
        admin: &signer,
        locker: &signer,
    ) {
        setup_test(framework, admin);
        account::create_account_for_test(signer::address_of(locker));

        let now = timestamp::now_seconds();
        let unlock_ts = now + 86400; // 1 day

        // Create lock
        locking::create_lock_with_deposit(
            locker,
            option::some(b"QmProject123"),
            @0x456,
            1000000,
            unlock_ts,
            option::none(),
        );

        // Verify lock
        let (
            id, lock_locker, _pp, _asset_ref, amount, kind, unlock, withdrawn, escrowed, _metadata
        ) = locking::get_lock(0);

        assert!(id == 0, 1);
        assert!(lock_locker == signer::address_of(locker), 2);
        assert!(amount == 1000000, 3);
        assert!(kind == locking::lock_kind_fungible(), 4);
        assert!(unlock == unlock_ts, 5);
        assert!(!withdrawn, 6);
        assert!(escrowed, 7);
    }

    #[test(framework = @0x1, admin = @lilipad, locker = @0x123)]
    fun test_create_lp_lock(
        framework: &signer,
        admin: &signer,
        locker: &signer,
    ) {
        setup_test(framework, admin);
        account::create_account_for_test(signer::address_of(locker));

        let now = timestamp::now_seconds();
        let unlock_ts = now + 86400;

        // Create LP lock
        locking::create_lock_for_lp(
            locker,
            option::some(b"QmProject123"),
            b"hyperion_pool_xyz",
            50000,
            unlock_ts,
            option::some(b"tx_hash: 0xabc123, explorer: https://..."),
        );

        // Verify lock
        let (
            id, lock_locker, _pp, asset_ref, amount, kind, unlock, withdrawn, escrowed, metadata
        ) = locking::get_lock(0);

        assert!(id == 0, 1);
        assert!(lock_locker == signer::address_of(locker), 2);
        assert!(asset_ref == b"hyperion_pool_xyz", 3);
        assert!(amount == 50000, 4);
        assert!(kind == locking::lock_kind_lp(), 5);
        assert!(unlock == unlock_ts, 6);
        assert!(!withdrawn, 7);
        assert!(!escrowed, 8); // LP locks are not escrowed on-chain
        assert!(option::is_some(&metadata), 9);
    }

    #[test(framework = @0x1, admin = @lilipad, locker = @0x123)]
    #[expected_failure(abort_code = 17)] // E_LOCK_NOT_EXPIRED
    fun test_withdraw_locked_before_unlock_fails(
        framework: &signer,
        admin: &signer,
        locker: &signer,
    ) {
        setup_test(framework, admin);
        account::create_account_for_test(signer::address_of(locker));

        let now = timestamp::now_seconds();
        let unlock_ts = now + 86400;

        // Create lock
        locking::create_lock_with_deposit(
            locker,
            option::none(),
            @0x456,
            1000000,
            unlock_ts,
            option::none(),
        );

        // Try to withdraw before unlock - should fail
        locking::withdraw_locked(locker, 0);
    }

    #[test(framework = @0x1, admin = @lilipad, locker = @0x123)]
    fun test_withdraw_locked_after_unlock(
        framework: &signer,
        admin: &signer,
        locker: &signer,
    ) {
        setup_test(framework, admin);
        account::create_account_for_test(signer::address_of(locker));

        let now = timestamp::now_seconds();
        let unlock_duration = 86400u64;

        // Create lock
        locking::create_lock_with_deposit(
            locker,
            option::none(),
            @0x456,
            1000000,
            now + unlock_duration,
            option::none(),
        );

        // Fast forward past unlock
        timestamp::fast_forward_seconds(unlock_duration + 1);

        // Withdraw
        locking::withdraw_locked(locker, 0);

        // Verify withdrawn
        let (
            _id, _locker, _pp, _asset_ref, _amount, _kind, _unlock, withdrawn, _escrowed, _metadata
        ) = locking::get_lock(0);

        assert!(withdrawn, 1);
    }
}
