#!/bin/bash
# Použitie: ./scripts/trigger.sh <automation-name> <payload.json>
# Príklad:  ./scripts/trigger.sh slack-notifier payload.json

AUTOMATION=$1
PAYLOAD_FILE=$2
BASE_URL=${BASE_URL:-"http://localhost:3000"}
API_KEY=${API_SECRET_KEY}

if [ -z "$AUTOMATION" ] || [ -z "$PAYLOAD_FILE" ]; then
  echo "Použitie: ./scripts/trigger.sh <automation> <payload.json>"
  exit 1
fi

curl -s -X POST "$BASE_URL/trigger/$AUTOMATION" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d @"$PAYLOAD_FILE" | jq .
