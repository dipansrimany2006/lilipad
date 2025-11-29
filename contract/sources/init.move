module lilipad::init {
    use std::signer;
    use lilipad::escrow;
    use lilipad::launchpad;
    use lilipad::vesting;
    use lilipad::locking;
    use lilipad::token;

    /// Initialize all modules (called once by module publisher)
    fun init_module(account: &signer) {
        // Verify deployer
        assert!(signer::address_of(account) == @lilipad, 0);

        // Initialize all modules
        token::init_token(account);
        escrow::init_escrow(account);
        launchpad::init_launchpad(account);
        vesting::init_vesting(account);
        locking::init_locking(account);
    }

    #[test_only]
    public fun init_module_for_test(account: &signer) {
        init_module(account);
    }
}
