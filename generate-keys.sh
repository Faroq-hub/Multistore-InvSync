#!/bin/bash
# Generate security keys for Railway environment variables

echo "=========================================="
echo "Generating Security Keys"
echo "=========================================="
echo ""
echo "ENCRYPTION_KEY:"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
echo ""
echo "ADMIN_TOKEN:"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
echo ""
echo "=========================================="
echo "Copy these values to Railway Variables"
echo "=========================================="

