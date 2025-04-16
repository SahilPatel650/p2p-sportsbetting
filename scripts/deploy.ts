import { parseEther } from "viem";
import hre from "hardhat";

async function main() {
  console.log("Deploying contracts...");

  // Get the deployer account
  const publicClient = await hre.viem.getPublicClient();

  // Deploy BetOracleRegistry first
  const oracleRegistry = await hre.viem.deployContract("BetOracleRegistry");
  console.log(`BetOracleRegistry deployed to: ${oracleRegistry.address}`);
  
  // Deploy BetManager with the oracle registry address
  const betManager = await hre.viem.deployContract("BetManager", [oracleRegistry.address]);
  console.log(`BetManager deployed to: ${betManager.address}`);
  
  // Add the BetManager contract as a trusted oracle (for demo purposes)
  await oracleRegistry.write.addOracle([betManager.address]);
  console.log("Added BetManager as a trusted oracle (for demo purposes)");
  
  console.log("Deployment completed!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 