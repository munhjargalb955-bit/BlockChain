// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract CampaignDonations {
    mapping(uint256 =>
        mapping(address => uint256))
        public campaignsById;
    function donate(uint256 campaignId) external payable {
        campaignsById[campaignId][msg.sender] += msg.value;
    }
}