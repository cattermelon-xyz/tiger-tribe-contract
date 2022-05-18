// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract Market is Ownable, Pausable, IERC721Receiver {
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeERC20 for IERC20;

    // ############
    // State
    // ############
    IERC721 public nftAddress;
    address public taxRecipient;
    uint256 public tax = 10; // 1%
    address public constant BNB = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    mapping(uint256 => Listing) private listings;
    EnumerableSet.UintSet private listedTokenIDs;

    mapping(IERC20 => bool) public acceptedTokens;

    struct Listing {
        address seller;
        uint256 price;
        IERC20 currency;
    }
    // ############
    // Events
    // ############
    event NewListing(address indexed seller, uint256 indexed nftID, uint256 price, address indexed currency);
    event ListingPriceChange(address indexed seller, uint256 indexed nftID, uint256 price, address indexed currency);
    event CancelledListing(address indexed seller, uint256 indexed nftID);
    event PurchasedListing(
        address indexed buyer,
        address seller,
        uint256 indexed nftID,
        uint256 price,
        address indexed currency
    );

    bytes4 private constant _INTERFACE_ID_ERC721 = 0x80ac58cd;

    uint256 public constant RATE_DENOMINATOR = 1000;

    // ############
    // Constructor
    // ############
    constructor(address _taxRecipient) {
        taxRecipient = _taxRecipient;

        acceptedTokens[IERC20(BNB)] = true;
    }

    modifier isListed(uint256 id) {
        require(listedTokenIDs.contains(id), "Token ID not listed");
        _;
    }

    modifier isNotListed(uint256 id) {
        require(!listedTokenIDs.contains(id), "Token ID must not be listed");
        _;
    }

    modifier isSeller(uint256 id) {
        require(listings[id].seller == msg.sender, "Access denied");
        _;
    }

    modifier isSellerOrAdmin(uint256 id) {
        require(listings[id].seller == msg.sender || owner() == msg.sender, "Access denied");
        _;
    }

    modifier isValidERC721(address _tokenAddress) {
        require(ERC165Checker.supportsInterface(_tokenAddress, _INTERFACE_ID_ERC721), "not valid ERC721");
        _;
    }

    modifier allowedCurrency(IERC20 _currency) {
        require(acceptedTokens[_currency], "Currency not allowed");
        _;
    }

    modifier isTokenContract(IERC20 _contract) {
        require(_contract.totalSupply() >= 0, "The accepted token address must be a deployed contract");
        _;
    }

    function getNumberOfListings() public view returns (uint256) {
        return listedTokenIDs.length();
    }

    function getListingSlice(uint256 start, uint256 length)
        public
        view
        returns (
            uint256 returnedCount,
            uint256[] memory ids,
            address[] memory sellers,
            uint256[] memory prices,
            address[] memory currencies
        )
    {
        returnedCount = length;
        ids = new uint256[](length);
        sellers = new address[](length);
        prices = new uint256[](length);
        currencies = new address[](length);

        uint256 index = 0;
        for (uint256 i = start; i < start + length; i++) {
            if (i >= listedTokenIDs.length()) return (index, ids, sellers, prices, currencies);

            uint256 id = listedTokenIDs.at(i);
            Listing memory listing = listings[id];
            ids[index] = id;
            sellers[index] = listing.seller;
            currencies[index] = address(listing.currency);
            prices[index++] = listing.price;
        }
    }

    // ############
    // Mutative
    // ############

    function disableTokens(IERC20 _token) external onlyOwner isTokenContract(_token) {
        acceptedTokens[_token] = false;
    }

    function enableTokens(IERC20 _token) public onlyOwner isTokenContract(_token) {
        acceptedTokens[_token] = true;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function setNFTAddress(address _nftAddress) external isValidERC721(_nftAddress) {
        nftAddress = IERC721(_nftAddress);
    }

    function addListing(
        uint256 _id,
        uint256 _priceInWei,
        IERC20 currency
    ) public isNotListed(_id) whenNotPaused allowedCurrency(currency) {
        listings[_id] = Listing(msg.sender, _priceInWei, currency);
        listedTokenIDs.add(_id);

        // in theory the transfer and required approval already test non-owner operations
        nftAddress.safeTransferFrom(msg.sender, address(this), _id);

        emit NewListing(msg.sender, _id, _priceInWei, address(currency));
    }

    function changeListingPrice(
        uint256 _id,
        uint256 _newPriceInWei,
        IERC20 _newCurrency
    ) public isListed(_id) isSeller(_id) whenNotPaused allowedCurrency(_newCurrency) {
        listings[_id].price = _newPriceInWei;
        listings[_id].currency = _newCurrency;
        emit ListingPriceChange(msg.sender, _id, _newPriceInWei, address(_newCurrency));
    }

    function cancelListing(uint256 _id) public isListed(_id) isSellerOrAdmin(_id) {
        address seller = listings[_id].seller;

        delete listings[_id];
        listedTokenIDs.remove(_id);

        nftAddress.safeTransferFrom(address(this), seller, _id);
        emit CancelledListing(msg.sender, _id);
    }

    function purchaseListing(uint256 _id) public payable isListed(_id) whenNotPaused {
        (uint256 finalPrice, Listing memory listing) = executePurchaseLogic(_id);
        nftAddress.safeTransferFrom(address(this), msg.sender, _id);

        emit PurchasedListing(msg.sender, listing.seller, _id, finalPrice, address(listing.currency));
    }

    function executePurchaseLogic(uint256 _id) private returns (uint256, Listing memory) {
        uint256 price = listings[_id].price;
        IERC20 currency = listings[_id].currency;
        address seller = listings[_id].seller;
        address sender = _msgSender();

        uint256 taxAmount = (price * tax) / RATE_DENOMINATOR;

        uint256 finalPrice = price - taxAmount;

        Listing memory listing = listings[_id];

        delete listings[_id];
        listedTokenIDs.remove(_id);

        if (address(currency) != BNB) {
            if (taxAmount > 0) {
                require(
                    currency.transferFrom(sender, taxRecipient, taxAmount),
                    "Transfering the tax to the Marketplace owner failed"
                );
            }
            // Transfer sale amount to seller
            require(
                currency.transferFrom(sender, seller, finalPrice),
                "Transfering the sale amount to the seller failed"
            );
        } else {
            require(msg.value >= price, "Transfering value not enough");
            if (taxAmount > 0) {
                payable(taxRecipient).transfer(taxAmount);
            }
            // Transfer sale amount to seller
            payable(seller).transfer(finalPrice);
        }
        return (finalPrice, listing);
    }

    function setTaxRecipient(address _taxRecipient) public onlyOwner {
        taxRecipient = _taxRecipient;
    }

    function setTax(uint256 _tax) public onlyOwner {
        require(_tax < RATE_DENOMINATOR, "Tax is too large");
        tax = _tax;
    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external pure override returns (bytes4) {
        return bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
    }
}
