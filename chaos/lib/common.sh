#!/usr/bin/env bash
# ── Chaos Test Harness: Common Utilities ──

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Config
API_URL="${API_URL:-http://localhost:3001}"
INTEL_URL="${INTEL_URL:-http://localhost:8000}"
WS_URL="${WS_URL:-ws://localhost:3001}"
SOVEREIGN_KEY="${SOVEREIGN_KEY:-7f9e1d3c5b7a9f2e4d6c8b0a2f4e6d7f9e1d}"
OPERATOR_KEY="${OPERATOR_KEY:-op3r4t0r5e7a9f2e4d6c8b0a2f4e6d8a1b2c}"
ANALYST_KEY="${ANALYST_KEY:-an4ly5t6b7a9f2e4d6c8b0a2f4e6d9c3d4e}"
GOV_KEY="${GOV_KEY:-governance-test-key-1234567890}"
RESULTS_DIR="${RESULTS_DIR:-$(dirname "$0")/../results}"
PASS_COUNT=0
FAIL_COUNT=0
TEST_NAME=""

# Ensure results dir exists
mkdir -p "$RESULTS_DIR"

log() {
  echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $*"
}

log_test() {
  TEST_NAME="$1"
  echo -e "\n${BOLD}${CYAN}━━━ TEST: $TEST_NAME ━━━${NC}"
}

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo -e "  ${GREEN}✓ PASS${NC}: $1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo -e "  ${RED}✗ FAIL${NC}: $1"
}

warn() {
  echo -e "  ${YELLOW}⚠ WARN${NC}: $1"
}

# Assert HTTP status code
assert_status() {
  local expected="$1"
  local actual="$2"
  local label="${3:-HTTP status}"
  if [ "$actual" = "$expected" ]; then
    pass "$label (expected=$expected, got=$actual)"
  else
    fail "$label (expected=$expected, got=$actual)"
  fi
}

# Assert string contains
assert_contains() {
  local haystack="$1"
  local needle="$2"
  local label="${3:-Response contains}"
  if echo "$haystack" | grep -q "$needle"; then
    pass "$label: found '$needle'"
  else
    fail "$label: '$needle' not found in response"
  fi
}

# Assert string does NOT contain
assert_not_contains() {
  local haystack="$1"
  local needle="$2"
  local label="${3:-Response excludes}"
  if echo "$haystack" | grep -q "$needle"; then
    fail "$label: '$needle' unexpectedly found"
  else
    pass "$label: '$needle' correctly absent"
  fi
}

# Make authenticated API request
api_request() {
  local method="$1"
  local path="$2"
  local key="${3:-$SOVEREIGN_KEY}"
  local data="${4:-}"
  local extra_headers="${5:-}"

  local cmd="curl -s -w '\n%{http_code}' -X $method '${API_URL}${path}' -H 'x-api-key: $key' -H 'Content-Type: application/json'"
  if [ -n "$extra_headers" ]; then
    cmd="$cmd -H '$extra_headers'"
  fi
  if [ -n "$data" ]; then
    cmd="$cmd -d '$data'"
  fi

  eval "$cmd"
}

# Extract status code from curl response (last line)
get_status() {
  echo "$1" | tail -1
}

# Extract body from curl response (all but last line)
get_body() {
  echo "$1" | head -n -1
}

# Print summary
print_summary() {
  local test_file="$1"
  echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  $test_file Summary${NC}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  ${GREEN}Passed: $PASS_COUNT${NC}"
  echo -e "  ${RED}Failed: $FAIL_COUNT${NC}"
  local total=$((PASS_COUNT + FAIL_COUNT))
  if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "  ${GREEN}${BOLD}ALL $total TESTS PASSED${NC}"
  else
    echo -e "  ${RED}${BOLD}$FAIL_COUNT/$total TESTS FAILED${NC}"
  fi
  echo ""
}
