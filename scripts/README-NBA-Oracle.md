# NBA Live Oracle Script

This script integrates with the Odds API to monitor live NBA games and resolve bets on the blockchain based on real game outcomes.

## Overview

The `live-oracle-nba-new.js` script:

1. Fetches real-time NBA game data from the Odds API
2. Monitors a specific bet in the BetManager contract
3. Tracks the Boston Celtics vs Orlando Magic game (configurable)
4. Automatically settles the bet once the game completes based on the total points threshold

## Prerequisites

- Node.js and npm installed
- Hardhat environment set up
- An Odds API key (get one free at [the-odds-api.com](https://the-odds-api.com/))
- Access to an Ethereum wallet that's registered as an oracle

## Setup

1. Create a `.env` file in your project root with:

   ```
   ODDS_API_KEY=your_api_key_here
   ```

2. Ensure you have the correct contract addresses in the script:

   - Oracle Registry address
   - BetManager address

3. Configure the bet parameters in the script:
   - `betId`: The ID of the bet to monitor
   - `targetGame`: The teams to track (currently Boston Celtics vs Orlando Magic)
   - `threshold`: The points threshold for the bet (only used as default)
   - `isMoreThan`: Whether the bet wins when points > threshold (only used as default)

## Running the Script

Execute the script using Hardhat:

```bash
npx hardhat run scripts/live-oracle-nba-new.js --network localhost
```

For a testnet or mainnet deployment:

```bash
npx hardhat run scripts/live-oracle-nba-new.js --network [network_name]
```

## How It Works

1. The script connects to the contracts and verifies if your address is an authorized oracle
2. It fetches the specified bet details from the BetManager contract
3. It polls the Odds API every minute (configurable) to get the latest game data
4. When the game completes, it calculates if the bet conditions were met
5. If authorized, it submits the result to the Oracle Registry, which will trigger bet settlement

## Customization

You can modify the `CONFIG` object at the top of the script to:

- Track a different game by changing `targetGame`
- Monitor a different bet ID
- Adjust the polling interval
- Change the API endpoint or parameters

## Terminating the Script

Press `Ctrl+C` to gracefully stop the script.
