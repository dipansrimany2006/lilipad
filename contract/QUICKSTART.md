# Lilipad Quick Start Guide

Get started with Lilipad in 5 minutes!

## Prerequisites

1. **Install Aptos CLI**
   ```bash
   # macOS/Linux
   curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3

   # Or with Homebrew (macOS)
   brew install aptos
   ```

2. **Create Aptos Account**
   ```bash
   aptos init --profile testnet --network testnet
   ```

3. **Fund Your Account** (Testnet/Devnet only)
   ```bash
   aptos account fund-with-faucet --profile testnet
   ```

## Installation

```bash
git clone <your-repo>
cd lilipad
```

## Compile & Test

```bash
# Compile the module
aptos move compile --dev

# Run tests
aptos move test --dev
```

Expected output:
```
[ PASS    ] 0xcafe::lilipad::test_create_sale
[ PASS    ] 0xcafe::lilipad::test_register_project
Test result: OK. Total tests: 2; passed: 2; failed: 0
```

## Deploy to Testnet

```bash
# Option 1: Use deployment script
./scripts/deploy.sh testnet

# Option 2: Manual deployment
aptos move publish \
    --profile testnet \
    --named-addresses lilipad=default
```

## Basic Usage

### 1. Register Your Project

```bash
aptos move run \
    --profile testnet \
    --function-id 'default::lilipad::register_project' \
    --args \
        string:"My Token Project" \
        address:0x1
```

Output will show:
- Transaction hash
- Success status
- Gas used
- Events emitted (including `ProjectRegistered`)

### 2. Create a Token Sale

```bash
# Calculate timestamps
NOW=$(date +%s)
START=$((NOW + 300))      # Starts in 5 minutes
END=$((START + 86400))    # Runs for 24 hours

# Create sale
aptos move run \
    --profile testnet \
    --function-id 'default::lilipad::create_sale' \
    --args \
        u64:0 \
        address:0x1 \
        u128:1000000 \
        u128:1000000 \
        u64:${START} \
        u64:${END} \
        u64:300
```

Parameters explained:
- `u64:0` - Project ID (from step 1)
- `address:0x1` - Token address (use AptosCoin for demo)
- `u128:1000000` - Total tokens for sale
- `u128:1000000` - Price = 0.001 APT per token (0.001 * 1e9)
- `u64:${START}` - Sale start timestamp
- `u64:${END}` - Sale end timestamp
- `u64:300` - Vesting duration (5 minutes)

### 3. Buy Tokens

```bash
# Wait for sale to start, then buy with 1 APT
aptos move run \
    --profile testnet \
    --function-id 'default::lilipad::buy' \
    --args \
        u64:0 \
        u64:100000000
```

This creates a vesting stream for the buyer!

### 4. Check Claimable Amount

```bash
aptos move view \
    --function-id 'default::lilipad::get_claimable' \
    --args u64:0
```

### 5. Claim Vested Tokens

```bash
aptos move run \
    --profile testnet \
    --function-id 'default::lilipad::claim' \
    --args u64:0
```

You can call this multiple times as tokens vest!

### 6. Withdraw Sale Proceeds

```bash
# After sale ends, withdraw raised APT
aptos move run \
    --profile testnet \
    --function-id 'default::lilipad::withdraw_proceeds' \
    --args \
        u64:0 \
        address:YOUR_ADDRESS
```

## View Functions (Query State)

```bash
# View project
aptos move view \
    --function-id 'default::lilipad::get_project' \
    --args u64:0

# View sale
aptos move view \
    --function-id 'default::lilipad::get_sale' \
    --args u64:0

# View stream
aptos move view \
    --function-id 'default::lilipad::get_stream' \
    --args u64:0

# View counters
aptos move view \
    --function-id 'default::lilipad::get_counters'
```

## Common Operations

### Calculate Price

```python
# Python helper
def calculate_price(apt_per_token: float) -> int:
    """Convert APT price to on-chain format"""
    PRECISION = 1_000_000_000
    return int(apt_per_token * PRECISION)

# Examples:
calculate_price(0.001)   # 1,000,000
calculate_price(0.00001) # 10,000
calculate_price(1.0)     # 1,000,000,000
```

### Calculate Timestamps

```bash
# Current time
date +%s

# Time in 1 hour
echo $(($(date +%s) + 3600))

# Time in 1 day
echo $(($(date +%s) + 86400))

# Time in 90 days
echo $(($(date +%s) + 7776000))
```

### Convert String to Hex

```bash
# For asset_ref in lock functions
echo -n "my-lp-position-123" | xxd -p | tr -d '\n'
```

## Monitoring

### View Transaction on Explorer

After any transaction, visit:
- Testnet: `https://explorer.aptoslabs.com/txn/{HASH}?network=testnet`
- Mainnet: `https://explorer.aptoslabs.com/txn/{HASH}?network=mainnet`

### View Events

Events are automatically emitted for all operations:
1. Visit Aptos Explorer
2. Navigate to your account
3. Click "Events" tab
4. Filter by module: `lilipad`

## Troubleshooting

### Error: "Sale not started"
- Check current time vs `start_ts`
- Use `date +%s` to verify timestamps

### Error: "Insufficient tokens"
- Sale may be sold out
- Check available tokens: `total_tokens - tokens_sold`

### Error: "No claimable"
- Vesting hasn't started yet
- All tokens already claimed
- Use `get_claimable` to check amount

### Error: "Not owner"
- Verify you're calling from correct account
- Check ownership with view functions

### Gas Issues
```bash
# Check balance
aptos account list --profile testnet

# Get more test APT
aptos account fund-with-faucet --profile testnet
```

## Development Workflow

```bash
# 1. Make changes to sources/lilipad.move
vim sources/lilipad.move

# 2. Compile
aptos move compile --dev

# 3. Test
aptos move test --dev

# 4. Deploy (if tests pass)
./scripts/deploy.sh testnet

# 5. Interact
# Use examples in scripts/examples.sh
```

## Next Steps

- Read [README.md](README.md) for full documentation
- Review [SECURITY.md](SECURITY.md) for security analysis
- Check [scripts/examples.sh](scripts/examples.sh) for more examples
- Build a frontend using Aptos SDK
- Integrate with Petra or Martian wallet

## Resources

- [Aptos Developer Documentation](https://aptos.dev)
- [Move Book](https://move-language.github.io/move/)
- [Aptos TypeScript SDK](https://github.com/aptos-labs/aptos-ts-sdk)
- [Aptos Explorer](https://explorer.aptoslabs.com)
- [Petra Wallet](https://petra.app)

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review error codes in [README.md](README.md)
3. Open an issue on GitHub


