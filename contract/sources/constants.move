module lilipad::constants {
    /// Price precision for token calculations (1e9)
    /// When computing tokens from APT: tokens = (apt_amount * PRICE_PRECISION) / price_per_token
    /// This allows precise fractional pricing while using integer math
    const PRICE_PRECISION: u128 = 1_000_000_000;

    /// Get the price precision constant
    public fun price_precision(): u128 {
        PRICE_PRECISION
    }

    // Error codes
    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_INITIALIZED: u64 = 2;
    const E_NOT_OWNER: u64 = 3;
    const E_INVALID_TOKEN: u64 = 4;
    const E_INVALID_TIME_RANGE: u64 = 5;
    const E_INVALID_PRICE: u64 = 6;
    const E_INVALID_AMOUNT: u64 = 7;
    const E_SALE_NOT_FOUND: u64 = 8;
    const E_STREAM_NOT_FOUND: u64 = 9;
    const E_LOCK_NOT_FOUND: u64 = 10;
    const E_SALE_NOT_ACTIVE: u64 = 11;
    const E_SALE_NOT_STARTED: u64 = 12;
    const E_SALE_ENDED: u64 = 13;
    const E_INSUFFICIENT_TOKENS: u64 = 14;
    const E_NO_CLAIMABLE: u64 = 15;
    const E_ALREADY_WITHDRAWN: u64 = 16;
    const E_LOCK_NOT_EXPIRED: u64 = 17;
    const E_SALE_NOT_ENDED: u64 = 18;
    const E_ZERO_TOKENS_BOUGHT: u64 = 19;
    const E_NOT_BENEFICIARY: u64 = 20;
    const E_SALE_NOT_ESCROWED: u64 = 21;
    const E_INSUFFICIENT_ESCROW: u64 = 22;
    const E_NOT_LOCKER: u64 = 23;
    const E_STREAM_NOT_ESCROWED: u64 = 24;
    const E_LOCK_NOT_ESCROWED: u64 = 25;

    // Error code getters
    public fun e_not_initialized(): u64 { E_NOT_INITIALIZED }
    public fun e_already_initialized(): u64 { E_ALREADY_INITIALIZED }
    public fun e_not_owner(): u64 { E_NOT_OWNER }
    public fun e_invalid_token(): u64 { E_INVALID_TOKEN }
    public fun e_invalid_time_range(): u64 { E_INVALID_TIME_RANGE }
    public fun e_invalid_price(): u64 { E_INVALID_PRICE }
    public fun e_invalid_amount(): u64 { E_INVALID_AMOUNT }
    public fun e_sale_not_found(): u64 { E_SALE_NOT_FOUND }
    public fun e_stream_not_found(): u64 { E_STREAM_NOT_FOUND }
    public fun e_lock_not_found(): u64 { E_LOCK_NOT_FOUND }
    public fun e_sale_not_active(): u64 { E_SALE_NOT_ACTIVE }
    public fun e_sale_not_started(): u64 { E_SALE_NOT_STARTED }
    public fun e_sale_ended(): u64 { E_SALE_ENDED }
    public fun e_insufficient_tokens(): u64 { E_INSUFFICIENT_TOKENS }
    public fun e_no_claimable(): u64 { E_NO_CLAIMABLE }
    public fun e_already_withdrawn(): u64 { E_ALREADY_WITHDRAWN }
    public fun e_lock_not_expired(): u64 { E_LOCK_NOT_EXPIRED }
    public fun e_sale_not_ended(): u64 { E_SALE_NOT_ENDED }
    public fun e_zero_tokens_bought(): u64 { E_ZERO_TOKENS_BOUGHT }
    public fun e_not_beneficiary(): u64 { E_NOT_BENEFICIARY }
    public fun e_sale_not_escrowed(): u64 { E_SALE_NOT_ESCROWED }
    public fun e_insufficient_escrow(): u64 { E_INSUFFICIENT_ESCROW }
    public fun e_not_locker(): u64 { E_NOT_LOCKER }
    public fun e_stream_not_escrowed(): u64 { E_STREAM_NOT_ESCROWED }
    public fun e_lock_not_escrowed(): u64 { E_LOCK_NOT_ESCROWED }
}
