// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IMatchManager.sol";

/**
 * @notice Manages competitive trading matches for TradeClub platform
 * @dev Handles match creation, participation, settlement, and prize distribution
 */
contract TradeClub_MatchManager is IMatchManager, ReentrancyGuard, Ownable, Pausable {
    // State variables
    uint256 public matchCounter;
    uint256 public platformFeePercent = 250; // 2.5% (basis points)
    uint256 public constant BASIS_POINTS = 10000;

    mapping(uint256 => Match) public matches;
    mapping(uint256 => mapping(address => Participant)) public participants;
    mapping(uint256 => address[]) public matchParticipants;
    mapping(address => uint256[]) public userMatches;

    // Modifiers
    modifier onlyMatchCreator(uint256 _matchId) {
        require(matches[_matchId].creator == msg.sender, "Only match creator can call this");
        _;
    }

    modifier onlyActiveMatch(uint256 _matchId) {
        require(matches[_matchId].status == MatchStatus.ACTIVE, "Match is not active");
        _;
    }

    modifier matchExists(uint256 _matchId) {
        require(matches[_matchId].creator != address(0), "Match does not exist");
        _;
    }

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Create a new trading match
     * @param _entryMargin Minimum margin required to join
     * @param _duration Match duration in seconds
     * @param _maxParticipants Maximum number of participants
     * @return matchId The ID of the newly created match
     */
    function createMatch(
        uint256 _entryMargin,
        uint256 _duration,
        uint256 _maxParticipants
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        require(_entryMargin > 0, "Entry margin must be positive");
        require(_duration >= 1 hours && _duration <= 24 hours, "Invalid duration");
        require(_maxParticipants >= 2 && _maxParticipants <= 10, "Invalid max participants");
        require(msg.value >= _entryMargin, "Insufficient entry margin");

        uint256 matchId = ++matchCounter;

        Match storage newMatch = matches[matchId];
        newMatch.id = matchId;
        newMatch.creator = msg.sender;
        newMatch.entryMargin = _entryMargin;
        newMatch.duration = _duration;
        newMatch.maxParticipants = _maxParticipants;
        newMatch.status = MatchStatus.CREATED;
        newMatch.prizePool = msg.value;

        // Add creator as first participant
        Participant storage creator = participants[matchId][msg.sender];
        creator.trader = msg.sender;
        creator.stakedAmount = msg.value;
        creator.joinedAt = block.timestamp;

        matchParticipants[matchId].push(msg.sender);
        newMatch.participants.push(msg.sender);
        userMatches[msg.sender].push(matchId);

        emit MatchCreated(matchId, msg.sender, _entryMargin, _duration, _maxParticipants);
        emit ParticipantJoined(matchId, msg.sender, msg.value);

        return matchId;
    }

    /**
     * @notice Join an existing match
     * @param _matchId The ID of the match to join
     */
    function joinMatch(
        uint256 _matchId
    ) external payable nonReentrant whenNotPaused matchExists(_matchId) {
        Match storage matchData = matches[_matchId];

        require(matchData.status == MatchStatus.CREATED, "Match already started or completed");
        require(msg.value >= matchData.entryMargin, "Insufficient entry margin");
        require(matchParticipants[_matchId].length < matchData.maxParticipants, "Match is full");
        require(
            participants[_matchId][msg.sender].trader == address(0),
            "Already joined this match"
        );

        // Add participant
        Participant storage participant = participants[_matchId][msg.sender];
        participant.trader = msg.sender;
        participant.stakedAmount = msg.value;
        participant.joinedAt = block.timestamp;

        matchParticipants[_matchId].push(msg.sender);
        matchData.participants.push(msg.sender);
        userMatches[msg.sender].push(_matchId);

        matchData.prizePool += msg.value;

        emit ParticipantJoined(_matchId, msg.sender, msg.value);

        // Auto-start if match is full
        if (matchParticipants[_matchId].length == matchData.maxParticipants) {
            _startMatch(_matchId);
        }
    }

    /**
     * @notice Start a match manually (by creator)
     * @param _matchId The ID of the match to start
     */
    function startMatch(
        uint256 _matchId
    ) external matchExists(_matchId) onlyMatchCreator(_matchId) {
        Match storage matchData = matches[_matchId];
        require(matchData.status == MatchStatus.CREATED, "Match already started");
        require(matchParticipants[_matchId].length >= 2, "Need at least 2 participants");

        _startMatch(_matchId);
    }

    /**
     * @notice Internal function to start a match
     * @param _matchId The ID of the match to start
     */
    function _startMatch(uint256 _matchId) internal {
        Match storage matchData = matches[_matchId];

        matchData.status = MatchStatus.ACTIVE;
        matchData.startTime = block.timestamp;
        matchData.endTime = block.timestamp + matchData.duration;

        emit MatchStarted(_matchId, block.timestamp);
    }

    /**
     * @notice Update participant PnL (called by oracle/backend)
     * @param _matchId The match ID
     * @param _participant The participant address
     * @param _pnl The profit/loss value
     */
    function updatePnL(
        uint256 _matchId,
        address _participant,
        int256 _pnl
    ) external onlyOwner matchExists(_matchId) {
        require(
            participants[_matchId][_participant].trader != address(0),
            "Participant not in match"
        );

        participants[_matchId][_participant].pnl = _pnl;

        emit PnLUpdated(_matchId, _participant, _pnl);
    }

    /**
     * @notice Settle a completed match and distribute prizes
     * @param _matchId The ID of the match to settle
     */
    function settleMatch(uint256 _matchId) external nonReentrant matchExists(_matchId) {
        Match storage matchData = matches[_matchId];

        require(matchData.status == MatchStatus.ACTIVE, "Match not active");
        require(block.timestamp >= matchData.endTime, "Match not ended yet");

        matchData.status = MatchStatus.COMPLETED;

        // Find winner (highest PnL)
        address winner = _determineWinner(_matchId);
        matchData.winner = winner;

        // Calculate and distribute prizes
        uint256 platformFee = (matchData.prizePool * platformFeePercent) / BASIS_POINTS;
        uint256 winnerPrize = matchData.prizePool - platformFee;

        // Transfer winner prize
        (bool success, ) = payable(winner).call{ value: winnerPrize }("");
        require(success, "Winner prize transfer failed");

        matchData.status = MatchStatus.SETTLED;

        emit MatchCompleted(_matchId, winner, winnerPrize);
    }

    /**
     * TODO Optimize
     * @notice Determine the winner of a match
     * @param _matchId The match ID
     * @return winner The address of the winner
     */
    function _determineWinner(uint256 _matchId) internal view returns (address) {
        address[] memory matchParticipantsList = matchParticipants[_matchId];
        address winner = matchParticipantsList[0];
        int256 highestPnL = participants[_matchId][winner].pnl;

        for (uint256 i = 1; i < matchParticipantsList.length; i++) {
            address participant = matchParticipantsList[i];
            int256 pnl = participants[_matchId][participant].pnl;

            if (pnl > highestPnL) {
                highestPnL = pnl;
                winner = participant;
            }
        }

        return winner;
    }

    /**
     * @notice Get match details
     * @param _matchId The match ID
     * @return Match struct with match details
     */
    function getMatch(uint256 _matchId) external view matchExists(_matchId) returns (Match memory) {
        return matches[_matchId];
    }

    /**
     * @notice Get participant details
     * @param _matchId The match ID
     * @param _participant The participant address
     * @return Participant struct with participant details
     */
    function getParticipant(
        uint256 _matchId,
        address _participant
    ) external view matchExists(_matchId) returns (Participant memory) {
        return participants[_matchId][_participant];
    }

    /**
     * @notice Get all participants in a match
     * @param _matchId The match ID
     * @return Array of participant addresses
     */
    function getMatchParticipants(
        uint256 _matchId
    ) external view matchExists(_matchId) returns (address[] memory) {
        return matchParticipants[_matchId];
    }

    /**
     * @notice Get all matches a user has participated in
     * @param _user The user address
     * @return Array of match IDs
     */
    function getUserMatches(address _user) external view returns (uint256[] memory) {
        return userMatches[_user];
    }

    /**
     * @notice Update platform fee percentage
     * @param _newFeePercent New fee in basis points (e.g., 250 = 2.5%)
     */
    function setPlatformFee(uint256 _newFeePercent) external onlyOwner {
        require(_newFeePercent <= 1000, "Fee cannot exceed 10%");
        platformFeePercent = _newFeePercent;
    }

    /**
     * @notice Withdraw accumulated platform fees
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{ value: balance }("");
        require(success, "Fee withdrawal failed");
    }

    /**
     * @notice Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    receive() external payable {}
}
