// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IPolymarketOracle.sol";

// Flare Data Connector Verification interface
interface IFdcVerification {
    function verifyAttestation(
        bytes calldata attestationData,
        bytes32[] calldata merkleProof
    ) external view returns (bool);
}

/**
 * @title FlarePolymarketOracle
 * @notice Oracle for Polymarket UMA resolution data using Flare Data Connector
 * @dev Integrates with Flare's FDC to verify and store Polymarket outcomes
 */
contract FlarePolymarketOracle is IPolymarketOracle {
    
    struct Outcome {
        bool resolved;
        uint8 outcome; // 0 = NO, 1 = YES, 2 = INVALID
        uint256 timestamp;
    }
    
    // FDC Verification contract on Flare (Coston2 testnet address)
    IFdcVerification public immutable fdcVerification;
    
    // Outcome storage
    mapping(bytes32 => Outcome) public outcomes;
    
    // Access control
    address public owner;
    mapping(address => bool) public attestors;
    
    // Events
    event OutcomeVerified(
        bytes32 indexed umaId, 
        uint8 outcome, 
        uint256 timestamp,
        address attestor
    );
    event AttestorAdded(address indexed attestor);
    event AttestorRemoved(address indexed attestor);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier onlyAttestor() {
        require(attestors[msg.sender] || msg.sender == owner, "Not authorized");
        _;
    }
    
    /**
     * @notice Constructor
     * @param _fdcVerification Address of FDC Verification contract
     * @dev For Coston2 testnet: 0x3A1b3220527aBA427d1e13e4b4c48c31460B4d91
     * @dev For Flare mainnet: 0x3A1b3220527aBA427d1e13e4b4c48c31460B4d91
     */
    constructor(address _fdcVerification) {
        require(_fdcVerification != address(0), "Invalid FDC address");
        fdcVerification = IFdcVerification(_fdcVerification);
        owner = msg.sender;
        attestors[msg.sender] = true;
    }
    
    /**
     * @notice Submit verified outcome from FDC attestation
     * @param umaId The Polymarket UMA question ID
     * @param outcome The resolved outcome (0=NO, 1=YES, 2=INVALID)
     * @param attestationData The attestation data from FDC
     * @param merkleProof Merkle proof for verification
     */
    function submitOutcome(
        bytes32 umaId,
        uint8 outcome,
        bytes calldata attestationData,
        bytes32[] calldata merkleProof
    ) external onlyAttestor {
        require(outcome <= 2, "Invalid outcome value");
        require(!outcomes[umaId].resolved, "Already resolved");
        
        // Verify attestation through FDC
        bool verified = fdcVerification.verifyAttestation(attestationData, merkleProof);
        require(verified, "Attestation verification failed");
        
        // Store the outcome
        outcomes[umaId] = Outcome({
            resolved: true,
            outcome: outcome,
            timestamp: block.timestamp
        });
        
        emit OutcomeVerified(umaId, outcome, block.timestamp, msg.sender);
    }
    
    /**
     * @notice Submit outcome directly (for owner/testing)
     * @param umaId The Polymarket UMA question ID
     * @param outcome The resolved outcome (0=NO, 1=YES, 2=INVALID)
     * @dev Use this for testing or manual intervention when FDC attestation is unavailable
     */
    function setOutcomeDirect(bytes32 umaId, uint8 outcome) external onlyOwner {
        require(outcome <= 2, "Invalid outcome value");
        
        outcomes[umaId] = Outcome({
            resolved: true,
            outcome: outcome,
            timestamp: block.timestamp
        });
        
        emit OutcomeVerified(umaId, outcome, block.timestamp, msg.sender);
    }
    
    /**
     * @notice Batch set outcomes directly (for owner/testing)
     * @param umaIds Array of UMA question IDs
     * @param _outcomes Array of outcomes corresponding to each UMA ID
     */
    function setOutcomesBatch(
        bytes32[] calldata umaIds, 
        uint8[] calldata _outcomes
    ) external onlyOwner {
        require(umaIds.length == _outcomes.length, "Length mismatch");
        
        for (uint256 i = 0; i < umaIds.length; i++) {
            require(_outcomes[i] <= 2, "Invalid outcome value");
            
            outcomes[umaIds[i]] = Outcome({
                resolved: true,
                outcome: _outcomes[i],
                timestamp: block.timestamp
            });
            
            emit OutcomeVerified(umaIds[i], _outcomes[i], block.timestamp, msg.sender);
        }
    }
    
    /**
     * @notice Get the resolved outcome for a UMA ID
     * @param umaId The UMA question ID
     * @return resolved Whether the outcome has been resolved
     * @return outcome The resolved outcome (0=NO, 1=YES, 2=INVALID)
     */
    function getOutcome(bytes32 umaId) 
        external 
        view 
        override 
        returns (bool resolved, uint8 outcome) 
    {
        Outcome memory o = outcomes[umaId];
        return (o.resolved, o.outcome);
    }
    
    /**
     * @notice Check if a market is resolved
     * @param umaId The UMA question ID
     * @return Whether the outcome has been resolved
     */
    function isResolved(bytes32 umaId) external view override returns (bool) {
        return outcomes[umaId].resolved;
    }
    
    /**
     * @notice Get full outcome details including timestamp
     * @param umaId The UMA question ID
     * @return resolved Whether resolved
     * @return outcome The outcome value
     * @return timestamp When it was resolved
     */
    function getOutcomeDetails(bytes32 umaId) 
        external 
        view 
        returns (bool resolved, uint8 outcome, uint256 timestamp) 
    {
        Outcome memory o = outcomes[umaId];
        return (o.resolved, o.outcome, o.timestamp);
    }
    
    /**
     * @notice Add an authorized attestor
     * @param attestor Address to authorize
     */
    function addAttestor(address attestor) external onlyOwner {
        require(attestor != address(0), "Invalid address");
        require(!attestors[attestor], "Already attestor");
        attestors[attestor] = true;
        emit AttestorAdded(attestor);
    }
    
    /**
     * @notice Remove an authorized attestor
     * @param attestor Address to remove
     */
    function removeAttestor(address attestor) external onlyOwner {
        require(attestors[attestor], "Not an attestor");
        attestors[attestor] = false;
        emit AttestorRemoved(attestor);
    }
    
    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        address oldOwner = owner;
        owner = newOwner;
        attestors[newOwner] = true;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
