// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface TradeClub_IDelegationRegistry {
    struct Delegation {
        address supporter;
        address monachad;
        uint256 matchId;
        uint256 amount;
        uint256 spendingLimit;
        uint256 expiresAt;
        bool active;
        bool revoked;
    }

    struct DelegationCaveat {
        address[] allowedContracts;
        uint256 maxSlippage;
        uint256 maxTradeSize;
    }

    event DelegationCreated(
        bytes32 indexed delegationHash,
        address indexed supporter,
        address indexed monachad,
        uint256 matchId,
        uint256 amount,
        uint256 expiresAt
    );

    event DelegationRevoked(
        bytes32 indexed delegationHash,
        address indexed supporter,
        uint256 timestamp
    );

    event DelegationExecuted(
        bytes32 indexed delegationHash,
        address indexed executor,
        address target,
        uint256 value,
        bytes data
    );

    function createDelegation(
        address _monachad,
        uint256 _matchId,
        uint256 _amount,
        uint256 _spendingLimit,
        uint256 _duration,
        DelegationCaveat calldata _caveats
    ) external payable returns (bytes32);

    function revokeDelegation(bytes32 _delegationHash) external;

    function executeDelegatedTrade(
        bytes32 _delegationHash,
        address _target,
        uint256 _value,
        bytes calldata _data
    ) external returns (bool);

    function getDelegation(
        bytes32 _delegationHash
    ) external view returns (Delegation memory);

    function isValidDelegation(
        bytes32 _delegationHash
    ) external view returns (bool);

    function getSupporterDelegations(
        address _supporter,
        uint256 _matchId
    ) external view returns (bytes32[] memory);

    function getMonachadDelegations(
        address _monachad,
        uint256 _matchId
    ) external view returns (bytes32[] memory);
}
