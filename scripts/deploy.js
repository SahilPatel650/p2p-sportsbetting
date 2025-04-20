// deploy.js
const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
  console.log("Starting deployment...");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  
  console.log(`Deploying contracts with account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.formatEther(await deployer.getBalance())} ETH`);

  // Deploy BetOracleRegistry
  console.log("\nDeploying BetOracleRegistry...");
  const BetOracleRegistry = await ethers.getContractFactory("BetOracleRegistry");
  const oracleRegistry = await BetOracleRegistry.deploy();
  await oracleRegistry.waitForDeployment();
  
  const oracleRegistryAddress = await oracleRegistry.getAddress();
  console.log(`BetOracleRegistry deployed to: ${oracleRegistryAddress}`);
  
  // Deploy BetManager with the address of BetOracleRegistry
  console.log("\nDeploying BetManager...");
  const BetManager = await ethers.getContractFactory("BetManager");
  const betManager = await BetManager.deploy(oracleRegistryAddress);
  await betManager.waitForDeployment();
  
  const betManagerAddress = await betManager.getAddress();
  console.log(`BetManager deployed to: ${betManagerAddress}`);
  
  // Verify deployment addresses match the expected addresses in .env.local
  const expectedBetManagerAddress = process.env.NEXT_PUBLIC_BET_MANAGER_ADDRESS?.toLowerCase();
  const expectedOracleRegistryAddress = process.env.NEXT_PUBLIC_BET_ORACLE_REGISTRY_ADDRESS?.toLowerCase();
  
  console.log("\nVerifying deployment addresses:");
  console.log(`BetManager expected: ${expectedBetManagerAddress}`);
  console.log(`BetManager actual: ${betManagerAddress.toLowerCase()}`);
  console.log(`BetOracleRegistry expected: ${expectedOracleRegistryAddress}`);
  console.log(`BetOracleRegistry actual: ${oracleRegistryAddress.toLowerCase()}`);
  
  // Add deployer as an authorized oracle for testing
  console.log("\nSetting up oracle authorization...");
  const addOracleTx = await oracleRegistry.addOracle(deployer.address);
  await addOracleTx.wait();
  console.log(`Added deployer (${deployer.address}) as an authorized oracle`);
  
  // Verify oracle authorization
  const isOracle = await oracleRegistry.isAuthorizedOracle(deployer.address);
  console.log(`Is deployer an authorized oracle? ${isOracle}`);
  
  // Testing contract interaction
  console.log("\nTesting contract interaction...");
  const isAuthorizedFromBetManager = await betManager.oracleRegistry();
  console.log(`BetManager's oracle registry address: ${isAuthorizedFromBetManager}`);
  
  if (isAuthorizedFromBetManager.toLowerCase() === oracleRegistryAddress.toLowerCase()) {
    console.log("✅ BetManager is correctly connected to BetOracleRegistry");
  } else {
    console.log("❌ Contract connection verification failed");
  }
  
  console.log("\nDeployment and verification complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 