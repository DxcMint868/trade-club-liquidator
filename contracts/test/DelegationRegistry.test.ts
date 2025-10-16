import { expect } from "chai";
import { ethers } from "hardhat";
import {
  TradeClub_DelegationRegistry,
  TradeClub_MatchManager,
  TradeClub_GovernanceToken,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("TradeClub_DelegationRegistry", function () {
  let delegationRegistry: TradeClub_DelegationRegistry;
  let matchManager: TradeClub_MatchManager;
  let govToken: TradeClub_GovernanceToken;
  let owner: SignerWithAddress;
  let monachad: SignerWithAddress;
  let supporter: SignerWithAddress;

  const ENTRY_MARGIN = ethers.parseEther("0.1");
  const DELEGATION_AMOUNT = ethers.parseEther("0.5");
  const SPENDING_LIMIT = ethers.parseEther("1.0");
  const MATCH_DURATION = 3600;

  beforeEach(async function () {
    [owner, monachad, supporter] = await ethers.getSigners();

    // Deploy contracts
    const TradeClub_GovernanceToken = await ethers.getContractFactory("TradeClub_GovernanceToken");
    govToken = await TradeClub_GovernanceToken.deploy();

    const TradeClub_MatchManager = await ethers.getContractFactory("TradeClub_MatchManager");
    matchManager = await TradeClub_MatchManager.deploy();

    const TradeClub_DelegationRegistry = await ethers.getContractFactory(
      "TradeClub_DelegationRegistry"
    );
    delegationRegistry = await TradeClub_DelegationRegistry.deploy(await matchManager.getAddress());

    // Create a match
    await matchManager
      .connect(monachad)
      .createMatch(ENTRY_MARGIN, MATCH_DURATION, 3, { value: ENTRY_MARGIN });
  });

  describe("Delegation Creation", function () {
    it("Should create a delegation successfully", async function () {
      const matchId = 1n;
      const duration = 3600;
      const caveats = {
        allowedContracts: [await govToken.getAddress()],
        maxSlippage: 100, // 1%
        maxTradeSize: ethers.parseEther("0.1"),
      };

      const tx = await delegationRegistry
        .connect(supporter)
        .createDelegation(
          monachad.address,
          matchId,
          DELEGATION_AMOUNT,
          SPENDING_LIMIT,
          duration,
          caveats,
          { value: DELEGATION_AMOUNT }
        );

      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;
    });

    it("Should fail with invalid Monachad address", async function () {
      const matchId = 1n;
      const duration = 3600;
      const caveats = {
        allowedContracts: [],
        maxSlippage: 100,
        maxTradeSize: ethers.parseEther("0.1"),
      };

      await expect(
        delegationRegistry
          .connect(supporter)
          .createDelegation(
            ethers.ZeroAddress,
            matchId,
            DELEGATION_AMOUNT,
            SPENDING_LIMIT,
            duration,
            caveats,
            { value: DELEGATION_AMOUNT }
          )
      ).to.be.revertedWith("Invalid Monachad address");
    });

    it("Should fail when Monachad is not a participant", async function () {
      const matchId = 1n;
      const duration = 3600;
      const caveats = {
        allowedContracts: [],
        maxSlippage: 100,
        maxTradeSize: ethers.parseEther("0.1"),
      };

      await expect(
        delegationRegistry.connect(supporter).createDelegation(
          supporter.address, // Not a participant
          matchId,
          DELEGATION_AMOUNT,
          SPENDING_LIMIT,
          duration,
          caveats,
          { value: DELEGATION_AMOUNT }
        )
      ).to.be.revertedWith("Monachad not in match");
    });
  });

  describe("Delegation Revocation", function () {
    let delegationHash: string;

    beforeEach(async function () {
      const matchId = 1n;
      const duration = 3600;
      const caveats = {
        allowedContracts: [await govToken.getAddress()],
        maxSlippage: 100,
        maxTradeSize: ethers.parseEther("0.1"),
      };

      const tx = await delegationRegistry
        .connect(supporter)
        .createDelegation(
          monachad.address,
          matchId,
          DELEGATION_AMOUNT,
          SPENDING_LIMIT,
          duration,
          caveats,
          { value: DELEGATION_AMOUNT }
        );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "DelegationCreated"
      );

      // Get delegation hash from contract state
      const supporterDelegations = await delegationRegistry.getSupporterDelegations(
        supporter.address,
        matchId
      );
      delegationHash = supporterDelegations[0];
    });

    it("Should revoke delegation successfully", async function () {
      const balanceBefore = await ethers.provider.getBalance(supporter.address);

      await delegationRegistry.connect(supporter).revokeDelegation(delegationHash);

      const delegation = await delegationRegistry.getDelegation(delegationHash);
      expect(delegation.active).to.be.false;
      expect(delegation.revoked).to.be.true;

      const balanceAfter = await ethers.provider.getBalance(supporter.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should fail when non-owner tries to revoke", async function () {
      await expect(
        delegationRegistry.connect(monachad).revokeDelegation(delegationHash)
      ).to.be.revertedWith("Not delegation owner");
    });
  });

  describe("Delegation Validation", function () {
    let delegationHash: string;

    beforeEach(async function () {
      const matchId = 1n;
      const duration = 3600;
      const caveats = {
        allowedContracts: [await govToken.getAddress()],
        maxSlippage: 100,
        maxTradeSize: ethers.parseEther("0.1"),
      };

      const tx = await delegationRegistry
        .connect(supporter)
        .createDelegation(
          monachad.address,
          matchId,
          DELEGATION_AMOUNT,
          SPENDING_LIMIT,
          duration,
          caveats,
          { value: DELEGATION_AMOUNT }
        );

      await tx.wait();
      const supporterDelegations = await delegationRegistry.getSupporterDelegations(
        supporter.address,
        matchId
      );
      delegationHash = supporterDelegations[0];
    });

    it("Should validate active delegation", async function () {
      const isValid = await delegationRegistry.isValidDelegation(delegationHash);
      expect(isValid).to.be.true;
    });

    it("Should invalidate after revocation", async function () {
      await delegationRegistry.connect(supporter).revokeDelegation(delegationHash);

      const isValid = await delegationRegistry.isValidDelegation(delegationHash);
      expect(isValid).to.be.false;
    });
  });
});
