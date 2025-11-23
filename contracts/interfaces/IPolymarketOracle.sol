// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPolymarketOracle
 * @notice Interface for reading Polymarket resolution data from Polymarket API
 */
interface IPolymarketOracle {
    /**
     * @notice Get the resolved outcome for a Polymarket condition ID
     * @param conditionId The condition ID from Polymarket
     * @return resolved Whether the market has been resolved
     * @return outcome The resolved outcome (0 = NO, 1 = YES, 2 = INVALID)
     */
    function getOutcome(bytes32 conditionId) external view returns (bool resolved, uint8 outcome);
    
    /**
     * @notice Check if a market is resolved
     * @param conditionId The condition ID
     * @return Whether the market is resolved
     */
    function isResolved(bytes32 conditionId) external view returns (bool);
}

