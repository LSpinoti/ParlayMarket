// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ParlayMarket.sol";

/**
 * @title EVVM_ParlayWrapper
 * @notice Wraps existing ParlayMarket with EVVM features (Dark Pool, virtual balances, rapid-fire)
 * @dev Users interact through intents, relayer submits to underlying ParlayMarket
 */
contract EVVM_ParlayWrapper {
    // =============================================================
    //                           CONSTANTS
    // =============================================================

    bytes32 public constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 public constant CREATE_PARLAY_TYPEHASH = keccak256(
        "CreateParlayIntent(address maker,bytes32[] umaIds,uint8[] requiredOutcomes,uint256 makerStake,uint256 takerStake,uint256 expiry,bool makerIsYes,uint256 nonce,uint256 deadline)"
    );

    bytes32 public constant FILL_PARLAY_TYPEHASH = keccak256(
        "FillParlayIntent(address taker,uint256 parlayId,uint256 nonce,uint256 deadline)"
    );

    bytes32 public constant WITHDRAWAL_TYPEHASH = keccak256(
        "Withdrawal(address user,uint256 amount,uint256 nonce)"
    );

    string public constant NAME = "FlareBet Pro";
    string public constant VERSION = "1";

    // =============================================================
    //                            STORAGE
    // =============================================================

    // Underlying ParlayMarket contract
    ParlayMarket public parlayMarket;

    // Virtual balance management
    mapping(address => uint256) public virtualBalances;
    mapping(address => uint256) public lockedBalances;

    // Async nonce tracking
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    // Commit-reveal for Dark Pool
    struct CommittedParlay {
        bytes32 commitment;
        uint256 makerStake;
        address maker;
        uint256 timestamp;
        bool revealed;
    }
    mapping(bytes32 => CommittedParlay) public commitments;

    // Relayer and owner
    address public relayer;
    address public owner;

    // Domain separator
    bytes32 public immutable DOMAIN_SEPARATOR;

    // =============================================================
    //                            EVENTS
    // =============================================================

    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event ParlayCreatedViaIntent(uint256 indexed parlayId, address indexed maker);
    event ParlayFilledViaIntent(uint256 indexed parlayId, address indexed taker);
    event ParlayCommitted(bytes32 indexed commitmentId, address indexed maker, uint256 stake);
    event ParlayRevealed(bytes32 indexed commitmentId, uint256 indexed parlayId);
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);

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

    constructor(address _parlayMarket) {
        parlayMarket = ParlayMarket(_parlayMarket);
        owner = msg.sender;
        relayer = msg.sender;

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
     * @notice Withdraw from virtual balance
     */
    function withdraw(uint256 amount) external {
        require(virtualBalances[msg.sender] >= amount, "Insufficient balance");
        require(virtualBalances[msg.sender] - lockedBalances[msg.sender] >= amount, "Funds locked");

        virtualBalances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);

        emit Withdrawal(msg.sender, amount);
    }

    /**
     * @notice Withdraw via signed intent
     */
    function withdrawWithIntent(
        address user,
        uint256 amount,
        uint256 nonce,
        bytes calldata signature
    ) external onlyRelayer {
        require(!usedNonces[user][nonce], "Nonce already used");

        bytes32 structHash = keccak256(abi.encode(
            WITHDRAWAL_TYPEHASH,
            user,
            amount,
            nonce
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        require(_recoverSigner(digest, signature) == user, "Invalid signature");

        usedNonces[user][nonce] = true;

        require(virtualBalances[user] >= amount, "Insufficient balance");
        require(virtualBalances[user] - lockedBalances[user] >= amount, "Funds locked");

        virtualBalances[user] -= amount;
        payable(user).transfer(amount);

        emit Withdrawal(user, amount);
    }

    // =============================================================
    //                    CREATE PARLAY VIA INTENT
    // =============================================================

    /**
     * @notice Create parlay via signed intent (rapid-fire)
     */
    function createParlayWithIntent(
        address maker,
        bytes32[] calldata umaIds,
        uint8[] calldata requiredOutcomes,
        uint256 makerStake,
        uint256 takerStake,
        uint256 expiry,
        bool makerIsYes,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external onlyRelayer returns (uint256 parlayId) {
        require(block.timestamp <= deadline, "Intent expired");
        require(!usedNonces[maker][nonce], "Nonce already used");

        // Verify signature
        bytes32 structHash = keccak256(abi.encode(
            CREATE_PARLAY_TYPEHASH,
            maker,
            keccak256(abi.encodePacked(umaIds)),
            keccak256(abi.encodePacked(requiredOutcomes)),
            makerStake,
            takerStake,
            expiry,
            makerIsYes,
            nonce,
            deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        require(_recoverSigner(digest, signature) == maker, "Invalid signature");

        usedNonces[maker][nonce] = true;

        // Check virtual balance
        require(virtualBalances[maker] - lockedBalances[maker] >= makerStake, "Insufficient balance");

        // Deduct from virtual balance
        virtualBalances[maker] -= makerStake;

        // Create parlay on underlying contract
        parlayId = parlayMarket.createParlay{value: makerStake}(
            umaIds,
            requiredOutcomes,
            takerStake,
            expiry,
            makerIsYes
        );

        emit ParlayCreatedViaIntent(parlayId, maker);
        return parlayId;
    }

    // =============================================================
    //                    FILL PARLAY VIA INTENT
    // =============================================================

    /**
     * @notice Fill parlay via signed intent
     */
    function fillParlayWithIntent(
        address taker,
        uint256 parlayId,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external onlyRelayer {
        require(block.timestamp <= deadline, "Intent expired");
        require(!usedNonces[taker][nonce], "Nonce already used");

        // Verify signature
        bytes32 structHash = keccak256(abi.encode(
            FILL_PARLAY_TYPEHASH,
            taker,
            parlayId,
            nonce,
            deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        require(_recoverSigner(digest, signature) == taker, "Invalid signature");

        usedNonces[taker][nonce] = true;

        // Get parlay details to know stake amount
        (
            ,
            ,
            ,
            ,
            ,
            uint256 takerStake,
            ,
            ,
        ) = parlayMarket.getParlay(parlayId);

        // Check virtual balance
        require(virtualBalances[taker] - lockedBalances[taker] >= takerStake, "Insufficient balance");

        // Deduct from virtual balance
        virtualBalances[taker] -= takerStake;

        // Fill parlay on underlying contract
        parlayMarket.fillParlay{value: takerStake}(parlayId);

        emit ParlayFilledViaIntent(parlayId, taker);
    }

    // =============================================================
    //                    DARK POOL (COMMIT-REVEAL)
    // =============================================================

    /**
     * @notice Commit an encrypted parlay (Dark Pool - Phase 1)
     */
    function commitParlay(
        bytes32 commitmentId,
        bytes32 commitment,
        uint256 makerStake
    ) external {
        require(commitments[commitmentId].timestamp == 0, "Commitment exists");
        require(virtualBalances[msg.sender] - lockedBalances[msg.sender] >= makerStake, "Insufficient balance");

        // Lock funds
        lockedBalances[msg.sender] += makerStake;

        commitments[commitmentId] = CommittedParlay({
            commitment: commitment,
            makerStake: makerStake,
            maker: msg.sender,
            timestamp: block.timestamp,
            revealed: false
        });

        emit ParlayCommitted(commitmentId, msg.sender, makerStake);
    }

    /**
     * @notice Reveal and create committed parlay (Dark Pool - Phase 2)
     */
    function revealParlay(
        bytes32 commitmentId,
        bytes32[] calldata umaIds,
        uint8[] calldata requiredOutcomes,
        uint256 takerStake,
        uint256 expiry,
        bool makerIsYes,
        bytes32 salt
    ) external onlyRelayer returns (uint256 parlayId) {
        CommittedParlay storage committed = commitments[commitmentId];
        require(committed.timestamp > 0, "Commitment not found");
        require(!committed.revealed, "Already revealed");

        // Verify commitment
        bytes32 expectedCommitment = keccak256(abi.encode(
            committed.maker,
            umaIds,
            requiredOutcomes,
            committed.makerStake,
            takerStake,
            expiry,
            makerIsYes,
            salt
        ));
        require(committed.commitment == expectedCommitment, "Invalid reveal");

        committed.revealed = true;

        // Unlock and use funds
        lockedBalances[committed.maker] -= committed.makerStake;
        virtualBalances[committed.maker] -= committed.makerStake;

        // Create parlay on underlying contract
        parlayId = parlayMarket.createParlay{value: committed.makerStake}(
            umaIds,
            requiredOutcomes,
            takerStake,
            expiry,
            makerIsYes
        );

        emit ParlayRevealed(commitmentId, parlayId);
        return parlayId;
    }

    // =============================================================
    //                    BATCH OPERATIONS
    // =============================================================

    /**
     * @notice Batch create multiple parlays
     */
    function batchCreateParlays(
        address[] calldata makers,
        bytes32[][] calldata umaIdsArray,
        uint8[][] calldata requiredOutcomesArray,
        uint256[] calldata makerStakes,
        uint256[] calldata takerStakes,
        uint256[] calldata expiries,
        bool[] calldata makerIsYesArray,
        uint256[] calldata nonces,
        uint256[] calldata deadlines,
        bytes[] calldata signatures
    ) external onlyRelayer {
        require(makers.length == umaIdsArray.length, "Length mismatch");

        for (uint256 i = 0; i < makers.length; i++) {
            if (block.timestamp > deadlines[i] || usedNonces[makers[i]][nonces[i]]) {
                continue;
            }

            // Simplified - in production verify each signature
            try this.createParlayWithIntent(
                makers[i],
                umaIdsArray[i],
                requiredOutcomesArray[i],
                makerStakes[i],
                takerStakes[i],
                expiries[i],
                makerIsYesArray[i],
                nonces[i],
                deadlines[i],
                signatures[i]
            ) {} catch {}
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

    function isNonceUsed(address user, uint256 nonce) external view returns (bool) {
        return usedNonces[user][nonce];
    }

    function getParlayMarketAddress() external view returns (address) {
        return address(parlayMarket);
    }

    // =============================================================
    //                      ADMIN FUNCTIONS
    // =============================================================

    function setRelayer(address newRelayer) external onlyOwner {
        emit RelayerUpdated(relayer, newRelayer);
        relayer = newRelayer;
    }

    function setParlayMarket(address newParlayMarket) external onlyOwner {
        parlayMarket = ParlayMarket(newParlayMarket);
    }

    // =============================================================
    //                    INTERNAL FUNCTIONS
    // =============================================================

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

    // =============================================================
    //                      RECEIVE ETHER
    // =============================================================

    receive() external payable {
        virtualBalances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }
}
