#!/bin/bash
# get_test_jwts.sh
# Sign in and get JWTs for all 6 test users

API_URL="http://127.0.0.1:54321/auth/v1"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

# Array of emails
EMAILS=(
  "admin@caci.com"
  "admin_a@caci.com"
  "pastor_a@caci.com"
  "secretary_a@caci.com"
  "volunteer_a@caci.com"
  "member_a@caci.com"
  "admin_b@caci.com"
)

PASSWORD="password123"

echo "Collecting JWTs..."
echo "-----------------------------------"

for EMAIL in "${EMAILS[@]}"; do
  # Try sign in
  SIGNIN_RESPONSE=$(curl -s -X POST "$API_URL/token?grant_type=password" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{ \"email\": \"$EMAIL\", \"password\": \"$PASSWORD\" }")
  
  ACCESS_TOKEN=$(echo $SIGNIN_RESPONSE | jq -r .access_token)
  
  if [ "$ACCESS_TOKEN" != "null" ] && [ -n "$ACCESS_TOKEN" ]; then
    echo "$EMAIL: $ACCESS_TOKEN"
  else
    # If sign in fails, try to sign up (if user doesn't exist or we want to reset)
    # But wait, sign up won't work if user exists.
    echo "$EMAIL: SIGN-IN FAILED"
    echo "Response: $SIGNIN_RESPONSE"
  fi
done
