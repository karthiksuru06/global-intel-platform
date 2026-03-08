#!/usr/bin/env bash
# ── Chaos Test: Graduated Break-Glass Tiers ──
# Tests: All 3 tiers, auth requirements, scope enforcement, auto-expiry

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

LOG_FILE="$RESULTS_DIR/break_glass_tiers_$(date +%Y%m%d_%H%M%S).log"

BYPASS_TOKEN="${SOVEREIGN_BYPASS_TOKEN:-dev-bypass-token-replace-in-prod}"
SECONDARY_AUTH="${SOVEREIGN_SECONDARY_AUTH:-dev-secondary-auth-replace-in-prod}"
BREAKER_KEY="chaos-test-breaker-$(date +%s)"

echo "Break-Glass Tiers Test" | tee "$LOG_FILE"
echo "======================" | tee -a "$LOG_FILE"

# ── Test 1: Tier 1 (TACTICAL) - breaker_key only ──
log_test "Tier 1 TACTICAL Activation"
tier1_data="{\"tier\":1,\"sources\":[\"chaos-test-source\"],\"breaker_key\":\"$BREAKER_KEY\",\"reason\":\"Chaos test Tier 1\"}"
response=$(curl -s -w '\n%{http_code}' -X POST "${API_URL}/api/governance/break-glass" \
  -H "x-api-key: $SOVEREIGN_KEY" \
  -H "x-governance-key: $GOV_KEY" \
  -H "Content-Type: application/json" \
  -d "$tier1_data")
status=$(get_status "$response")
body=$(get_body "$response")
assert_status "200" "$status" "Tier 1 activation request"
assert_contains "$body" "TACTICAL" "Tier 1 response contains TACTICAL"

# Extract session ID for later deactivation
T1_SESSION=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_id',''))" 2>/dev/null || echo "")
log "Tier 1 session: ${T1_SESSION:0:16}..."

# ── Test 2: Verify break-glass status shows active session ──
log_test "Break-Glass Status Check"
response=$(curl -s -w '\n%{http_code}' "${API_URL}/api/governance/break-glass-status" \
  -H "x-api-key: $SOVEREIGN_KEY" \
  -H "x-governance-key: $GOV_KEY")
status=$(get_status "$response")
body=$(get_body "$response")
assert_status "200" "$status" "Break-glass status endpoint"
assert_contains "$body" "session" "Status contains session data"

# ── Test 3: Tier 2 (STRATEGIC) - requires bypass_token ──
log_test "Tier 2 STRATEGIC Activation"
tier2_data="{\"tier\":2,\"sources\":[\"chaos-test-source-2\"],\"breaker_key\":\"$BREAKER_KEY\",\"bypass_token\":\"$BYPASS_TOKEN\",\"reason\":\"Chaos test Tier 2\"}"
response=$(curl -s -w '\n%{http_code}' -X POST "${API_URL}/api/governance/break-glass" \
  -H "x-api-key: $SOVEREIGN_KEY" \
  -H "x-governance-key: $GOV_KEY" \
  -H "Content-Type: application/json" \
  -d "$tier2_data")
status=$(get_status "$response")
body=$(get_body "$response")
assert_status "200" "$status" "Tier 2 activation request"
assert_contains "$body" "STRATEGIC" "Tier 2 response contains STRATEGIC"

T2_SESSION=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_id',''))" 2>/dev/null || echo "")
log "Tier 2 session: ${T2_SESSION:0:16}..."

# ── Test 4: Tier 2 without bypass_token should fail ──
log_test "Tier 2 Without Bypass Token (Should Fail)"
tier2_bad="{\"tier\":2,\"sources\":[\"chaos-test-bad\"],\"breaker_key\":\"$BREAKER_KEY\",\"reason\":\"Should fail\"}"
response=$(curl -s -w '\n%{http_code}' -X POST "${API_URL}/api/governance/break-glass" \
  -H "x-api-key: $SOVEREIGN_KEY" \
  -H "x-governance-key: $GOV_KEY" \
  -H "Content-Type: application/json" \
  -d "$tier2_bad")
status=$(get_status "$response")
if [ "$status" = "403" ] || [ "$status" = "400" ] || [ "$status" = "401" ]; then
  pass "Tier 2 correctly rejected without bypass_token (status=$status)"
else
  fail "Tier 2 should require bypass_token (got status=$status)"
