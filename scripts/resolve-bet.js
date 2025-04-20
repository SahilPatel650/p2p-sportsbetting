// resolve-bet.js
const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
  // Get command line arguments
  const args = process.argv.slice(2);
  const betId = args[0] || "0"; // Default to bet ID 0 if not provided
  const creatorWon = args[1] === "true"; // Pass "true" or "false" as the second argument
  
  console.log(`Resolving bet ID: ${betId}`);
  console.log(`Creator won: ${creatorWon}`);
  
  // Contract addresses
  const betManagerAddress = process.env.NEXT_PUBLIC_BET_MANAGER_ADDRESS;
  const oracleRegistryAddress = process.env.NEXT_PUBLIC_BET_ORACLE_REGISTRY_ADDRESS;
  
  console.log(`BetManager address: ${betManagerAddress}`);
  console.log(`BetOracleRegistry address: ${oracleRegistryAddress}`);
  
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`Using account: ${signer.address}`);
  
  // Get contract instances
  const BetOracleRegistry = await ethers.getContractFactory("BetOracleRegistry");
  const oracleRegistry = BetOracleRegistry.attach(oracleRegistryAddress);
  
  const BetManager = await ethers.getContractFactory("BetManager");
  const betManager = BetManager.attach(betManagerAddress);
  
  // Check if the signer is an authorized oracle
  const isOracle = await oracleRegistry.isAuthorizedOracle(signer.address);
  console.log(`Is signer an authorized oracle? ${isOracle}`);
  
  if (!isOracle) {
    console.log("Adding signer as an oracle...");
    const tx = await oracleRegistry.addOracle(signer.address);
    await tx.wait();
    console.log("Signer added as an oracle");
  }
  
  // Get bet details before resolution
  try {
    const betDetails = await betManager.getBetDetails(betId);
    console.log("\nBet details before resolution:");
    console.log(`Creator: ${betDetails.creator}`);
    console.log(`Joiner: ${betDetails.joiner}`);
    console.log(`Amount: ${ethers.formatEther(betDetails.amount)} ETH`);
    console.log(`Sport Event: ${betDetails.sportEvent}`);
    console.log(`Selected Team: ${betDetails.selectedTeam}`);
    console.log(`Threshold: ${betDetails.threshold}`);
    console.log(`Is More Line: ${betDetails.isMoreLine}`);
    console.log(`Status: ${betDetails.status}`);
    console.log(`Is Settled: ${betDetails.isSettled}`);
    
    // Submit oracle result
    console.log("\nSubmitting oracle result...");
    const oracleTx = await oracleRegistry.submitResult(betId, creatorWon);
    await oracleTx.wait();
    console.log("Oracle result submitted");
    
    // Settle the bet
    console.log("\nSettling the bet...");
    const settleTx = await betManager.settleBet(betId, creatorWon);
    const receipt = await settleTx.wait();
    console.log(`Bet settled! Transaction hash: ${receipt.hash}`);
    
    // Get bet details after resolution
    const updatedBetDetails = await betManager.getBetDetails(betId);
    console.log("\nBet details after resolution:");
    console.log(`Status: ${updatedBetDetails.status}`);
    console.log(`Is Settled: ${updatedBetDetails.isSettled}`);
    console.log(`Creator Won: ${updatedBetDetails.creatorWon}`);
    
    console.log("\nResolution complete!");
  } catch (error) {
    console.error("Error resolving bet:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 