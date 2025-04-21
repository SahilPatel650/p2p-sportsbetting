// live-oracle-nba-new.js
const ethers = require("ethers");
const hre = require("hardhat");
const axios = require("axios");
require('dotenv').config();

// setup
const CONFIG = {
  betId: 7,
  targetGame: {
    homeTeam: "San Francisco Giants",
    awayTeam: "Los Angeles Angels"
  },
  threshold: 2, 
  isMoreThan: true,
  trackTeam: "San Francisco Giants",
  apiKey: process.env.ODDS_API_KEY,
  oracleAddress: "0x8ca0de8e880bdada0d4e0f8f0b274f97bfaebff9",
  betManagerAddress: "0xbf835ccd01d8395df0ed40206a302d62b24cad07",
  pollInterval: 60000,
  oddsApiEndpoint: "https://api.the-odds-api.com/v4/sports/baseball_mlb/scores"
};

const OracleRegistryABI = [
  "function submitResult(uint256 betId, bool outcome) external",
  "function getOracle(address user) external view returns (bool)",
  "function isOracle(address user) external view returns (bool)"
];

const BetManagerABI = [
  "function getBet(uint256 betId) external view returns (uint256 id, string memory description, uint256 totalAmount, uint256 totalYes, uint256 totalNo, bool isResolved, bool result, uint256 endTime, address creator)",
  "function isBetActive(uint256 betId) external view returns (bool)"
];

async function fetchGameData() {
  try {    
    const response = await axios.get(CONFIG.oddsApiEndpoint, {
      params: {apiKey: CONFIG.apiKey, daysFrom: 1}});
    
    if (response.status !== 200) {
      throw new Error(`api error: ${response.status}`);
    }
    
    const games = response.data;
    
    const targetGame = games.find(game => 
      game.home_team === CONFIG.targetGame.homeTeam && 
      game.away_team === CONFIG.targetGame.awayTeam
    );
    
    if (!targetGame) {
      console.log(`Game not found`);
      return null;
    }
    
    const homeScore = targetGame.scores?.find(s => s.name === CONFIG.targetGame.homeTeam)?.score || "0";
    const awayScore = targetGame.scores?.find(s => s.name === CONFIG.targetGame.awayTeam)?.score || "0";
    
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

async function monitorAndSettleBet() {
  try {
    console.log("\n Checking Bet status");
    console.log(`Target Game: ${CONFIG.targetGame.homeTeam} vs ${CONFIG.targetGame.awayTeam}`);
    console.log(`Tracking team: ${CONFIG.trackTeam}`);
    console.log(`Bet ID: ${CONFIG.betId}`);
    
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_URL);
    const privateKey = process.env.PRIVATE_KEY;
    const signer = new ethers.Wallet(privateKey, provider);
    
    console.log(`oracle addr: ${signer.address}`);
    
    const oracleRegistry = new ethers.Contract(CONFIG.oracleAddress, OracleRegistryABI, signer);
    const betManager = new ethers.Contract(CONFIG.betManagerAddress, BetManagerABI, signer);
    
    let isOracleWallet = false;
    
    isOracleWallet = await oracleRegistry.isOracle(signer.address);
    try {
      const [id, description, totalAmount, totalYes, totalNo, isResolved, result, endTime, creator] = await betManager.getBet(CONFIG.betId);
    
      const isBetActive = await betManager.isBetActive(CONFIG.betId);
      if (!isBetActive) {
        console.log(`No active bet found`);
        return false;
      }
    } catch (error) {
      console.log("Bet error: ", error);
      return false;
    }
    
    const gameData = await fetchGameData();

    let trackedTeamRuns;
    if (CONFIG.trackTeam === CONFIG.targetGame.homeTeam) {
      trackedTeamRuns = gameData.homeScore;
    } else if (CONFIG.trackTeam === CONFIG.targetGame.awayTeam) {
      trackedTeamRuns = gameData.awayScore;
    } else {
      return false;
    }

    let canSettle = false;
    let outcome = false;
    
    // If the game is ongoing, we can check if the score has passed a more bet.
    if (CONFIG.isMoreThan && trackedTeamRuns > CONFIG.threshold) {
      canSettle = true;
      outcome = true;
    } 
    // else wait until the game is complete
    else if (gameData.completed) {
      canSettle = true;
      
      if (CONFIG.isMoreThan) {
        outcome = trackedTeamRuns > CONFIG.threshold;
      } else {
        outcome = trackedTeamRuns < CONFIG.threshold;
      }
    } else {
      console.log(`Game in progress`);
      return false;
    }
    
    if (canSettle) {
      const tx = await oracleRegistry.submitResult(CONFIG.betId, outcome);
      await tx.wait();      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

// Main function
async function main() {
  
  const interval = setInterval(async () => {
    const settled = await monitorAndSettleBet();
    if (settled) {
      console.log("Bet done.");
      clearInterval(interval);
    }
  }, CONFIG.pollInterval);
  
  // shutdown
  process.on('SIGINT', () => {
    clearInterval(interval);
    process.exit(0);
  });
  
  await monitorAndSettleBet();
}

main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
}); 