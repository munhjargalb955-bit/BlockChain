// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GiveChain {
    enum Stage { NONE, OPEN, SUCCESS, FAILED }

    struct Campaign {
        address owner;
        string title;
        uint256 goal;
        uint256 raised;
        address payable beneficiary;
        Stage stage;
    }

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public donations;
    mapping(uint256 => bool) public withdrawn;

    uint256 public campaignCount;

    // Events
    event CampaignCreated(uint256 indexed id, address indexed owner, uint256 goal);
    event Donated(uint256 indexed id, address indexed donor, uint256 amount);
    event Finalized(uint256 indexed id, Stage stage);
    event Withdrawn(uint256 indexed id, address indexed beneficiary, uint256 amount);
    event Refunded(uint256 indexed id, address indexed donor, uint256 amount);

    // Custom errors
    error InvalidInput();
    error WrongStage();
    error NotOwner();
    error NotBeneficiary();
    error AlreadyWithdrawn();
    error NoDoubleRefund();
    error TransferFailed();

    // 1) createCampaign
    function createCampaign(
        string calldata title,
        uint256 goal,
        address payable beneficiary
    ) external returns (uint256 id) {
        if (goal == 0 || beneficiary == address(0)) revert InvalidInput();

        id = campaignCount;
        campaignCount++;

        campaigns[id] = Campaign({
            owner: msg.sender,
            title: title,
            goal: goal,
            raised: 0,
            beneficiary: beneficiary,
            stage: Stage.OPEN
        });

        emit CampaignCreated(id, msg.sender, goal);
    }

    // 2) donate
    function donate(uint256 id) external payable {
        Campaign storage c = campaigns[id];
        if (c.stage != Stage.OPEN) revert WrongStage();
        if (msg.value == 0) revert InvalidInput();

        c.raised += msg.value;
        donations[id][msg.sender] += msg.value;

        emit Donated(id, msg.sender, msg.value);
    }

    // 3) finalizeCampaign
    function finalizeCampaign(uint256 id) external {
        Campaign storage c = campaigns[id];
        if (c.stage != Stage.OPEN) revert WrongStage();
        if (msg.sender != c.owner) revert NotOwner();

        c.stage = c.raised >= c.goal ? Stage.SUCCESS : Stage.FAILED;

        emit Finalized(id, c.stage);
    }

    // 4) withdraw (SUCCESS only, beneficiary only)
    function withdraw(uint256 id) external {
        Campaign storage c = campaigns[id];
        if (c.stage != Stage.SUCCESS) revert WrongStage();
        if (msg.sender != c.beneficiary) revert NotBeneficiary();
        if (withdrawn[id]) revert AlreadyWithdrawn();

        withdrawn[id] = true;               // Effects first
        uint256 amount = c.raised;

        (bool ok, ) = c.beneficiary.call{value: amount}("");  // Interaction last
        if (!ok) revert TransferFailed();

        emit Withdrawn(id, c.beneficiary, amount);
    }

    // 5) refund (FAILED only, donor only)
    function refund(uint256 id) external {
        Campaign storage c = campaigns[id];
        if (c.stage != Stage.FAILED) revert WrongStage();

        uint256 amount = donations[id][msg.sender];
        if (amount == 0) revert NoDoubleRefund();

        donations[id][msg.sender] = 0;      // Effects first (CEI)

        (bool ok, ) = msg.sender.call{value: amount}("");     // Interaction last
        if (!ok) revert TransferFailed();

        emit Refunded(id, msg.sender, amount);
    }
}