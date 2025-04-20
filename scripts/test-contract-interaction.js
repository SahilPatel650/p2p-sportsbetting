// test-contract-interaction.js
const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
  console.log("Testing contract interaction...");
  
  // Contract addresses from .env.local
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
  
  // Verify BetManager has correct reference to BetOracleRegistry
  const registryAddressFromManager = await betManager.oracleRegistry();
  console.log(`\nBetManager's oracle registry address: ${registryAddressFromManager}`);
  
  if (registryAddressFromManager.toLowerCase() === oracleRegistryAddress.toLowerCase()) {
    console.log("✅ BetManager is correctly connected to BetOracleRegistry");
  } else {
    console.log("❌ Contract connection verification failed");
    return;
  }
  
  // Add signer as an oracle if not already
  const isOracle = await oracleRegistry.isAuthorizedOracle(signer.address);
  console.log(`\nIs signer already an oracle? ${isOracle}`);
  
  if (!isOracle) {
    console.log("Adding signer as an oracle...");
    const tx = await oracleRegistry.addOracle(signer.address);
    await tx.wait();
    
    const isOracleNow = await oracleRegistry.isAuthorizedOracle(signer.address);
    console.log(`Is signer an oracle now? ${isOracleNow}`);
  }
  
  // Create a test bet
  console.log("\nCreating a test bet...");
  const betAmount = ethers.parseEther("0.001");
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  
  try {
    const createTx = await betManager.createBet(
      "Test bet for Braves vs Twins",
      deadline,
      "MLB_2023_2001", // sportEvent
      "Atlanta Braves", // selectedTeam
      5, // threshold - team will score more than 5 points
      true, // isMoreLine - "more than" threshold
      { value: betAmount }
    );
    
    const receipt = await createTx.wait();
    console.log(`✅ Test bet created! Transaction hash: ${receipt.hash}`);
    
    // Get the bet ID from events
    const betIdEvent = receipt.logs
      .filter(log => log.topics[0] === ethers.id("BetCreated(uint256,address,uint256,string,uint256,string,string,uint256,bool)").slice(0, 66))
      .map(log => {
        const decoded = betManager.interface.parseLog({
          topics: log.topics,
          data: log.data
        });
        return decoded?.args[0];
      })[0];
    
    if (betIdEvent) {
      const betId = betIdEvent;
      console.log(`Bet ID: ${betId}`);
      
      // Get bet details
      const betDetails = await betManager.getBetDetails(betId);
      console.log("\nBet details:");
      console.log(`Creator: ${betDetails.creator}`);
      console.log(`Amount: ${ethers.formatEther(betDetails.amount)} ETH`);
      console.log(`Sport Event: ${betDetails.sportEvent}`);
      console.log(`Selected Team: ${betDetails.selectedTeam}`);
      console.log(`Threshold: ${betDetails.threshold}`);
      console.log(`Is More Line: ${betDetails.isMoreLine}`);
      console.log(`Status: ${betDetails.status}`);
    }
    
  } catch (error) {
    console.error("Error creating test bet:", error);
  }
  
  console.log("\nContract testing complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 