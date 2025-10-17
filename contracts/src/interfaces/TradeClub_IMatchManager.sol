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
        MONACHAD,   // Competing trader
        SUPPORTER   // Copy trader following a Monachad
    }

    struct Match {
        uint256 id;
        address creator;
        uint256 entryMargin;
        uint256 duration;
        uint256 startTime;
        uint256 endTime;
        uint256 maxMonachads;      // Max competing traders
        uint256 maxSupportersPerMonachad; // Max supporters per trader
        uint256 prizePool;
        MatchStatus status;
        address[] monachads;       // List of competing traders
        address winner;
    }

    struct Participant {
        address trader;
        address smartAccount;      // Smart account for trading (supporters only)
        ParticipantRole role;
        address followingMonachad; // Only set if role == SUPPORTER
        uint256 stakedAmount;      // Entry fee for supporters, full stake for Monachads
        uint256 fundedAmount;      // Amount funded to smart account (supporters only)
        int256 pnl;
        uint256 joinedAt;
    }

    event MatchCreated(
        uint256 indexed matchId,
        address indexed creator,
        uint256 entryMargin,
        uint256 duration,
        uint256 maxMonachads,
        uint256 maxSupportersPerMonachad
    );

    event MonachadJoined(
        uint256 indexed matchId,
        address indexed monachad,
        uint256 stakedAmount
    );

    event SupporterJoined(
        uint256 indexed matchId,
        address indexed supporter,
        address indexed followingMonachad,
        address smartAccount,
        uint256 entryFee,
        uint256 fundedAmount
    );

    event MatchStarted(uint256 indexed matchId, uint256 startTime);

    event MatchCompleted(
        uint256 indexed matchId,
        address indexed winner,
        uint256 prizePool
    );

    event PnLUpdated(
        uint256 indexed matchId,
        address indexed participant,
        int256 pnl
    );

    function createMatch(
        uint256 _entryMargin,
        uint256 _duration,
        uint256 _maxMonachads,
        uint256 _maxSupportersPerMonachad
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

    function updatePnL(
        uint256 _matchId,
        address _participant,
        int256 _pnl
    ) external;

    function getMatch(uint256 _matchId) external view returns (Match memory);

    function getParticipant(
        uint256 _matchId,
        address _participant
    ) external view returns (Participant memory);
}
