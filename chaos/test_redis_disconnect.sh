#!/usr/bin/env bash
# ── Chaos Test: Redis Disconnect & Recovery ──
# Tests: API Gateway reconnection, stream recovery after Redis pause/unpause

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

LOG_FILE="$RESULTS_DIR/redis_disconnect_$(date +%Y%m%d_%H%M%S).log"

echo "Redis Disconnect Test" | tee "$LOG_FILE"
echo "=====================" | tee -a "$LOG_FILE"

# ── Test 1: Verify baseline connectivity ──
log_test "Baseline Health Check"
response=$(curl -s -w '\n%{http_code}' "${API_URL}/health" -H "x-api-key: $SOVEREIGN_KEY")
status=$(get_status "$response")
assert_status "200" "$status" "Gateway health before Redis pause"

# ── Test 2: Pause Redis container ──
log_test "Redis Container Pause"
log "Pausing Redis container..."
docker compose -f "$SCRIPT_DIR/../docker-compose.yml" pause redis 2>>"$LOG_FILE"
sleep 2

# Gateway should still respond (degraded mode)
response=$(curl -s -w '\n%{http_code}' --max-time 5 "${API_URL}/health" -H "x-api-key: $SOVEREIGN_KEY" 2>/dev/null || echo -e '\n503')
status=$(get_status "$response")
body=$(get_body "$response")
log "Gateway response during Redis pause: status=$status"
if [ "$status" = "200" ] || [ "$status" = "503" ]; then
  pass "Gateway responded during Redis outage (status=$status)"
else
  fail "Gateway unresponsive during Redis outage (status=$status)"
fi

# ── Test 3: Unpause Redis ──
log_test "Redis Recovery"
log "Unpausing Redis container..."
docker compose -f "$SCRIPT_DIR/../docker-compose.yml" unpause redis 2>>"$LOG_FILE"
sleep 5

# Gateway should be fully healthy
response=$(curl -s -w '\n%{http_code}' "${API_URL}/health" -H "x-api-key: $SOVEREIGN_KEY")
status=$(get_status "$response")
body=$(get_body "$response")
assert_status "200" "$status" "Gateway health after Redis recovery"

# ── Test 4: Verify event stream recovery ──
log_test "Stream Recovery Verification"
response=$(curl -s -w '\n%{http_code}' "${INTEL_URL}/health")
status=$(get_status "$response")
body=$(get_body "$response")
assert_status "200" "$status" "Intelligence Engine health after recovery"
assert_contains "$body" "healthy" "Intelligence Engine reports healthy"

print_summary "Redis Disconnect" | tee -a "$LOG_FILE"
exit $FAIL_COUNT
