// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Counter {
    uint256 public count;
    int256 public delta;

    function inc(uint256 n) public {
        count += n;
        delta += int256(n);
    }

    function dec(uint256 n) public {
        require(n <= count, "n is greater than count");
        count -= n;
        delta -= int256(n);
    }
}