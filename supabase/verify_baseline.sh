#!/bin/bash
# verify_baseline.sh
# Verify baseline access for Admin A

REST_URL="http://127.0.0.1:54321/rest/v1"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
ADMIN_A_JWT=$1

if [ -z "$ADMIN_A_JWT" ]; then
  echo "Usage: ./verify_baseline.sh <admin_a_jwt>"
  exit 1
fi

echo "Querying members_view as Admin A..."
curl -s -X GET "$REST_URL/members_view?select=*" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ADMIN_A_JWT" \
  -H "Content-Type: application/json" | jq .
