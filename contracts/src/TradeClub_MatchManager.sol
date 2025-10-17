// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/TradeClub_IMatchManager.sol";

/**
 * @notice Manages competitive trading matches for TradeClub platform
 * @dev Handles match creation, participation, settlement, and prize distribution
 */
contract TradeClub_MatchManager is TradeClub_IMatchManager, ReentrancyGuard, Ownable, Pausable {
    // State variables
    uint256 public matchCounter;
    uint256 public platformFeePercent = 250; // 2.5% (basis points)
    uint256 public constant BASIS_POINTS = 10000;

    mapping(uint256 => Match) public matches;
    mapping(uint256 => mapping(address => Participant)) public participants;
    mapping(uint256 => address[]) public matchMonachads;      // List of Monachads per match
    mapping(uint256 => mapping(address => address[])) public monachadSupporters; // Monachad => Supporters
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
     * @param _entryMargin Minimum margin required to join as Monachad
     * @param _duration Match duration in seconds
     * @param _maxMonachads Maximum number of competing traders
     * @param _maxSupportersPerMonachad Maximum supporters each Monachad can have
     * @param _allowedDexes Array of DEX addresses to monitor for this match
     * @return matchId The ID of the newly created match
     */
    function createMatch(
        uint256 _entryMargin,
        uint256 _duration,
        uint256 _maxMonachads,
        uint256 _maxSupportersPerMonachad,
        address[] memory _allowedDexes
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        require(_entryMargin > 0, "Entry margin must be positive");
        require(_duration >= 1 hours && _duration <= 24 hours, "Invalid duration");
        require(_maxMonachads >= 2 && _maxMonachads <= 10, "Invalid max monachads");
        require(_maxSupportersPerMonachad > 0, "Must allow supporters");
        require(_allowedDexes.length > 0, "Must specify at least one DEX");
        require(msg.value >= _entryMargin, "Insufficient entry margin");

        uint256 matchId = ++matchCounter;

        Match storage newMatch = matches[matchId];
        newMatch.id = matchId;
        newMatch.creator = msg.sender;
        newMatch.entryMargin = _entryMargin;
        newMatch.duration = _duration;
        newMatch.maxMonachads = _maxMonachads;
        newMatch.maxSupportersPerMonachad = _maxSupportersPerMonachad;
        newMatch.status = MatchStatus.CREATED;
        newMatch.prizePool = msg.value;
        newMatch.allowedDexes = _allowedDexes;

        // Add creator as first Monachad
        Participant storage creator = participants[matchId][msg.sender];
        creator.trader = msg.sender;
        creator.role = ParticipantRole.MONACHAD;
        creator.stakedAmount = msg.value;
        creator.joinedAt = block.timestamp;

        matchMonachads[matchId].push(msg.sender);
        newMatch.monachads.push(msg.sender);
        userMatches[msg.sender].push(matchId);

        emit MatchCreated(matchId, msg.sender, _entryMargin, _duration, _maxMonachads, _maxSupportersPerMonachad, _allowedDexes);
        emit MonachadJoined(matchId, msg.sender, msg.value);

        return matchId;
    }

    /**
     * @notice Join a match as a competing Monachad (trader)
     * @param _matchId The ID of the match to join
     */
    function joinAsMonachad(
        uint256 _matchId
    ) external payable nonReentrant whenNotPaused matchExists(_matchId) {
        Match storage matchData = matches[_matchId];

        require(matchData.status == MatchStatus.CREATED, "Match already started or completed");
        require(msg.value >= matchData.entryMargin, "Insufficient entry margin");
        require(matchMonachads[_matchId].length < matchData.maxMonachads, "Match is full");
        require(
            participants[_matchId][msg.sender].trader == address(0),
            "Already joined this match"
        );

        // Add as Monachad
        Participant storage participant = participants[_matchId][msg.sender];
        participant.trader = msg.sender;
        participant.role = ParticipantRole.MONACHAD;
        participant.stakedAmount = msg.value;
        participant.joinedAt = block.timestamp;

        matchMonachads[_matchId].push(msg.sender);
        matchData.monachads.push(msg.sender);
        userMatches[msg.sender].push(_matchId);

        matchData.prizePool += msg.value;

        emit MonachadJoined(_matchId, msg.sender, msg.value);

        // Auto-start if match is full
        if (matchMonachads[_matchId].length == matchData.maxMonachads) {
            _startMatch(_matchId);
        }
    }

    /**
     * @notice Follow a Monachad and fund your smart account in one transaction
     * @param _matchId The ID of the match to join
     * @param _monachad The address of the Monachad to follow
     * @param _smartAccountAddress Your smart account that will execute trades
     * @dev msg.value = entryFee (10% of Monachad entry) + fundingAmount
     */
    function followMonachadAndFundAccount(
        uint256 _matchId,
        address _monachad,
        address payable _smartAccountAddress
    ) external payable nonReentrant whenNotPaused matchExists(_matchId) {
        Match storage matchData = matches[_matchId];

        require(matchData.status == MatchStatus.CREATED || matchData.status == MatchStatus.ACTIVE, 
                "Match not available");
        
        // Calculate entry fee (10% of Monachad entry margin)
        uint256 entryFee = (matchData.entryMargin * 1000) / BASIS_POINTS; // 10%
        
        require(msg.value > entryFee, "Must send entry fee + funding amount");
        require(
            participants[_matchId][msg.sender].trader == address(0),
            "Already joined this match"
        );
        require(
            participants[_matchId][_monachad].role == ParticipantRole.MONACHAD,
            "Target is not a Monachad in this match"
        );
        require(
            monachadSupporters[_matchId][_monachad].length < matchData.maxSupportersPerMonachad,
            "Monachad has max supporters"
        );
        
        // Verify smart account exists
        require(_smartAccountAddress.code.length > 0, "Smart account not deployed");

        // Calculate funding amount (remainder after entry fee)
        uint256 fundingAmount = msg.value - entryFee;

        // Add as Supporter
        Participant storage participant = participants[_matchId][msg.sender];
        participant.trader = msg.sender;
        participant.smartAccount = _smartAccountAddress;
        participant.role = ParticipantRole.SUPPORTER;
        participant.followingMonachad = _monachad;
        participant.stakedAmount = entryFee;
        participant.fundedAmount = fundingAmount;
        participant.joinedAt = block.timestamp;

        monachadSupporters[_matchId][_monachad].push(msg.sender);
        userMatches[msg.sender].push(_matchId);

        // Add entry fee to prize pool
        matchData.prizePool += entryFee;

        // Fund the smart account
        (bool success, ) = _smartAccountAddress.call{value: fundingAmount}("");
        require(success, "Smart account funding failed");

        emit SupporterJoined(_matchId, msg.sender, _monachad, _smartAccountAddress, entryFee, fundingAmount);
    }

    /**
     * @notice Get the entry fee for supporters (10% of Monachad entry margin)
     * @param _matchId The match ID
     * @return entryFee The required entry fee for supporters
     */
    function getEntryFee(uint256 _matchId) external view matchExists(_matchId) returns (uint256) {
        return (matches[_matchId].entryMargin * 1000) / BASIS_POINTS; // 10%
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
        require(matchMonachads[_matchId].length >= 2, "Need at least 2 Monachads");

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
     * @notice Determine the winner of a match (highest PnL among Monachads)
     * @param _matchId The match ID
     * @return winner The address of the winning Monachad
     */
    function _determineWinner(uint256 _matchId) internal view returns (address) {
        address[] memory monachads = matchMonachads[_matchId];
        require(monachads.length > 0, "No Monachads in match");
        
        address winner = monachads[0];
        int256 highestPnL = participants[_matchId][winner].pnl;

        for (uint256 i = 1; i < monachads.length; i++) {
            address monachad = monachads[i];
            int256 pnl = participants[_matchId][monachad].pnl;

            if (pnl > highestPnL) {
                highestPnL = pnl;
                winner = monachad;
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
     * @notice Get all Monachads in a match
     * @param _matchId The match ID
     * @return Array of Monachad addresses
     */
    function getMatchMonachads(
        uint256 _matchId
    ) external view matchExists(_matchId) returns (address[] memory) {
        return matchMonachads[_matchId];
    }

    /**
     * @notice Get all supporters of a specific Monachad in a match
     * @param _matchId The match ID
     * @param _monachad The Monachad address
     * @return Array of supporter addresses
     */
    function getMonachadSupporters(
        uint256 _matchId,
        address _monachad
    ) external view matchExists(_matchId) returns (address[] memory) {
        return monachadSupporters[_matchId][_monachad];
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
