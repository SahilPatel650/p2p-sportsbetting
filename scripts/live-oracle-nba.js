// live-oracle-nba.js
const { ethers } = require("hardhat");
const axios = require("axios");
require('dotenv').config();

// Configuration
const CONFIG = {
  betId: 6, // The bet ID to monitor
  expectedOutcome: true, // The outcome you expect (true if Celtics win, false if Magic win)
  targetGame: {
    homeTeam: "Boston Celtics",
    awayTeam: "Orlando Magic",
  },
  apiKey: "9e57e230f31bbb2e7aacdefc6bc95a0c", // The Odds API key
  oracleAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Replace with actual Oracle contract address
  betManagerAddress: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199", // Replace with actual BetManager contract address
  pollInterval: 60000, // Poll every 60 seconds
};

// Contract ABIs
const OracleABI = [
  "function submitResult(uint256 betId, bool result) public",
  "function owner() public view returns (address)",
];

const BetManagerABI = [
  "function getBet(uint256 betId) public view returns (tuple(uint256 id, address creator, address acceptor, uint256 amount, string description, uint256 creationTime, uint256 expirationTime, bool isSettled, bool outcome, bool isCancelled, bool isAccepted))",
];

async function fetchGameData() {
  try {
    console.log("Fetching game data from Odds API...");
    const response = await axios.get(
      `https://api.the-odds-api.com/v4/sports/basketball_nba/scores?apiKey=${CONFIG.apiKey}&daysFrom=1`
    );

    if (response.data && Array.isArray(response.data)) {
      const targetGame = response.data.find(
        (game) =>
          game.home_team === CONFIG.targetGame.homeTeam &&
          game.away_team === CONFIG.targetGame.awayTeam
      );

      if (targetGame) {
        console.log(`Found target game: ${targetGame.home_team} vs ${targetGame.away_team}`);
        console.log(`Game status: ${targetGame.completed ? "Completed" : "In progress"}`);
        
        if (targetGame.scores && targetGame.scores.length === 2) {
          const homeTeamScore = parseInt(
            targetGame.scores.find((s) => s.name === CONFIG.targetGame.homeTeam)?.score || "0"
          );
          const awayTeamScore = parseInt(
            targetGame.scores.find((s) => s.name === CONFIG.targetGame.awayTeam)?.score || "0"
          );
          
          console.log(`Current score: ${CONFIG.targetGame.homeTeam} ${homeTeamScore} - ${CONFIG.targetGame.awayTeam} ${awayTeamScore}`);
          
          return {
            gameId: targetGame.id,
            homeTeam: targetGame.home_team,
            awayTeam: targetGame.away_team,
            homeTeamScore,
            awayTeamScore,
            completed: targetGame.completed,
            lastUpdate: targetGame.last_update,
          };
        }
      } else {
        console.log("Target game not found in the API response");
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching game data:", error.message);
    return null;
  }
}

async function monitorAndSettleBet() {
  try {
    // Connect to contracts
    const [signer] = await ethers.getSigners();
    console.log(`Using signer address: ${signer.address}`);
    
    const oracle = new ethers.Contract(CONFIG.oracleAddress, OracleABI, signer);
    const betManager = new ethers.Contract(CONFIG.betManagerAddress, BetManagerABI, signer);
    
    // Verify oracle ownership
    const oracleOwner = await oracle.owner();
    if (oracleOwner.toLowerCase() !== signer.address.toLowerCase()) {
      console.warn(`Warning: Your address (${signer.address}) is not the oracle owner (${oracleOwner})`);
      console.warn("You may not have permission to submit results!");
    }
    
    // Get bet details
    let bet;
    try {
      bet = await betManager.getBet(CONFIG.betId);
      console.log(`Bet ID ${CONFIG.betId} details:`);
      console.log(`- Creator: ${bet.creator}`);
      console.log(`- Description: ${bet.description}`);
      console.log(`- Amount: ${ethers.formatEther(bet.amount)} ETH`);
      console.log(`- Is Settled: ${bet.isSettled}`);
      console.log(`- Is Accepted: ${bet.isAccepted}`);
    } catch (error) {
      console.error(`Error fetching bet ${CONFIG.betId}:`, error.message);
      return;
    }
    
    // If bet is already settled or not accepted, exit
    if (bet.isSettled) {
      console.log(`Bet ${CONFIG.betId} is already settled. Exiting.`);
      return;
    }
    
    if (!bet.isAccepted) {
      console.log(`Bet ${CONFIG.betId} has not been accepted yet. Waiting...`);
      return;
    }
    
    // Fetch game data
    const gameData = await fetchGameData();
    if (!gameData) {
      console.log("No game data available. Will try again later.");
      return;
    }
    
    // Check if game is completed to determine outcome
    if (gameData.completed) {
      const celticsWon = gameData.homeTeamScore > gameData.awayTeamScore;
      console.log(`Game completed! ${gameData.homeTeam} ${celticsWon ? "won" : "lost"}`);
      
      // Submit result to oracle if it matches our expected outcome
      // (In a real scenario, you'd determine the outcome based on the bet description and game result)
      if (celticsWon === CONFIG.expectedOutcome) {
        console.log(`Submitting result to oracle: ${CONFIG.expectedOutcome}`);
        try {
          const tx = await oracle.submitResult(CONFIG.betId, CONFIG.expectedOutcome);
          console.log(`Transaction submitted: ${tx.hash}`);
          await tx.wait();
          console.log(`Bet ${CONFIG.betId} settled successfully!`);
          process.exit(0);
        } catch (error) {
          console.error("Error submitting result:", error.message);
        }
      } else {
        console.log(`Expected outcome (${CONFIG.expectedOutcome}) doesn't match game result. Please review.`);
      }
    } else {
      // Game in progress, provide current status
      console.log(`Game in progress. Current score: ${gameData.homeTeam} ${gameData.homeTeamScore} - ${gameData.awayTeam} ${gameData.awayTeamScore}`);
      console.log(`Last update: ${new Date(gameData.lastUpdate).toLocaleString()}`);
      console.log("Waiting for game to complete...");
    }
  } catch (error) {
    console.error("Error in monitoring and settling bet:", error.message);
  }
}

// Main execution
async function main() {
  console.log("Starting NBA Live Oracle Script");
  console.log(`Monitoring bet ID: ${CONFIG.betId}`);
  console.log(`Target game: ${CONFIG.targetGame.homeTeam} vs ${CONFIG.targetGame.awayTeam}`);
  
  // Initial check
  await monitorAndSettleBet();
  
  // Setup interval for continuous monitoring
  const intervalId = setInterval(monitorAndSettleBet, CONFIG.pollInterval);
  
  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("Stopping NBA Live Oracle Script...");
    clearInterval(intervalId);
    process.exit(0);
  });
}

// Run the script
main().catch((error) => {
  console.error("Error in main execution:", error);
  process.exit(1);
}); 