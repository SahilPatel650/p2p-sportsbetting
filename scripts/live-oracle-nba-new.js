// live-oracle-nba-new.js
const { ethers } = require("hardhat");
const axios = require("axios");
require('dotenv').config();

// Configuration
const CONFIG = {
  betId: 6,
  targetGame: {
    homeTeam: "Boston Celtics",
    awayTeam: "Orlando Magic"
  },
  threshold: 105, // Celtics points threshold (changed from 150)
  isMoreThan: true, // bet wins if Celtics points > threshold
  trackTeam: "Boston Celtics", // Only track this team's points
  apiKey: process.env.ODDS_API_KEY,
  oracleAddress: "0x8ca0de8e880bdada0d4e0f8f0b274f97bfaebff9", // Update with your oracle address
  betManagerAddress: "0xbf835ccd01d8395df0ed40206a302d62b24cad07", // Update with your BetManager address
  pollInterval: 60000, // 1 minute in milliseconds
  oddsApiEndpoint: "https://api.the-odds-api.com/v4/sports/basketball_nba/scores"
};

// ABIs
const OracleRegistryABI = [
  "function submitResult(uint256 betId, bool outcome) external",
  "function isOracle(address user) external view returns (bool)"
];

const BetManagerABI = [
  "function getBet(uint256 betId) external view returns (uint256 id, string memory description, uint256 totalAmount, uint256 totalYes, uint256 totalNo, bool isResolved, bool result, uint256 endTime, address creator)",
  "function isBetActive(uint256 betId) external view returns (bool)"
];

// Function to fetch game data from Odds API
async function fetchGameData() {
  try {
    console.log(`Fetching game data from Odds API...`);
    
    const response = await axios.get(CONFIG.oddsApiEndpoint, {
      params: {
        apiKey: CONFIG.apiKey,
        daysFrom: 1
      }
    });
    
    if (response.status !== 200) {
      throw new Error(`API returned status code ${response.status}`);
    }
    
    const games = response.data;
    
    // Find our target game
    const targetGame = games.find(game => 
      game.home_team === CONFIG.targetGame.homeTeam && 
      game.away_team === CONFIG.targetGame.awayTeam
    );
    
    if (!targetGame) {
      console.log(`Game not found: ${CONFIG.targetGame.homeTeam} vs ${CONFIG.targetGame.awayTeam}`);
      return null;
    }
    
    // Extract and log game info
    const homeScore = targetGame.scores?.find(s => s.name === CONFIG.targetGame.homeTeam)?.score || "0";
    const awayScore = targetGame.scores?.find(s => s.name === CONFIG.targetGame.awayTeam)?.score || "0";
    
    console.log(`Game Status: ${targetGame.completed ? "Completed" : "In Progress"}`);
    console.log(`Score: ${CONFIG.targetGame.homeTeam} ${homeScore} - ${CONFIG.targetGame.awayTeam} ${awayScore}`);
    
    return {
      completed: targetGame.completed,
      homeScore: parseInt(homeScore, 10), 
      awayScore: parseInt(awayScore, 10),
      lastUpdate: targetGame.last_update
    };
    
  } catch (error) {
    console.error("Error fetching game data:", error.message);
    console.error(error.response?.data || error);
    return null;
  }
}

