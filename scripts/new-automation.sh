#!/bin/bash
# Použitie: ./scripts/new-automation.sh <automation-name>
# Príklad:  ./scripts/new-automation.sh slack-notifier

AUTOMATION=$1

if [ -z "$AUTOMATION" ]; then
  echo "Použitie: ./scripts/new-automation.sh <automation-name>"
  exit 1
fi

AUTOMATION_DIR="automations/$AUTOMATION"

if [ -d "$AUTOMATION_DIR" ]; then
  echo "Chyba: Automatizácia '$AUTOMATION' už existuje."
  exit 1
fi

mkdir -p "$AUTOMATION_DIR"
cp -r automations/_template/* "$AUTOMATION_DIR/"

echo "Automatizácia '$AUTOMATION' bola úspešne vytvorená v $AUTOMATION_DIR"
