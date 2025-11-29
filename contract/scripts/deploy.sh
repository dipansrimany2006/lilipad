#!/bin/bash
# Lilipad Deployment Script

set -e

echo "🚀 Lilipad Deployment Script"
echo "=============================="
echo ""

# Function to display usage
usage() {
    echo "Usage: $0 [testnet|devnet|mainnet]"
    echo ""
    echo "Examples:"
    echo "  $0 testnet    # Deploy to testnet"
    echo "  $0 devnet     # Deploy to devnet"
    echo "  $0 mainnet    # Deploy to mainnet"
    exit 1
}

# Check arguments
if [ $# -eq 0 ]; then
    usage
fi

NETWORK=$1

# Validate network
if [[ ! "$NETWORK" =~ ^(testnet|devnet|mainnet)$ ]]; then
    echo "❌ Error: Invalid network '$NETWORK'"
    usage
fi

echo "📋 Deployment Configuration:"
echo "   Network: $NETWORK"
echo ""

# Step 1: Compile
echo "📦 Step 1: Compiling Move module..."
aptos move compile --named-addresses lilipad=default

if [ $? -ne 0 ]; then
    echo "❌ Compilation failed!"
    exit 1
fi
echo "✅ Compilation successful!"
echo ""

# Step 2: Run tests
echo "🧪 Step 2: Running tests..."
aptos move test

if [ $? -ne 0 ]; then
    echo "❌ Tests failed!"
    read -p "Continue with deployment anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ All tests passed!"
fi
echo ""

# Step 3: Confirm deployment
echo "⚠️  WARNING: You are about to deploy to $NETWORK"
read -p "Continue with deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi
echo ""

# Step 4: Deploy
echo "🚀 Step 3: Deploying to $NETWORK..."
aptos move publish \
    --profile $NETWORK \
    --named-addresses lilipad=default \
    --assume-yes

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed!"
    exit 1
fi
echo ""

# Success
echo "✅ Deployment successful!"
echo ""
echo "📝 Next steps:"
echo "   1. Note the deployed module address"
echo "   2. Update frontend configuration with the address"
echo "   3. Verify the deployment on Aptos Explorer"
echo "   4. Test basic operations (register_project, create_sale)"
echo ""
echo "🔗 Explorer URLs:"
echo "   Testnet: https://explorer.aptoslabs.com/?network=testnet"
echo "   Devnet:  https://explorer.aptoslabs.com/?network=devnet"
echo "   Mainnet: https://explorer.aptoslabs.com/?network=mainnet"
echo ""
