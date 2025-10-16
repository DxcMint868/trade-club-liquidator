// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface TradeClub_IMatchManager {
    enum MatchStatus {
        CREATED,
        ACTIVE,
        COMPLETED,
        SETTLED
    }

    struct Match {
        uint256 id;
        address creator;
        uint256 entryMargin;
        uint256 duration;
        uint256 startTime;
        uint256 endTime;
        uint256 maxParticipants;
        uint256 prizePool;
        MatchStatus status;
        address[] participants;
        address winner;
    }

    struct Participant {
        address trader;
        uint256 stakedAmount;
        int256 pnl;
        uint256 joinedAt;
    }

    event MatchCreated(
        uint256 indexed matchId,
        address indexed creator,
        uint256 entryMargin,
        uint256 duration,
        uint256 maxParticipants
    );

    event ParticipantJoined(
        uint256 indexed matchId,
        address indexed participant,
        uint256 stakedAmount
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
        uint256 _maxParticipants
    ) external payable returns (uint256);

    function joinMatch(uint256 _matchId) external payable;

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
