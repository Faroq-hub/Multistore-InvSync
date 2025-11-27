#!/bin/bash
# API Endpoint Testing Script

BASE_URL="https://web-production-33f26.up.railway.app"

echo "=========================================="
echo "API Endpoint Testing"
echo "=========================================="
echo ""

# Test 1: Health Endpoint (Public)
echo "1. Testing Health Endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/health")
HTTP_STATUS=$(echo "$HEALTH_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | grep -v "HTTP_STATUS")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Health endpoint: PASSED"
    echo "   Response: $HEALTH_BODY"
else
    echo "❌ Health endpoint: FAILED (HTTP $HTTP_STATUS)"
    echo "   Response: $HEALTH_BODY"
fi
echo ""

# Test 2: Feed Endpoint (Requires API Key)
echo "2. Testing Feed Endpoint (requires API key)..."
if [ -z "$API_KEY" ]; then
    echo "⚠️  Skipping - API_KEY not set"
    echo "   Set API_KEY environment variable to test"
else
    FEED_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -H "X-API-Key: $API_KEY" \
        "$BASE_URL/v1/feed.json?limit=1")
    FEED_HTTP=$(echo "$FEED_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    if [ "$FEED_HTTP" = "200" ]; then
        echo "✅ Feed endpoint: PASSED"
    else
        echo "❌ Feed endpoint: FAILED (HTTP $FEED_HTTP)"
    fi
fi
echo ""

# Test 3: Admin Connections (Requires Admin Token)
echo "3. Testing Admin Connections Endpoint (requires admin token)..."
if [ -z "$ADMIN_TOKEN" ]; then
    echo "⚠️  Skipping - ADMIN_TOKEN not set"
    echo "   Set ADMIN_TOKEN environment variable to test"
else
    ADMIN_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -H "X-Admin-Token: $ADMIN_TOKEN" \
        "$BASE_URL/admin/connections")
    ADMIN_HTTP=$(echo "$ADMIN_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    if [ "$ADMIN_HTTP" = "200" ]; then
        echo "✅ Admin connections endpoint: PASSED"
    else
        echo "❌ Admin connections endpoint: FAILED (HTTP $ADMIN_HTTP)"
    fi
fi
echo ""

# Test 4: Admin Jobs
echo "4. Testing Admin Jobs Endpoint (requires admin token)..."
if [ -z "$ADMIN_TOKEN" ]; then
    echo "⚠️  Skipping - ADMIN_TOKEN not set"
else
    JOBS_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -H "X-Admin-Token: $ADMIN_TOKEN" \
        "$BASE_URL/admin/jobs?limit=10")
    JOBS_HTTP=$(echo "$JOBS_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    if [ "$JOBS_HTTP" = "200" ]; then
        echo "✅ Admin jobs endpoint: PASSED"
    else
        echo "❌ Admin jobs endpoint: FAILED (HTTP $JOBS_HTTP)"
    fi
fi
echo ""

# Test 5: Admin Audit Logs
echo "5. Testing Admin Audit Logs Endpoint (requires admin token)..."
if [ -z "$ADMIN_TOKEN" ]; then
    echo "⚠️  Skipping - ADMIN_TOKEN not set"
else
    AUDIT_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -H "X-Admin-Token: $ADMIN_TOKEN" \
        "$BASE_URL/admin/audit?limit=10")
    AUDIT_HTTP=$(echo "$AUDIT_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    if [ "$AUDIT_HTTP" = "200" ]; then
        echo "✅ Admin audit endpoint: PASSED"
    else
        echo "❌ Admin audit endpoint: FAILED (HTTP $AUDIT_HTTP)"
    fi
fi
echo ""

echo "=========================================="
echo "Testing Complete"
echo "=========================================="
echo ""
echo "To test authenticated endpoints, set:"
echo "  export API_KEY='your-api-key'"
echo "  export ADMIN_TOKEN='your-admin-token'"
echo ""
echo "Then run: ./test-endpoints.sh"

