#!/bin/bash
# Lilipad Usage Examples

# This file contains example commands for interacting with the Lilipad module
# These are examples only - adjust addresses and parameters as needed

# ============================================
# Configuration
# ============================================
MODULE_ADDRESS="0xCAFE"  # Replace with actual deployed address
PROFILE="testnet"        # or devnet, mainnet
TOKEN_ADDRESS="0x1::aptos_coin::AptosCoin"

# ============================================
# 1. Register a Project
# ============================================
echo "Example 1: Register a Project"
echo "================================"
cat << 'EOF'
aptos move run \
    --profile $PROFILE \
    --function-id "${MODULE_ADDRESS}::lilipad::register_project" \
    --args \
        string:"My DeFi Token" \
        address:0x123456789...
EOF
echo ""

# ============================================
# 2. Create a Token Sale
# ============================================
echo "Example 2: Create a Token Sale"
echo "==============================="
cat << 'EOF'
# Sale Parameters:
# - Project ID: 0
# - Token: Your token address
# - Total Tokens: 1,000,000
# - Price: 0.001 APT per token (1,000,000 = 0.001 * 1e9)
# - Start: Current time + 60 seconds
# - End: Start + 24 hours (86400 seconds)
# - Vesting: 5 minutes (300 seconds)

NOW=$(date +%s)
START_TS=$((NOW + 60))
END_TS=$((START_TS + 86400))

aptos move run \
    --profile $PROFILE \
    --function-id "${MODULE_ADDRESS}::lilipad::create_sale" \
    --args \
        u64:0 \
        address:0x123... \
        u128:1000000 \
        u128:1000000 \
        u64:${START_TS} \
        u64:${END_TS} \
        u64:300
EOF
echo ""

# ============================================
# 3. Buy Tokens
# ============================================
echo "Example 3: Buy Tokens from Sale"
echo "================================"
cat << 'EOF'
# Buy with 10 APT (10 * 100000000 = 1000000000 octas)
# At price 0.001 APT/token, this buys 10,000 tokens

aptos move run \
    --profile $PROFILE \
    --function-id "${MODULE_ADDRESS}::lilipad::buy" \
    --args \
        u64:0 \
        u64:1000000000
EOF
echo ""

# ============================================
# 4. Claim Vested Tokens
# ============================================
echo "Example 4: Claim Vested Tokens"
echo "==============================="
cat << 'EOF'
# Claim from stream ID 0
# Can be called multiple times as vesting progresses

aptos move run \
    --profile $PROFILE \
    --function-id "${MODULE_ADDRESS}::lilipad::claim" \
    --args u64:0
EOF
echo ""

# ============================================
# 5. Withdraw Sale Proceeds
# ============================================
echo "Example 5: Withdraw Sale Proceeds"
echo "=================================="
cat << 'EOF'
# Withdraw raised APT after sale ends
# Must be called by sale owner

aptos move run \
    --profile $PROFILE \
    --function-id "${MODULE_ADDRESS}::lilipad::withdraw_proceeds" \
    --args \
        u64:0 \
        address:0xYOUR_ADDRESS
EOF
echo ""

# ============================================
# 6. Lock LP Position
# ============================================
echo "Example 6: Lock LP Position"
echo "==========================="
cat << 'EOF'
# Lock LP position for 90 days
# asset_ref is hex-encoded identifier (e.g., "hyperion-pos-12345")

UNLOCK_TIME=$(($(date +%s) + 7776000))  # 90 days from now

aptos move run \
    --profile $PROFILE \
    --function-id "${MODULE_ADDRESS}::lilipad::lock_lp_position" \
    --args \
        u64:0 \
        hex:68797065726964652D706F732D3132333435 \
        u128:500000 \
        u64:${UNLOCK_TIME}
EOF
echo ""

# ============================================
# 7. Withdraw Locked Position
# ============================================
echo "Example 7: Withdraw Locked Position"
echo "===================================="
cat << 'EOF'
# Withdraw after lock period expires

aptos move run \
    --profile $PROFILE \
    --function-id "${MODULE_ADDRESS}::lilipad::withdraw_locked" \
    --args u64:0
EOF
echo ""

# ============================================
# View Functions (Query State)
# ============================================
echo "View Functions (Query State)"
echo "============================"
cat << 'EOF'
# Get project details
aptos move view \
    --function-id "${MODULE_ADDRESS}::lilipad::get_project" \
    --args u64:0

