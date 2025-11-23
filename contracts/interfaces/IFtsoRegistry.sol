// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IFtsoRegistry
 * @notice Interface for Flare's FTSO (Flare Time Series Oracle) Registry
 * @dev Used to fetch decentralized price feeds for various assets
 */
interface IFtsoRegistry {
    /**
     * @notice Get current price for a symbol
     * @param _symbol The asset symbol (e.g., "FLR", "BTC", "ETH")
     * @return _price The current price
     * @return _timestamp The timestamp of the price
     * @return _decimals The number of decimals
     */
    function getCurrentPriceWithDecimals(string memory _symbol)
        external view
        returns (uint256 _price, uint256 _timestamp, uint256 _decimals);

    /**
     * @notice Get current price for a symbol by index
     */
    function getCurrentPriceWithDecimalsByIndex(uint256 _assetIndex)
        external view
        returns (uint256 _price, uint256 _timestamp, uint256 _decimals);

    /**
     * @notice Get supported symbols
     */
    function getSupportedSymbols() external view returns (string[] memory);

    /**
     * @notice Get symbol by index
     */
    function getSupportedSymbolByIndex(uint256 _index) external view returns (string memory);

    /**
     * @notice Get all supported indices and symbols
     */
    function getSupportedIndicesAndSymbols()
        external view
        returns (uint256[] memory _indices, string[] memory _symbols);

    /**
     * @notice Get FTSO address by symbol
     */
    function getFtsoBySymbol(string memory _symbol) external view returns (address);
}
