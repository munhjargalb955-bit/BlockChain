// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GiveTokenV2 is ERC20, Ownable {
    error InvalidUser();
    error InvalidAmount();

    event ChargeMinted(address indexed user, uint256 amount);

    constructor(address initialOwner)
        ERC20("GiveToken", "GVT")
        Ownable(initialOwner)
    {}

    function mintForCharge(address user, uint256 amount)
        external
        onlyOwner
    {
        if (user == address(0)) revert InvalidUser();
        if (amount == 0) revert InvalidAmount();

        _mint(user, amount);
        emit ChargeMinted(user, amount);
    }
}
