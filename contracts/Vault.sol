// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Vault
 * @notice Secure collateral vault for the FlareBet Pro platform
 * @dev Only EVVM_Hub can authorize fund movements
 */
contract Vault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============================================================
    //                            STORAGE
    // =============================================================

    address public evvmHub;
    address public owner;

    // Supported tokens (address(0) = native FLR)
    mapping(address => bool) public supportedTokens;
    address[] public tokenList;

    // Total reserves per token
    mapping(address => uint256) public totalReserves;

    // Platform treasury (for collected fees)
    mapping(address => uint256) public treasury;

    // Emergency pause
    bool public paused;

    // =============================================================
    //                            EVENTS
    // =============================================================

    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event ReservesAdded(address indexed token, uint256 amount);
    event ReservesRemoved(address indexed token, uint256 amount);
    event FeeCollected(address indexed token, uint256 amount);
    event TreasuryWithdrawn(address indexed token, uint256 amount, address recipient);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event EVVMHubUpdated(address indexed oldHub, address indexed newHub);
    event Paused();
    event Unpaused();

    // =============================================================
    //                          MODIFIERS
    // =============================================================

    modifier onlyEVVMHub() {
        require(msg.sender == evvmHub, "Only EVVM Hub");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Vault is paused");
        _;
    }

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    constructor(address _evvmHub) {
        owner = msg.sender;
        evvmHub = _evvmHub;

        // Native FLR is always supported
        supportedTokens[address(0)] = true;
        tokenList.push(address(0));
    }

    // =============================================================
    //                     DEPOSIT FUNCTIONS
    // =============================================================

    /**
     * @notice Deposit native FLR to vault
     */
    function depositFLR() external payable whenNotPaused nonReentrant {
        require(msg.value > 0, "Must deposit something");
        totalReserves[address(0)] += msg.value;
        emit Deposited(msg.sender, address(0), msg.value);
    }

    /**
     * @notice Deposit ERC20 token to vault
     */
    function depositToken(address token, uint256 amount) external whenNotPaused nonReentrant {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Must deposit something");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        totalReserves[token] += amount;

        emit Deposited(msg.sender, token, amount);
    }

    // =============================================================
    //                    WITHDRAWAL FUNCTIONS
    // =============================================================

    /**
     * @notice Withdraw funds to a user (only EVVM Hub can call)
     * @param recipient The recipient address
     * @param token The token to withdraw (address(0) for FLR)
     * @param amount The amount to withdraw
     */
    function withdrawTo(
        address recipient,
        address token,
        uint256 amount
    ) external onlyEVVMHub whenNotPaused nonReentrant {
        require(totalReserves[token] >= amount, "Insufficient reserves");

        totalReserves[token] -= amount;

        if (token == address(0)) {
            payable(recipient).transfer(amount);
        } else {
            IERC20(token).safeTransfer(recipient, amount);
        }

        emit Withdrawn(recipient, token, amount);
    }

    /**
     * @notice Batch withdraw to multiple recipients
     */
    function batchWithdraw(
        address[] calldata recipients,
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external onlyEVVMHub whenNotPaused nonReentrant {
        require(recipients.length == tokens.length, "Length mismatch");
        require(recipients.length == amounts.length, "Length mismatch");

        for (uint256 i = 0; i < recipients.length; i++) {
            require(totalReserves[tokens[i]] >= amounts[i], "Insufficient reserves");

            totalReserves[tokens[i]] -= amounts[i];

            if (tokens[i] == address(0)) {
                payable(recipients[i]).transfer(amounts[i]);
            } else {
                IERC20(tokens[i]).safeTransfer(recipients[i], amounts[i]);
            }

            emit Withdrawn(recipients[i], tokens[i], amounts[i]);
        }
    }

    // =============================================================
    //                    RESERVE MANAGEMENT
    // =============================================================

    /**
     * @notice Add to platform reserves (from EVVM Hub)
     */
    function addReserves(address token, uint256 amount) external onlyEVVMHub {
        totalReserves[token] += amount;
        emit ReservesAdded(token, amount);
    }

    /**
     * @notice Remove from platform reserves
     */
    function removeReserves(address token, uint256 amount) external onlyEVVMHub {
        require(totalReserves[token] >= amount, "Insufficient reserves");
        totalReserves[token] -= amount;
        emit ReservesRemoved(token, amount);
    }

    // =============================================================
    //                    FEE COLLECTION
    // =============================================================

    /**
     * @notice Collect platform fee (called by EVVM Hub)
     */
    function collectFee(address token, uint256 amount) external onlyEVVMHub {
        require(totalReserves[token] >= amount, "Insufficient reserves");
        totalReserves[token] -= amount;
        treasury[token] += amount;
        emit FeeCollected(token, amount);
    }

    /**
     * @notice Withdraw from treasury (owner only)
     */
    function withdrawTreasury(
        address token,
        uint256 amount,
        address recipient
    ) external onlyOwner nonReentrant {
        require(treasury[token] >= amount, "Insufficient treasury");
        treasury[token] -= amount;

        if (token == address(0)) {
            payable(recipient).transfer(amount);
        } else {
            IERC20(token).safeTransfer(recipient, amount);
        }

        emit TreasuryWithdrawn(token, amount, recipient);
    }

    // =============================================================
    //                      VIEW FUNCTIONS
    // =============================================================

    function getReserves(address token) external view returns (uint256) {
        return totalReserves[token];
    }

    function getTreasury(address token) external view returns (uint256) {
        return treasury[token];
    }

    function getBalance(address token) external view returns (uint256) {
        if (token == address(0)) {
            return address(this).balance;
        }
        return IERC20(token).balanceOf(address(this));
    }

    function getSupportedTokens() external view returns (address[] memory) {
        return tokenList;
    }

    function isTokenSupported(address token) external view returns (bool) {
        return supportedTokens[token];
    }

    // =============================================================
    //                      ADMIN FUNCTIONS
    // =============================================================

    function addSupportedToken(address token) external onlyOwner {
        require(!supportedTokens[token], "Already supported");
        supportedTokens[token] = true;
        tokenList.push(token);
        emit TokenAdded(token);
    }

    function removeSupportedToken(address token) external onlyOwner {
        require(token != address(0), "Cannot remove native token");
        require(supportedTokens[token], "Not supported");
        supportedTokens[token] = false;

        // Remove from list
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (tokenList[i] == token) {
                tokenList[i] = tokenList[tokenList.length - 1];
                tokenList.pop();
                break;
            }
        }

        emit TokenRemoved(token);
    }

    function setEVVMHub(address _evvmHub) external onlyOwner {
        emit EVVMHubUpdated(evvmHub, _evvmHub);
        evvmHub = _evvmHub;
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }

    // =============================================================
    //                     EMERGENCY FUNCTIONS
    // =============================================================

    /**
     * @notice Emergency withdrawal of all funds (owner only, when paused)
     */
    function emergencyWithdraw(address token, address recipient) external onlyOwner {
        require(paused, "Must be paused");

        uint256 amount;
        if (token == address(0)) {
            amount = address(this).balance;
            payable(recipient).transfer(amount);
        } else {
            amount = IERC20(token).balanceOf(address(this));
            IERC20(token).safeTransfer(recipient, amount);
        }

        totalReserves[token] = 0;
        treasury[token] = 0;
    }

    // =============================================================
    //                      RECEIVE ETHER
    // =============================================================

    receive() external payable {
        totalReserves[address(0)] += msg.value;
        emit Deposited(msg.sender, address(0), msg.value);
    }
}
