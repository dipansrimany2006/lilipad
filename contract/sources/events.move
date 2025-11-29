module lilipad::events {
    use std::option::Option;
    use std::string::String;

    /// Emitted when a new token is created
    #[event]
    struct TokenCreated has drop, store {
        metadata: address,
        creator: address,
        name: String,
        symbol: String,
        decimals: u8,
        initial_supply: u64,
        max_supply: u64,
    }

    /// Emitted when a project hash is registered (optional anchor for off-chain registry)
    #[event]
    struct ProjectHashRegistered has drop, store {
        project_pointer: vector<u8>, // IPFS CID or hash
        owner: address,
        timestamp: u64,
    }

    /// Emitted when a new sale is created
    #[event]
    struct SaleCreated has drop, store {
        sale_id: u64,
        owner: address,
        project_pointer_opt: Option<vector<u8>>,
        token: address,
        total_tokens: u128,
        price_per_token: u128,
        start_ts: u64,
        end_ts: u64,
        soft_cap: u128,
    }

    /// Emitted when tokens are deposited into sale escrow
    #[event]
    struct SaleEscrowDeposited has drop, store {
        sale_id: u64,
        depositor: address,
        token: address,
        amount: u128,
        total_escrowed: u128,
    }

    /// Emitted when a buyer purchases tokens
    #[event]
    struct Bought has drop, store {
        sale_id: u64,
        buyer: address,
        tokens_bought: u128,
        apt_spent: u128,
        stream_id: u64,
    }

    /// Emitted when a vesting stream is created
    #[event]
    struct StreamCreated has drop, store {
        stream_id: u64,
        owner: address,
        beneficiary: address,
        token: address,
        total_amount: u128,
        start_ts: u64,
        end_ts: u64,
        metadata_opt: Option<vector<u8>>,
    }

    /// Emitted when tokens are deposited into vesting escrow
    #[event]
    struct VestingEscrowDeposited has drop, store {
        stream_id: u64,
        depositor: address,
        token: address,
        amount: u128,
    }

    /// Emitted when vested tokens are claimed
    #[event]
    struct Claimed has drop, store {
        stream_id: u64,
        beneficiary: address,
        token: address,
        amount: u128,
    }

    /// Emitted when sale proceeds (APT) are withdrawn
    #[event]
    struct ProceedsWithdrawn has drop, store {
        sale_id: u64,
        to: address,
        amount: u128,
    }

    /// Emitted when a sale reaches its soft cap
    #[event]
    struct SaleSoftCapReached has drop, store {
        sale_id: u64,
        raised_apt: u128,
        soft_cap: u128,
        timestamp: u64,
    }

    /// Emitted when a lock is created
    #[event]
    struct LockCreated has drop, store {
        lock_id: u64,
        locker: address,
        project_pointer_opt: Option<vector<u8>>,
        kind: u8, // 0 = fungible token, 1 = LP position
        token: address, // For fungible locks; @0x0 for LP
        asset_ref: vector<u8>, // Opaque reference (e.g., LP pool ID, tx hash)
        amount: u128,
        unlock_ts: u64,
        metadata_opt: Option<vector<u8>>,
    }

    /// Emitted when tokens are deposited into lock escrow
    #[event]
    struct LockEscrowDeposited has drop, store {
        lock_id: u64,
        depositor: address,
        token: address,
        amount: u128,
    }

    /// Emitted when locked assets are withdrawn
    #[event]
    struct LockWithdrawn has drop, store {
        lock_id: u64,
        to: address,
        amount: u128,
    }

    // Event emission functions (public so other modules can call them)

    public fun emit_project_hash_registered(
        project_pointer: vector<u8>,
        owner: address,
        timestamp: u64
    ) {
        aptos_framework::event::emit(ProjectHashRegistered {
            project_pointer,
            owner,
            timestamp,
        });
    }

    public fun emit_sale_created(
        sale_id: u64,
        owner: address,
        project_pointer_opt: Option<vector<u8>>,
        token: address,
        total_tokens: u128,
        price_per_token: u128,
        start_ts: u64,
        end_ts: u64,
        soft_cap: u128,
    ) {
        aptos_framework::event::emit(SaleCreated {
            sale_id,
            owner,
            project_pointer_opt,
            token,
            total_tokens,
            price_per_token,
            start_ts,
            end_ts,
            soft_cap,
        });
    }

    public fun emit_sale_escrow_deposited(
        sale_id: u64,
        depositor: address,
        token: address,
        amount: u128,
        total_escrowed: u128,
    ) {
        aptos_framework::event::emit(SaleEscrowDeposited {
            sale_id,
            depositor,
            token,
            amount,
            total_escrowed,
        });
    }

    public fun emit_bought(
        sale_id: u64,
        buyer: address,
        tokens_bought: u128,
        apt_spent: u128,
        stream_id: u64,
    ) {
        aptos_framework::event::emit(Bought {
            sale_id,
            buyer,
            tokens_bought,
            apt_spent,
            stream_id,
        });
    }

    public fun emit_stream_created(
        stream_id: u64,
        owner: address,
        beneficiary: address,
        token: address,
        total_amount: u128,
        start_ts: u64,
        end_ts: u64,
        metadata_opt: Option<vector<u8>>,
    ) {
        aptos_framework::event::emit(StreamCreated {
            stream_id,
            owner,
            beneficiary,
            token,
            total_amount,
            start_ts,
            end_ts,
            metadata_opt,
        });
    }

    public fun emit_vesting_escrow_deposited(
        stream_id: u64,
        depositor: address,
        token: address,
        amount: u128,
    ) {
        aptos_framework::event::emit(VestingEscrowDeposited {
            stream_id,
            depositor,
            token,
            amount,
        });
    }

    public fun emit_claimed(
        stream_id: u64,
        beneficiary: address,
        token: address,
        amount: u128,
    ) {
        aptos_framework::event::emit(Claimed {
            stream_id,
            beneficiary,
            token,
            amount,
        });
    }

    public fun emit_proceeds_withdrawn(
        sale_id: u64,
        to: address,
        amount: u128,
    ) {
        aptos_framework::event::emit(ProceedsWithdrawn {
            sale_id,
            to,
            amount,
        });
    }

    public fun emit_sale_soft_cap_reached(
        sale_id: u64,
        raised_apt: u128,
        soft_cap: u128,
        timestamp: u64,
    ) {
        aptos_framework::event::emit(SaleSoftCapReached {
            sale_id,
            raised_apt,
            soft_cap,
            timestamp,
        });
    }

    public fun emit_lock_created(
        lock_id: u64,
        locker: address,
        project_pointer_opt: Option<vector<u8>>,
        kind: u8,
        token: address,
        asset_ref: vector<u8>,
        amount: u128,
        unlock_ts: u64,
        metadata_opt: Option<vector<u8>>,
    ) {
        aptos_framework::event::emit(LockCreated {
            lock_id,
            locker,
            project_pointer_opt,
            kind,
            token,
            asset_ref,
            amount,
            unlock_ts,
            metadata_opt,
        });
    }

    public fun emit_lock_escrow_deposited(
        lock_id: u64,
        depositor: address,
        token: address,
        amount: u128,
    ) {
        aptos_framework::event::emit(LockEscrowDeposited {
            lock_id,
            depositor,
            token,
            amount,
        });
    }

    public fun emit_lock_withdrawn(
        lock_id: u64,
        to: address,
        amount: u128,
    ) {
        aptos_framework::event::emit(LockWithdrawn {
            lock_id,
            to,
            amount,
        });
    }

    public fun emit_token_created(
        metadata: address,
        creator: address,
        name: String,
        symbol: String,
        decimals: u8,
        initial_supply: u64,
        max_supply: u64,
    ) {
        aptos_framework::event::emit(TokenCreated {
            metadata,
            creator,
            name,
            symbol,
            decimals,
            initial_supply,
            max_supply,
        });
    }
}
