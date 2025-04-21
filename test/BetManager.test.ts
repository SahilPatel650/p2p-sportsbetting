import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther } from "viem";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";

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

const BetStatus = {
  Open: 0,
  Active: 1,
  Completed: 2,
  Cancelled: 3,
  Refunded: 4
};

describe("Sports Betting Contracts", function () {
  async function deployContractsFixture() {
    const [owner, user1, user2, oracle] = await hre.viem.getWalletClients();
    
    const oracleRegistry = await hre.viem.deployContract("BetOracleRegistry");
    
    const betManager = await hre.viem.deployContract("BetManager", [oracleRegistry.address]);
    
    await oracleRegistry.write.addOracle([oracle.account.address]);
    
    return { betManager, oracleRegistry, owner, user1, user2, oracle };
  }
  
  describe("BetOracleRegistry", function () {
    it("Should allow owner to add and remove oracles", async function () {
      const { oracleRegistry, owner, user1 } = await loadFixture(deployContractsFixture);
      
      await oracleRegistry.write.addOracle([user1.account.address]);
      
      expect(await oracleRegistry.read.isAuthorizedOracle([user1.account.address])).to.be.true;
      
      await oracleRegistry.write.removeOracle([user1.account.address]);
      
      expect(await oracleRegistry.read.isAuthorizedOracle([user1.account.address])).to.be.false;
    });
  });
  
  describe("BetManager", function () {
    it("Should allow users to create bets", async function () {
      const { betManager, user1 } = await loadFixture(deployContractsFixture);
      
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
      
      await betManager.write.createBet(
        ["Lakers vs Warriors", deadline],
        { value: parseEther("0.1"), account: user1.account }
      );
      
      const bet = await betManager.read.getBetDetails([0n]) as unknown as Bet;
      
      expect(bet.creator.toLowerCase()).to.equal(user1.account.address.toLowerCase());
      expect(bet.amount).to.equal(parseEther("0.1"));
      expect(bet.description).to.equal("Lakers vs Warriors");
      expect(bet.deadline).to.equal(deadline);
      expect(Number(bet.status)).to.equal(BetStatus.Open);
    });
    
    it("Should allow users to join bets", async function () {
      const { betManager, user1, user2 } = await loadFixture(deployContractsFixture);
      
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
      
      await betManager.write.createBet(
        ["Lakers vs Warriors", deadline],
        { value: parseEther("0.1"), account: user1.account }
      );
      
      await betManager.write.joinBet(
        [0n],
        { value: parseEther("0.1"), account: user2.account }
      );
      
      const bet = await betManager.read.getBetDetails([0n]) as unknown as Bet;
      
      expect(bet.joiner.toLowerCase()).to.equal(user2.account.address.toLowerCase());
      expect(Number(bet.status)).to.equal(BetStatus.Active);
    });
    
    it("Should allow settlement of bets by oracle", async function () {
      const { betManager, oracleRegistry, user1, user2, oracle } = await loadFixture(deployContractsFixture);
      
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
      
      await betManager.write.createBet(
        ["Lakers vs Warriors", deadline],
        { value: parseEther("0.1"), account: user1.account }
      );
      
      await betManager.write.joinBet(
        [0n],
        { value: parseEther("0.1"), account: user2.account }
      );
      
      await betManager.write.settleBet(
        [0n, true],
        { account: oracle.account }
      );
      
      const bet = await betManager.read.getBetDetails([0n]) as unknown as Bet;
      
      expect(bet.creatorWon).to.be.true;
      expect(Number(bet.status)).to.equal(BetStatus.Completed);
      expect(bet.isSettled).to.be.true;
    });
    
    it("Should allow timeout refunds after deadline", async function () {
      const { betManager, user1, user2 } = await loadFixture(deployContractsFixture);
      
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      
      await betManager.write.createBet(
        ["Lakers vs Warriors", deadline],
        { value: parseEther("0.1"), account: user1.account }
      );
      
      await betManager.write.joinBet(
        [0n],
        { value: parseEther("0.1"), account: user2.account }
      );
      
      await time.increaseTo(Number(deadline) + 1);
      
      await betManager.write.timeoutBet([0n], { account: user1.account });
      
      const bet = await betManager.read.getBetDetails([0n]) as unknown as Bet;
      
      expect(Number(bet.status)).to.equal(BetStatus.Refunded);
    });
    
    it("Should allow bet cancellation before it's joined", async function () {
      const { betManager, user1 } = await loadFixture(deployContractsFixture);
      
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
      
      await betManager.write.createBet(
        ["Lakers vs Warriors", deadline],
        { value: parseEther("0.1"), account: user1.account }
      );
      
      await betManager.write.cancelBet([0n], { account: user1.account });
      
      const bet = await betManager.read.getBetDetails([0n]) as unknown as Bet;
      
      expect(Number(bet.status)).to.equal(BetStatus.Cancelled);
    });
  });
}); 