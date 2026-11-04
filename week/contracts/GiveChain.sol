// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GiveChain {
    enum Stage {
        NONE,
        OPEN,
        SUCCESS,
        FAILED
    }

    struct Campaign {
        address owner;
        string title;
        uint256 goal;
        uint256 raised;
        address payable beneficiary;
        Stage stage;
        bool withdrawn;
        uint256 refunded;
    }

    // storage
    address public owner;
    uint256 public campaignCount;
    uint256 public totalDonated;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public donations;
    bool private locked;

    // errors
    error OnlyOwner();
    error InvalidCampaign();
    error InvalidBeneficiary();
    error InvalidGoal();
    error InvalidDonation();
    error InvalidStage();
    error OnlyBeneficiary();
    error NoDonation();
    error AlreadyWithdrawn();
    error CampaignHasDonation();
    error ReentrantCall();
    error TransferFailed();

    // events
    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed owner,
        string title,
        uint256 goal,
        address indexed beneficiary
    );
    event Donated(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount
    );
    event CampaignFinalized(uint256 indexed campaignId, Stage stage);
    event Withdrawn(
        uint256 indexed campaignId,
        address indexed beneficiary,
        uint256 amount
    );
    event Refunded(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount
    );
    event BeneficiaryChanged(
        uint256 indexed campaignId,
        address indexed oldBeneficiary,
        address indexed newBeneficiary
    );

    // modifiers
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier validCampaign(uint256 id) {
        if (id >= campaignCount) revert InvalidCampaign();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert ReentrantCall();
        locked = true;
        _;
        locked = false;
    }

    constructor() {
        owner = msg.sender;
    }

    // create / finalize
    function createCampaign(
        string calldata title,
        uint256 goal,
        address payable beneficiary
    ) external onlyOwner returns (uint256 id) {
        if (beneficiary == address(0)) revert InvalidBeneficiary();
        if (goal == 0) revert InvalidGoal();

        id = campaignCount;
        campaignCount++;

        Campaign storage c = campaigns[id];
        c.owner = msg.sender;
        c.title = title;
        c.goal = goal;
        c.beneficiary = beneficiary;
        c.stage = Stage.OPEN;

        emit CampaignCreated(id, msg.sender, title, goal, beneficiary);
    }

    function finalizeCampaign(
        uint256 id
    ) external onlyOwner validCampaign(id) {
        Campaign storage c = campaigns[id];
        if (c.stage != Stage.OPEN) revert InvalidStage();

        c.stage = c.raised >= c.goal ? Stage.SUCCESS : Stage.FAILED;

        emit CampaignFinalized(id, c.stage);
    }

    // money flow
    function donate(uint256 id) external payable validCampaign(id) {
        Campaign storage c = campaigns[id];
        if (c.stage != Stage.OPEN) revert InvalidStage();
        if (msg.value == 0) revert InvalidDonation();

        c.raised += msg.value;
        donations[id][msg.sender] += msg.value;
        totalDonated += msg.value;

        emit Donated(id, msg.sender, msg.value);
    }

    function withdraw(uint256 id) external validCampaign(id) nonReentrant {
        Campaign storage c = campaigns[id];
        if (c.stage != Stage.SUCCESS) revert InvalidStage();
        if (msg.sender != c.beneficiary) revert OnlyBeneficiary();
        if (c.withdrawn) revert AlreadyWithdrawn();

        c.withdrawn = true;
        uint256 amount = c.raised;

        (bool ok, ) = c.beneficiary.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(id, c.beneficiary, amount);
    }

    function refund(uint256 id) external validCampaign(id) nonReentrant {
        Campaign storage c = campaigns[id];
        if (c.stage != Stage.FAILED) revert InvalidStage();

        uint256 amount = donations[id][msg.sender];
        if (amount == 0) revert NoDonation();

        donations[id][msg.sender] = 0;
        c.refunded += amount;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Refunded(id, msg.sender, amount);
    }

    function changeBeneficiary(
        uint256 id,
        address payable newBeneficiary
    ) external onlyOwner validCampaign(id) {
        Campaign storage c = campaigns[id];
        if (c.stage != Stage.OPEN) revert InvalidStage();
        if (newBeneficiary == address(0)) revert InvalidBeneficiary();
        if (c.raised != 0) revert CampaignHasDonation();

        address oldBeneficiary = c.beneficiary;
        c.beneficiary = newBeneficiary;

        emit BeneficiaryChanged(id, oldBeneficiary, newBeneficiary);
    }

    // views
    function getMyDonation(
        uint256 id
    ) external view validCampaign(id) returns (uint256) {
        return donations[id][msg.sender];
    }

    function getCampaignRaised(
        uint256 id
    ) external view validCampaign(id) returns (uint256) {
        return campaigns[id].raised;
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
