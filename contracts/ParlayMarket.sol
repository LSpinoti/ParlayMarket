// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IPolymarketOracle.sol";
import "./ParlayToken.sol";

/**
 * @title ParlayMarket
 * @notice Core contract managing parlay creation, filling, cancellation, and settlement
 */
contract ParlayMarket {
    enum ParlayStatus {
        Created,    // Maker deposited, waiting for taker
        Filled,     // Taker deposited, waiting for resolution
        Resolved,   // Settled with winner determined
        Cancelled,  // Cancelled before fill
        Invalid     // Invalid due to underlying market issues
    }
    
    struct Parlay {
        uint256 id;
        address maker;
        address taker;
        string name;                // Name of the parlay
        bytes32[] conditionIds;     // Polymarket condition IDs
        uint8[] requiredOutcomes;   // Required outcome for each market (1 = YES)
        string[] legNames;          // Names for each market leg
        string[] imageUrls;          // Image URLs for each market leg
        uint256 makerStake;         // Maker's collateral in FLR
        uint256 takerStake;         // Taker's collateral in FLR
        uint256 expiry;             // Timestamp after which unfilled parlays can be cancelled
        ParlayStatus status;
        bool makerIsYes;            // True if maker takes YES side
        uint256 yesTokenId;         // Token ID for YES position
        uint256 noTokenId;          // Token ID for NO position
    }
    
    // State
    uint256 private _parlayIdCounter;
    mapping(uint256 => Parlay) public parlays;
    IPolymarketOracle public oracle;
    ParlayToken public parlayToken;
    
    // Events
    event ParlayCreated(
        uint256 indexed parlayId,
        address indexed maker,
        string name,
        bytes32[] conditionIds,
        uint8[] requiredOutcomes,
        string[] legNames,
        string[] imageUrls,
        uint256 makerStake,
        uint256 takerStake,
        uint256 expiry,
        bool makerIsYes
    );
    
    event ParlayFilled(
        uint256 indexed parlayId,
        address indexed taker,
        uint256 yesTokenId,
        uint256 noTokenId
    );
    
    event ParlayCancelled(uint256 indexed parlayId);
    
    event ParlayResolved(
        uint256 indexed parlayId,
        bool yesWins,
        address winner,
        uint256 payout
    );
    
    event ParlayInvalidated(uint256 indexed parlayId);
    
    constructor(address _oracle) {
        oracle = IPolymarketOracle(_oracle);
        parlayToken = new ParlayToken(address(this));
    }
    
    /**
     * @notice Create a new parlay
     * @param name Name of the parlay
     * @param conditionIds Array of Polymarket condition IDs
     * @param requiredOutcomes Required outcome for each market (1 = YES wins parlay)
     * @param legNames Array of names for each market leg
     * @param imageUrls Array of image URLs for each market leg
     * @param takerStake Amount taker must provide
     * @param expiry Timestamp after which parlay can be cancelled if unfilled
     * @param makerIsYes Whether maker takes YES side (true) or NO side (false)
     */
    function createParlay(
        string calldata name,
        bytes32[] calldata conditionIds,
        uint8[] calldata requiredOutcomes,
        string[] calldata legNames,
        string[] calldata imageUrls,
        uint256 takerStake,
        uint256 expiry,
        bool makerIsYes
    ) external payable returns (uint256) {
        require(conditionIds.length > 0, "No markets specified");
        require(conditionIds.length == requiredOutcomes.length, "Length mismatch");
        require(conditionIds.length == legNames.length, "Leg names length mismatch");
        require(conditionIds.length == imageUrls.length, "Image URLs length mismatch");
        require(expiry > block.timestamp, "Expiry in past");
        require(msg.value > 0, "No stake provided");
        require(takerStake > 0, "Taker stake must be positive");
        
        for (uint256 i = 0; i < requiredOutcomes.length; i++) {
            require(requiredOutcomes[i] <= 2, "Invalid outcome");
        }
        
        uint256 parlayId = _parlayIdCounter++;
        
        Parlay storage parlay = parlays[parlayId];
        parlay.id = parlayId;
        parlay.maker = msg.sender;
        parlay.name = name;
        parlay.conditionIds = conditionIds;
        parlay.requiredOutcomes = requiredOutcomes;
        
        // Manually copy legNames array (required for old code generator)
        for (uint256 i = 0; i < legNames.length; i++) {
            parlay.legNames.push(legNames[i]);
        }
        
        // Manually copy imageUrls array (required for old code generator)
        for (uint256 i = 0; i < imageUrls.length; i++) {
            parlay.imageUrls.push(imageUrls[i]);
        }
        
        parlay.makerStake = msg.value;
        parlay.takerStake = takerStake;
        parlay.expiry = expiry;
        parlay.status = ParlayStatus.Created;
        parlay.makerIsYes = makerIsYes;
        
        emit ParlayCreated(
            parlayId,
            msg.sender,
            name,
            conditionIds,
            requiredOutcomes,
            legNames,
            imageUrls,
            msg.value,
            takerStake,
            expiry,
            makerIsYes
        );
        
        return parlayId;
    }
    
    /**
     * @notice Fill a parlay by providing matching collateral
     * @param parlayId The parlay to fill
     */
    function fillParlay(uint256 parlayId) external payable {
        Parlay storage parlay = parlays[parlayId];
        require(parlay.status == ParlayStatus.Created, "Parlay not available");
        require(block.timestamp <= parlay.expiry, "Parlay expired");
        require(msg.value == parlay.takerStake, "Incorrect stake amount");
        require(msg.sender != parlay.maker, "Cannot fill own parlay");
        
        parlay.taker = msg.sender;
        parlay.status = ParlayStatus.Filled;
        
        // Mint tokens
        address yesHolder = parlay.makerIsYes ? parlay.maker : msg.sender;
        address noHolder = parlay.makerIsYes ? msg.sender : parlay.maker;
        
        uint256 yesTokenId = parlayToken.mint(yesHolder, parlayId, true);
        uint256 noTokenId = parlayToken.mint(noHolder, parlayId, false);
        
        parlay.yesTokenId = yesTokenId;
        parlay.noTokenId = noTokenId;
        
        emit ParlayFilled(parlayId, msg.sender, yesTokenId, noTokenId);
    }
    
    /**
     * @notice Cancel an unfilled parlay and return collateral
     * @param parlayId The parlay to cancel
     */
    function cancelParlay(uint256 parlayId) external {
        Parlay storage parlay = parlays[parlayId];
        require(parlay.status == ParlayStatus.Created, "Parlay not cancellable");
        require(msg.sender == parlay.maker, "Only maker can cancel");
        require(
            block.timestamp > parlay.expiry || parlay.taker == address(0),
            "Cannot cancel yet"
        );
        
        parlay.status = ParlayStatus.Cancelled;
        
        // Return maker's stake
        payable(parlay.maker).transfer(parlay.makerStake);
        
        emit ParlayCancelled(parlayId);
    }
    
    /**
     * @notice Resolve a filled parlay using oracle data
     * @param parlayId The parlay to resolve
     */
    function resolveParlay(uint256 parlayId) external {
        Parlay storage parlay = parlays[parlayId];
        require(parlay.status == ParlayStatus.Filled, "Parlay not filled");
        
        // Check all legs
        bool allResolved = true;
        bool yesWins = true;
        bool anyInvalid = false;
        
        for (uint256 i = 0; i < parlay.conditionIds.length; i++) {
            (bool resolved, uint8 outcome) = oracle.getOutcome(parlay.conditionIds[i]);
            
            if (!resolved) {
                allResolved = false;
                break;
            }
            
            if (outcome == 2) { // INVALID
                anyInvalid = true;
                break;
            }
            
            if (outcome != parlay.requiredOutcomes[i]) {
                yesWins = false;
            }
        }
        
        require(allResolved, "Not all markets resolved");
        
        // Handle invalid case - refund both parties proportionally
        if (anyInvalid) {
            parlay.status = ParlayStatus.Invalid;
            payable(parlay.maker).transfer(parlay.makerStake);
            payable(parlay.taker).transfer(parlay.takerStake);
            
            parlayToken.burn(parlay.yesTokenId);
            parlayToken.burn(parlay.noTokenId);
            
            emit ParlayInvalidated(parlayId);
            return;
        }
        
        parlay.status = ParlayStatus.Resolved;
        
        // Determine winner based on current token ownership
        address yesOwner = parlayToken.ownerOf(parlay.yesTokenId);
        address noOwner = parlayToken.ownerOf(parlay.noTokenId);
        
        address winner = yesWins ? yesOwner : noOwner;
        uint256 totalPayout = parlay.makerStake + parlay.takerStake;
        
        // Transfer winnings
        payable(winner).transfer(totalPayout);
        
        // Burn tokens
        parlayToken.burn(parlay.yesTokenId);
        parlayToken.burn(parlay.noTokenId);
        
        emit ParlayResolved(parlayId, yesWins, winner, totalPayout);
    }
    
    /**
     * @notice Get parlay details
     */
    function getParlay(uint256 parlayId) external view returns (
        address maker,
        address taker,
        string memory name,
        bytes32[] memory conditionIds,
        uint8[] memory requiredOutcomes,
        string[] memory legNames,
        string[] memory imageUrls,
        uint256 makerStake,
        uint256 takerStake,
        uint256 expiry,
        ParlayStatus status,
        bool makerIsYes,
        uint256 yesTokenId,
        uint256 noTokenId
    ) {
        Parlay storage parlay = parlays[parlayId];
        return (
            parlay.maker,
            parlay.taker,
            parlay.name,
            parlay.conditionIds,
            parlay.requiredOutcomes,
            parlay.legNames,
            parlay.imageUrls,
            parlay.makerStake,
            parlay.takerStake,
            parlay.expiry,
            parlay.status,
            parlay.makerIsYes,
            parlay.yesTokenId,
            parlay.noTokenId
        );
    }
    
    /**
     * @notice Get total number of parlays created
     */
    function getTotalParlays() external view returns (uint256) {
        return _parlayIdCounter;
    }
}

