# P2P Sports Betting Contracts

This repository contains the smart contracts for a peer-to-peer sports betting platform.

## Prerequisites

- Node.js (14+)
- npm or yarn
- MetaMask or other Ethereum wallet

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Create `.env` file with your private key and Sepolia RPC URL:

   ```
   PRIVATE_KEY=your_private_key_here
   SEPOLIA_URL=your_sepolia_rpc_url_here
   ```

3. Create `.env.local` in the frontend directory with contract addresses:
   ```
   NEXT_PUBLIC_BET_MANAGER_ADDRESS=0xbf835ccd01d8395df0ed40206a302d62b24cad07
   NEXT_PUBLIC_BET_ORACLE_REGISTRY_ADDRESS=0x8ca0de8e880bdada0d4e0f8f0b274f97bfaebff9
   ```

## Deployment

Deploy the contracts to Sepolia:

```
npm run deploy
```

This will:

1. Deploy the BetOracleRegistry contract
2. Deploy the BetManager contract (with a reference to the BetOracleRegistry)
3. Add the deployer address as an authorized oracle
4. Verify the contracts are properly connected

## Testing Contract Interaction

Test the interaction between the deployed contracts:

```
npm run test-interaction
```

This will:

1. Verify BetManager has the correct reference to BetOracleRegistry
2. Add your address as an oracle (if not already)
3. Create a test bet for Braves vs Twins

## Resolving a Bet (Oracle)

To resolve a bet as an oracle, run:

```
npm run resolve-bet -- [betId] [creatorWon]
```

Example:

```
npm run resolve-bet -- 0 true
```

This will:

1. Add your address as an oracle (if not already)
2. Submit the result to the BetOracleRegistry
3. Settle the bet in the BetManager, transferring funds to the winner

## Usage in Frontend

The BetResolver component uses MetaMask to interact with these contracts:

1. When "Resolve with Oracle" is clicked, it calls the contract's settleBet function
2. MetaMask will prompt for transaction approval
3. Once confirmed, funds are transferred to the winner

## Contract Addresses

- BetManager: 0xbf835ccd01d8395df0ed40206a302d62b24cad07
- BetOracleRegistry: 0x8ca0de8e880bdada0d4e0f8f0b274f97bfaebff9
