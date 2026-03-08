#!/usr/bin/env bash
# ── Chaos Test Suite: Master Runner ──
# Executes all chaos tests and generates a summary report

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/../results"
mkdir -p "$RESULTS_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

REPORT_FILE="$RESULTS_DIR/chaos_report_$(date +%Y%m%d_%H%M%S).log"

echo -e "${BOLD}${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║     GLOBAL INTELLIGENCE PLATFORM - CHAOS SUITE   ║"
echo "║         Resilience & Security Validation          ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "Started: $(date)" | tee "$REPORT_FILE"
echo ""

# Test registry: name -> script
declare -A TESTS=(
  ["Token Revocation"]="test_token_revocation.sh"
  ["WebSocket Flood"]="test_websocket_flood.sh"
  ["Canary Leak Detection"]="test_canary_leak.sh"
  ["Break-Glass Tiers"]="test_break_glass_tiers.sh"
  ["Anchor Integrity"]="test_anchor_integrity.sh"
  ["Redis Disconnect"]="test_redis_disconnect.sh"
)

# Ordered execution (Redis disconnect last since it's destructive)
TEST_ORDER=(
  "Token Revocation"
  "WebSocket Flood"
  "Canary Leak Detection"
  "Break-Glass Tiers"
  "Anchor Integrity"
  "Redis Disconnect"
)

# Skip destructive tests unless explicitly enabled
SKIP_DESTRUCTIVE="${SKIP_DESTRUCTIVE:-false}"

total_pass=0
total_fail=0
total_tests=0
declare -A RESULTS_MAP

# Pre-flight check
echo -e "${BOLD}Pre-flight Checks${NC}"
echo "─────────────────"

# Check API Gateway
api_status=$(curl -s -o /dev/null -w '%{http_code}' "${API_URL:-http://localhost:3001}/health" -H "x-api-key: ${SOVEREIGN_KEY:-7f9e1d3c5b7a9f2e4d6c8b0a2f4e6d7f9e1d}" --max-time 5 2>/dev/null || echo "000")
if [ "$api_status" = "200" ]; then
  echo -e "  ${GREEN}✓${NC} API Gateway reachable (port 3001)"
else
  echo -e "  ${RED}✗${NC} API Gateway unreachable (status=$api_status)"
  echo -e "  ${YELLOW}⚠${NC} Start the platform first: docker compose up -d"
  exit 1
fi

# Check Intelligence Engine
intel_status=$(curl -s -o /dev/null -w '%{http_code}' "${INTEL_URL:-http://localhost:8000}/health" --max-time 5 2>/dev/null || echo "000")
if [ "$intel_status" = "200" ]; then
  echo -e "  ${GREEN}✓${NC} Intelligence Engine reachable (port 8000)"
else
  echo -e "  ${YELLOW}⚠${NC} Intelligence Engine unreachable (status=$intel_status) - some tests may skip"
fi

# Check Docker
if docker compose -f "$SCRIPT_DIR/../docker-compose.yml" ps --format json &>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Docker Compose accessible"
  # Flush rate limit keys so previous runs don't interfere
  flushed=$(docker compose -f "$SCRIPT_DIR/../docker-compose.yml" exec -T redis \
    redis-cli --no-auth-warning KEYS "rl:*" 2>/dev/null | wc -l)
  if [ "$flushed" -gt 0 ]; then
    docker compose -f "$SCRIPT_DIR/../docker-compose.yml" exec -T redis \
      sh -c 'redis-cli --no-auth-warning KEYS "rl:*" | xargs -r redis-cli --no-auth-warning DEL' &>/dev/null
    echo -e "  ${GREEN}✓${NC} Rate limiter state cleared ($flushed keys)"
  else
    echo -e "  ${GREEN}✓${NC} Rate limiter state clean"
  fi
else
  echo -e "  ${YELLOW}⚠${NC} Docker Compose not accessible - Redis disconnect test will skip"
fi

echo ""

