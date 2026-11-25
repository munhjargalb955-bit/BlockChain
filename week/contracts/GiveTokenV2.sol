// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Charge-based GVT (1 GVT = 1 KRW in the lecture assumption).
/// Supply starts at 0; only the owner mints after off-chain payment is confirmed.
contract GiveTokenV2 is ERC20, Ownable {
    error InvalidReceiver();
    error InvalidAmount();

    event ChargeMinted(address indexed user, uint256 amount);

    constructor(
        address initialOwner
    ) ERC20("GiveToken", "GVT") Ownable(initialOwner) {}

    function mintForCharge(address user, uint256 amount) external onlyOwner {
        if (user == address(0)) revert InvalidReceiver();
        if (amount == 0) revert InvalidAmount();

        _mint(user, amount);
        emit ChargeMinted(user, amount);
    }
}
