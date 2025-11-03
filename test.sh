#!/bin/bash

# Simple test script for opencode-amplifier

set -e

echo "🧪 Testing OpenCode-Amplifier MCP Bridge"
echo

# Configuration
AMPLIFIER_PATH="${AMPLIFIER_PATH:-../amplifier}"
PYTHON_PATH="${PYTHON_PATH:-$AMPLIFIER_PATH/.venv/bin/python3}"
SERVER="$(cd "$(dirname "$0")" && pwd)/server.js"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

PASS=0
FAIL=0

test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}✗${NC} $2"
        FAIL=$((FAIL + 1))
    fi
}

# Test 1: Prerequisites
echo "Test 1: Prerequisites"
[ -f "$SERVER" ] && test_result 0 "Server exists" || test_result 1 "Server not found"
[ -d "$AMPLIFIER_PATH" ] && test_result 0 "Amplifier found" || test_result 1 "Amplifier not found"
[ -x "$PYTHON_PATH" ] && test_result 0 "Python found" || test_result 1 "Python not found"
echo

# Test 2: Server starts
echo "Test 2: Server initialization"
INIT='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
RESPONSE=$(echo "$INIT" | AMPLIFIER_PATH="$AMPLIFIER_PATH" PYTHON_PATH="$PYTHON_PATH" LOG_LEVEL=ERROR timeout 5 node "$SERVER" 2>/dev/null || echo "")

if echo "$RESPONSE" | grep -q '"result"'; then
    test_result 0 "Server initializes"
else
    test_result 1 "Server failed to initialize"
fi
echo

# Test 3: Tool discovery
echo "Test 3: Tool discovery"
LIST='{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
TOOLS=$(echo "$LIST" | AMPLIFIER_PATH="$AMPLIFIER_PATH" PYTHON_PATH="$PYTHON_PATH" LOG_LEVEL=ERROR timeout 5 node "$SERVER" 2>/dev/null || echo "")

if echo "$TOOLS" | grep -q '"tools"'; then
    test_result 0 "Tools listed"
    
    if echo "$TOOLS" | grep -q 'amplifier_web_to_md'; then
        test_result 0 "web_to_md discovered"
    else
        test_result 1 "web_to_md not found"
    fi
    
    COUNT=$(echo "$TOOLS" | grep -o 'amplifier_' | wc -l)
    echo "  Found $COUNT scenarios"
else
    test_result 1 "Tool listing failed"
fi
echo

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed${NC}"
    exit 1
fi