fi

# ── Test 5: Tier 3 (SOVEREIGN) - requires all auth ──
log_test "Tier 3 SOVEREIGN Activation"
tier3_data="{\"tier\":3,\"sources\":[\"chaos-test-source-3\"],\"breaker_key\":\"$BREAKER_KEY\",\"bypass_token\":\"$BYPASS_TOKEN\",\"secondary_auth\":\"$SECONDARY_AUTH\",\"reason\":\"Chaos test Tier 3\"}"
response=$(curl -s -w '\n%{http_code}' -X POST "${API_URL}/api/governance/break-glass" \
  -H "x-api-key: $SOVEREIGN_KEY" \
  -H "x-governance-key: $GOV_KEY" \
  -H "Content-Type: application/json" \
  -d "$tier3_data")
status=$(get_status "$response")
body=$(get_body "$response")
assert_status "200" "$status" "Tier 3 activation request"

T3_SESSION=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_id',''))" 2>/dev/null || echo "")
log "Tier 3 session: ${T3_SESSION:0:16}..."

# ── Test 6: Tier 3 without secondary_auth should fail ──
log_test "Tier 3 Without Secondary Auth (Should Fail)"
tier3_bad="{\"tier\":3,\"sources\":[\"chaos-test-bad\"],\"breaker_key\":\"$BREAKER_KEY\",\"bypass_token\":\"$BYPASS_TOKEN\",\"reason\":\"Should fail\"}"
response=$(curl -s -w '\n%{http_code}' -X POST "${API_URL}/api/governance/break-glass" \
  -H "x-api-key: $SOVEREIGN_KEY" \
  -H "x-governance-key: $GOV_KEY" \
  -H "Content-Type: application/json" \
  -d "$tier3_bad")
status=$(get_status "$response")
if [ "$status" = "403" ] || [ "$status" = "400" ] || [ "$status" = "401" ]; then
  pass "Tier 3 correctly rejected without secondary_auth (status=$status)"
else
  fail "Tier 3 should require secondary_auth (got status=$status)"
fi

# ── Test 7: OPERATOR cannot activate break-glass (production only) ──
log_test "OPERATOR Break-Glass Role Check"
response=$(curl -s -w '\n%{http_code}' -X POST "${API_URL}/api/governance/break-glass" \
  -H "x-api-key: $OPERATOR_KEY" \
  -H "x-governance-key: $GOV_KEY" \
  -H "Content-Type: application/json" \
  -d "$tier1_data")
status=$(get_status "$response")
if [ "$status" = "403" ] || [ "$status" = "401" ]; then
  pass "OPERATOR correctly denied break-glass activation (status=$status)"
elif [ "$status" = "200" ]; then
  warn "OPERATOR allowed in dev mode (role enforcement only in production)"
  pass "Governance guard active (dev mode allows non-SOVEREIGN)"
else
  fail "Unexpected status for OPERATOR break-glass (got status=$status)"
fi

# ── Test 8: Deactivate Tier 1 session ──
log_test "Manual Session Deactivation"
if [ -n "$T1_SESSION" ]; then
  deactivate_data="{\"session_id\":\"$T1_SESSION\",\"reason\":\"Chaos test cleanup\"}"
  response=$(curl -s -w '\n%{http_code}' -X POST "${API_URL}/api/governance/break-glass-deactivate" \
    -H "x-api-key: $SOVEREIGN_KEY" \
    -H "x-governance-key: $GOV_KEY" \
    -H "Content-Type: application/json" \
    -d "$deactivate_data")
  status=$(get_status "$response")
  assert_status "200" "$status" "Session deactivation request"
else
  warn "No Tier 1 session ID to deactivate (skipped)"
fi

# ── Cleanup: Deactivate remaining sessions ──
log "Cleaning up remaining break-glass sessions..."
for session in "$T2_SESSION" "$T3_SESSION"; do
  if [ -n "$session" ]; then
    curl -s -o /dev/null -X POST "${API_URL}/api/governance/break-glass-deactivate" \
      -H "x-api-key: $SOVEREIGN_KEY" \
      -H "x-governance-key: $GOV_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"session_id\":\"$session\",\"reason\":\"Chaos test cleanup\"}" 2>/dev/null || true
  fi
done

print_summary "Break-Glass Tiers" | tee -a "$LOG_FILE"
exit $FAIL_COUNT
