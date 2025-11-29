module lilipad::token {
    use std::signer;
    use std::string::{Self, String};
    use std::option;
    use aptos_framework::object::{Self, Object};
    use aptos_framework::fungible_asset::{Self, MintRef, TransferRef, BurnRef, Metadata, FungibleAsset};
    use aptos_framework::primary_fungible_store;
    use aptos_std::table::{Self, Table};
    use lilipad::constants;
    use lilipad::events;

    /// Token metadata and references
    struct TokenRefs has key {
        mint_ref: MintRef,
        transfer_ref: TransferRef,
        burn_ref: BurnRef,
    }

    /// Token registry to track created tokens
    struct TokenRegistry has key {
        token_counter: u64,
        tokens: Table<address, TokenInfo>,
    }

    /// Information about a created token
    struct TokenInfo has store, drop {
        creator: address,
        metadata: address,
        name: String,
        symbol: String,
        decimals: u8,
        icon_uri: String,
        project_uri: String,
        total_supply: u64,
        max_supply: u64, // 0 means unlimited
    }

    /// Initialize token module
    public fun init_token(account: &signer) {
        let addr = signer::address_of(account);
        assert!(!exists<TokenRegistry>(addr), constants::e_already_initialized());

        move_to(account, TokenRegistry {
            token_counter: 0,
            tokens: table::new(),
        });
    }

    /// Create a new fungible asset token (internal function)
    /// Returns the metadata object address (this is the "token address" used in launchpad)
    fun create_token_internal(
        creator: &signer,
        name: String,
        symbol: String,
        decimals: u8,
        icon_uri: String,
        project_uri: String,
        initial_supply: u64,
        max_supply: u64, // 0 for unlimited
    ): address acquires TokenRegistry, TokenRefs {
        let creator_addr = signer::address_of(creator);

        // Create named object for the fungible asset
        let constructor_ref = &object::create_named_object(
            creator,
            *string::bytes(&symbol),
        );

        // Initialize fungible asset with metadata
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            constructor_ref,
            option::some(max_supply as u128),
            name,
            symbol,
            decimals,
            icon_uri,
            project_uri,
        );

        // Get metadata object
        let metadata_object = object::object_from_constructor_ref<Metadata>(constructor_ref);
        let metadata_addr = object::object_address(&metadata_object);

        // Generate refs for minting, transferring, and burning
        let mint_ref = fungible_asset::generate_mint_ref(constructor_ref);
        let transfer_ref = fungible_asset::generate_transfer_ref(constructor_ref);
        let burn_ref = fungible_asset::generate_burn_ref(constructor_ref);

        // Store refs in the metadata object
        let metadata_signer = &object::generate_signer(constructor_ref);
        move_to(metadata_signer, TokenRefs {
            mint_ref,
            transfer_ref,
            burn_ref,
        });

        // Mint initial supply to creator
        if (initial_supply > 0) {
            let fa = fungible_asset::mint(&borrow_global<TokenRefs>(metadata_addr).mint_ref, (initial_supply as u64));
            primary_fungible_store::deposit(creator_addr, fa);
        };

        // Register token in registry
        let registry = borrow_global_mut<TokenRegistry>(@lilipad);
        let token_id = registry.token_counter;
        registry.token_counter = token_id + 1;

        let token_info = TokenInfo {
            creator: creator_addr,
            metadata: metadata_addr,
            name,
            symbol,
            decimals,
            icon_uri,
            project_uri,
            total_supply: initial_supply,
            max_supply,
        };

        table::add(&mut registry.tokens, metadata_addr, token_info);

        // Emit event
        events::emit_token_created(
            metadata_addr,
            creator_addr,
            name,
            symbol,
            decimals,
            initial_supply,
            max_supply,
        );

        metadata_addr
    }

    /// Create a new fungible asset token (entry wrapper)
    public entry fun create_token(
        creator: &signer,
        name: String,
        symbol: String,
        decimals: u8,
        icon_uri: String,
        project_uri: String,
        initial_supply: u64,
        max_supply: u64, // 0 for unlimited
    ) acquires TokenRegistry, TokenRefs {
        create_token_internal(
            creator,
            name,
            symbol,
            decimals,
            icon_uri,
            project_uri,
            initial_supply,
            max_supply,
        );
    }

    /// Mint additional tokens (only creator can mint)
    public entry fun mint(
        creator: &signer,
        metadata_addr: address,
        amount: u64,
        to: address,
    ) acquires TokenRefs, TokenRegistry {
        let creator_addr = signer::address_of(creator);

        // Verify creator
        let registry = borrow_global<TokenRegistry>(@lilipad);
        assert!(table::contains(&registry.tokens, metadata_addr), constants::e_invalid_token());
        let token_info = table::borrow(&registry.tokens, metadata_addr);
        assert!(token_info.creator == creator_addr, constants::e_not_owner());

        // Mint tokens
        let refs = borrow_global<TokenRefs>(metadata_addr);
        let fa = fungible_asset::mint(&refs.mint_ref, (amount as u64));
        primary_fungible_store::deposit(to, fa);

        // Update total supply in registry
        let registry_mut = borrow_global_mut<TokenRegistry>(@lilipad);
        let token_info_mut = table::borrow_mut(&mut registry_mut.tokens, metadata_addr);
        token_info_mut.total_supply = token_info_mut.total_supply + amount;
    }

    /// Burn tokens from creator's account
    public entry fun burn(
        creator: &signer,
        metadata_addr: address,
        amount: u64,
    ) acquires TokenRefs, TokenRegistry {
        let creator_addr = signer::address_of(creator);

        // Verify creator
        let registry = borrow_global<TokenRegistry>(@lilipad);
        assert!(table::contains(&registry.tokens, metadata_addr), constants::e_invalid_token());
        let token_info = table::borrow(&registry.tokens, metadata_addr);
        assert!(token_info.creator == creator_addr, constants::e_not_owner());

        // Withdraw and burn
        let refs = borrow_global<TokenRefs>(metadata_addr);
        let metadata_obj = object::address_to_object<Metadata>(metadata_addr);
        let fa = primary_fungible_store::withdraw(creator, metadata_obj, (amount as u64));
        fungible_asset::burn(&refs.burn_ref, fa);

        // Update total supply in registry
        let registry_mut = borrow_global_mut<TokenRegistry>(@lilipad);
        let token_info_mut = table::borrow_mut(&mut registry_mut.tokens, metadata_addr);
        token_info_mut.total_supply = token_info_mut.total_supply - amount;
    }

    /// Freeze/unfreeze token transfers (only creator can call)
    public entry fun set_frozen(
        creator: &signer,
        metadata_addr: address,
        target: address,
        frozen: bool,
    ) acquires TokenRefs, TokenRegistry {
        let creator_addr = signer::address_of(creator);

        // Verify creator
        let registry = borrow_global<TokenRegistry>(@lilipad);
        assert!(table::contains(&registry.tokens, metadata_addr), constants::e_invalid_token());
        let token_info = table::borrow(&registry.tokens, metadata_addr);
        assert!(token_info.creator == creator_addr, constants::e_not_owner());

        // Set frozen state
        let refs = borrow_global<TokenRefs>(metadata_addr);
        let metadata_obj = object::address_to_object<Metadata>(metadata_addr);
        primary_fungible_store::set_frozen_flag(&refs.transfer_ref, target, frozen);
    }

    // ========================================
    // View Functions
    // ========================================

    #[view]
    public fun get_token_info(metadata_addr: address): (
        address, // creator
        address, // metadata
        String,  // name
        String,  // symbol
        u8,      // decimals
        String,  // icon_uri
        String,  // project_uri
        u64,     // total_supply
        u64,     // max_supply
    ) acquires TokenRegistry {
        let registry = borrow_global<TokenRegistry>(@lilipad);
        assert!(table::contains(&registry.tokens, metadata_addr), constants::e_invalid_token());

        let info = table::borrow(&registry.tokens, metadata_addr);
        (
            info.creator,
            info.metadata,
            info.name,
            info.symbol,
            info.decimals,
            info.icon_uri,
            info.project_uri,
            info.total_supply,
            info.max_supply,
        )
    }

    #[view]
    public fun get_balance(owner: address, metadata_addr: address): u64 {
        let metadata_obj = object::address_to_object<Metadata>(metadata_addr);
        (primary_fungible_store::balance(owner, metadata_obj) as u64)
    }

    #[view]
    public fun get_token_counter(): u64 acquires TokenRegistry {
        let registry = borrow_global<TokenRegistry>(@lilipad);
        registry.token_counter
    }

    #[view]
    public fun is_frozen(owner: address, metadata_addr: address): bool {
        let metadata_obj = object::address_to_object<Metadata>(metadata_addr);
        primary_fungible_store::is_frozen(owner, metadata_obj)
    }

    // ========================================
    // Test-only Functions
    // ========================================

    #[test_only]
    public fun init_token_for_test(account: &signer) {
        init_token(account);
    }
}
