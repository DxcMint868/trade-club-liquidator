// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface TradeClub_IMatchVault {
    function getBalance() external view returns (uint256);

    function withdrawMargin(uint256 amount) external;

    function executeTrade(
        address _target,
        bytes calldata _calldata,
        uint256 _nativeAmount
    ) external payable;
}
