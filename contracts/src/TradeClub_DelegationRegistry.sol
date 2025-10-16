// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IDelegationRegistry.sol";
import "./interfaces/IMatchManager.sol";

/**
 * @notice Manages trading delegations for TradeClub supporters to Monachads
 * @dev Implements non-custodial delegation with time-bound permissions and caveats
 */
contract TradeClub_DelegationRegistry is IDelegationRegistry, ReentrancyGuard, Ownable {
    // State variables
    mapping(bytes32 => Delegation) public delegations;
    mapping(bytes32 => DelegationCaveat) public delegationCaveats;
    mapping(address => mapping(uint256 => bytes32[])) public supporterDelegations; // supporter => matchId => delegationHashes
    mapping(address => mapping(uint256 => bytes32[])) public monachadDelegations; // monachad => matchId => delegationHashes
    mapping(bytes32 => uint256) public delegationSpent; // Track spending per delegation

    IMatchManager public matchManager;

    constructor(address _matchManager) Ownable(msg.sender) {
        matchManager = IMatchManager(_matchManager);
    }

    /**
     * @notice Create a new delegation from supporter to Monachad
     * @param _monachad The Monachad address to delegate to
     * @param _matchId The match ID this delegation is for
     * @param _amount The amount of funds to delegate
     * @param _spendingLimit Maximum amount that can be spent via this delegation
     * @param _duration Duration of the delegation in seconds
     * @param _caveats Additional restrictions on the delegation
     * @return delegationHash The unique hash identifying this delegation
     */
    function createDelegation(
        address _monachad,
        uint256 _matchId,
        uint256 _amount,
        uint256 _spendingLimit,
        uint256 _duration,
        DelegationCaveat calldata _caveats
    ) external payable nonReentrant returns (bytes32) {
        require(_monachad != address(0), "Invalid Monachad address");
        require(_amount > 0, "Amount must be positive");
        require(msg.value >= _amount, "Insufficient funds sent");
        require(_spendingLimit >= _amount, "Spending limit too low");
        require(_duration > 0, "Duration must be positive");

        // Verify match exists and Monachad is participant
        IMatchManager.Match memory matchData = matchManager.getMatch(_matchId);
        require(matchData.id == _matchId, "Match does not exist");

        bool isParticipant = false;
        for (uint256 i = 0; i < matchData.participants.length; i++) {
            if (matchData.participants[i] == _monachad) {
                isParticipant = true;
                break;
            }
        }
        require(isParticipant, "Monachad not in match");

        // Verify match hasn't ended
        if (matchData.status == IMatchManager.MatchStatus.ACTIVE) {
            require(block.timestamp < matchData.endTime, "Match already ended");
        }

        // Create delegation hash
        bytes32 delegationHash = keccak256(
            abi.encodePacked(
                msg.sender,
                _monachad,
                _matchId,
                _amount,
                block.timestamp,
                block.number
            )
        );

        // Store delegation
        Delegation storage delegation = delegations[delegationHash];
        delegation.supporter = msg.sender;
        delegation.monachad = _monachad;
        delegation.matchId = _matchId;
        delegation.amount = _amount;
        delegation.spendingLimit = _spendingLimit;
        delegation.expiresAt = block.timestamp + _duration;
        delegation.active = true;
        delegation.revoked = false;

        // Store caveats
        delegationCaveats[delegationHash] = _caveats;

        // Track delegations
        supporterDelegations[msg.sender][_matchId].push(delegationHash);
        monachadDelegations[_monachad][_matchId].push(delegationHash);

        emit DelegationCreated(
            delegationHash,
            msg.sender,
            _monachad,
            _matchId,
            _amount,
            delegation.expiresAt
        );

        return delegationHash;
    }

    /**
     * @notice Revoke an active delegation
     * @param _delegationHash The hash of the delegation to revoke
     */
    function revokeDelegation(bytes32 _delegationHash) external nonReentrant {
        Delegation storage delegation = delegations[_delegationHash];

        require(delegation.supporter == msg.sender, "Not delegation owner");
        require(delegation.active, "Delegation not active");
        require(!delegation.revoked, "Already revoked");

        delegation.active = false;
        delegation.revoked = true;

        // Return unused funds to supporter
        uint256 spent = delegationSpent[_delegationHash];
        uint256 remaining = delegation.amount - spent;

        if (remaining > 0) {
            (bool success, ) = payable(msg.sender).call{ value: remaining }("");
            require(success, "Refund transfer failed");
        }

        emit DelegationRevoked(_delegationHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Execute a delegated trade on behalf of supporter
     * @param _delegationHash The delegation hash to execute under
     * @param _target The contract address to call
     * @param _value The ETH value to send with the call
     * @param _data The calldata to execute
     * @return success Whether the execution succeeded
     */
    function executeDelegatedTrade(
        bytes32 _delegationHash,
        address _target,
        uint256 _value,
        bytes calldata _data
    ) external nonReentrant returns (bool) {
        Delegation storage delegation = delegations[_delegationHash];

        require(delegation.active, "Delegation not active");
        require(!delegation.revoked, "Delegation revoked");
        require(delegation.monachad == msg.sender, "Not authorized");
        require(block.timestamp <= delegation.expiresAt, "Delegation expired");

        // Check spending limit
        uint256 spent = delegationSpent[_delegationHash];
        require(spent + _value <= delegation.spendingLimit, "Exceeds spending limit");

        // Verify target contract is allowed
        DelegationCaveat memory caveats = delegationCaveats[_delegationHash];
        bool targetAllowed = false;
        for (uint256 i = 0; i < caveats.allowedContracts.length; i++) {
            if (caveats.allowedContracts[i] == _target) {
                targetAllowed = true;
                break;
            }
        }
        require(targetAllowed, "Target contract not allowed");

        // Verify trade size is within limits
        require(_value <= caveats.maxTradeSize, "Trade size exceeds limit");

        // Update spent amount
        delegationSpent[_delegationHash] += _value;

        // Execute the trade
        (bool success, ) = _target.call{ value: _value }(_data);
        require(success, "Trade execution failed");

        emit DelegationExecuted(_delegationHash, msg.sender, _target, _value, _data);

        return true;
    }

    /**
     * @notice Get delegation details
     * @param _delegationHash The delegation hash
     * @return Delegation struct with delegation details
     */
    function getDelegation(bytes32 _delegationHash) external view returns (Delegation memory) {
        return delegations[_delegationHash];
    }

    /**
     * @notice Check if a delegation is currently valid
     * @param _delegationHash The delegation hash
     * @return isValid Whether the delegation is valid for execution
     */
    function isValidDelegation(bytes32 _delegationHash) external view returns (bool) {
        Delegation memory delegation = delegations[_delegationHash];

        return
            delegation.active &&
            !delegation.revoked &&
            block.timestamp <= delegation.expiresAt &&
            delegationSpent[_delegationHash] < delegation.spendingLimit;
    }

    /**
     * @notice Get all delegations for a supporter in a specific match
     * @param _supporter The supporter address
     * @param _matchId The match ID
     * @return Array of delegation hashes
     */
    function getSupporterDelegations(
        address _supporter,
        uint256 _matchId
    ) external view returns (bytes32[] memory) {
        return supporterDelegations[_supporter][_matchId];
    }

    /**
     * @notice Get all delegations to a Monachad in a specific match
     * @param _monachad The Monachad address
     * @param _matchId The match ID
     * @return Array of delegation hashes
     */
    function getMonachadDelegations(
        address _monachad,
        uint256 _matchId
    ) external view returns (bytes32[] memory) {
        return monachadDelegations[_monachad][_matchId];
    }

    /**
     * @notice Get delegation caveats
     * @param _delegationHash The delegation hash
     * @return DelegationCaveat struct with restrictions
     */
    function getDelegationCaveats(
        bytes32 _delegationHash
    ) external view returns (DelegationCaveat memory) {
        return delegationCaveats[_delegationHash];
    }

    /**
     * @notice Get amount spent from a delegation
     * @param _delegationHash The delegation hash
     * @return spent The amount spent so far
     */
    function getDelegationSpent(bytes32 _delegationHash) external view returns (uint256) {
        return delegationSpent[_delegationHash];
    }

    /**
     * @notice Update match manager address
     * @param _newMatchManager New match manager address
     */
    function setMatchManager(address _newMatchManager) external onlyOwner {
        require(_newMatchManager != address(0), "Invalid address");
        matchManager = IMatchManager(_newMatchManager);
    }

    /**
     * @notice Emergency function to deactivate a delegation
     * @param _delegationHash The delegation hash to deactivate
     */
    function emergencyDeactivate(bytes32 _delegationHash) external onlyOwner {
        Delegation storage delegation = delegations[_delegationHash];
        delegation.active = false;
    }

    receive() external payable {}
}
