// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface TradeClub_IGovernanceToken is IERC20 {
    function mint(address to, uint256 amount) external;

    function burn(uint256 amount) external;

    function delegate(address delegatee) external;

    function getCurrentVotes(address account) external view returns (uint256);

    function getPriorVotes(
        address account,
        uint256 blockNumber
    ) external view returns (uint256);
}
