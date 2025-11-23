// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IERC721Minimal
 * @notice Minimal ERC-721 interface for the ParlayToken
 */
interface IERC721Minimal {
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function tokenSide(uint256 tokenId) external view returns (bool);
    function tokenToParlayId(uint256 tokenId) external view returns (uint256);
}

/**
 * @title ParlayMarketplace
 * @notice Secondary marketplace for buying and selling YES/NO parlay position NFTs for FLR
 */
contract ParlayMarketplace {
    IERC721Minimal public immutable parlayToken;
    
    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 price; // Price in FLR (wei)
        bool isActive;
        bool isYes; // true = YES token, false = NO token
        uint256 parlayId;
    }
    
    // Mapping from listing ID to Listing
    mapping(uint256 => Listing) public listings;
    uint256 private _listingIdCounter;
    
    // Mapping from tokenId to listingId (for quick lookup)
    mapping(uint256 => uint256) public tokenToListing;
    
    // Market fee (in basis points, e.g., 250 = 2.5%)
    uint256 public constant MARKET_FEE_BP = 250; // 2.5% fee
    uint256 public constant BP_DENOMINATOR = 10000;
    
    // Accumulated fees
    uint256 public accumulatedFees;
    address public feeRecipient;
    
    // Events
    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        uint256 indexed tokenId,
        uint256 price,
        bool isYes,
        uint256 parlayId
    );
    
    event ListingCancelled(uint256 indexed listingId, uint256 indexed tokenId);
    
    event ListingPurchased(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 tokenId,
        uint256 price,
        uint256 fee
    );
    
    event ListingPriceUpdated(uint256 indexed listingId, uint256 oldPrice, uint256 newPrice);
    
    constructor(address _parlayToken, address _feeRecipient) {
        parlayToken = IERC721Minimal(_parlayToken);
        feeRecipient = _feeRecipient;
    }
    
    /**
     * @notice Create a new listing for a parlay position NFT
     * @param tokenId The token ID to list
     * @param price The price in FLR (wei)
     */
    function createListing(uint256 tokenId, uint256 price) external returns (uint256) {
        require(price > 0, "Price must be greater than 0");
        require(parlayToken.ownerOf(tokenId) == msg.sender, "Not token owner");
        require(tokenToListing[tokenId] == 0, "Token already listed");
        
        // Get token metadata
        bool isYes = parlayToken.tokenSide(tokenId);
        uint256 parlayId = parlayToken.tokenToParlayId(tokenId);
        
        uint256 listingId = ++_listingIdCounter;
        
        listings[listingId] = Listing({
            seller: msg.sender,
            tokenId: tokenId,
            price: price,
            isActive: true,
            isYes: isYes,
            parlayId: parlayId
        });
        
        tokenToListing[tokenId] = listingId;
        
        emit ListingCreated(listingId, msg.sender, tokenId, price, isYes, parlayId);
        
        return listingId;
    }
    
    /**
     * @notice Cancel an active listing
     * @param listingId The listing ID to cancel
     */
    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.isActive, "Listing not active");
        require(listing.seller == msg.sender, "Not seller");
        
        listing.isActive = false;
        delete tokenToListing[listing.tokenId];
        
        emit ListingCancelled(listingId, listing.tokenId);
    }
    
    /**
     * @notice Update the price of an active listing
     * @param listingId The listing ID to update
     * @param newPrice The new price in FLR (wei)
     */
    function updateListingPrice(uint256 listingId, uint256 newPrice) external {
        require(newPrice > 0, "Price must be greater than 0");
        Listing storage listing = listings[listingId];
        require(listing.isActive, "Listing not active");
        require(listing.seller == msg.sender, "Not seller");
        
        uint256 oldPrice = listing.price;
        listing.price = newPrice;
        
        emit ListingPriceUpdated(listingId, oldPrice, newPrice);
    }
    
    /**
     * @notice Purchase a listed NFT
     * @param listingId The listing ID to purchase
     */
    function purchaseListing(uint256 listingId) external payable {
        Listing storage listing = listings[listingId];
        require(listing.isActive, "Listing not active");
        require(msg.value == listing.price, "Incorrect payment amount");
        require(msg.sender != listing.seller, "Cannot buy own listing");
        
        // Verify seller still owns the token
        require(parlayToken.ownerOf(listing.tokenId) == listing.seller, "Seller no longer owns token");
        
        // Calculate fee
        uint256 fee = (listing.price * MARKET_FEE_BP) / BP_DENOMINATOR;
        uint256 sellerProceeds = listing.price - fee;
        
        // Mark listing as inactive
        listing.isActive = false;
        delete tokenToListing[listing.tokenId];
        
        // Transfer NFT to buyer
        parlayToken.safeTransferFrom(listing.seller, msg.sender, listing.tokenId);
        
        // Transfer payment to seller
        payable(listing.seller).transfer(sellerProceeds);
        
        // Accumulate fee
        accumulatedFees += fee;
        
        emit ListingPurchased(listingId, msg.sender, listing.seller, listing.tokenId, listing.price, fee);
    }
    
    /**
     * @notice Withdraw accumulated fees (only fee recipient)
     */
    function withdrawFees() external {
        require(msg.sender == feeRecipient, "Not fee recipient");
        uint256 amount = accumulatedFees;
        accumulatedFees = 0;
        payable(feeRecipient).transfer(amount);
    }
    
    /**
     * @notice Get all active listings (paginated)
     * @param offset Starting index
     * @param limit Maximum number of listings to return
     * @return listingIds Array of listing IDs
     * @return count Total number of listings returned
     */
    function getActiveListings(uint256 offset, uint256 limit) 
        external 
        view 
        returns (uint256[] memory listingIds, uint256 count) 
    {
        // First pass: count active listings
        uint256 totalActive = 0;
        for (uint256 i = 1; i <= _listingIdCounter; i++) {
            if (listings[i].isActive) {
                totalActive++;
            }
        }
        
        if (offset >= totalActive) {
            return (new uint256[](0), 0);
        }
        
        // Determine actual number to return
        uint256 remaining = totalActive - offset;
        uint256 toReturn = remaining < limit ? remaining : limit;
        
        listingIds = new uint256[](toReturn);
        
        // Second pass: collect listing IDs
        uint256 currentIndex = 0;
        uint256 arrayIndex = 0;
        
        for (uint256 i = 1; i <= _listingIdCounter && arrayIndex < toReturn; i++) {
            if (listings[i].isActive) {
                if (currentIndex >= offset) {
                    listingIds[arrayIndex] = i;
                    arrayIndex++;
                }
                currentIndex++;
            }
        }
        
        return (listingIds, arrayIndex);
    }
    
    /**
     * @notice Get active YES listings (paginated)
     */
    function getYesListings(uint256 offset, uint256 limit) 
        external 
        view 
        returns (uint256[] memory listingIds, uint256 count) 
    {
        // First pass: count active YES listings
        uint256 totalYes = 0;
        for (uint256 i = 1; i <= _listingIdCounter; i++) {
            if (listings[i].isActive && listings[i].isYes) {
                totalYes++;
            }
        }
        
        if (offset >= totalYes) {
            return (new uint256[](0), 0);
        }
        
        uint256 remaining = totalYes - offset;
        uint256 toReturn = remaining < limit ? remaining : limit;
        
        listingIds = new uint256[](toReturn);
        
        uint256 currentIndex = 0;
        uint256 arrayIndex = 0;
        
        for (uint256 i = 1; i <= _listingIdCounter && arrayIndex < toReturn; i++) {
            if (listings[i].isActive && listings[i].isYes) {
                if (currentIndex >= offset) {
                    listingIds[arrayIndex] = i;
                    arrayIndex++;
                }
                currentIndex++;
            }
        }
        
        return (listingIds, arrayIndex);
    }
    
    /**
     * @notice Get active NO listings (paginated)
     */
    function getNoListings(uint256 offset, uint256 limit) 
        external 
        view 
        returns (uint256[] memory listingIds, uint256 count) 
    {
        // First pass: count active NO listings
        uint256 totalNo = 0;
        for (uint256 i = 1; i <= _listingIdCounter; i++) {
            if (listings[i].isActive && !listings[i].isYes) {
                totalNo++;
            }
        }
        
        if (offset >= totalNo) {
            return (new uint256[](0), 0);
        }
        
        uint256 remaining = totalNo - offset;
        uint256 toReturn = remaining < limit ? remaining : limit;
        
        listingIds = new uint256[](toReturn);
        
        uint256 currentIndex = 0;
        uint256 arrayIndex = 0;
        
        for (uint256 i = 1; i <= _listingIdCounter && arrayIndex < toReturn; i++) {
            if (listings[i].isActive && !listings[i].isYes) {
                if (currentIndex >= offset) {
                    listingIds[arrayIndex] = i;
                    arrayIndex++;
                }
                currentIndex++;
            }
        }
        
        return (listingIds, arrayIndex);
    }
    
    /**
     * @notice Get total number of listings created
     */
    function getTotalListings() external view returns (uint256) {
        return _listingIdCounter;
    }
    
    /**
     * @notice Check if a token is listed
     */
    function isTokenListed(uint256 tokenId) external view returns (bool) {
        uint256 listingId = tokenToListing[tokenId];
        return listingId != 0 && listings[listingId].isActive;
    }
}

