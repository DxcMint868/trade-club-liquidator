// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./TradeClub_GovernanceToken.sol";

/**
 * @notice Manages governance bribe wars for TradeClub DAO
 * @dev Allows Monachads to create bribe pools to influence governance votes
 */
contract TradeClub_BribePool is ReentrancyGuard, Ownable {
    TradeClub_GovernanceToken public govToken;

    struct Bribe {
        uint256 id;
        address creator;
        uint256 proposalId;
        uint256 totalReward;
        uint256 rewardPerVote;
        uint256 votesCaptured;
        uint256 deadline;
        bool distributed;
        bool active;
    }

    struct VoteDelegation {
        address delegator;
        address delegatee;
        uint256 bribeId;
        uint256 votes;
        uint256 reward;
        bool claimed;
    }

    uint256 public bribeCounter;
    uint256 public platformFeePercent = 200; // 2% fee in basis points
    uint256 public constant BASIS_POINTS = 10000;

    mapping(uint256 => Bribe) public bribes;
    mapping(uint256 => mapping(address => VoteDelegation)) public voteDelegations;
    mapping(uint256 => address[]) public bribeDelegators;
    mapping(address => uint256[]) public userBribes;

    event BribeCreated(
        uint256 indexed bribeId,
        address indexed creator,
        uint256 proposalId,
        uint256 totalReward,
        uint256 deadline
    );

    event VotesDelegated(
        uint256 indexed bribeId,
        address indexed delegator,
        address indexed delegatee,
        uint256 votes
    );

    event RewardClaimed(
        uint256 indexed bribeId,
        address indexed delegator,
        uint256 reward
    );

    event BribeDistributed(uint256 indexed bribeId, uint256 totalDistributed);

    constructor(address _tclubToken) Ownable(msg.sender) {
        require(_tclubToken != address(0), "Invalid token address");
        govToken = TradeClub_GovernanceToken(_tclubToken);
    }

    /**
     * @notice Create a new bribe pool for a governance proposal
     * @param _proposalId The governance proposal ID
     * @param _totalReward Total amount of TCLUB tokens offered as reward
     * @param _duration Duration in seconds for the bribe to be active
     * @return bribeId The ID of the created bribe
     */
    function createBribe(
        uint256 _proposalId,
        uint256 _totalReward,
        uint256 _duration
    ) external nonReentrant returns (uint256) {
        require(_totalReward > 0, "Reward must be positive");
        require(_duration > 0, "Duration must be positive");

        // Transfer tokens from creator
        require(
            govToken.transferFrom(msg.sender, address(this), _totalReward),
            "Token transfer failed"
        );

        uint256 bribeId = ++bribeCounter;
        uint256 deadline = block.timestamp + _duration;

        Bribe storage bribe = bribes[bribeId];
        bribe.id = bribeId;
        bribe.creator = msg.sender;
        bribe.proposalId = _proposalId;
        bribe.totalReward = _totalReward;
        bribe.deadline = deadline;
        bribe.active = true;

        userBribes[msg.sender].push(bribeId);

        emit BribeCreated(bribeId, msg.sender, _proposalId, _totalReward, deadline);

        return bribeId;
    }

    /**
     * @notice Delegate voting power to a bribe pool
     * @param _bribeId The bribe pool ID
     * @param _delegatee The address to delegate votes to (typically bribe creator)
     * @param _votes Number of votes to delegate
     */
    function delegateVotes(
        uint256 _bribeId,
        address _delegatee,
        uint256 _votes
    ) external nonReentrant {
        Bribe storage bribe = bribes[_bribeId];
        
        require(bribe.active, "Bribe not active");
        require(block.timestamp <= bribe.deadline, "Bribe expired");
        require(_votes > 0, "Votes must be positive");

        // Verify user has voting power
        uint256 userVotes = govToken.getVotes(msg.sender);
        require(userVotes >= _votes, "Insufficient voting power");

        // Check if already delegated
        require(
            voteDelegations[_bribeId][msg.sender].delegator == address(0),
            "Already delegated to this bribe"
        );

        // Record delegation
        VoteDelegation storage delegation = voteDelegations[_bribeId][msg.sender];
        delegation.delegator = msg.sender;
        delegation.delegatee = _delegatee;
        delegation.bribeId = _bribeId;
        delegation.votes = _votes;

        bribeDelegators[_bribeId].push(msg.sender);
        bribe.votesCaptured += _votes;

        emit VotesDelegated(_bribeId, msg.sender, _delegatee, _votes);
    }

    /**
     * @notice Distribute rewards to delegators after bribe ends
     * @param _bribeId The bribe pool ID
     */
    function distributeBribe(uint256 _bribeId) external nonReentrant {
        Bribe storage bribe = bribes[_bribeId];
        
        require(bribe.active, "Bribe not active");
        require(block.timestamp > bribe.deadline, "Bribe not ended yet");
        require(!bribe.distributed, "Already distributed");

        bribe.distributed = true;
        bribe.active = false;

        if (bribe.votesCaptured == 0) {
            // No votes captured, return funds to creator
            require(
                govToken.transfer(bribe.creator, bribe.totalReward),
                "Return transfer failed"
            );
            return;
        }

        // Calculate reward per vote
        uint256 platformFee = (bribe.totalReward * platformFeePercent) / BASIS_POINTS;
        uint256 distributionAmount = bribe.totalReward - platformFee;
        bribe.rewardPerVote = distributionAmount / bribe.votesCaptured;

        // Calculate individual rewards
        address[] memory delegators = bribeDelegators[_bribeId];
        for (uint256 i = 0; i < delegators.length; i++) {
            address delegator = delegators[i];
            VoteDelegation storage delegation = voteDelegations[_bribeId][delegator];
            delegation.reward = delegation.votes * bribe.rewardPerVote;
        }

        // Transfer platform fee to owner
        if (platformFee > 0) {
            require(
                govToken.transfer(owner(), platformFee),
                "Platform fee transfer failed"
            );
        }

        emit BribeDistributed(_bribeId, distributionAmount);
    }

    /**
     * @notice Claim bribe rewards
     * @param _bribeId The bribe pool ID
     */
    function claimReward(uint256 _bribeId) external nonReentrant {
        Bribe storage bribe = bribes[_bribeId];
        VoteDelegation storage delegation = voteDelegations[_bribeId][msg.sender];

        require(bribe.distributed, "Bribe not distributed yet");
        require(delegation.delegator == msg.sender, "No delegation found");
        require(!delegation.claimed, "Reward already claimed");
        require(delegation.reward > 0, "No reward to claim");

        delegation.claimed = true;
        uint256 reward = delegation.reward;

        require(
            govToken.transfer(msg.sender, reward),
            "Reward transfer failed"
        );

        emit RewardClaimed(_bribeId, msg.sender, reward);
    }

    /**
     * @notice Get bribe details
     * @param _bribeId The bribe ID
     * @return Bribe struct
     */
    function getBribe(uint256 _bribeId) external view returns (Bribe memory) {
        return bribes[_bribeId];
    }

    /**
     * @notice Get vote delegation details
     * @param _bribeId The bribe ID
     * @param _delegator The delegator address
     * @return VoteDelegation struct
     */
    function getVoteDelegation(uint256 _bribeId, address _delegator)
        external
        view
        returns (VoteDelegation memory)
    {
        return voteDelegations[_bribeId][_delegator];
    }

    /**
     * @notice Get all delegators for a bribe
     * @param _bribeId The bribe ID
     * @return Array of delegator addresses
     */
    function getBribeDelegators(uint256 _bribeId)
        external
        view
        returns (address[] memory)
    {
        return bribeDelegators[_bribeId];
    }

    /**
     * @notice Get all bribes created by a user
     * @param _user The user address
     * @return Array of bribe IDs
     */
    function getUserBribes(address _user) external view returns (uint256[] memory) {
        return userBribes[_user];
    }

    /**
     * @notice Update platform fee
     * @param _newFeePercent New fee in basis points
     */
    function setPlatformFee(uint256 _newFeePercent) external onlyOwner {
        require(_newFeePercent <= 1000, "Fee cannot exceed 10%");
        platformFeePercent = _newFeePercent;
    }

    /**
     * @notice Emergency cancel a bribe (owner only)
     * @param _bribeId The bribe ID to cancel
     */
    function emergencyCancel(uint256 _bribeId) external onlyOwner {
        Bribe storage bribe = bribes[_bribeId];
        require(bribe.active, "Bribe not active");
        
        bribe.active = false;
        
        // Return funds to creator
        require(
            govToken.transfer(bribe.creator, bribe.totalReward),
            "Refund transfer failed"
        );
    }
}
