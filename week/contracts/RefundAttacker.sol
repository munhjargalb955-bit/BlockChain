// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {GiveChain} from "./GiveChain.sol";

contract RefundAttacker {
    GiveChain public immutable target;
    uint256 public campaignId;
    uint256 public reentryAttempts;
    uint256 public reentrySuccesses;

    constructor(address giveChain) {
        target = GiveChain(giveChain);
    }

    function donate(uint256 id) external payable {
        target.donate{value: msg.value}(id);
    }

    function attack(uint256 id) external {
        campaignId = id;
        target.refund(id);
    }

    // try/catch keeps the first refund alive when the re-entry reverts.
    receive() external payable {
        if (reentryAttempts == 0) {
            reentryAttempts++;
            try target.refund(campaignId) {
                reentrySuccesses++;
            } catch {}
        }
    }
}
