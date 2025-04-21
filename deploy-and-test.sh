#!/bin/bash
echo "MGT4074 - Starting deployment and verification process"

# Install dependencies
echo "MGT4074 - Installing dependencies"
npm install

# Compile contracts
echo "Compiling"
npm run compile

# Deploy contracts
echo "Deploying contracts"
npm run deploy

# Test contract interaction
echo "Testing contract"
npm run test-interaction

# Create a sample bet
echo "Testing sample bet"
npm run test-interaction

echo "Contracts are ready to use."
echo "BetManager: $(grep NEXT_PUBLIC_BET_MANAGER_ADDRESS frontend/.env.local | cut -d= -f2)"
echo "BetOracleRegistry: $(grep NEXT_PUBLIC_BET_ORACLE_REGISTRY_ADDRESS frontend/.env.local | cut -d= -f2)" 