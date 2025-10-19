// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/TradeClub_IMatchVault.sol";

contract TradeClub_MatchVault is TradeClub_IMatchVault, Ownable, ReentrancyGuard {
    constructor() Ownable(msg.sender) {}

    receive() external payable {}

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function executeTrade(
        address _target,
        bytes calldata _calldata,
        uint256 _nativeAmount
    ) external payable nonReentrant onlyOwner {
        require(
            _nativeAmount <= address(this).balance,
            "MatchVault: Insufficient native balance for trade"
        );
        (bool success, ) = _target.call{ value: _nativeAmount }(_calldata);
        require(success, "MatchVault: Trade execution failed");
    }

    function withdrawMargin(uint256 amount) external nonReentrant onlyOwner {
        require(amount <= address(this).balance, "MatchVault: Insufficient balance");
        (bool success, ) = owner().call{ value: amount }("");
        require(success, "MatchVault: Withdraw failed");
    }
}