// Function to monitor and settle bet
async function monitorAndSettleBet() {
  try {
    console.log("\n--- Starting bet monitoring session ---");
    console.log(`Target Game: ${CONFIG.targetGame.homeTeam} vs ${CONFIG.targetGame.awayTeam}`);
    console.log(`Tracking team: ${CONFIG.trackTeam}`);
    console.log(`Bet ID: ${CONFIG.betId}`);
    
    // Connect to contracts
    const [signer] = await ethers.getSigners();
    console.log(`Using oracle address: ${signer.address}`);
    
    const oracleRegistry = await ethers.getContractAt(OracleRegistryABI, CONFIG.oracleAddress, signer);
    const betManager = await ethers.getContractAt(BetManagerABI, CONFIG.betManagerAddress, signer);
    
    // Check if signer is an oracle
    const isOracle = await oracleRegistry.isOracle(signer.address);
    if (!isOracle) {
      console.error(`Address ${signer.address} is not registered as an oracle.`);
      return false;
    }
    console.log(`Oracle status confirmed for ${signer.address}`);
    
    // Get bet details
    const [id, description, totalAmount, totalYes, totalNo, isResolved, result, endTime, creator] = await betManager.getBet(CONFIG.betId);
    console.log(`Bet description: ${description}`);
    
    // Check if bet is active
    const isBetActive = await betManager.isBetActive(CONFIG.betId);
    if (!isBetActive) {
      console.log(`Bet ${CONFIG.betId} is not active.`);
      return false;
    }
    console.log(`Bet ${CONFIG.betId} is active.`);
    
    // Fetch game data
    const gameData = await fetchGameData();
    if (!gameData) {
      console.log("Could not fetch game data. Will try again next interval.");
      return false;
    }

    // Get tracked team's points
    let trackedTeamPoints;
    if (CONFIG.trackTeam === CONFIG.targetGame.homeTeam) {
      trackedTeamPoints = gameData.homeScore;
    } else if (CONFIG.trackTeam === CONFIG.targetGame.awayTeam) {
      trackedTeamPoints = gameData.awayScore;
    } else {
      console.error(`Error: Tracked team ${CONFIG.trackTeam} is not in the target game.`);
      return false;
    }
    
    // Calculate current total points
    console.log(`${CONFIG.trackTeam} current points: ${trackedTeamPoints}`);
    console.log(`Threshold: ${CONFIG.threshold}`);
    
    // Determine if bet can be settled
    let canSettle = false;
    let outcome = false;
    
    // For "more than" bets, we can settle early if score already exceeds threshold
    if (CONFIG.isMoreThan && trackedTeamPoints > CONFIG.threshold) {
      console.log(`${CONFIG.trackTeam}'s score has ALREADY EXCEEDED the threshold of ${CONFIG.threshold}!`);
      console.log("For 'more than' bets, we can settle now since basketball scores can't decrease.");
      canSettle = true;
      outcome = true;
    } 
    // For all other cases, we need to wait for game completion
    else if (gameData.completed) {
      console.log("Game is complete. Determining final outcome...");
      canSettle = true;
      
      if (CONFIG.isMoreThan) {
        outcome = trackedTeamPoints > CONFIG.threshold;
        console.log(`Bet condition: ${CONFIG.trackTeam} points > ${CONFIG.threshold}`);
      } else {
        outcome = trackedTeamPoints < CONFIG.threshold;
        console.log(`Bet condition: ${CONFIG.trackTeam} points < ${CONFIG.threshold}`);
      }
    } else {
      console.log(`Game is still in progress and ${CONFIG.trackTeam}'s score hasn't crossed threshold yet.`);
      console.log("Will check again next interval.");
      return false;
    }
    
    // Submit result if we've determined we can settle
    if (canSettle) {
      console.log(`Bet outcome: ${outcome ? "WIN" : "LOSE"}`);
      
      // Submit result to oracle
      console.log(`Submitting result (${outcome}) to Oracle Registry...`);
      const tx = await oracleRegistry.submitResult(CONFIG.betId, outcome);
      console.log(`Transaction submitted: ${tx.hash}`);
      await tx.wait();
      console.log(`Transaction confirmed! Bet has been resolved.`);
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Error in monitoring/settling bet:", error);
    return false;
  }
}

// Main function
async function main() {
  console.log("=== NBA Live Oracle Script ===");
  console.log(`Monitoring: ${CONFIG.targetGame.homeTeam} vs ${CONFIG.targetGame.awayTeam}`);
  console.log(`Tracking: ${CONFIG.trackTeam} points`);
  console.log(`Threshold: ${CONFIG.threshold} points`);
  console.log(`Bet ID: ${CONFIG.betId}`);
  console.log(`Polling interval: ${CONFIG.pollInterval / 1000} seconds`);
  
  // Set up interval
  const interval = setInterval(async () => {
    const settled = await monitorAndSettleBet();
    if (settled) {
      console.log("Bet has been successfully settled. Stopping monitoring.");
      clearInterval(interval);
    }
  }, CONFIG.pollInterval);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log("Shutting down oracle monitor...");
    clearInterval(interval);
    process.exit(0);
  });
  
  // Initial check
  await monitorAndSettleBet();
}

// Execute main and handle errors
main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
}); 