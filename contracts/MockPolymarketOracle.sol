// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IPolymarketOracle.sol";

/**
 * @title MockPolymarketOracle
 * @notice DEPRECATED: Mock oracle for testing - allows manual outcome setting
 * @dev This contract is deprecated. Use FlarePolymarketOracle for production.
 *      Only use this for local testing when FDC attestation is not available.
 */
contract MockPolymarketOracle is IPolymarketOracle {
    struct Outcome {
        bool resolved;
        uint8 outcome; // 0 = NO, 1 = YES, 2 = INVALID
    }
    
    mapping(bytes32 => Outcome) public outcomes;
    address public owner;
    
    event OutcomeSet(bytes32 indexed umaId, uint8 outcome);
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    /**
     * @notice Set outcome for a UMA ID (testing only)
     */
    function setOutcome(bytes32 umaId, uint8 outcome) external onlyOwner {
        require(outcome <= 2, "Invalid outcome");
        outcomes[umaId].resolved = true;
        outcomes[umaId].outcome = outcome;
        emit OutcomeSet(umaId, outcome);
    }
    
    /**
     * @notice Batch set outcomes
     */
    function setOutcomes(bytes32[] calldata umaIds, uint8[] calldata _outcomes) external onlyOwner {
        require(umaIds.length == _outcomes.length, "Length mismatch");
        for (uint256 i = 0; i < umaIds.length; i++) {
            require(_outcomes[i] <= 2, "Invalid outcome");
            outcomes[umaIds[i]].resolved = true;
            outcomes[umaIds[i]].outcome = _outcomes[i];
            emit OutcomeSet(umaIds[i], _outcomes[i]);
        }
    }
    
    function getOutcome(bytes32 umaId) external view returns (bool resolved, uint8 outcome) {
        Outcome memory o = outcomes[umaId];
        return (o.resolved, o.outcome);
    }
    
    function isResolved(bytes32 umaId) external view returns (bool) {
        return outcomes[umaId].resolved;
    }
}

