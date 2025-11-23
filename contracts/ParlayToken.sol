// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IParlayMarket
 * @notice Minimal interface to access parlay image URLs
 */
interface IParlayMarket {
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
        uint8 status,
        bool makerIsYes,
        uint256 yesTokenId,
        uint256 noTokenId
    );
}

/**
 * @title ParlayToken
 * @notice ERC-721 tokens representing YES/NO positions in a parlay
 * @dev Minted by ParlayMarket contract when a parlay is filled
 */
contract ParlayToken {
    string public name = "ParlayMarket Position";
    string public symbol = "PARLAY";
    
    // Token ID counter - starts at 1 so YES tokens are odd (1, 3, 5...) and NO tokens are even (2, 4, 6...)
    uint256 private _tokenIdCounter = 1;
    
    // Total supply tracking
    uint256 private _totalSupply = 0;
    
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
    
    // ERC-165 interface IDs
    bytes4 private constant _INTERFACE_ID_ERC165 = 0x01ffc9a7;
    bytes4 private constant _INTERFACE_ID_ERC721 = 0x80ac58cd;
    bytes4 private constant _INTERFACE_ID_ERC721_METADATA = 0x5b5e139f;
    
    // ERC-721 Receiver interface selector
    bytes4 private constant _ERC721_RECEIVED = 0x150b7a02;
    
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
     * @dev YES tokens get odd IDs (1, 3, 5...), NO tokens get even IDs (2, 4, 6...)
     */
    function mint(address to, uint256 parlayId, bool isYes) external onlyParlayMarket returns (uint256) {
        require(to != address(0), "Mint to zero address");
        
        // YES tokens: odd numbers (1, 3, 5...)
        // NO tokens: even numbers (2, 4, 6...)
        uint256 tokenId = _tokenIdCounter++;
        _owners[tokenId] = to;
        _balances[to] += 1;
        _totalSupply += 1;
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
        _totalSupply -= 1;
        delete _owners[tokenId];
        delete _tokenApprovals[tokenId];
        delete tokenToParlayId[tokenId];
        delete tokenSide[tokenId];
        
        emit Transfer(owner, address(0), tokenId);
    }
    
    // ERC-165 Support
    
    /**
     * @notice Check if contract implements an interface
     * @dev Required for NFT detection in wallets like Metamask
     */
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == _INTERFACE_ID_ERC165 ||
            interfaceId == _INTERFACE_ID_ERC721 ||
            interfaceId == _INTERFACE_ID_ERC721_METADATA;
    }
    
    // ERC-721 Metadata
    
    /**
     * @notice Get metadata URI for a token
     * @dev Returns JSON metadata for the NFT
     */
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        
        uint256 parlayId = tokenToParlayId[tokenId];
        bool isYes = tokenSide[tokenId];
        
        // Get the first leg's image URL from the parlay
        string memory imageUrl = "";
        try IParlayMarket(parlayMarket).getParlay(parlayId) returns (
            address,
            address,
            string memory,
            bytes32[] memory,
            uint8[] memory,
            string[] memory,
            string[] memory imageUrls,
            uint256,
            uint256,
            uint256,
            uint8,
            bool,
            uint256,
            uint256
        ) {
            if (imageUrls.length > 0 && bytes(imageUrls[0]).length > 0) {
                imageUrl = imageUrls[0];
            }
        } catch {
            // If query fails, leave imageUrl empty
        }
        
        // Construct JSON metadata
        string memory side = isYes ? "YES" : "NO";
        string memory json;
        
        if (bytes(imageUrl).length > 0) {
            // Include image in metadata
            json = string(abi.encodePacked(
                '{"name":"ParlayMarket Position #',
                _toString(tokenId),
                '","description":"',
                side,
                ' position for Parlay #',
                _toString(parlayId),
                '","image":"',
                imageUrl,
                '","attributes":[{"trait_type":"Side","value":"',
                side,
                '"},{"trait_type":"Parlay ID","value":"',
                _toString(parlayId),
                '"}]}'
            ));
        } else {
            // No image available
            json = string(abi.encodePacked(
                '{"name":"ParlayMarket Position #',
                _toString(tokenId),
                '","description":"',
                side,
                ' position for Parlay #',
                _toString(parlayId),
                '","attributes":[{"trait_type":"Side","value":"',
                side,
                '"},{"trait_type":"Parlay ID","value":"',
                _toString(parlayId),
                '"}]}'
            ));
        }
        
        // Return as data URI
        return string(abi.encodePacked(
            'data:application/json;utf8,',
            json
        ));
    }
    
    /**
     * @notice Convert uint256 to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    // Standard ERC-721 functions
    
    /**
     * @notice Returns the total number of tokens in existence
     * @return The total supply of tokens
     */
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }
    
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
    
    /**
     * @notice Safely transfers a token from one address to another
     * @dev Checks if recipient is a contract and calls onERC721Received if so
     */
    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }
    
    /**
     * @notice Safely transfers a token from one address to another with data
     * @dev Checks if recipient is a contract and calls onERC721Received if so
     */
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        transferFrom(from, to, tokenId);
        _checkOnERC721Received(from, to, tokenId, data);
    }
    
    /**
     * @notice Internal function to check if recipient implements IERC721Receiver
     */
    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) private {
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
                require(retval == _ERC721_RECEIVED, "ERC721: transfer to non ERC721Receiver implementer");
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("ERC721: transfer to non ERC721Receiver implementer");
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        }
    }
    
}

/**
 * @title IERC721Receiver
 * @notice Interface for contracts that can receive ERC-721 tokens
 */
interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

