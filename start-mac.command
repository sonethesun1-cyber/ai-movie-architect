#!/bin/bash
# Double-click this file in Finder to launch AI Movie Architect.
cd "$(dirname "$0")"
node start.js
echo ""
echo "Press any key to close this window..."
read -n 1 -s
