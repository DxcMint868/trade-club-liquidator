import { expect } from "chai";
import { ethers } from "hardhat";
import { TradeClub_MatchManager, TradeClub_GovernanceToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("TradeClub_MatchManager", function () {
  let matchManager: TradeClub_MatchManager;
  let govToken: TradeClub_GovernanceToken;
  let owner: SignerWithAddress;
  let monachad1: SignerWithAddress;
  let monachad2: SignerWithAddress;
  let supporter: SignerWithAddress;

  const ENTRY_MARGIN = ethers.parseEther("0.1");
  const MATCH_DURATION = 3600; // 1 hour
  const MAX_PARTICIPANTS = 3;

  beforeEach(async function () {
    [owner, monachad1, monachad2, supporter] = await ethers.getSigners();

    // Deploy contracts
    const TradeClub_GovernanceToken = await ethers.getContractFactory("TradeClub_GovernanceToken");
    govToken = await TradeClub_GovernanceToken.deploy();

    const TradeClub_MatchManager = await ethers.getContractFactory("TradeClub_MatchManager");
    matchManager = await TradeClub_MatchManager.deploy();
  });

  describe("Match Creation", function () {
    it("Should create a match successfully", async function () {
      const tx = await matchManager
        .connect(monachad1)
        .createMatch(ENTRY_MARGIN, MATCH_DURATION, MAX_PARTICIPANTS, { value: ENTRY_MARGIN });

      const receipt = await tx.wait();
      const matchId = 1n;

      const match = await matchManager.getMatch(matchId);
      expect(match.creator).to.equal(monachad1.address);
      expect(match.entryMargin).to.equal(ENTRY_MARGIN);
      expect(match.duration).to.equal(MATCH_DURATION);
      expect(match.maxParticipants).to.equal(MAX_PARTICIPANTS);
    });

    it("Should fail with insufficient entry margin", async function () {
      await expect(
        matchManager
          .connect(monachad1)
          .createMatch(ENTRY_MARGIN, MATCH_DURATION, MAX_PARTICIPANTS, {
            value: ethers.parseEther("0.05"),
          })
      ).to.be.revertedWith("Insufficient entry margin");
    });

    it("Should fail with invalid duration", async function () {
      await expect(
        matchManager.connect(monachad1).createMatch(
          ENTRY_MARGIN,
          30 * 60, // 30 minutes - too short
          MAX_PARTICIPANTS,
          { value: ENTRY_MARGIN }
        )
      ).to.be.revertedWith("Invalid duration");
    });
  });

  describe("Joining Matches", function () {
    let matchId: bigint;

    beforeEach(async function () {
      const tx = await matchManager
        .connect(monachad1)
        .createMatch(ENTRY_MARGIN, MATCH_DURATION, MAX_PARTICIPANTS, { value: ENTRY_MARGIN });
      await tx.wait();
      matchId = 1n;
    });

    it("Should allow joining a created match", async function () {
      await matchManager.connect(monachad2).joinMatch(matchId, {
        value: ENTRY_MARGIN,
      });

      const participants = await matchManager.getMatchParticipants(matchId);
      expect(participants.length).to.equal(2);
      expect(participants[1]).to.equal(monachad2.address);
    });

    it("Should auto-start when match is full", async function () {
      await matchManager.connect(monachad2).joinMatch(matchId, {
        value: ENTRY_MARGIN,
      });

      // Join third participant to fill the match
      await matchManager.connect(supporter).joinMatch(matchId, {
        value: ENTRY_MARGIN,
      });

      const match = await matchManager.getMatch(matchId);
      expect(match.status).to.equal(1); // ACTIVE
    });

    it("Should fail when joining with insufficient margin", async function () {
      await expect(
        matchManager.connect(monachad2).joinMatch(matchId, {
          value: ethers.parseEther("0.05"),
        })
      ).to.be.revertedWith("Insufficient entry margin");
    });
  });

  describe("Match Settlement", function () {
    let matchId: bigint;

    beforeEach(async function () {
      // Create and fill a match
      const tx = await matchManager.connect(monachad1).createMatch(
        ENTRY_MARGIN,
        MATCH_DURATION,
        2, // 2 participants for quick testing
        { value: ENTRY_MARGIN }
      );
      await tx.wait();
      matchId = 1n;

      await matchManager.connect(monachad2).joinMatch(matchId, {
        value: ENTRY_MARGIN,
      });
    });

    it("Should update PnL correctly", async function () {
      const pnl = ethers.parseEther("0.05");
      await matchManager.updatePnL(matchId, monachad1.address, pnl);

      const participant = await matchManager.getParticipant(matchId, monachad1.address);
      expect(participant.pnl).to.equal(pnl);
    });

    it("Should settle match and distribute prizes", async function () {
      // Update PnL
      await matchManager.updatePnL(matchId, monachad1.address, ethers.parseEther("0.1"));
      await matchManager.updatePnL(matchId, monachad2.address, ethers.parseEther("0.05"));

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [MATCH_DURATION + 1]);
      await ethers.provider.send("evm_mine", []);

      const balanceBefore = await ethers.provider.getBalance(monachad1.address);

      await matchManager.settleMatch(matchId);

      const balanceAfter = await ethers.provider.getBalance(monachad1.address);
      const match = await matchManager.getMatch(matchId);

      expect(match.winner).to.equal(monachad1.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });

  describe("Platform Fee", function () {
    it("Should allow owner to update platform fee", async function () {
      await matchManager.setPlatformFee(500); // 5%
      expect(await matchManager.platformFeePercent()).to.equal(500);
    });

    it("Should fail when setting fee too high", async function () {
      await expect(matchManager.setPlatformFee(1500)).to.be.revertedWith("Fee cannot exceed 10%");
    });
  });
});
