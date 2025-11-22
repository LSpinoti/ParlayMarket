// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ParlayToken.sol";

/**
 * @title ParlayMarketplace
 * @notice Marketplace for buying and selling parlay position tokens
 * @dev Integrates with existing ParlayToken (ERC-721) contract
 */
contract ParlayMarketplace {
    // =============================================================
    //                            STRUCTS
    // =============================================================

    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;          // Price in FLR (wei)
        uint256 parlayId;       // Associated parlay ID
        bool isYesPosition;     // true = YES token, false = NO token
        bool active;
        uint256 listedAt;
    }

    // =============================================================
    //                            STORAGE
    // =============================================================

    ParlayToken public parlayToken;
    address public owner;
    address public feeRecipient;

    // Fee in basis points (100 = 1%)
    uint256 public feeBps = 100;

    // Listing storage
    uint256 private _listingIdCounter;
    mapping(uint256 => Listing) public listings;

    // Track active listing by token ID
    mapping(uint256 => uint256) public tokenToListing;

    // =============================================================
    //                            EVENTS
    // =============================================================

    event Listed(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price,
        uint256 parlayId,
        bool isYesPosition
    );

    event Sold(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        address indexed buyer,
        address seller,
        uint256 price,
        uint256 fee
    );

    event Cancelled(uint256 indexed listingId, uint256 indexed tokenId);

    event PriceUpdated(uint256 indexed listingId, uint256 oldPrice, uint256 newPrice);

    event FeeUpdated(uint256 oldFee, uint256 newFee);

    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    // =============================================================
    //                          MODIFIERS
    // =============================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    constructor(address _parlayToken) {
        parlayToken = ParlayToken(_parlayToken);
        owner = msg.sender;
        feeRecipient = msg.sender;
    }

    // =============================================================
    //                      LIST POSITION
    // =============================================================

    /**
     * @notice List a parlay position token for sale
     * @param tokenId The token ID to list
     * @param price The asking price in FLR (wei)
     */
    function listPosition(uint256 tokenId, uint256 price) external returns (uint256 listingId) {
        require(price > 0, "Price must be > 0");
        require(parlayToken.ownerOf(tokenId) == msg.sender, "Not token owner");
        require(tokenToListing[tokenId] == 0, "Already listed");

        // Get token metadata from public mappings
        uint256 parlayId = parlayToken.tokenToParlayId(tokenId);
        bool isYes = parlayToken.tokenSide(tokenId);

        // Transfer token to marketplace (escrow)
        parlayToken.transferFrom(msg.sender, address(this), tokenId);

        // Create listing
        listingId = ++_listingIdCounter;
        listings[listingId] = Listing({
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            parlayId: parlayId,
            isYesPosition: isYes,
            active: true,
            listedAt: block.timestamp
        });

        tokenToListing[tokenId] = listingId;

        emit Listed(listingId, tokenId, msg.sender, price, parlayId, isYes);
        return listingId;
    }

    // =============================================================
    //                      BUY POSITION
    // =============================================================

    /**
     * @notice Buy a listed position
     * @param listingId The listing to buy
     */
    function buyPosition(uint256 listingId) external payable {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(msg.value == listing.price, "Incorrect payment");

        // Mark as sold
        listing.active = false;
        tokenToListing[listing.tokenId] = 0;

        // Calculate fee
        uint256 fee = (listing.price * feeBps) / 10000;
        uint256 sellerAmount = listing.price - fee;

        // Transfer token to buyer
        parlayToken.transferFrom(address(this), msg.sender, listing.tokenId);

        // Transfer payment to seller
        payable(listing.seller).transfer(sellerAmount);

        // Transfer fee to recipient
        if (fee > 0) {
            payable(feeRecipient).transfer(fee);
        }

        emit Sold(listingId, listing.tokenId, msg.sender, listing.seller, listing.price, fee);
    }

    // =============================================================
    //                    CANCEL LISTING
    // =============================================================

    /**
     * @notice Cancel a listing and return token to seller
     * @param listingId The listing to cancel
     */
    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender, "Not seller");

        listing.active = false;
        tokenToListing[listing.tokenId] = 0;

        // Return token to seller
        parlayToken.transferFrom(address(this), msg.sender, listing.tokenId);

        emit Cancelled(listingId, listing.tokenId);
    }

    // =============================================================
    //                    UPDATE PRICE
    // =============================================================

    /**
     * @notice Update the price of an active listing
     * @param listingId The listing to update
     * @param newPrice The new price in FLR (wei)
     */
    function updatePrice(uint256 listingId, uint256 newPrice) external {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender, "Not seller");
        require(newPrice > 0, "Price must be > 0");

        uint256 oldPrice = listing.price;
        listing.price = newPrice;

        emit PriceUpdated(listingId, oldPrice, newPrice);
    }

    // =============================================================
    //                      VIEW FUNCTIONS
    // =============================================================

    /**
     * @notice Get listing details
     */
    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    /**
     * @notice Get listing ID for a token
     */
    function getListingByToken(uint256 tokenId) external view returns (uint256) {
        return tokenToListing[tokenId];
    }

    /**
     * @notice Get total number of listings created
     */
    function getTotalListings() external view returns (uint256) {
        return _listingIdCounter;
    }

    /**
     * @notice Check if a token is currently listed
     */
    function isListed(uint256 tokenId) external view returns (bool) {
        uint256 listingId = tokenToListing[tokenId];
        if (listingId == 0) return false;
        return listings[listingId].active;
    }

    // =============================================================
    //                      ADMIN FUNCTIONS
    // =============================================================

    /**
     * @notice Update the fee percentage
     * @param newFeeBps New fee in basis points (max 1000 = 10%)
     */
    function setFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Fee too high");
        emit FeeUpdated(feeBps, newFeeBps);
        feeBps = newFeeBps;
    }

    /**
     * @notice Update the fee recipient
     */
    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid address");
        emit FeeRecipientUpdated(feeRecipient, newRecipient);
        feeRecipient = newRecipient;
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }

    /**
     * @notice Emergency cancel - owner can cancel stuck listings
     */
    function emergencyCancel(uint256 listingId) external onlyOwner {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");

        listing.active = false;
        tokenToListing[listing.tokenId] = 0;

        // Return token to seller
        parlayToken.transferFrom(address(this), listing.seller, listing.tokenId);

        emit Cancelled(listingId, listing.tokenId);
    }
}
