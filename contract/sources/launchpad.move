module lilipad::launchpad {
    use std::signer;
    use std::option::{Self, Option};
    use aptos_framework::timestamp;
    use aptos_std::table::{Self, Table};
    use lilipad::constants;
    use lilipad::events;
    use lilipad::escrow;
    use lilipad::vesting;

    /// Sale resource
    struct Sale has store, drop {
        id: u64,
        project_pointer_opt: Option<vector<u8>>, // Optional IPFS CID or hash
        owner: address,
        token: address,
        total_tokens: u128,
        tokens_sold: u128,
        price_per_token: u128, // APT per token (scaled by PRICE_PRECISION)
        start_ts: u64,
        end_ts: u64,
        soft_cap: u128,
        raised_apt: u128,
        escrowed: bool,
        soft_cap_reached: bool,
    }

    /// Global sale registry
    struct SaleRegistry has key {
        sale_counter: u64,
        sales: Table<u64, Sale>,
    }

    /// Initialize launchpad module
    public fun init_launchpad(account: &signer) {
        let addr = signer::address_of(account);
        assert!(!exists<SaleRegistry>(addr), constants::e_already_initialized());

        move_to(account, SaleRegistry {
            sale_counter: 0,
            sales: table::new(),
        });
    }

    /// Create a new sale (deposit-first model: owner must deposit tokens before buyers can purchase)
    public entry fun create_sale(
        owner: &signer,
        project_pointer_opt: Option<vector<u8>>,
        token: address,
        total_tokens: u128,
        price_per_token: u128,
        start_ts: u64,
        end_ts: u64,
        soft_cap: u128,
    ) acquires SaleRegistry {
        let owner_addr = signer::address_of(owner);

        // Validate parameters
        assert!(token != @0x0, constants::e_invalid_token());
        assert!(start_ts < end_ts, constants::e_invalid_time_range());
        assert!(price_per_token > 0, constants::e_invalid_price());
        assert!(total_tokens > 0, constants::e_invalid_amount());

        let registry = borrow_global_mut<SaleRegistry>(@lilipad);

        let sale_id = registry.sale_counter;
        registry.sale_counter = sale_id + 1;

        // Create sale (initially not escrowed)
        let sale = Sale {
            id: sale_id,
            project_pointer_opt,
            owner: owner_addr,
            token,
            total_tokens,
            tokens_sold: 0,
            price_per_token,
            start_ts,
            end_ts,
            soft_cap,
            raised_apt: 0,
            escrowed: false,
            soft_cap_reached: false,
        };

        table::add(&mut registry.sales, sale_id, sale);

        // Create escrow bucket
        escrow::create_sale_bucket(sale_id, token);

        events::emit_sale_created(
            sale_id,
            owner_addr,
            project_pointer_opt,
            token,
            total_tokens,
            price_per_token,
            start_ts,
            end_ts,
            soft_cap,
        );
    }

    /// Deposit tokens into sale escrow (owner must call this before sale can accept buyers)
    public entry fun deposit_sale_tokens(
        depositor: &signer,
        sale_id: u64,
        amount: u128,
    ) acquires SaleRegistry {
        let depositor_addr = signer::address_of(depositor);

        let registry = borrow_global_mut<SaleRegistry>(@lilipad);
        assert!(table::contains(&registry.sales, sale_id), constants::e_sale_not_found());

        let sale = table::borrow_mut(&mut registry.sales, sale_id);
        assert!(sale.owner == depositor_addr, constants::e_not_owner());

        // Record deposit
        escrow::deposit_sale_tokens_record(sale_id, depositor_addr, sale.token, amount);

        // Check if fully escrowed
        let (token_balance, _apt_balance) = escrow::get_sale_escrow_balance(sale_id);
        if (token_balance >= sale.total_tokens) {
            sale.escrowed = true;
        };
    }

    /// Buy tokens from a sale (atomic: transfer APT + create vesting stream)
    public entry fun buy(
        buyer: &signer,
        sale_id: u64,
        apt_amount: u64,
        vesting_duration_secs: u64,
    ) acquires SaleRegistry {
        let buyer_addr = signer::address_of(buyer);
        let now = timestamp::now_seconds();

        let registry = borrow_global_mut<SaleRegistry>(@lilipad);
        assert!(table::contains(&registry.sales, sale_id), constants::e_sale_not_found());

        let sale = table::borrow_mut(&mut registry.sales, sale_id);

        // Validate sale state
        assert!(sale.escrowed, constants::e_sale_not_escrowed());
        assert!(now >= sale.start_ts, constants::e_sale_not_started());
        assert!(now <= sale.end_ts, constants::e_sale_ended());

        // Calculate tokens bought
        let apt_amount_u128 = (apt_amount as u128);
        let tokens_bought = (apt_amount_u128 * constants::price_precision()) / sale.price_per_token;

        assert!(tokens_bought > 0, constants::e_zero_tokens_bought());
        assert!(tokens_bought <= (sale.total_tokens - sale.tokens_sold), constants::e_insufficient_tokens());

        // Transfer APT from buyer to escrow (ATOMIC)
        escrow::deposit_apt_for_sale(buyer, sale_id, apt_amount);

        // Update sale state
        sale.raised_apt = sale.raised_apt + apt_amount_u128;
        sale.tokens_sold = sale.tokens_sold + tokens_bought;

        // Check soft cap
        if (sale.raised_apt >= sale.soft_cap && !sale.soft_cap_reached) {
            sale.soft_cap_reached = true;
            events::emit_sale_soft_cap_reached(
                sale_id,
                sale.raised_apt,
                sale.soft_cap,
                now,
            );
        };

        // Create vesting stream (ATOMIC with buy)
        let stream_id = vesting::create_stream_from_sale(
            sale_id,
            buyer_addr,
            sale.token,
            tokens_bought,
            now,
            now + vesting_duration_secs,
            option::none(),
        );

        // Emit bought event
        events::emit_bought(
            sale_id,
            buyer_addr,
            tokens_bought,
            apt_amount_u128,
            stream_id,
        );
    }

    /// Withdraw sale proceeds (APT) after sale ends
    public entry fun withdraw_proceeds(
        owner: &signer,
        sale_id: u64,
        to: address,
    ) acquires SaleRegistry {
        let owner_addr = signer::address_of(owner);
        let now = timestamp::now_seconds();

        let registry = borrow_global_mut<SaleRegistry>(@lilipad);
        assert!(table::contains(&registry.sales, sale_id), constants::e_sale_not_found());

        let sale = table::borrow_mut(&mut registry.sales, sale_id);
        assert!(sale.owner == owner_addr, constants::e_not_owner());
        assert!(now > sale.end_ts, constants::e_sale_not_ended());

        let amount = sale.raised_apt;
        assert!(amount > 0, constants::e_invalid_amount());

        // Withdraw APT from escrow
        escrow::withdraw_sale_apt(sale_id, to, amount);

        // Update sale state
        sale.raised_apt = 0;

        events::emit_proceeds_withdrawn(sale_id, to, amount);
    }

    // ========================================
    // View Functions
    // ========================================

    #[view]
    public fun get_sale(sale_id: u64): (
        u64,                    // id
        Option<vector<u8>>,     // project_pointer_opt
        address,                // owner
        address,                // token
        u128,                   // total_tokens
        u128,                   // tokens_sold
        u128,                   // price_per_token
        u64,                    // start_ts
        u64,                    // end_ts
        u128,                   // soft_cap
        u128,                   // raised_apt
        bool,                   // escrowed
        bool,                   // soft_cap_reached
    ) acquires SaleRegistry {
        let registry = borrow_global<SaleRegistry>(@lilipad);
        assert!(table::contains(&registry.sales, sale_id), constants::e_sale_not_found());

        let sale = table::borrow(&registry.sales, sale_id);
        (
            sale.id,
            sale.project_pointer_opt,
            sale.owner,
            sale.token,
            sale.total_tokens,
            sale.tokens_sold,
            sale.price_per_token,
            sale.start_ts,
            sale.end_ts,
            sale.soft_cap,
            sale.raised_apt,
            sale.escrowed,
            sale.soft_cap_reached,
        )
    }

    #[view]
    public fun get_sale_counter(): u64 acquires SaleRegistry {
        let registry = borrow_global<SaleRegistry>(@lilipad);
        registry.sale_counter
    }

    #[view]
    public fun compute_tokens_for_apt(apt_amount: u128, price_per_token: u128): u128 {
        (apt_amount * constants::price_precision()) / price_per_token
    }

    // ========================================
    // Test-only Functions
    // ========================================

    #[test_only]
    public fun init_launchpad_for_test(account: &signer) {
        init_launchpad(account);
    }
}