# Get sale details
aptos move view \
    --function-id "${MODULE_ADDRESS}::lilipad::get_sale" \
    --args u64:0

# Get stream details
aptos move view \
    --function-id "${MODULE_ADDRESS}::lilipad::get_stream" \
    --args u64:0

# Get claimable amount
aptos move view \
    --function-id "${MODULE_ADDRESS}::lilipad::get_claimable" \
    --args u64:0

# Get lock details
aptos move view \
    --function-id "${MODULE_ADDRESS}::lilipad::get_lock" \
    --args u64:0

# Get all counters
aptos move view \
    --function-id "${MODULE_ADDRESS}::lilipad::get_counters"
EOF
echo ""

# ============================================
# Helper: Convert string to hex
# ============================================
echo "Helper: Convert String to Hex"
echo "=============================="
cat << 'EOF'
# To convert a string to hex for asset_ref:
echo -n "hyperion-pos-12345" | xxd -p | tr -d '\n'
# Output: 68797065726964652D706F732D3132333435
EOF
echo ""

# ============================================
# Helper: Calculate Unix Timestamp
# ============================================
echo "Helper: Calculate Unix Timestamp"
echo "================================="
cat << 'EOF'
# Current timestamp
date +%s

# Timestamp 24 hours from now
echo $(($(date +%s) + 86400))

# Timestamp 90 days from now
echo $(($(date +%s) + 7776000))

# Convert human-readable date to timestamp
date -d "2024-12-31 23:59:59" +%s
EOF
echo ""

# ============================================
# Helper: Calculate Price
# ============================================
echo "Helper: Calculate Price"
echo "======================="
cat << 'EOF'
# PRECISION = 1e9
# price_per_token = desired_price * PRECISION

# Example: 0.001 APT per token
# price_per_token = 0.001 * 1000000000 = 1000000

# Example: 0.00001 APT per token
# price_per_token = 0.00001 * 1000000000 = 10000

# Example: 1 APT per token
# price_per_token = 1 * 1000000000 = 1000000000
EOF
echo ""

# ============================================
# Full Sale Lifecycle Example
# ============================================
echo "Full Sale Lifecycle Example"
echo "==========================="
cat << 'EOF'
# 1. Register project
aptos move run --function-id "${MODULE_ADDRESS}::lilipad::register_project" \
    --args string:"MyToken" address:0x123...

# 2. Create sale (starts in 1 minute, runs for 1 day, 5min vesting)
aptos move run --function-id "${MODULE_ADDRESS}::lilipad::create_sale" \
    --args u64:0 address:0x123... u128:1000000 u128:1000000 \
           u64:$(($(date +%s) + 60)) u64:$(($(date +%s) + 86460)) u64:300

# 3. Wait for sale to start...

# 4. Buy tokens (buyer)
aptos move run --function-id "${MODULE_ADDRESS}::lilipad::buy" \
    --args u64:0 u64:1000000000

# 5. Check claimable amount
aptos move view --function-id "${MODULE_ADDRESS}::lilipad::get_claimable" \
    --args u64:0

# 6. Claim vested tokens (after some time)
aptos move run --function-id "${MODULE_ADDRESS}::lilipad::claim" \
    --args u64:0

# 7. Claim again (after more time)
aptos move run --function-id "${MODULE_ADDRESS}::lilipad::claim" \
    --args u64:0

# 8. Wait for sale to end...

# 9. Withdraw proceeds (sale owner)
aptos move run --function-id "${MODULE_ADDRESS}::lilipad::withdraw_proceeds" \
    --args u64:0 address:0xOWNER...

# 10. Lock LP position
aptos move run --function-id "${MODULE_ADDRESS}::lilipad::lock_lp_position" \
    --args u64:0 hex:706F732D313233 u128:500000 u64:$(($(date +%s) + 7776000))

# 11. Wait for lock period...

# 12. Withdraw locked position
aptos move run --function-id "${MODULE_ADDRESS}::lilipad::withdraw_locked" \
    --args u64:0
EOF
echo ""

echo "💡 Tips:"
echo "  - Replace \${MODULE_ADDRESS} with your deployed module address"
echo "  - Replace \${PROFILE} with your Aptos CLI profile (testnet/devnet/mainnet)"
echo "  - Adjust timestamps, amounts, and addresses as needed"
echo "  - Use 'aptos account fund-with-faucet' on testnet/devnet to get test APT"
echo ""