# Execute tests
for test_name in "${TEST_ORDER[@]}"; do
  script="${TESTS[$test_name]}"
  script_path="$SCRIPT_DIR/$script"

  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  Running: $test_name${NC}"
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  # Skip destructive tests if flag set
  if [ "$SKIP_DESTRUCTIVE" = "true" ] && [ "$test_name" = "Redis Disconnect" ]; then
    echo -e "  ${YELLOW}⚠ SKIPPED${NC}: Destructive test (set SKIP_DESTRUCTIVE=false to enable)"
    RESULTS_MAP["$test_name"]="SKIPPED"
    continue
  fi

  if [ ! -f "$script_path" ]; then
    echo -e "  ${RED}✗ Script not found:${NC} $script_path"
    RESULTS_MAP["$test_name"]="MISSING"
    continue
  fi

  # Run the test and capture exit code
  start_time=$(date +%s)
  bash "$script_path" 2>&1 | tee -a "$REPORT_FILE"
  exit_code=${PIPESTATUS[0]}
  end_time=$(date +%s)
  duration=$((end_time - start_time))

  total_tests=$((total_tests + 1))
  if [ "$exit_code" -eq 0 ]; then
    RESULTS_MAP["$test_name"]="PASS (${duration}s)"
    total_pass=$((total_pass + 1))
  else
    RESULTS_MAP["$test_name"]="FAIL:$exit_code (${duration}s)"
    total_fail=$((total_fail + 1))
  fi

  echo ""
  # Flush rate limiter after flood test to prevent cascading 429s
  if [ "$test_name" = "WebSocket Flood" ]; then
    echo -e "  ${CYAN}Flushing rate limiter state after flood test...${NC}"
    docker compose -f "$SCRIPT_DIR/../docker-compose.yml" exec -T redis \
      sh -c 'redis-cli --no-auth-warning KEYS "rl:*" | xargs -r redis-cli --no-auth-warning DEL' &>/dev/null || true
    sleep 3
  else
    sleep 2
  fi
done

# Final Report
echo -e "\n${BOLD}${CYAN}" | tee -a "$REPORT_FILE"
echo "╔══════════════════════════════════════════════════╗" | tee -a "$REPORT_FILE"
echo "║              CHAOS SUITE REPORT                   ║" | tee -a "$REPORT_FILE"
echo "╚══════════════════════════════════════════════════╝" | tee -a "$REPORT_FILE"
echo -e "${NC}" | tee -a "$REPORT_FILE"

for test_name in "${TEST_ORDER[@]}"; do
  result="${RESULTS_MAP[$test_name]:-NOT RUN}"
  if [[ "$result" == PASS* ]]; then
    echo -e "  ${GREEN}✓ PASS${NC}  $test_name  ${CYAN}$result${NC}" | tee -a "$REPORT_FILE"
  elif [[ "$result" == FAIL* ]]; then
    echo -e "  ${RED}✗ FAIL${NC}  $test_name  ${RED}$result${NC}" | tee -a "$REPORT_FILE"
  elif [[ "$result" == "SKIPPED" ]]; then
    echo -e "  ${YELLOW}⊘ SKIP${NC}  $test_name" | tee -a "$REPORT_FILE"
  else
    echo -e "  ${YELLOW}? $result${NC}  $test_name" | tee -a "$REPORT_FILE"
  fi
done

echo "" | tee -a "$REPORT_FILE"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "$REPORT_FILE"
echo -e "  Tests run:    $total_tests" | tee -a "$REPORT_FILE"
echo -e "  ${GREEN}Passed:      $total_pass${NC}" | tee -a "$REPORT_FILE"
echo -e "  ${RED}Failed:      $total_fail${NC}" | tee -a "$REPORT_FILE"

if [ "$total_fail" -eq 0 ]; then
  echo -e "\n  ${GREEN}${BOLD}ALL CHAOS TESTS PASSED${NC}" | tee -a "$REPORT_FILE"
else
  echo -e "\n  ${RED}${BOLD}$total_fail CHAOS TEST(S) FAILED${NC}" | tee -a "$REPORT_FILE"
fi

echo -e "\nCompleted: $(date)" | tee -a "$REPORT_FILE"
echo -e "Report: $REPORT_FILE"

exit $total_fail
