#!/bin/bash
# Lilipad Verification Script
# Runs all checks to ensure the module is ready for deployment

set -e

echo "🔍 Lilipad Module Verification"
echo "==============================="
echo ""

ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ERRORS=$((ERRORS + 1))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

info() {
    echo "ℹ $1"
}

# Check 1: Move.toml exists
echo "📋 Checking project structure..."
if [ -f "Move.toml" ]; then
    pass "Move.toml exists"
else
    fail "Move.toml not found"
fi

# Check 2: Main module exists
if [ -f "sources/lilipad.move" ]; then
    pass "Main module exists"
else
    fail "sources/lilipad.move not found"
fi

# Check 3: Scripts directory
if [ -d "scripts" ]; then
    pass "Scripts directory exists"
else
    warn "Scripts directory not found"
fi

echo ""

# Check 4: Compilation
echo "🔨 Checking compilation..."
if aptos move compile --dev > /dev/null 2>&1; then
    pass "Module compiles successfully"
else
    fail "Compilation failed"
    echo "   Run 'aptos move compile --dev' for details"
fi

echo ""

# Check 5: Tests
echo "🧪 Running tests..."
TEST_OUTPUT=$(aptos move test --dev 2>&1)
if echo "$TEST_OUTPUT" | grep -q "Test result: OK"; then
    PASSED=$(echo "$TEST_OUTPUT" | grep -oP 'passed: \K\d+')
    pass "All tests passed ($PASSED tests)"
else
    fail "Tests failed"
    echo "$TEST_OUTPUT"
fi

echo ""

# Check 6: Documentation
echo "📚 Checking documentation..."
if [ -f "README.md" ]; then
    pass "README.md exists"
else
    warn "README.md not found"
fi

if [ -f "SECURITY.md" ]; then
    pass "SECURITY.md exists"
else
    warn "SECURITY.md not found"
fi

if [ -f "QUICKSTART.md" ]; then
    pass "QUICKSTART.md exists"
else
    warn "QUICKSTART.md not found"
fi

echo ""

# Check 7: Code metrics
echo "📊 Code metrics..."
LINES=$(wc -l < sources/lilipad.move)
info "Total lines: $LINES"

FUNCTIONS=$(grep -c "public entry fun\|public fun\|fun " sources/lilipad.move || true)
info "Functions: $FUNCTIONS"

TESTS=$(grep -c "#\[test" sources/lilipad.move || true)
info "Tests: $TESTS"

EVENTS=$(grep -c "#\[event\]" sources/lilipad.move || true)
info "Events: $EVENTS"

echo ""

# Check 8: Security patterns
echo "🔒 Security checks..."
if grep -q "assert!" sources/lilipad.move; then
    pass "Uses assertions for validation"
else
    warn "No assertions found"
fi

if grep -q "signer::address_of" sources/lilipad.move; then
    pass "Uses signer verification"
else
    warn "No signer verification found"
fi

if grep -q "timestamp::now_seconds()" sources/lilipad.move; then
    pass "Uses timestamp validation"
else
    warn "No timestamp validation found"
fi

echo ""

# Check 9: Aptos CLI
echo "🔧 Checking Aptos CLI..."
if command -v aptos &> /dev/null; then
    VERSION=$(aptos --version | head -n 1)
    pass "Aptos CLI installed ($VERSION)"
else
    fail "Aptos CLI not found"
    echo "   Install from: https://aptos.dev/cli-tools/aptos-cli-tool/install-aptos-cli"
fi

echo ""

# Check 10: Git repository
echo "📦 Checking Git..."
if [ -d ".git" ]; then
    pass "Git repository initialized"
    if git diff-index --quiet HEAD -- 2>/dev/null; then
        pass "No uncommitted changes"
    else
        warn "Uncommitted changes detected"
    fi
else
    warn "Not a Git repository"
    echo "   Run 'git init' to initialize"
fi

echo ""

# Summary
echo "═══════════════════════════════"
echo "Summary:"
echo "───────────────────────────────"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "🚀 Your module is ready for deployment!"
    echo ""
    echo "Next steps:"
    echo "  1. ./scripts/deploy.sh testnet"
    echo "  2. Test on testnet"
    echo "  3. Deploy to mainnet when ready"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Passed with $WARNINGS warning(s)${NC}"
    echo ""
    echo "Module is functional but some optional components are missing."
    echo "Review warnings above."
    exit 0
else
    echo -e "${RED}✗ Failed with $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    echo ""
    echo "Please fix errors before deploying."
    exit 1
fi
