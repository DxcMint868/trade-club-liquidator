// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface TradeClub_IMatchManager {
    enum MatchStatus {
        CREATED,
        ACTIVE,
        COMPLETED,
        SETTLED
    }

    enum ParticipantRole {
        MONACHAD, // Competing trader
        SUPPORTER // Copy trader following a Monachad
    }

    struct Match {
        uint256 id;
        address creator;
        uint256 entryMargin;
        uint256 duration;
        uint256 startTime;
        uint256 endTime;
        uint256 maxMonachads; // Max competing traders
        uint256 maxSupportersPerMonachad; // Max supporters per trader
        uint256 prizePool;
        MatchStatus status;
        address[] monachads; // List of competing traders
        address[] allowedDexes; // DEXs to monitor for this match
        address winner;
    }

    struct Participant {
        address trader;
        address smartAccount; // Smart account for trading (supporters only)
        ParticipantRole role;
        address followingMonachad; // Only set if role == SUPPORTER
        uint256 marginAmount; // Trading margin supplied by Monachads (0 for supporters)
        uint256 entryFeePaid; // Entry fee contribution to prize pool
        uint256 fundedAmount; // Amount funded to smart account (supporters only)
        int256 pnl;
        uint256 joinedAt;
    }

    event DEXFunctionAllowanceUpdated(
        address indexed dexAddress,
        bytes4 indexed functionSelector,
        bool isAllowed,
        string description
    );

    event GaveChadAMatchVault(
        uint256 indexed matchId,
        address indexed monachad,
        address vaultAddress
    );

    event MatchCreated(
        uint256 indexed matchId,
        address indexed creator,
        uint256 entryMargin,
        uint256 duration,
        uint256 maxMonachads,
        uint256 maxSupportersPerMonachad,
        address[] allowedDexes
    );

    event MonachadJoined(
        uint256 indexed matchId,
        address indexed monachad,
        uint256 marginAmount,
        uint256 entryFee
    );

    event MonachadWithdrawMargin(uint256 indexed matchId, address monachad, uint256 amount);

    event SupporterJoined(
        uint256 indexed matchId,
        address indexed supporter,
        address indexed followingMonachad,
        address smartAccount,
        uint256 entryFee,
        uint256 fundedAmount
    );

    event MatchStarted(uint256 indexed matchId, uint256 startTime);

    event MatchCompleted(uint256 indexed matchId, address indexed winner, uint256 prizePool);

    event PnLUpdated(uint256 indexed matchId, address indexed participant, int256 pnl);

    enum BalanceChangeType {
        VAULT_BALANCE_CHANGE_CREATED,
        VAULT_BALANCE_CHANGE_TRADE,
        VAULT_BALANCE_CHANGE_WITHDRAW
    }

    event MatchVaultBalanceRecorded(
        uint256 indexed matchId,
        address indexed monachad,
        address indexed matchVault,
        uint256 preBalance,
        uint256 postBalance,
        int256 delta,
        BalanceChangeType changeType,
        uint256 timestamp
    );

    function createMatch(
        uint256 _entryMargin,
        uint256 _duration,
        uint256 _maxMonachads,
        uint256 _maxSupportersPerMonachad,
        address[] memory _allowedDexes
    ) external payable returns (uint256);

    function joinAsMonachad(uint256 _matchId) external payable;

    function followMonachadAndFundAccount(
        uint256 _matchId,
        address _monachad,
        address payable _smartAccountAddress
    ) external payable;

    function getEntryFee(uint256 _matchId) external view returns (uint256);

    function startMatch(uint256 _matchId) external;

    function settleMatch(uint256 _matchId) external;

    function updatePnL(uint256 _matchId, address _participant, int256 _pnl) external;

    function getMatch(uint256 _matchId) external view returns (Match memory);

    function getParticipant(
        uint256 _matchId,
        address _participant
    ) external view returns (Participant memory);
}
