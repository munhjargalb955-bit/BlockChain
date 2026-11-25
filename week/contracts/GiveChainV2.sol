// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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
        address beneficiary;
        address asset; // address(0) = ETH, otherwise ERC-20 token address
        Stage stage;
        bool withdrawn;
        uint256 refunded;
    }

    error NotOwner();
    error CampaignNotFound(uint256 id);
    error InvalidGoal();
    error InvalidBeneficiary();
    error InvalidAsset();
    error InvalidAmount();
    error InvalidStage();
    error WrongAssetType();
    error NotBeneficiary();
    error AlreadyWithdrawn();
    error NothingToRefund();
    error TransferFailed();
    error CampaignAlreadyFunded();
    error ReentrantCall();

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

    event CampaignFinalized(
        uint256 indexed campaignId,
        Stage stage
    );

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

    address public immutable owner;
    uint256 public campaignCount;

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public donations;
    mapping(address => uint256) public lifetimeDonatedByAsset;

    bool private locked;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier validCampaign(uint256 id) {
        if (id >= campaignCount) revert CampaignNotFound(id);
        _;
    }

    modifier nonReentrant() {
        if (locked) revert ReentrantCall();
        locked = true;
        _;
        locked = false;
    }

    function createCampaign(
        string calldata title,
        uint256 goal,
        address beneficiary,
        address asset
    )
        external
        onlyOwner
        returns (uint256 id)
    {
        if (goal == 0) revert InvalidGoal();
        if (beneficiary == address(0)) revert InvalidBeneficiary();

        if (asset != address(0) && asset.code.length == 0) {
            revert InvalidAsset();
        }

        id = campaignCount;

        campaigns[id] = Campaign({
            owner: msg.sender,
            title: title,
            goal: goal,
            raised: 0,
            beneficiary: beneficiary,
            asset: asset,
            stage: Stage.OPEN,
            withdrawn: false,
            refunded: 0
        });

        campaignCount++;

        emit CampaignCreated(
            id,
            msg.sender,
            title,
            goal,
            beneficiary,
            asset
        );
    }

    function donateETH(uint256 id)
        external
        payable
        validCampaign(id)
        nonReentrant
    {
        Campaign storage c = campaigns[id];

        if (c.stage != Stage.OPEN) revert InvalidStage();
        if (c.asset != address(0)) revert WrongAssetType();
        if (msg.value == 0) revert InvalidAmount();

        _recordDonation(id, msg.sender, msg.value);
    }

    function donateToken(uint256 id, uint256 amount)
        external
        validCampaign(id)
        nonReentrant
    {
        Campaign storage c = campaigns[id];

        if (c.stage != Stage.OPEN) revert InvalidStage();
        if (c.asset == address(0)) revert WrongAssetType();
        if (amount == 0) revert InvalidAmount();

        IERC20 token = IERC20(c.asset);

        uint256 beforeBalance = token.balanceOf(address(this));

        token.safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        uint256 afterBalance = token.balanceOf(address(this));
        uint256 received = afterBalance - beforeBalance;

        if (received == 0) revert InvalidAmount();

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

        emit Donated(
            id,
            donor,
            c.asset,
            amount
        );
    }

    function finalizeCampaign(uint256 id)
        external
        onlyOwner
        validCampaign(id)
    {
        Campaign storage c = campaigns[id];

        if (c.stage != Stage.OPEN) revert InvalidStage();

        if (c.raised >= c.goal) {
            c.stage = Stage.SUCCESS;
        } else {
            c.stage = Stage.FAILED;
        }

        emit CampaignFinalized(id, c.stage);
    }

    function withdraw(uint256 id)
        external
        validCampaign(id)
        nonReentrant
    {
        Campaign storage c = campaigns[id];

        if (c.stage != Stage.SUCCESS) revert InvalidStage();
        if (msg.sender != c.beneficiary) revert NotBeneficiary();
        if (c.withdrawn) revert AlreadyWithdrawn();

        uint256 amount = c.raised;
        c.withdrawn = true;

        _payout(c.asset, c.beneficiary, amount);

        emit Withdrawn(
            id,
            c.beneficiary,
            c.asset,
            amount
        );
    }

    function refund(uint256 id)
        external
        validCampaign(id)
        nonReentrant
    {
        Campaign storage c = campaigns[id];

        if (c.stage != Stage.FAILED) revert InvalidStage();

        uint256 amount = donations[id][msg.sender];
        if (amount == 0) revert NothingToRefund();

        donations[id][msg.sender] = 0;
        c.refunded += amount;

        _payout(c.asset, msg.sender, amount);

        emit Refunded(
            id,
            msg.sender,
            c.asset,
            amount
        );
    }

    function _payout(
        address asset,
        address receiver,
        uint256 amount
    ) internal {
        if (asset == address(0)) {
            (bool success, ) = payable(receiver).call{value: amount}("");
            if (!success) revert TransferFailed();
            return;
        }

        IERC20(asset).safeTransfer(receiver, amount);
    }

    function changeBeneficiary(
        uint256 id,
        address newBeneficiary
    )
        external
        onlyOwner
        validCampaign(id)
    {
        Campaign storage c = campaigns[id];

        if (c.stage != Stage.OPEN) revert InvalidStage();
        if (c.raised != 0) revert CampaignAlreadyFunded();
        if (newBeneficiary == address(0)) revert InvalidBeneficiary();

        address oldBeneficiary = c.beneficiary;
        c.beneficiary = newBeneficiary;

        emit BeneficiaryChanged(
            id,
            oldBeneficiary,
            newBeneficiary
        );
    }

    function getMyDonation(uint256 id)
        external
        view
        validCampaign(id)
        returns (uint256)
    {
        return donations[id][msg.sender];
    }

    function getContractAssetBalance(address asset)
        external
        view
        returns (uint256)
    {
        if (asset == address(0)) {
            return address(this).balance;
        }

        return IERC20(asset).balanceOf(address(this));
    }
}
