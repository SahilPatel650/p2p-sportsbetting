#!/bin/bash
echo "Starting deployment and verification process..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Compile contracts
echo "Compiling contracts..."
npm run compile

# Deploy contracts
echo "Deploying contracts to Sepolia..."
npm run deploy

# Test contract interaction
echo "Testing contract interaction..."
npm run test-interaction

# Create a sample bet
echo "Creating a sample bet..."
npm run test-interaction

echo "Deployment complete! Your contracts are ready to use."
echo "BetManager: $(grep NEXT_PUBLIC_BET_MANAGER_ADDRESS frontend/.env.local | cut -d= -f2)"
echo "BetOracleRegistry: $(grep NEXT_PUBLIC_BET_ORACLE_REGISTRY_ADDRESS frontend/.env.local | cut -d= -f2)" 