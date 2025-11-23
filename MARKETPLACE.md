# ParlayMarket NFT Marketplace

A secondary marketplace for buying and selling YES and NO parlay position NFTs for FLR tokens.

## Overview

The ParlayMarketplace contract allows users to:
- List their YES/NO position NFTs for sale
- Buy listed NFTs with FLR tokens
- Cancel their listings
- Update listing prices

## Smart Contract

### Key Features

- **ERC-721 Compatible**: Works with ParlayToken (YES/NO position NFTs)
- **Native FLR Payments**: All trades use FLR as the payment token
- **Market Fee**: 2.5% fee on all sales
- **Separate YES/NO Views**: Filter listings by position type
- **Active Listing Management**: Cancel or update your listings anytime

### Functions

#### Creating a Listing
```solidity
function createListing(uint256 tokenId, uint256 price) external returns (uint256)
```
- Lists a ParlayToken NFT for sale
- Price is in wei (FLR)
- Returns the listing ID
- Requires token approval first

#### Purchasing a Listing
```solidity
function purchaseListing(uint256 listingId) external payable
```
- Purchase a listed NFT
- Must send exact price in FLR
- 2.5% fee deducted automatically
- NFT transferred to buyer, FLR to seller

#### Managing Listings
```solidity
function cancelListing(uint256 listingId) external
function updateListingPrice(uint256 listingId, uint256 newPrice) external
```

#### Querying Listings
```solidity
function getYesListings(uint256 offset, uint256 limit) external view returns (uint256[] memory, uint256)
function getNoListings(uint256 offset, uint256 limit) external view returns (uint256[] memory, uint256)
function getActiveListings(uint256 offset, uint256 limit) external view returns (uint256[] memory, uint256)
```

## Frontend

### Marketplace Page

Located at `/marketplace`, the page features:

- **Split Layout**: YES positions on the left, NO positions on the right
- **Listing Cards**: Display token info, parlay details, and price
- **Buy/Sell Interface**: Easy-to-use modals for transactions
- **User Token Management**: View and list your owned tokens

### UI Components

#### Listing Card
- Shows token ID, position type (YES/NO), and price
- Displays parlay name and ID
- Buy button for other users' listings
- Cancel button for your own listings

#### List NFT Modal
- Select from your owned tokens
- Set price in FLR
- Automatic approval and listing in one flow
- Shows 2.5% marketplace fee notice

#### Purchase Confirmation Modal
- Review listing details before purchase
- Shows final price in FLR
- Confirms transaction details

## Deployment

### Prerequisites
- ParlayMarket and ParlayToken must be deployed first
- Deployer needs FLR for gas

### Deploy Marketplace
```bash
npx hardhat run scripts/deploy-marketplace.js --network coston2
```

### Update Contract Addresses
After deployment, update `lib/contracts.ts`:
```typescript
ParlayMarketplace: '0xYourMarketplaceAddress',
```

## Usage Flow

### Selling an NFT

1. **Navigate to Marketplace**: Click "Marketplace" in the navigation
2. **Connect Wallet**: Ensure your wallet is connected
3. **Click "List Your NFT"**: Opens the listing modal
4. **Select Token**: Choose from your owned YES/NO tokens
5. **Set Price**: Enter price in FLR
6. **Confirm**: Approves token and creates listing in one transaction

### Buying an NFT

1. **Browse Listings**: View YES (left) or NO (right) positions
2. **Click "Buy Now"**: Opens confirmation modal
3. **Review Details**: Check token ID, type, and price
4. **Confirm Purchase**: Send FLR and receive NFT

### Managing Listings

- **Cancel**: Click "Cancel Listing" on your listed tokens
- **Update Price**: Use the contract directly or cancel and relist
- **View Status**: See which of your tokens are currently listed

## Market Fee

- **Fee Rate**: 2.5% (250 basis points)
- **Applied On**: Sale price
- **Example**: 10 FLR sale = 9.75 FLR to seller, 0.25 FLR fee
- **Fee Recipient**: Configurable (set during deployment)

## Technical Details

### Contract Architecture

```
ParlayMarketplace
├── Listings Storage
│   ├── listingId -> Listing struct
│   └── tokenId -> listingId mapping
├── Listing Management
│   ├── createListing()
│   ├── cancelListing()
│   └── updateListingPrice()
├── Trading
│   └── purchaseListing()
└── Queries
    ├── getYesListings()
    ├── getNoListings()
    └── getActiveListings()
```

### Listing Struct
```solidity
struct Listing {
    address seller;
    uint256 tokenId;
    uint256 price;
    bool isActive;
    bool isYes;
    uint256 parlayId;
}
```

### Events
- `ListingCreated`: When a new listing is created
- `ListingCancelled`: When a listing is cancelled
- `ListingPurchased`: When a listing is purchased
- `ListingPriceUpdated`: When a listing price is changed

## Security Considerations

1. **Ownership Verification**: Contract verifies token ownership before purchase
2. **Reentrancy Protection**: Uses checks-effects-interactions pattern
3. **Price Validation**: Ensures correct payment amount
4. **Active Status**: Prevents double-spending of listings

## Future Enhancements

- [ ] Offer/Bid system
- [ ] Auction functionality
- [ ] Bulk listing/buying
- [ ] Advanced filtering (by parlay, price range, etc.)
- [ ] Trading history and analytics
- [ ] Price discovery and recommendations
- [ ] Notifications for price changes
- [ ] Marketplace statistics dashboard

## Support

For issues or questions:
1. Check the contract code in `contracts/ParlayMarketplace.sol`
2. Review the frontend implementation in `app/marketplace/page.tsx`
3. See the hook utilities in `hooks/useMarketplace.ts`

