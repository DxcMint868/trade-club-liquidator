import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { ContractService } from "../blockchain/contract.service";
import { MatchStatus, ParticipantRole } from "@prisma/client";
import {
  hashDelegation,
  type Caveat as CoreCaveat,
  type Delegation as CoreDelegation,
  type Hex,
} from "@metamask/delegation-core";
import { bytesToHex, hexToBigInt } from "viem";

const BASIS_POINTS = 10000n;
const ENTRY_FEE_BPS = 1000n;

export interface CreateMatchDto {
  creator: string;
  entryMargin: string;
  duration: number;
  maxParticipants: number;
}

export interface JoinMatchDto {
  matchId: string;
  participant: string;
  marginAmount: string;
  entryFeePaid: string;
}

export interface UpdatePnLDto {
  matchId: string;
  participant: string;
  pnl: string;
}

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    private db: DatabaseService,
    private contractService: ContractService
  ) {}

  async createMatch(payload: any) {
    const {
      matchId,
      creator,
      entryMargin,
      duration,
      maxParticipants,
      maxSupportersPerMonachad,
      allowedDexes,
      blockNumber,
      transactionHash,
    } = payload;

    const normalizedCreator = String(creator || "").toLowerCase();

    const parsedDuration = this.parseInteger(duration);
    const parsedMaxParticipants = this.parseInteger(maxParticipants);
    const parsedMaxSupporters =
      maxSupportersPerMonachad !== undefined &&
      maxSupportersPerMonachad !== null
        ? this.parseInteger(maxSupportersPerMonachad)
        : null;
    const dexes = Array.isArray(allowedDexes)
      ? allowedDexes.map((dex: string) => dex.toLowerCase())
      : [];
    const normalizedBlockNumber = this.parseInteger(blockNumber);

    await this.db.match.upsert({
      where: { matchId },
      update: {
        creator: normalizedCreator,
        entryMargin,
        duration: parsedDuration,
        maxParticipants: parsedMaxParticipants,
        maxSupporters:
          parsedMaxSupporters !== null && !Number.isNaN(parsedMaxSupporters)
            ? parsedMaxSupporters
            : undefined,
        allowedDexes: dexes,
        blockNumber: normalizedBlockNumber,
        transactionHash,
        createdTxHash: transactionHash,
        updatedAt: new Date(),
      },
      create: {
        matchId,
        creator: normalizedCreator,
        entryMargin,
        duration: parsedDuration,
        maxParticipants: parsedMaxParticipants,
        maxSupporters:
          parsedMaxSupporters !== null && !Number.isNaN(parsedMaxSupporters)
            ? parsedMaxSupporters
            : null,
        prizePool: "0",
        status: MatchStatus.CREATED,
        allowedDexes: dexes,
        createdTxHash: transactionHash,
        blockNumber: normalizedBlockNumber,
        transactionHash,
      },
    });

    this.logger.log(`Match ${matchId} saved/updated (status: CREATED)`);

    return {
      matchId,
      creator: normalizedCreator,
      entryMargin,
      duration: parsedDuration,
      maxParticipants: parsedMaxParticipants,
      maxSupportersPerMonachad:
        parsedMaxSupporters !== null && !Number.isNaN(parsedMaxSupporters)
          ? parsedMaxSupporters
          : undefined,
      allowedDexes: dexes,
      blockNumber: normalizedBlockNumber,
      transactionHash,
    };
  }

  async upsertParticipant(payload: any) {
    const {
      matchId,
      participant,
      stakedAmount,
      marginAmount,
      entryFee,
      transactionHash,
      role,
      followingAddress,
      blockNumber,
      smartAccount,
      fundedAmount,
      entryMargin,
    } = payload;

    this.logger.log(
      `Upserting participant ${participant} for match ${matchId}`
    );

    if (!participant) {
      this.logger.warn(
        `participant.joined event missing participant address (match ${matchId})`
      );
      return null;
    }

    const normalizedParticipant = participant.toLowerCase();
    const participantRole =
      role === ParticipantRole.MONACHAD
        ? ParticipantRole.MONACHAD
        : ParticipantRole.SUPPORTER;
    const coerceToString = (value: unknown) =>
      value === undefined || value === null ? undefined : String(value);

    const normalizedMarginAmount =
      coerceToString(marginAmount) ??
      (participantRole === ParticipantRole.MONACHAD
        ? (coerceToString(stakedAmount) ?? coerceToString(entryMargin) ?? "0")
        : "0");

    const normalizedEntryFee =
      coerceToString(entryFee) ??
      (participantRole === ParticipantRole.SUPPORTER
        ? (coerceToString(stakedAmount) ?? "0")
        : "0");

    const normalizedFundedAmount = coerceToString(fundedAmount);
    const followerAddress =
      participantRole === ParticipantRole.SUPPORTER && followingAddress
        ? String(followingAddress).toLowerCase()
        : null;

    // Perform match prize pool update and participant upsert atomically
    try {
      const result = await this.db.$transaction(async (tx) => {
        // Read match inside transaction to avoid race conditions
        const match = await tx.match.findUnique({ where: { matchId } });
        if (!match) {
          // Abort transaction by throwing; will be caught below
          throw new Error(
            `Match ${matchId} not found when updating prize pool`
          );
        }

        this.logger.log(
          `participant margin: ${normalizedMarginAmount ?? "0"}, entry fee: ${normalizedEntryFee}`
        );

        const entryFeeBigInt = BigInt(normalizedEntryFee ?? "0");
        const updatedPrizePool =
          entryFeeBigInt > 0n
            ? String(BigInt(match.prizePool ?? "0") + entryFeeBigInt)
            : match.prizePool;

        const updatedMatch =
          entryFeeBigInt > 0n
            ? await tx.match.update({
                where: { matchId },
                data: {
                  prizePool: updatedPrizePool,
                  updatedAt: new Date(),
                },
              })
            : match;

        // Upsert participant
        const updateData: any = {
          role: participantRole,
          followingAddress: followerAddress,
          marginAmount: normalizedMarginAmount,
          entryFeePaid: normalizedEntryFee ?? "0",
          joinedTxHash: transactionHash,
          updatedAt: new Date(),
        };

        if (normalizedFundedAmount !== undefined) {
          updateData.fundedAmount = normalizedFundedAmount;
        }

        const createData: any = {
          matchId,
          address: normalizedParticipant,
          role: participantRole,
          followingAddress: followerAddress,
          marginAmount: normalizedMarginAmount ?? "0",
          entryFeePaid: normalizedEntryFee ?? "0",
          pnl: "0",
          joinedTxHash: transactionHash,
        };

        if (normalizedFundedAmount !== undefined) {
          createData.fundedAmount = normalizedFundedAmount;
        }

        const participantRecord = await tx.participant.upsert({
          where: {
            matchId_address: {
              matchId,
              address: normalizedParticipant,
            },
          },
          update: updateData,
          create: createData,
        });

        return { updatedMatch, participantRecord };
      });

      this.logger.log(
        `${participantRole} ${normalizedParticipant} recorded for match ${matchId}`
      );
    } catch (err) {
      this.logger.error(
        err.message ?? `Match ${matchId} not found when updating prize pool`
      );
      return;
    }

    const normalizedBlockNumber =
      blockNumber !== undefined && blockNumber !== null
        ? this.parseInteger(blockNumber)
        : undefined;

    return {
      matchId,
      participant: normalizedParticipant,
      marginAmount: normalizedMarginAmount ?? "0",
      entryFee: normalizedEntryFee ?? "0",
      transactionHash,
      blockNumber: normalizedBlockNumber,
      role:
        participantRole === ParticipantRole.MONACHAD ? "MONACHAD" : "SUPPORTER",
      followingAddress: followerAddress ?? undefined,
      smartAccount: smartAccount
        ? String(smartAccount).toLowerCase()
        : undefined,
      fundedAmount: normalizedFundedAmount,
    };
  }

  async completeMatch(payload: any) {
    const { matchId, winner, prizePool, transactionHash, blockNumber } =
      payload;

    const updateData: any = {
      status: MatchStatus.COMPLETED,
      completedTxHash: transactionHash,
      endTime: new Date(),
      updatedAt: new Date(),
    };

    if (winner) {
      updateData.winner = String(winner).toLowerCase();
    }

    if (prizePool !== undefined && prizePool !== null) {
      updateData.prizePool = String(prizePool);
    }

    const normalizedBlockNumber =
      blockNumber !== undefined && blockNumber !== null
        ? this.parseInteger(blockNumber)
        : undefined;

    if (normalizedBlockNumber !== undefined) {
      updateData.blockNumber = normalizedBlockNumber;
    }

    const result = await this.db.match.updateMany({
      where: { matchId },
      data: updateData,
    });

    if (result.count === 0) {
      this.logger.warn(
        `Received match.completed for ${matchId} but no match record was updated`
      );
      return null;
    }

    this.logger.log(`Match ${matchId} completed. Winner: ${winner ?? "n/a"}`);

    return {
      matchId,
      winner: updateData.winner ?? undefined,
      prizePool: updateData.prizePool ?? undefined,
      transactionHash,
      blockNumber: normalizedBlockNumber,
    };
  }

  async updatePnL(payload: any) {
    const { matchId, participant, pnl, transactionHash, blockNumber } = payload;

    if (!participant) {
      this.logger.warn(`PnL update missing participant for match ${matchId}`);
      return null;
    }

    const normalizedParticipant = participant.toLowerCase();
    const normalizedPnL = pnl !== undefined && pnl !== null ? String(pnl) : "0";

    await this.db.participant.updateMany({
      where: {
        matchId,
        address: normalizedParticipant,
      },
      data: {
        pnl: normalizedPnL,
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `PnL updated for ${normalizedParticipant} in match ${matchId}: ${normalizedPnL}`
    );

    const normalizedBlockNumber =
      blockNumber !== undefined && blockNumber !== null
        ? this.parseInteger(blockNumber)
        : undefined;

    return {
      matchId,
      participant: normalizedParticipant,
      pnl: normalizedPnL,
      transactionHash,
      blockNumber: normalizedBlockNumber,
    };
  }

  async getActiveMatchesForMonachad(monachadAddress: string) {
    const normalizedAddress = monachadAddress.toLowerCase();

    return this.db.match.findMany({
      where: {
        status: MatchStatus.ACTIVE,
        participants: {
          some: {
            address: normalizedAddress,
            role: ParticipantRole.MONACHAD,
          },
        },
      },
      include: {
        delegations: {
          where: {
            monachad: normalizedAddress,
            isActive: true,
            expiresAt: {
              gt: new Date(),
            },
          },
        },
      },
    });
  }

  // Get methods
  async getAllMatches(status?: MatchStatus) {
    const where = status ? { status } : {};

    return await this.db.match.findMany({
      where,
      include: {
        participants: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getMatch(matchId: string) {
    const match = await this.db.match.findUnique({
      where: { matchId },
    });

    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    const participantCount = await this.db.participant.count({
      where: { matchId },
    });

    const topMonachads = await this.db.participant.findMany({
      where: {
        matchId,
        role: ParticipantRole.MONACHAD,
      },
      orderBy: {
        pnl: "desc",
      },
      take: 5,
    });
    const monachadCount = await this.db.participant.count({
      where: { matchId, role: ParticipantRole.MONACHAD },
    });

    const supporterCount = await this.db.participant.count({
      where: {
        matchId,
        role: ParticipantRole.SUPPORTER,
      },
    });
    const topSupporters = await this.db.participant.findMany({
      where: {
        matchId,
        role: ParticipantRole.SUPPORTER,
      },
      orderBy: {
        pnl: "desc",
      },
      take: 10,
    });

    const returnData = {
      ...match,
      participantCount,
      topMonachads,
      topSupporters,
      supporterCount,
      monachadCount,
    };
    return returnData;
  }

  async getMatchParticipants(matchId: string) {
    return await this.db.participant.findMany({
      where: { matchId },
      orderBy: {
        pnl: "desc",
      },
    });
  }

  async getMatchLeaderboard(matchId: string) {
    const participants = await this.db.participant.findMany({
      where: { matchId },
      orderBy: {
        pnl: "desc",
      },
    });

    return participants.map((p, index) => ({
      rank: index + 1,
      address: p.address,
      pnl: p.pnl,
      marginAmount: p.marginAmount,
      entryFeePaid: p.entryFeePaid,
      fundedAmount: p.fundedAmount,
      roi: this.calculateROI(p.pnl, p.marginAmount || p.fundedAmount || "0"),
    }));
  }

  async getUserMatches(address: string) {
    const lowerAddress = address.toLowerCase();

    // Find matches where user is creator
    const createdMatches = await this.db.match.findMany({
      where: { creator: lowerAddress },
      include: {
        participants: true,
      },
    });

    // Find matches where user is participant
    const participatedMatches = await this.db.match.findMany({
      where: {
        participants: {
          some: {
            address: lowerAddress,
          },
        },
      },
      include: {
        participants: true,
      },
    });

    // Combine and deduplicate
    const allMatches = [...createdMatches, ...participatedMatches];
    const uniqueMatches = Array.from(
      new Map(allMatches.map((m) => [m.matchId, m])).values()
    );

    return uniqueMatches;
  }

  async getMatchParticipant(matchId: string, address: string) {
    const lowerAddress = address.toLowerCase();

    const participant = await this.db.participant.findUnique({
      where: {
        matchId_address: {
          matchId,
          address: lowerAddress,
        },
      },
    });

    if (!participant) {
      throw new Error(
        `Participant ${lowerAddress} not found in match ${matchId}`
      );
    }

    return participant;
  }

  async getActiveMatches() {
    return await this.db.match.findMany({
      where: {
        status: MatchStatus.ACTIVE,
      },
      include: {
        participants: true,
      },
      orderBy: {
        startTime: "desc",
      },
    });
  }

  async joinMatch(
    matchId: string,
    userAddress: string,
    smartAccountAddress: string,
    signedDelegation: any
  ) {
    // Validate match exists and is joinable
    const match = await this.db.match.findUnique({
      where: { matchId },
      include: { participants: true },
    });

    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    if (
      match.status !== MatchStatus.CREATED &&
      match.status !== MatchStatus.ACTIVE
    ) {
      throw new Error(
        `Match ${matchId} is not accepting participants (status: ${match.status})`
      );
    }

    if (match.participants.length >= match.maxParticipants) {
      throw new Error(`Match ${matchId} is full`);
    }

    // Check if user already joined
    const existingParticipant = match.participants.find(
      (p) => p.address.toLowerCase() === userAddress.toLowerCase()
    );

    if (existingParticipant) {
      throw new Error(`User ${userAddress} already joined match ${matchId}`);
    }

    const delegationHash = this.extractDelegationHash(signedDelegation);

    // Store signed delegation for future use
    const entryFeePaid = this.calculateEntryFeeFromMargin(match.entryMargin);
    const delegationData = {
      supporter: userAddress.toLowerCase(),
      monachad: signedDelegation.delegate.toLowerCase(),
      matchId,
      amount: match.entryMargin,
      spendingLimit: match.entryMargin, // For now, spending limit = entry margin
      spent: "0",
      expiresAt: new Date(Date.now() + match.duration * 1000),
      delegationHash,
      signedDelegation: JSON.stringify(signedDelegation),
      isActive: true,
      blockNumber: 0, // Will be updated when actually executed on-chain
      transactionHash: "0x0", // Placeholder as well
    };

    // Create participant and delegation in a transaction
    const result = await this.db.$transaction(async (tx) => {
      const participant = await tx.participant.create({
        data: {
          matchId,
          address: userAddress.toLowerCase(),
          role: ParticipantRole.SUPPORTER,
          followingAddress: signedDelegation.delegate.toLowerCase(),
          marginAmount: match.entryMargin,
          entryFeePaid,
          fundedAmount: match.entryMargin,
          pnl: "0",
          joinedTxHash: "0x0", // Will be updated when on-chain tx happens
        } as any,
      });

      this.logger.debug(`Delegation Data: ${JSON.stringify(delegationData)}`);
      const delegation = await tx.delegation.create({
        data: delegationData,
      });

      return { participant, delegation };
    });

    this.logger.log(
      `User ${userAddress} joined match ${matchId} with delegation`
    );

    return {
      success: true,
      participant: result.participant,
      delegation: {
        delegationHash: result.delegation.delegationHash,
        expiresAt: result.delegation.expiresAt,
      },
    };
  }

  async updatePnLFromTrade(
    matchId: string,
    participant: string,
    tradePnL: string
  ) {
    // Get current participant data
    const participantData = await this.db.participant.findFirst({
      where: {
        matchId,
        address: participant.toLowerCase(),
      },
    });

    if (!participantData) {
      throw new Error(
        `Participant ${participant} not found in match ${matchId}`
      );
    }

    // Calculate new PnL
    const currentPnL = BigInt(participantData.pnl);
    const tradePnLBigInt = BigInt(tradePnL);
    const newPnL = currentPnL + tradePnLBigInt;

    // Update on blockchain (this will trigger the event listener to update DB)
    await this.contractService.updatePnL(matchId, participant, newPnL);

    return {
      matchId,
      participant,
      oldPnL: currentPnL.toString(),
      tradePnL: tradePnLBigInt.toString(),
      newPnL: newPnL.toString(),
    };
  }

  // Helper methods
  private calculateROI(pnl: string, basisAmount: string): string {
    const pnlBigInt = BigInt(pnl);
    const basisBigInt = BigInt(basisAmount);

    if (basisBigInt === 0n) return "0";

    const roi = (pnlBigInt * 10000n) / basisBigInt; // 100% = 10000
    return (Number(roi) / 100).toFixed(2);
  }

  private calculateEntryFeeFromMargin(
    entryMargin: string | number | bigint
  ): string {
    try {
      const marginBigInt =
        typeof entryMargin === "bigint"
          ? entryMargin
          : BigInt(entryMargin.toString());

      return ((marginBigInt * ENTRY_FEE_BPS) / BASIS_POINTS).toString();
    } catch (error) {
      this.logger.warn(
        `Failed to calculate entry fee from margin value ${entryMargin}: ${String(
          error
        )}`
      );
      return "0";
    }
  }

  private extractDelegationHash(signedDelegation: any): string {
    const candidateHash = signedDelegation?.delegationHash;
    if (
      typeof candidateHash === "string" &&
      /^0x[a-fA-F0-9]{64}$/.test(candidateHash)
    ) {
      return candidateHash.toLowerCase();
    }

    if (!signedDelegation || typeof signedDelegation !== "object") {
      throw new Error("Signed delegation payload is missing");
    }

    const { delegate, delegator, authority, caveats, salt, signature } =
      signedDelegation;

    const normalizeHex = (value: unknown, field: string): Hex => {
      if (value instanceof Uint8Array) {
        return bytesToHex(value).toLowerCase() as Hex;
      }

      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed.length) {
          throw new Error(`Signed delegation ${field} is empty`);
        }

        const normalized = trimmed.toLowerCase();
        if (!normalized.startsWith("0x") || !/^0x[0-9a-f]*$/.test(normalized)) {
          throw new Error(
            `Signed delegation ${field} must be a hex string prefixed with 0x`
          );
        }
        return normalized as Hex;
      }

      throw new Error(`Signed delegation is missing ${field} in hex format`);
    };

    const normalizeSalt = (value: unknown): bigint => {
      if (typeof value === "bigint") {
        return value;
      }
      if (typeof value === "number") {
        return BigInt(value);
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed.length) {
          throw new Error("Signed delegation salt is empty");
        }
        if (trimmed === "0x" || trimmed === "0X") {
          return 0n;
        }
        try {
          return BigInt(trimmed);
        } catch (error) {
          const lower = trimmed.toLowerCase();
          if (lower.startsWith("0x")) {
            if (lower.length === 2) {
              return 0n;
            }
            if (/^0x[0-9a-f]+$/.test(lower)) {
              return hexToBigInt(lower as `0x${string}`);
            }
          }
          throw new Error(
            "Signed delegation salt must be a hex or decimal string"
          );
        }
      }
      if (value instanceof Uint8Array) {
        if (value.length === 0) {
          return 0n;
        }
        return hexToBigInt(bytesToHex(value) as `0x${string}`);
      }
      if (
        value &&
        typeof value === "object" &&
        "hex" in (value as any) &&
        typeof (value as any).hex === "string"
      ) {
        const hexValue = (value as any).hex as string;
        const normalized = hexValue.trim().toLowerCase();
        if (!normalized.startsWith("0x")) {
          throw new Error(
            "Signed delegation salt hex property must be a valid hex string"
          );
        }
        if (normalized.length === 2) {
          return 0n;
        }
        if (!/^0x[0-9a-f]+$/.test(normalized)) {
          throw new Error(
            "Signed delegation salt hex property must be a valid hex string"
          );
        }
        return hexToBigInt(normalized as `0x${string}`);
      }
      throw new Error("Signed delegation is missing salt");
    };

    const normalizedCaveats: CoreCaveat[] = Array.isArray(caveats)
      ? caveats.map((caveat: any) => {
          if (!caveat || typeof caveat !== "object") {
            throw new Error(
              "Signed delegation contains an invalid caveat entry"
            );
          }

          return {
            enforcer: normalizeHex(caveat.enforcer, "caveat.enforcer"),
            terms: normalizeHex(caveat.terms ?? "0x", "caveat.terms"),
            args: normalizeHex(caveat.args ?? "0x", "caveat.args"),
          };
        })
      : [];

    const delegationStruct: CoreDelegation = {
      delegate: normalizeHex(delegate, "delegate"),
      delegator: normalizeHex(delegator, "delegator"),
      authority: normalizeHex(authority ?? "0x", "authority"),
      caveats: normalizedCaveats,
      salt: normalizeSalt(salt),
      signature: normalizeHex(signature, "signature"),
    };

    const computedHash = hashDelegation(delegationStruct);
    if (
      typeof computedHash !== "string" ||
      !/^0x[a-fA-F0-9]{64}$/.test(computedHash)
    ) {
      throw new Error(
        "Unable to derive delegation hash from signed delegation"
      );
    }

    return computedHash.toLowerCase();
  }

  // New methods for Monachad/Supporter flow

  /**
   * Get all Monachads (competing traders) in a match
   */
  async getMatchMonachads(matchId: string) {
    const monachads = (await this.db.participant.findMany({
      where: {
        matchId,
        role: "MONACHAD",
      },
      select: {
        address: true,
        marginAmount: true,
        entryFeePaid: true,
        pnl: true,
        joinedAt: true,
      },
      orderBy: {
        joinedAt: "asc",
      },
    } as any)) as unknown as Array<{
      address: string;
      marginAmount: string;
      entryFeePaid: string;
      pnl: string;
      joinedAt: Date;
    }>;

    return {
      matchId,
      monachads: monachads.map((m) => ({
        ...m,
        roi: this.calculateROI(m.pnl, m.marginAmount || "0"),
      })),
    };
  }

  /**
   * Get all supporters in a match
   */
  async getMatchSupporters(matchId: string) {
    const supporters = (await this.db.participant.findMany({
      where: {
        matchId,
        role: "SUPPORTER",
      },
      select: {
        address: true,
        followingAddress: true,
        marginAmount: true,
        entryFeePaid: true,
        fundedAmount: true,
        pnl: true,
        joinedAt: true,
      },
      orderBy: {
        joinedAt: "asc",
      },
    } as any)) as unknown as Array<{
      address: string;
      followingAddress: string | null;
      marginAmount: string;
      entryFeePaid: string;
      fundedAmount: string | null;
      pnl: string;
      joinedAt: Date;
    }>;

    return {
      matchId,
      supporters,
    };
  }

  /**
   * Get all supporters following a specific Monachad
   */
  async getMonachadSupporters(matchId: string, monachadAddress: string) {
    const supporters = (await this.db.participant.findMany({
      where: {
        matchId,
        role: "SUPPORTER",
        followingAddress: monachadAddress.toLowerCase(),
      },
      select: {
        address: true,
        marginAmount: true,
        entryFeePaid: true,
        fundedAmount: true,
        pnl: true,
        joinedAt: true,
      },
      orderBy: {
        joinedAt: "asc",
      },
    } as any)) as unknown as Array<{
      address: string;
      marginAmount: string;
      entryFeePaid: string;
      fundedAmount: string | null;
      pnl: string;
      joinedAt: Date;
    }>;

    return {
      matchId,
      monachadAddress,
      supporters,
      totalSupporters: supporters.length,
    };
  }

  /**
   * Join a match as a competing Monachad (trader)
   */
  async joinAsMonachad(
    matchId: string,
    monachadAddress: string,
    smartAccountAddress: string
  ) {
    const match = await this.db.match.findUnique({
      where: { matchId },
      include: { participants: true },
    });

    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    if (
      match.status !== MatchStatus.CREATED &&
      match.status !== MatchStatus.ACTIVE
    ) {
      throw new Error(
        `Match ${matchId} is not accepting Monachads (status: ${match.status})`
      );
    }

    // Count current Monachads
    const currentMonachads = match.participants.filter(
      (p) => p.role === "MONACHAD"
    ).length;

    if (currentMonachads >= match.maxParticipants) {
      throw new Error(`Match ${matchId} already has max Monachads`);
    }

    // Check if user already joined
    const existingParticipant = match.participants.find(
      (p) => p.address.toLowerCase() === monachadAddress.toLowerCase()
    );

    if (existingParticipant) {
      throw new Error(
        `User ${monachadAddress} already joined match ${matchId}`
      );
    }

    const entryFeePaid = this.calculateEntryFeeFromMargin(match.entryMargin);

    const participant = await this.db.$transaction(async (tx) => {
      const createdParticipant = await tx.participant.create({
        data: {
          matchId,
          address: monachadAddress.toLowerCase(),
          role: "MONACHAD",
          followingAddress: null,
          marginAmount: match.entryMargin,
          entryFeePaid,
          pnl: "0",
          joinedTxHash: "0x0", // Will be updated when on-chain tx happens
        } as any,
      });

      await tx.match.update({
        where: { matchId },
        data: {
          prizePool: String(
            BigInt(match.prizePool ?? "0") + BigInt(entryFeePaid)
          ),
          updatedAt: new Date(),
        },
      });

      return createdParticipant;
    });

    this.logger.log(
      `User ${monachadAddress} joined match ${matchId} as Monachad`
    );

    return {
      success: true,
      participant,
      role: "MONACHAD",
    };
  }

  /**
   * Follow a Monachad in a match (join as supporter/copy trader)
   */
  async delegate(
    matchId: string,
    supporterAddress: string,
    monachadAddress: string,
    smartAccountAddress: string,
    signedDelegation: any,
    entryFeePaid?: string,
    fundedAmount?: string,
    stakedAmountLegacy?: string
  ) {
    const match = await this.db.match.findUnique({
      where: { matchId },
      include: { participants: true },
    });

    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    if (
      match.status !== MatchStatus.CREATED &&
      match.status !== MatchStatus.ACTIVE
    ) {
      throw new Error(
        `Match ${matchId} is not accepting supporters (status: ${match.status})`
      );
    }

    // Verify monachad exists in this match
    const monachad = await this.db.participant.findFirst({
      where: {
        matchId,
        address: monachadAddress.toLowerCase(),
        role: "MONACHAD",
      },
    });

    if (!monachad) {
      throw new Error(
        `Monachad ${monachadAddress} not found in match ${matchId}`
      );
    }

    const existingDelegation = await this.db.delegation.findFirst({
      where: {
        matchId,
        supporter: supporterAddress.toLowerCase(),
        monachad: monachadAddress.toLowerCase(),
        isActive: true,
      },
    });
    if (existingDelegation) {
      throw new Error(
        `User ${supporterAddress} already delegated for Monachad ${monachadAddress} in match ${matchId}`
      );
    }

    // Count current supporters for this Monachad
    const monachadSupporterCount = await this.db.participant.count({
      where: {
        matchId,
        role: "SUPPORTER",
        followingAddress: monachadAddress.toLowerCase(),
      },
    });

    if (match.maxSupporters && monachadSupporterCount >= match.maxSupporters) {
      throw new Error(`Monachad ${monachadAddress} already has max supporters`);
    }

    const normalizedFundedAmount =
      fundedAmount !== undefined && fundedAmount !== null
        ? String(fundedAmount)
        : "0";

    const delegationHash = this.extractDelegationHash(signedDelegation);

    // Store delegation
    const delegationData = {
      supporter: supporterAddress.toLowerCase(),
      monachad: monachadAddress.toLowerCase(),
      matchId,
      amount: normalizedFundedAmount,
      spendingLimit: normalizedFundedAmount,
      spent: "0",
      expiresAt: new Date(Date.now() + match.duration * 1000),
      delegationHash,
      signedDelegation: JSON.stringify(signedDelegation),
      isActive: true,
      blockNumber: 0,
      transactionHash: "0x0",
    };

    // Create participant and delegation in a transaction
    // const result = await this.db.$transaction(async (tx) => {
    // const participant = await tx.participant.create({
    //   data: {
    //     matchId,
    //     address: supporterAddress.toLowerCase(),
    //     role: "SUPPORTER",
    //     followingAddress: monachadAddress.toLowerCase(),
    //     marginAmount: "0",
    //     entryFeePaid: String(normalizedEntryFee),
    //     fundedAmount: normalizedFundedAmount,
    //     pnl: "0",
    //     joinedTxHash: "0x0",
    //   } as any,
    // });

    this.logger.debug(`Delegation Data: ${JSON.stringify(delegationData)}`);
    const delegation = await this.db.delegation.create({
      data: delegationData,
    });

    this.logger.log(
      `User ${supporterAddress} joined match ${matchId} as Supporter, following ${monachadAddress}`
    );

    return {
      success: true,
      delegation: {
        delegationHash: delegation.delegationHash,
        expiresAt: delegation.expiresAt,
      },
      role: "SUPPORTER",
      followingMonachad: monachadAddress,
    };
  }

  private parseInteger(value: any): number {
    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    }

    if (typeof value === "bigint") {
      return Number(value);
    }

    return 0;
  }

  async applyMatchStartedUpdate(payload: any): Promise<boolean> {
    const { matchId, startTime, transactionHash, blockNumber } = payload;

    const startTimestamp =
      startTime !== undefined && startTime !== null
        ? this.parseInteger(startTime) * 1000
        : undefined;

    const updateData: any = {
      status: MatchStatus.ACTIVE,
      startedTxHash: transactionHash,
      updatedAt: new Date(),
    };

    if (startTimestamp !== undefined) {
      updateData.startTime = new Date(startTimestamp);
    }

    if (blockNumber !== undefined && blockNumber !== null) {
      updateData.blockNumber = this.parseInteger(blockNumber);
    }

    const result = await this.db.match.updateMany({
      where: { matchId },
      data: updateData,
    });

    if (result.count === 0) {
      this.logger.warn(
        `Received match.started for ${matchId} but no match record was updated`
      );
      return false;
    }

    this.logger.log(`Match ${matchId} marked active`);
    return true;
  }
}
