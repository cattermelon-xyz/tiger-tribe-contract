// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

interface INFTMarket {
    // if the struct can be extended, that's one way, otherwise different mapping per type.
    struct Listing {
        address seller;
        uint256 price;
    }
    // ############
    // Events
    // ############
    event NewListing(address indexed seller, uint256 indexed nftID, uint256 price);
    event ListingPriceChange(address indexed seller, uint256 indexed nftID, uint256 newPrice);
    event CancelledListing(address indexed seller, uint256 indexed nftID);
    event PurchasedListing(address indexed buyer, address seller, uint256 indexed nftID, uint256 price);

    // ############
    // Views
    // ############
    function getSellerOfNFTID(uint256 _tokenId) external view returns (address);

    function getListingIDs() external view returns (uint256[] memory);

    function getListingIDsPage(uint8 _limit, uint256 _pageNumber) external view returns (uint256[] memory);

    function getNumberOfListingsBySeller(address _seller) external view returns (uint256);

    function getListingIDsBySeller(address _seller) external view returns (uint256[] memory tokens);

    function getNumberOfListings() external view returns (uint256);

    function getPrice(uint256 _id) external view returns (uint256);

    function getListingSlice(uint256 start, uint256 length)
        external
        view
        returns (
            uint256 returnedCount,
            uint256[] memory ids,
            address[] memory sellers,
            uint256[] memory prices
        );

    // ############
    // Mutative
    // ############
    function addListing(uint256 _id, uint256 _price) external;

    function changeListingPrice(uint256 _id, uint256 _newPrice) external;

    function cancelListing(uint256 _id) external;

    function purchaseListing(uint256 _id) external;

    function setTaxRecipient(address _taxRecipient) external;

    function setTax(uint256 _tax) external;
}
