// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleDonation {
    // 1. Эзэн ба хүлээн авагч
    address public owner;
    address payable public beneficiary;

    // 2. Хандивын мэдээлэл
    bool public campaignActive;
    uint256 public totalDonated;
    mapping(address => uint256) public donations;

    // 3. Reentrancy lock
    bool private locked;

    // 4. Events
    event Donated(address indexed donor, uint256 amount);
    event CampaignStatusChanged(bool active);
    event Withdrawn(address indexed to, uint256 amount);
    event BeneficiaryChanged(
        address indexed oldBeneficiary,
        address indexed newBeneficiary
    );

    // 5. Constructor
    constructor(address payable initialBeneficiary) {
        require(initialBeneficiary != address(0), "Invalid beneficiary address");
        owner = msg.sender;
        beneficiary = initialBeneficiary;
        campaignActive = true;
    }

    // 6-8. Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlyBeneficiary() {
        require(msg.sender == beneficiary, "Only beneficiary can call this function");
        _;
    }

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    // 9. Хандив өгөх
    function donate() external payable {
        require(campaignActive, "Campaign is not active");
        require(msg.value > 0, "Donation must be greater than 0");

        donations[msg.sender] += msg.value;
        totalDonated += msg.value;
        emit Donated(msg.sender, msg.value);
    }

    // 10. Аяныг асаах/унтраах
    function setCampaignActive(bool active) external onlyOwner {
        campaignActive = active;
        emit CampaignStatusChanged(active);
    }

    // 11. Beneficiary солих
    function changeBeneficiary(address payable newBeneficiary) external onlyOwner {
        require(newBeneficiary != address(0), "Invalid beneficiary address");
        require(address(this).balance == 0, "Contract balance must be zero");

        address oldBeneficiary = beneficiary;   // засвар
        beneficiary = newBeneficiary;
        emit BeneficiaryChanged(oldBeneficiary, newBeneficiary);
    }

    // 12. Мөнгө татах
    function withdraw() external onlyBeneficiary nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");

        (bool success, ) = beneficiary.call{value: balance}("");
        require(success, "Withdrawal failed");
        emit Withdrawn(beneficiary, balance);
    }

    // 13-15. View functions (wei-ээр буцаана)
    function getTotalDonated() external view returns (uint256) {
        return totalDonated;
    }

    function getMyDonation() external view returns (uint256) {
        return donations[msg.sender];
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}