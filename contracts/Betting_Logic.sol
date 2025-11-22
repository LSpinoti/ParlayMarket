// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IFtsoRegistry.sol";

/**
 * @title Betting_Logic
 * @notice Advanced parlay logic with support for 10+ leg mega parlays
 * @dev Optimized for virtual execution to bypass L1 gas limits
 */
contract Betting_Logic {
    // =============================================================
    //                           STRUCTS
    // =============================================================

    struct ParlayLeg {
        bytes32 ftsoSymbol;      // FTSO symbol for price feed
        uint256 targetPrice;     // Target price (with decimals)
        bool isOver;             // true = over, false = under
        int256 spread;           // Spread/handicap (0 for moneyline)
        uint256 odds;            // Odds in basis points (10000 = 1x, 20000 = 2x)
    }

    struct MegaParlay {
        uint256 id;
        address bettor;
        ParlayLeg[] legs;
        uint256 stake;
        uint256 potentialPayout;
        uint256 settleTime;      // When bet can be settled
        bool settled;
        bool won;
        uint256 createdAt;
    }

    // =============================================================
    //                            STORAGE
    // =============================================================

    IFtsoRegistry public ftsoRegistry;
    address public evvmHub;
    address public owner;

    uint256 private _parlayIdCounter;
    mapping(uint256 => MegaParlay) public parlays;
    mapping(address => uint256[]) public userParlays;

    // Odds configuration
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public maxLegs = 15;          // Support up to 15 legs
    uint256 public maxOddsMultiplier = 1000000; // 100x max payout
    uint256 public houseEdge = 500;       // 5% house edge in basis points

    // =============================================================
    //                            EVENTS
    // =============================================================

    event MegaParlayCreated(
        uint256 indexed parlayId,
        address indexed bettor,
        uint256 legs,
        uint256 stake,
        uint256 potentialPayout
    );

    event MegaParlaySettled(
        uint256 indexed parlayId,
        address indexed bettor,
        bool won,
        uint256 payout
    );

    event OddsCalculated(
        uint256 indexed parlayId,
        uint256 combinedOdds,
        uint256 potentialPayout
    );

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

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    constructor(address _ftsoRegistry, address _evvmHub) {
        ftsoRegistry = IFtsoRegistry(_ftsoRegistry);
        evvmHub = _evvmHub;
        owner = msg.sender;
    }

    // =============================================================
    //                    MEGA PARLAY CREATION
    // =============================================================

    /**
     * @notice Create a mega parlay with multiple legs
     * @param bettor The bettor's address
     * @param ftsoSymbols Array of FTSO symbols
     * @param targetPrices Array of target prices
     * @param isOvers Array of over/under directions
     * @param spreads Array of spreads (0 for none)
     * @param customOdds Array of custom odds (0 for auto-calculate)
     * @param stake Stake amount
     * @param settleTime When the parlay can be settled
     */
    function createMegaParlay(
        address bettor,
        bytes32[] calldata ftsoSymbols,
        uint256[] calldata targetPrices,
        bool[] calldata isOvers,
        int256[] calldata spreads,
        uint256[] calldata customOdds,
        uint256 stake,
        uint256 settleTime
    ) external onlyEVVMHub returns (uint256 parlayId, uint256 potentialPayout) {
        require(ftsoSymbols.length > 0 && ftsoSymbols.length <= maxLegs, "Invalid leg count");
        require(ftsoSymbols.length == targetPrices.length, "Length mismatch");
        require(ftsoSymbols.length == isOvers.length, "Length mismatch");
        require(ftsoSymbols.length == spreads.length, "Length mismatch");
        require(ftsoSymbols.length == customOdds.length, "Length mismatch");
        require(settleTime > block.timestamp, "Invalid settle time");
        require(stake > 0, "No stake");

        parlayId = _parlayIdCounter++;

        MegaParlay storage parlay = parlays[parlayId];
        parlay.id = parlayId;
        parlay.bettor = bettor;
        parlay.stake = stake;
        parlay.settleTime = settleTime;
        parlay.createdAt = block.timestamp;

        // Calculate combined odds
        uint256 combinedOdds = BASIS_POINTS;

        for (uint256 i = 0; i < ftsoSymbols.length; i++) {
            ParlayLeg memory leg;
            leg.ftsoSymbol = ftsoSymbols[i];
            leg.targetPrice = targetPrices[i];
            leg.isOver = isOvers[i];
            leg.spread = spreads[i];

            // Use custom odds or calculate based on probability
            if (customOdds[i] > 0) {
                leg.odds = customOdds[i];
            } else {
                leg.odds = _calculateLegOdds(ftsoSymbols[i], targetPrices[i], isOvers[i]);
            }

            parlay.legs.push(leg);

            // Multiply odds (parlay math)
            combinedOdds = (combinedOdds * leg.odds) / BASIS_POINTS;
        }

        // Apply house edge
        combinedOdds = (combinedOdds * (BASIS_POINTS - houseEdge)) / BASIS_POINTS;

        // Cap at max multiplier
        if (combinedOdds > maxOddsMultiplier) {
            combinedOdds = maxOddsMultiplier;
        }

        potentialPayout = (stake * combinedOdds) / BASIS_POINTS;
        parlay.potentialPayout = potentialPayout;

        userParlays[bettor].push(parlayId);

        emit MegaParlayCreated(parlayId, bettor, ftsoSymbols.length, stake, potentialPayout);
        emit OddsCalculated(parlayId, combinedOdds, potentialPayout);

        return (parlayId, potentialPayout);
    }

    // =============================================================
    //                    MEGA PARLAY SETTLEMENT
    // =============================================================

    /**
     * @notice Settle a mega parlay
     * @param parlayId The parlay to settle
     * @return won Whether the bettor won
     * @return payout The payout amount (0 if lost)
     */
    function settleMegaParlay(uint256 parlayId) external returns (bool won, uint256 payout) {
        MegaParlay storage parlay = parlays[parlayId];
        require(!parlay.settled, "Already settled");
        require(block.timestamp >= parlay.settleTime, "Cannot settle yet");

        bool allWin = true;

        // Check each leg
        for (uint256 i = 0; i < parlay.legs.length; i++) {
            ParlayLeg memory leg = parlay.legs[i];

            // Get current price from FTSO
            (uint256 currentPrice, , ) = ftsoRegistry.getCurrentPriceWithDecimals(
                _bytes32ToString(leg.ftsoSymbol)
            );

            // Apply spread
            int256 adjustedTarget = int256(leg.targetPrice) + leg.spread;
            require(adjustedTarget >= 0, "Invalid adjusted target");

            bool legWins;
            if (leg.isOver) {
                legWins = int256(currentPrice) > adjustedTarget;
            } else {
                legWins = int256(currentPrice) < adjustedTarget;
            }

            if (!legWins) {
                allWin = false;
                break;
            }
        }

        parlay.settled = true;
        parlay.won = allWin;

        if (allWin) {
            payout = parlay.potentialPayout;
        }

        emit MegaParlaySettled(parlayId, parlay.bettor, allWin, payout);

        return (allWin, payout);
    }

    // =============================================================
    //                      ODDS CALCULATION
    // =============================================================

    /**
     * @notice Calculate odds for a single leg based on current market
     * @dev Uses distance from current price to determine implied probability
     */
    function _calculateLegOdds(
        bytes32 ftsoSymbol,
        uint256 targetPrice,
        bool isOver
    ) internal view returns (uint256) {
        // Get current price
        (uint256 currentPrice, , ) = ftsoRegistry.getCurrentPriceWithDecimals(
            _bytes32ToString(ftsoSymbol)
        );

        // Calculate percentage difference
        uint256 diff;
        if (targetPrice > currentPrice) {
            diff = ((targetPrice - currentPrice) * BASIS_POINTS) / currentPrice;
        } else {
            diff = ((currentPrice - targetPrice) * BASIS_POINTS) / currentPrice;
        }

        // Base odds: 2x (fair odds for 50/50)
        uint256 baseOdds = 20000;

        // Adjust based on likelihood
        // If betting OVER and target is above current, it's harder (higher odds)
        // If betting UNDER and target is below current, it's harder (higher odds)
        if ((isOver && targetPrice > currentPrice) || (!isOver && targetPrice < currentPrice)) {
            // Harder bet - increase odds
            // More difference = higher odds
            return baseOdds + (diff * 10);
        } else {
            // Easier bet - decrease odds (but minimum 1.1x)
            uint256 reduction = diff * 5;
            if (reduction > baseOdds - 11000) {
                reduction = baseOdds - 11000;
            }
            return baseOdds - reduction;
        }
    }

    /**
     * @notice Preview odds for a mega parlay without creating it
     */
    function previewOdds(
        bytes32[] calldata ftsoSymbols,
        uint256[] calldata targetPrices,
        bool[] calldata isOvers,
        uint256[] calldata customOdds
    ) external view returns (uint256 combinedOdds, uint256[] memory legOdds) {
        require(ftsoSymbols.length == targetPrices.length, "Length mismatch");

        legOdds = new uint256[](ftsoSymbols.length);
        combinedOdds = BASIS_POINTS;

        for (uint256 i = 0; i < ftsoSymbols.length; i++) {
            if (customOdds.length > i && customOdds[i] > 0) {
                legOdds[i] = customOdds[i];
            } else {
                legOdds[i] = _calculateLegOdds(ftsoSymbols[i], targetPrices[i], isOvers[i]);
            }
            combinedOdds = (combinedOdds * legOdds[i]) / BASIS_POINTS;
        }

        // Apply house edge
        combinedOdds = (combinedOdds * (BASIS_POINTS - houseEdge)) / BASIS_POINTS;

        // Cap at max
        if (combinedOdds > maxOddsMultiplier) {
            combinedOdds = maxOddsMultiplier;
        }
    }

    // =============================================================
    //                      VIEW FUNCTIONS
    // =============================================================

    function getParlay(uint256 parlayId) external view returns (MegaParlay memory) {
        return parlays[parlayId];
    }

    function getParlayLegs(uint256 parlayId) external view returns (ParlayLeg[] memory) {
        return parlays[parlayId].legs;
    }

    function getUserParlays(address user) external view returns (uint256[] memory) {
        return userParlays[user];
    }

    function getTotalParlays() external view returns (uint256) {
        return _parlayIdCounter;
    }

    // =============================================================
    //                      ADMIN FUNCTIONS
    // =============================================================

    function setMaxLegs(uint256 _maxLegs) external onlyOwner {
        require(_maxLegs > 0 && _maxLegs <= 20, "Invalid max legs");
        maxLegs = _maxLegs;
    }

    function setMaxOddsMultiplier(uint256 _maxMultiplier) external onlyOwner {
        maxOddsMultiplier = _maxMultiplier;
    }

    function setHouseEdge(uint256 _houseEdge) external onlyOwner {
        require(_houseEdge <= 2000, "House edge too high"); // Max 20%
        houseEdge = _houseEdge;
    }

    function setEVVMHub(address _evvmHub) external onlyOwner {
        evvmHub = _evvmHub;
    }

    // =============================================================
    //                    INTERNAL FUNCTIONS
    // =============================================================

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
}
