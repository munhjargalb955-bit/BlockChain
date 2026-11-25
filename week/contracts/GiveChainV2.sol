// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice GiveChain V1 + ERC-20 support. One campaign settles in exactly one asset:
/// asset == address(0) -> ETH, otherwise the ERC-20 token address.
contract GiveChainV2 {
    using SafeERC20 for IERC20;

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
        address asset; // address(0) = ETH
        Stage stage;
        bool withdrawn;
        uint256 refunded;
    }

    // storage
    address public owner;
    uint256 public campaignCount;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public donations;
    // historical total per asset; NOT reduced by refunds/withdrawals
    mapping(address => uint256) public lifetimeDonatedByAsset;
    bool private locked;

    // errors
    error OnlyOwner();
    error InvalidCampaign();
    error InvalidBeneficiary();
    error InvalidGoal();
    error InvalidAsset();
    error InvalidDonation();
    error InvalidStage();
    error WrongAssetType();
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
        address indexed beneficiary,
        address asset
    );
    event Donated(
        uint256 indexed campaignId,
        address indexed donor,
        address indexed asset,
        uint256 amount
    );
    event CampaignFinalized(uint256 indexed campaignId, Stage stage);
    event Withdrawn(
        uint256 indexed campaignId,
        address indexed beneficiary,
        address indexed asset,
        uint256 amount
    );
    event Refunded(
        uint256 indexed campaignId,
        address indexed donor,
        address indexed asset,
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
        address payable beneficiary,
        address asset
    ) external onlyOwner returns (uint256 id) {
        if (beneficiary == address(0)) revert InvalidBeneficiary();
        if (goal == 0) revert InvalidGoal();
        if (asset != address(0) && asset.code.length == 0) revert InvalidAsset();

        id = campaignCount;
        campaignCount++;

        Campaign storage c = campaigns[id];
        c.owner = msg.sender;
        c.title = title;
        c.goal = goal;
        c.beneficiary = beneficiary;
        c.asset = asset;
        c.stage = Stage.OPEN;

        emit CampaignCreated(id, msg.sender, title, goal, beneficiary, asset);
    }

    function finalizeCampaign(
        uint256 id
    ) external onlyOwner validCampaign(id) {
        Campaign storage c = campaigns[id];
        if (c.stage != Stage.OPEN) revert InvalidStage();

        c.stage = c.raised >= c.goal ? Stage.SUCCESS : Stage.FAILED;

        emit CampaignFinalized(id, c.stage);
    }

    // donate
    function donateETH(uint256 id) external payable validCampaign(id) {
        Campaign storage c = campaigns[id];
        if (c.stage != Stage.OPEN) revert InvalidStage();
        if (c.asset != address(0)) revert WrongAssetType();
        if (msg.value == 0) revert InvalidDonation();

        _recordDonation(id, msg.sender, msg.value);
    }

    function donateToken(
        uint256 id,
        uint256 amount
    ) external validCampaign(id) nonReentrant {
        Campaign storage c = campaigns[id];
        if (c.stage != Stage.OPEN) revert InvalidStage();
        if (c.asset == address(0)) revert WrongAssetType();
        if (amount == 0) revert InvalidDonation();

        IERC20 token = IERC20(c.asset);

        // record what actually arrived (fee-on-transfer tokens)
        uint256 beforeBal = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - beforeBal;

        if (received == 0) revert InvalidDonation();

        _recordDonation(id, msg.sender, received);
    }

    function _recordDonation(
        uint256 id,
        address donor,
        uint256 amount
    ) internal {
        Campaign storage c = campaigns[id];

        donations[id][donor] += amount;
        c.raised += amount;
        lifetimeDonatedByAsset[c.asset] += amount;

        emit Donated(id, donor, c.asset, amount);
    }

    // settlement
    function withdraw(uint256 id) external validCampaign(id) nonReentrant {
        Campaign storage c = campaigns[id];
        if (c.stage != Stage.SUCCESS) revert InvalidStage();
        if (msg.sender != c.beneficiary) revert OnlyBeneficiary();
        if (c.withdrawn) revert AlreadyWithdrawn();

        c.withdrawn = true;
        uint256 amount = c.raised;

        _payout(c.asset, c.beneficiary, amount);

        emit Withdrawn(id, c.beneficiary, c.asset, amount);
    }

    function refund(uint256 id) external validCampaign(id) nonReentrant {
        Campaign storage c = campaigns[id];
        if (c.stage != Stage.FAILED) revert InvalidStage();

        uint256 amount = donations[id][msg.sender];
        if (amount == 0) revert NoDonation();

        donations[id][msg.sender] = 0;
        c.refunded += amount;

        _payout(c.asset, payable(msg.sender), amount);

        emit Refunded(id, msg.sender, c.asset, amount);
    }

    function _payout(
        address asset,
        address payable receiver,
        uint256 amount
    ) internal {
        if (asset == address(0)) {
            (bool ok, ) = receiver.call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            IERC20(asset).safeTransfer(receiver, amount);
        }
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

    function getContractAssetBalance(
        address asset
    ) external view returns (uint256) {
        if (asset == address(0)) return address(this).balance;
        return IERC20(asset).balanceOf(address(this));
    }
}
