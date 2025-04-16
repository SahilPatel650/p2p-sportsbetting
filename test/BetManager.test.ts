import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther } from "viem";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";

// Define the Bet type to handle the returned values
interface Bet {
  creator: string;
  joiner: string;
  amount: bigint;
  description: string;
  deadline: bigint;
  creatorWon: boolean;
  status: number;
  isSettled: boolean;
}

// Enum values for BetStatus
const BetStatus = {
  Open: 0,
  Active: 1,
  Completed: 2,
  Cancelled: 3,
  Refunded: 4
};

describe("Sports Betting Contracts", function () {
  // We define a fixture to reuse the same setup in every test
  async function deployContractsFixture() {
    // Get test accounts
    const [owner, user1, user2, oracle] = await hre.viem.getWalletClients();
    
    // Deploy the oracle registry
    const oracleRegistry = await hre.viem.deployContract("BetOracleRegistry");
    
    // Deploy the bet manager with the oracle registry address
    const betManager = await hre.viem.deployContract("BetManager", [oracleRegistry.address]);
    
    // Add the oracle address to the registry
    await oracleRegistry.write.addOracle([oracle.account.address]);
    
    return { betManager, oracleRegistry, owner, user1, user2, oracle };
  }
  
  describe("BetOracleRegistry", function () {
    it("Should allow owner to add and remove oracles", async function () {
      const { oracleRegistry, owner, user1 } = await loadFixture(deployContractsFixture);
      
      // Add user1 as oracle
      await oracleRegistry.write.addOracle([user1.account.address]);
      
      // Check if user1 is an oracle
      expect(await oracleRegistry.read.isAuthorizedOracle([user1.account.address])).to.be.true;
      
      // Remove user1 as oracle
      await oracleRegistry.write.removeOracle([user1.account.address]);
      
      // Check if user1 is no longer an oracle
      expect(await oracleRegistry.read.isAuthorizedOracle([user1.account.address])).to.be.false;
    });
  });
  
  describe("BetManager", function () {
    it("Should allow users to create bets", async function () {
      const { betManager, user1 } = await loadFixture(deployContractsFixture);
      
      // Set deadline to 1 day from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
      
      // Create a bet
      await betManager.write.createBet(
        ["Lakers vs Warriors", deadline],
        { value: parseEther("0.1"), account: user1.account }
      );
      
      // Get the bet
      const bet = await betManager.read.getBetDetails([0n]) as unknown as Bet;
      
      // Check bet details - use toLowerCase for address comparison
      expect(bet.creator.toLowerCase()).to.equal(user1.account.address.toLowerCase());
      expect(bet.amount).to.equal(parseEther("0.1"));
      expect(bet.description).to.equal("Lakers vs Warriors");
      expect(bet.deadline).to.equal(deadline);
      expect(Number(bet.status)).to.equal(BetStatus.Open);
    });
    
    it("Should allow users to join bets", async function () {
      const { betManager, user1, user2 } = await loadFixture(deployContractsFixture);
      
      // Set deadline to 1 day from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
      
      // Create a bet
      await betManager.write.createBet(
        ["Lakers vs Warriors", deadline],
        { value: parseEther("0.1"), account: user1.account }
      );
      
      // Join the bet
      await betManager.write.joinBet(
        [0n],
        { value: parseEther("0.1"), account: user2.account }
      );
      
      // Get the bet
      const bet = await betManager.read.getBetDetails([0n]) as unknown as Bet;
      
      // Check bet details - use toLowerCase for address comparison
      expect(bet.joiner.toLowerCase()).to.equal(user2.account.address.toLowerCase());
      expect(Number(bet.status)).to.equal(BetStatus.Active);
    });
    
    it("Should allow settlement of bets by oracle", async function () {
      const { betManager, oracleRegistry, user1, user2, oracle } = await loadFixture(deployContractsFixture);
      
      // Set deadline to 1 day from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
      
      // Create a bet
      await betManager.write.createBet(
        ["Lakers vs Warriors", deadline],
        { value: parseEther("0.1"), account: user1.account }
      );
      
      // Join the bet
      await betManager.write.joinBet(
        [0n],
        { value: parseEther("0.1"), account: user2.account }
      );
      
      // Settle the bet (creator wins)
      await betManager.write.settleBet(
        [0n, true],
        { account: oracle.account }
      );
      
      // Get the bet
      const bet = await betManager.read.getBetDetails([0n]) as unknown as Bet;
      
      // Check bet details
      expect(bet.creatorWon).to.be.true;
      expect(Number(bet.status)).to.equal(BetStatus.Completed);
      expect(bet.isSettled).to.be.true;
    });
    
    it("Should allow timeout refunds after deadline", async function () {
      const { betManager, user1, user2 } = await loadFixture(deployContractsFixture);
      
      // Set deadline to 1 hour from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      
      // Create a bet
      await betManager.write.createBet(
        ["Lakers vs Warriors", deadline],
        { value: parseEther("0.1"), account: user1.account }
      );
      
      // Join the bet
      await betManager.write.joinBet(
        [0n],
        { value: parseEther("0.1"), account: user2.account }
      );
      
      // Advance time past the deadline
      await time.increaseTo(Number(deadline) + 1);
      
      // Timeout the bet
      await betManager.write.timeoutBet([0n], { account: user1.account });
      
      // Get the bet
      const bet = await betManager.read.getBetDetails([0n]) as unknown as Bet;
      
      // Check bet details
      expect(Number(bet.status)).to.equal(BetStatus.Refunded);
    });
    
    it("Should allow bet cancellation before it's joined", async function () {
      const { betManager, user1 } = await loadFixture(deployContractsFixture);
      
      // Set deadline to 1 day from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
      
      // Create a bet
      await betManager.write.createBet(
        ["Lakers vs Warriors", deadline],
        { value: parseEther("0.1"), account: user1.account }
      );
      
      // Cancel the bet
      await betManager.write.cancelBet([0n], { account: user1.account });
      
      // Get the bet
      const bet = await betManager.read.getBetDetails([0n]) as unknown as Bet;
      
      // Check bet details
      expect(Number(bet.status)).to.equal(BetStatus.Cancelled);
    });
  });
}); 