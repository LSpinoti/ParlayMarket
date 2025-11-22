// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ParlayToken
 * @notice ERC-721 tokens representing YES/NO positions in a parlay
 * @dev Minted by ParlayMarket contract when a parlay is filled
 */
contract ParlayToken {
    string public name = "ParlayMarket Position";
    string public symbol = "PARLAY";
    
    // Token ID counter
    uint256 private _tokenIdCounter;
    
    // Token ownership
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    // Token metadata: parlayId and side (true = YES, false = NO)
    mapping(uint256 => uint256) public tokenToParlayId;
    mapping(uint256 => bool) public tokenSide; // true = YES, false = NO
    
    // Only the ParlayMarket contract can mint
    address public immutable parlayMarket;
    
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    
    modifier onlyParlayMarket() {
        require(msg.sender == parlayMarket, "Only ParlayMarket can call");
        _;
    }
    
    constructor(address _parlayMarket) {
        parlayMarket = _parlayMarket;
    }
    
    /**
     * @notice Mint a YES or NO token for a parlay
     * @param to Recipient address
     * @param parlayId The parlay ID
     * @param isYes Whether this is a YES token (true) or NO token (false)
     * @return tokenId The minted token ID
     */
    function mint(address to, uint256 parlayId, bool isYes) external onlyParlayMarket returns (uint256) {
        require(to != address(0), "Mint to zero address");
        
        uint256 tokenId = _tokenIdCounter++;
        _owners[tokenId] = to;
        _balances[to] += 1;
        tokenToParlayId[tokenId] = parlayId;
        tokenSide[tokenId] = isYes;
        
        emit Transfer(address(0), to, tokenId);
        return tokenId;
    }
    
    /**
     * @notice Burn a token (called after settlement)
     */
    function burn(uint256 tokenId) external onlyParlayMarket {
        address owner = _owners[tokenId];
        require(owner != address(0), "Token does not exist");
        
        _balances[owner] -= 1;
        delete _owners[tokenId];
        delete _tokenApprovals[tokenId];
        delete tokenToParlayId[tokenId];
        delete tokenSide[tokenId];
        
        emit Transfer(owner, address(0), tokenId);
    }
    
    // Standard ERC-721 functions
    
    function balanceOf(address owner) external view returns (uint256) {
        require(owner != address(0), "Zero address");
        return _balances[owner];
    }
    
    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Token does not exist");
        return owner;
    }
    
    function approve(address to, uint256 tokenId) external {
        address owner = _owners[tokenId];
        require(msg.sender == owner || _operatorApprovals[owner][msg.sender], "Not authorized");
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }
    
    function getApproved(uint256 tokenId) external view returns (address) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return _tokenApprovals[tokenId];
    }
    
    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
    
    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return _operatorApprovals[owner][operator];
    }
    
    function transferFrom(address from, address to, uint256 tokenId) public {
        address owner = _owners[tokenId];
        require(owner == from, "From address mismatch");
        require(to != address(0), "Transfer to zero address");
        require(
            msg.sender == owner || 
            _tokenApprovals[tokenId] == msg.sender || 
            _operatorApprovals[owner][msg.sender],
            "Not authorized"
        );
        
        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;
        delete _tokenApprovals[tokenId];
        
        emit Transfer(from, to, tokenId);
    }
    
    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        transferFrom(from, to, tokenId);
    }
    
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory) external {
        transferFrom(from, to, tokenId);
    }
}

