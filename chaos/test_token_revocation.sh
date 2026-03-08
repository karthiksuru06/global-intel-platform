#!/usr/bin/env bash
# ── Chaos Test: Dynamic Token Revocation ──
# Tests: Revoke token → 401, Unrevoke → 200 again

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

LOG_FILE="$RESULTS_DIR/token_revocation_$(date +%Y%m%d_%H%M%S).log"

echo "Token Revocation Test" | tee "$LOG_FILE"
echo "=====================" | tee -a "$LOG_FILE"

# Compute SHA-256 hash of the OPERATOR key
OPERATOR_HASH=$(echo -n "$OPERATOR_KEY" | sha256sum | awk '{print $1}')
log "Operator key hash: ${OPERATOR_HASH:0:16}..."

# ── Test 1: Baseline - Operator key works ──
log_test "Baseline Operator Access"
response=$(curl -s -w '\n%{http_code}' "${API_URL}/api/events?limit=1" -H "x-api-key: $OPERATOR_KEY")
status=$(get_status "$response")
assert_status "200" "$status" "Operator key access before revocation"

# ── Test 2: Revoke the operator key ──
log_test "Revoke Operator Token"
revoke_data="{\"target_key_hash\":\"$OPERATOR_HASH\",\"target_key_prefix\":\"op3r\",\"reason\":\"Chaos test revocation\",\"ttl_hours\":1}"
response=$(curl -s -w '\n%{http_code}' -X POST "${API_URL}/api/governance/revoke-token" \
  -H "x-api-key: $SOVEREIGN_KEY" \
  -H "x-governance-key: $GOV_KEY" \
  -H "Content-Type: application/json" \
  -d "$revoke_data")
status=$(get_status "$response")
body=$(get_body "$response")
assert_status "200" "$status" "Token revocation request"
assert_contains "$body" "TOKEN_REVOKED" "Revocation confirmed"

# ── Test 3: Verify operator key is now rejected ──
log_test "Verify Revoked Key Rejected"
sleep 1
response=$(curl -s -w '\n%{http_code}' "${API_URL}/api/events?limit=1" -H "x-api-key: $OPERATOR_KEY")
status=$(get_status "$response")
body=$(get_body "$response")
assert_status "401" "$status" "Revoked key returns 401"
assert_contains "$body" "TOKEN_REVOKED" "Error message confirms revocation"

# ── Test 4: Sovereign key still works ──
log_test "Sovereign Key Unaffected"
response=$(curl -s -w '\n%{http_code}' "${API_URL}/api/events?limit=1" -H "x-api-key: $SOVEREIGN_KEY")
status=$(get_status "$response")
assert_status "200" "$status" "Sovereign key still works"

# ── Test 5: Unrevoke the operator key ──
log_test "Unrevoke Operator Token"
unrevoke_data="{\"target_key_hash\":\"$OPERATOR_HASH\",\"reason\":\"Chaos test complete\"}"
response=$(curl -s -w '\n%{http_code}' -X POST "${API_URL}/api/governance/unrevoke-token" \
  -H "x-api-key: $SOVEREIGN_KEY" \
  -H "x-governance-key: $GOV_KEY" \
  -H "Content-Type: application/json" \
  -d "$unrevoke_data")
status=$(get_status "$response")
body=$(get_body "$response")
assert_status "200" "$status" "Token unrevocation request"
assert_contains "$body" "TOKEN_UNREVOKED" "Unrevocation confirmed"

# ── Test 6: Verify operator key works again ──
log_test "Verify Restored Access"
sleep 1
response=$(curl -s -w '\n%{http_code}' "${API_URL}/api/events?limit=1" -H "x-api-key: $OPERATOR_KEY")
status=$(get_status "$response")
assert_status "200" "$status" "Operator key works after unrevocation"

print_summary "Token Revocation" | tee -a "$LOG_FILE"
exit $FAIL_COUNT
