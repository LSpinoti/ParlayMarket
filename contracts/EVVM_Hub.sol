// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IFtsoRegistry.sol";

/**
 * @title EVVM_Hub
 * @notice Main entry point for the EVVM (Ethereum Virtual Virtual Machine) betting system
 * @dev Implements EIP-712 for intent signing, async nonces, and commit-reveal for Dark Pool
 */
contract EVVM_Hub {
    // =============================================================
    //                           CONSTANTS
    // =============================================================

    bytes32 public constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 public constant BET_INTENT_TYPEHASH = keccak256(
        "BetIntent(address bettor,uint256 amount,uint256 nonce,uint256 deadline,bytes32 encryptedData)"
    );

    bytes32 public constant WITHDRAWAL_TYPEHASH = keccak256(
        "Withdrawal(address user,uint256 amount,uint256 nonce)"
    );

    string public constant NAME = "FlareBet Pro";
    string public constant VERSION = "1";

    // =============================================================
    //                            STORAGE
    // =============================================================

    // Virtual state management
    bytes32 public virtualStateRoot;
    mapping(address => uint256) public virtualBalances;
    mapping(address => uint256) public lockedBalances; // Funds locked in pending bets

    // Async nonce tracking - allows out-of-order execution
    mapping(address => mapping(uint256 => bool)) public usedNonces;
    mapping(address => uint256) public highestNonce; // Track highest nonce for reference

    // Commit-reveal for Dark Pool
    struct CommittedBet {
        bytes32 commitment;      // Hash of encrypted bet
        uint256 amount;
        uint256 timestamp;
        bool revealed;
    }
    mapping(bytes32 => CommittedBet) public commitments;

    // Bet storage
    struct VirtualBet {
        uint256 id;
        address bettor;
        bytes32[] ftsoSymbols;   // Flare FTSO symbols for price feeds
        uint256[] targetPrices;  // Target prices for each leg
        bool[] overUnder;        // true = over, false = under
        uint256 stake;
        uint256 potentialPayout;
        uint256 expiry;
        bool settled;
        bool won;
    }

    uint256 private _betIdCounter;
    mapping(uint256 => VirtualBet) public bets;
    mapping(address => uint256[]) public userBets;

    // Relayer management
    address public relayer;
    address public owner;

    // FTSO Registry (Flare native)
    IFtsoRegistry public ftsoRegistry;

    // Domain separator for EIP-712
    bytes32 public immutable DOMAIN_SEPARATOR;

    // =============================================================
    //                            EVENTS
    // =============================================================

    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event BetCommitted(bytes32 indexed commitmentId, address indexed bettor, uint256 amount);
    event BetRevealed(uint256 indexed betId, address indexed bettor, uint256 stake);
    event BetPlaced(uint256 indexed betId, address indexed bettor, uint256 stake, uint256 potentialPayout);
    event BetSettled(uint256 indexed betId, address indexed bettor, bool won, uint256 payout);
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);
    event VirtualStateUpdated(bytes32 oldRoot, bytes32 newRoot);

    // =============================================================
    //                          MODIFIERS
    // =============================================================

    modifier onlyRelayer() {
        require(msg.sender == relayer || msg.sender == owner, "Not authorized");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    constructor(address _ftsoRegistry) {
        owner = msg.sender;
        relayer = msg.sender; // Initially owner is relayer
        ftsoRegistry = IFtsoRegistry(_ftsoRegistry);

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes(NAME)),
                keccak256(bytes(VERSION)),
                block.chainid,
                address(this)
            )
        );
    }

    // =============================================================
    //                    DEPOSIT / WITHDRAWAL
    // =============================================================

    /**
     * @notice Deposit FLR to virtual balance
     */
    function deposit() external payable {
        require(msg.value > 0, "Must deposit something");
        virtualBalances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw from virtual balance to real wallet
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external {
        require(virtualBalances[msg.sender] >= amount, "Insufficient balance");
        require(virtualBalances[msg.sender] - lockedBalances[msg.sender] >= amount, "Funds locked");

        virtualBalances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);

        emit Withdrawal(msg.sender, amount);
    }

    /**
     * @notice Withdraw via signed intent (relayer can submit)
     */
    function withdrawWithIntent(
        address user,
        uint256 amount,
        uint256 nonce,
        bytes calldata signature
    ) external onlyRelayer {
        require(!usedNonces[user][nonce], "Nonce already used");

        // Verify signature
        bytes32 structHash = keccak256(abi.encode(
            WITHDRAWAL_TYPEHASH,
            user,
            amount,
            nonce
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address signer = _recoverSigner(digest, signature);
        require(signer == user, "Invalid signature");

        // Mark nonce used
        usedNonces[user][nonce] = true;
        if (nonce > highestNonce[user]) {
            highestNonce[user] = nonce;
        }

        // Execute withdrawal
        require(virtualBalances[user] >= amount, "Insufficient balance");
        require(virtualBalances[user] - lockedBalances[user] >= amount, "Funds locked");

        virtualBalances[user] -= amount;
        payable(user).transfer(amount);

        emit Withdrawal(user, amount);
    }

    // =============================================================
    //                    DARK POOL (COMMIT-REVEAL)
    // =============================================================

    /**
     * @notice Commit an encrypted bet (Dark Pool - Phase 1)
     * @param commitmentId Unique ID for this commitment
     * @param commitment Hash of (encryptedBetData + salt)
     * @param amount Stake amount to lock
     */
    function commitBet(
        bytes32 commitmentId,
        bytes32 commitment,
        uint256 amount
    ) external {
        require(commitments[commitmentId].timestamp == 0, "Commitment exists");
        require(virtualBalances[msg.sender] - lockedBalances[msg.sender] >= amount, "Insufficient available balance");

        // Lock the funds
        lockedBalances[msg.sender] += amount;

        commitments[commitmentId] = CommittedBet({
            commitment: commitment,
            amount: amount,
            timestamp: block.timestamp,
            revealed: false
        });

        emit BetCommitted(commitmentId, msg.sender, amount);
    }

    /**
     * @notice Reveal and execute a committed bet (Dark Pool - Phase 2)
     * @param commitmentId The commitment to reveal
     * @param bettor Original bettor address
     * @param ftsoSymbols Array of FTSO symbols for each leg
     * @param targetPrices Target prices for each leg
     * @param overUnder Direction for each leg (true = over)
     * @param expiry Bet expiration timestamp
     * @param salt Random salt used in commitment
     */
    function revealBet(
        bytes32 commitmentId,
        address bettor,
        bytes32[] calldata ftsoSymbols,
        uint256[] calldata targetPrices,
        bool[] calldata overUnder,
        uint256 expiry,
        bytes32 salt
    ) external onlyRelayer {
        CommittedBet storage committed = commitments[commitmentId];
        require(committed.timestamp > 0, "Commitment not found");
        require(!committed.revealed, "Already revealed");

        // Verify commitment
        bytes32 expectedCommitment = keccak256(abi.encode(
            bettor,
            ftsoSymbols,
            targetPrices,
            overUnder,
            expiry,
            salt
        ));
        require(committed.commitment == expectedCommitment, "Invalid reveal");

        committed.revealed = true;

        // Unlock and execute bet
        lockedBalances[bettor] -= committed.amount;

        // Create the bet
        _createBet(bettor, ftsoSymbols, targetPrices, overUnder, committed.amount, expiry);

        emit BetRevealed(_betIdCounter - 1, bettor, committed.amount);
    }

    // =============================================================
    //                    RAPID FIRE BETTING
    // =============================================================

    /**
     * @notice Place bet via signed intent (async nonces)
     * @dev Allows out-of-order execution for rapid-fire betting
     */
    function placeBetWithIntent(
        address bettor,
        bytes32[] calldata ftsoSymbols,
        uint256[] calldata targetPrices,
        bool[] calldata overUnder,
        uint256 amount,
        uint256 expiry,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external onlyRelayer {
        require(block.timestamp <= deadline, "Intent expired");
        require(!usedNonces[bettor][nonce], "Nonce already used");

        // Create bet data hash for signature verification
        bytes32 betDataHash = keccak256(abi.encode(
            ftsoSymbols,
            targetPrices,
            overUnder,
            expiry
        ));

        // Verify EIP-712 signature
        bytes32 structHash = keccak256(abi.encode(
            BET_INTENT_TYPEHASH,
            bettor,
            amount,
            nonce,
            deadline,
            betDataHash
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address signer = _recoverSigner(digest, signature);
        require(signer == bettor, "Invalid signature");

        // Mark nonce used (async - doesn't require sequential)
        usedNonces[bettor][nonce] = true;
        if (nonce > highestNonce[bettor]) {
            highestNonce[bettor] = nonce;
        }

        // Create bet
        _createBet(bettor, ftsoSymbols, targetPrices, overUnder, amount, expiry);
    }

    /**
     * @notice Batch multiple bets in one transaction
     */
    function batchPlaceBets(
        address[] calldata bettors,
        bytes32[][] calldata ftsoSymbolsArray,
        uint256[][] calldata targetPricesArray,
        bool[][] calldata overUnderArray,
        uint256[] calldata amounts,
        uint256[] calldata expiries,
        uint256[] calldata nonces,
        uint256[] calldata deadlines,
        bytes[] calldata signatures
    ) external onlyRelayer {
        require(bettors.length == ftsoSymbolsArray.length, "Length mismatch");

        for (uint256 i = 0; i < bettors.length; i++) {
            // Skip if intent expired or nonce used
            if (block.timestamp > deadlines[i] || usedNonces[bettors[i]][nonces[i]]) {
                continue;
            }

            // Verify and place each bet
            bytes32 betDataHash = keccak256(abi.encode(
                ftsoSymbolsArray[i],
                targetPricesArray[i],
                overUnderArray[i],
                expiries[i]
            ));

            bytes32 structHash = keccak256(abi.encode(
                BET_INTENT_TYPEHASH,
                bettors[i],
                amounts[i],
                nonces[i],
                deadlines[i],
                betDataHash
            ));
            bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
            address signer = _recoverSigner(digest, signatures[i]);

            if (signer == bettors[i]) {
                usedNonces[bettors[i]][nonces[i]] = true;
                if (nonces[i] > highestNonce[bettors[i]]) {
                    highestNonce[bettors[i]] = nonces[i];
                }
                _createBet(
                    bettors[i],
                    ftsoSymbolsArray[i],
                    targetPricesArray[i],
                    overUnderArray[i],
                    amounts[i],
                    expiries[i]
                );
            }
        }
    }

    // =============================================================
    //                      BET SETTLEMENT
    // =============================================================

    /**
     * @notice Settle a bet using FTSO oracle data
     * @param betId The bet to settle
     */
    function settleBet(uint256 betId) external {
        VirtualBet storage bet = bets[betId];
        require(!bet.settled, "Already settled");
        require(block.timestamp >= bet.expiry, "Not yet expired");

        bool allWin = true;

        // Check each leg against FTSO prices
        for (uint256 i = 0; i < bet.ftsoSymbols.length; i++) {
            // Get current price from FTSO
            (uint256 price, , ) = ftsoRegistry.getCurrentPriceWithDecimals(
                _bytes32ToString(bet.ftsoSymbols[i])
            );

            bool legWins;
            if (bet.overUnder[i]) {
                // Over bet wins if price > target
                legWins = price > bet.targetPrices[i];
            } else {
                // Under bet wins if price < target
                legWins = price < bet.targetPrices[i];
            }

            if (!legWins) {
                allWin = false;
                break;
            }
        }

        bet.settled = true;
        bet.won = allWin;

        if (allWin) {
            virtualBalances[bet.bettor] += bet.potentialPayout;
            emit BetSettled(betId, bet.bettor, true, bet.potentialPayout);
        } else {
            emit BetSettled(betId, bet.bettor, false, 0);
        }
    }

    /**
     * @notice Batch settle multiple bets
     */
    function batchSettleBets(uint256[] calldata betIds) external {
        for (uint256 i = 0; i < betIds.length; i++) {
            VirtualBet storage bet = bets[betIds[i]];
            if (!bet.settled && block.timestamp >= bet.expiry) {
                // Simplified settlement for batch
                this.settleBet(betIds[i]);
            }
        }
    }

    // =============================================================
    //                      VIEW FUNCTIONS
    // =============================================================

    function getVirtualBalance(address user) external view returns (uint256 total, uint256 available, uint256 locked) {
        return (
            virtualBalances[user],
            virtualBalances[user] - lockedBalances[user],
            lockedBalances[user]
        );
    }

    function getBet(uint256 betId) external view returns (VirtualBet memory) {
        return bets[betId];
    }

    function getUserBets(address user) external view returns (uint256[] memory) {
        return userBets[user];
    }

    function isNonceUsed(address user, uint256 nonce) external view returns (bool) {
        return usedNonces[user][nonce];
    }

    function getTotalBets() external view returns (uint256) {
        return _betIdCounter;
    }

    // =============================================================
    //                      ADMIN FUNCTIONS
    // =============================================================

    function setRelayer(address newRelayer) external onlyOwner {
        emit RelayerUpdated(relayer, newRelayer);
        relayer = newRelayer;
    }

    function setFtsoRegistry(address newRegistry) external onlyOwner {
        ftsoRegistry = IFtsoRegistry(newRegistry);
    }

    function updateVirtualStateRoot(bytes32 newRoot) external onlyRelayer {
        emit VirtualStateUpdated(virtualStateRoot, newRoot);
        virtualStateRoot = newRoot;
    }

    // =============================================================
    //                    INTERNAL FUNCTIONS
    // =============================================================

    function _createBet(
        address bettor,
        bytes32[] calldata ftsoSymbols,
        uint256[] calldata targetPrices,
        bool[] calldata overUnder,
        uint256 amount,
        uint256 expiry
    ) internal {
        require(ftsoSymbols.length > 0, "No legs");
        require(ftsoSymbols.length == targetPrices.length, "Length mismatch");
        require(ftsoSymbols.length == overUnder.length, "Length mismatch");
        require(expiry > block.timestamp, "Expiry in past");
        require(virtualBalances[bettor] - lockedBalances[bettor] >= amount, "Insufficient balance");

        // Calculate odds based on number of legs (simplified: 2x per leg)
        uint256 multiplier = 1;
        for (uint256 i = 0; i < ftsoSymbols.length; i++) {
            multiplier *= 2;
        }
        uint256 potentialPayout = amount * multiplier;

        // Deduct stake from virtual balance
        virtualBalances[bettor] -= amount;

        uint256 betId = _betIdCounter++;

        VirtualBet storage newBet = bets[betId];
        newBet.id = betId;
        newBet.bettor = bettor;
        newBet.ftsoSymbols = ftsoSymbols;
        newBet.targetPrices = targetPrices;
        newBet.overUnder = overUnder;
        newBet.stake = amount;
        newBet.potentialPayout = potentialPayout;
        newBet.expiry = expiry;

        userBets[bettor].push(betId);

        emit BetPlaced(betId, bettor, amount, potentialPayout);
    }

    function _recoverSigner(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        if (v < 27) {
            v += 27;
        }

        return ecrecover(digest, v, r, s);
    }

    function _bytes32ToString(bytes32 _bytes32) internal pure returns (string memory) {
        uint8 i = 0;
        while(i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }

    // =============================================================
    //                      RECEIVE ETHER
    // =============================================================

    receive() external payable {
        virtualBalances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }
}
