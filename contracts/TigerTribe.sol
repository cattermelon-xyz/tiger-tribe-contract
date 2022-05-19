// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract TigerTribe is ERC721, ERC721Enumerable, ERC721URIStorage, Pausable, Ownable, ERC721Burnable {
    /* ======== EVENTS ======== */
    event Redeem(uint256 indexed tokenId, address indexed to);

    event Withdraw(address indexed backedTokenAddr, uint256 amount);

    /* ======== STATE VARIABLES ======== */
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    uint256 public constant MAX_TOTAL_SUPPLY = 999;

    string public baseURI;

    uint256 public redeemableAt;
    address public backedTokenAddress;
    bool public lockedMetadata;
    
    mapping(uint256 => uint256) public backedAmounts;

    constructor(string memory _baseUri) ERC721("Hectagon Tiger Tribe", "HTT") {
        baseURI = _baseUri;
        _tokenIdCounter.increment();
    }

    modifier whenNotLocked() {
        require(!lockedMetadata, "Error: The Metadata is already locked!");
        _;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    function setBaseURI(string memory _uri) public onlyOwner whenNotLocked {
        baseURI = _uri;
    }

    function getCurrentCounter() public view returns (uint256) {
        return _tokenIdCounter.current();
    }

    function withdraw(address _backedTokenAddr, uint256 _amount) public onlyOwner {
        IERC20(_backedTokenAddr).transfer(msg.sender, _amount);
        emit Withdraw(_backedTokenAddr, _amount);
    }

    function lockMetadata() public virtual onlyOwner whenNotLocked {
        lockedMetadata = true;
    }


    function setBackedToken(
        address _addr
    ) public onlyOwner {
        require(_addr != address(0), "Zero address: backed token");
        backedTokenAddress = _addr;
    }

    function setRedeemableAt(
        uint256 _redeemableAt
    ) public onlyOwner {
        require(_redeemableAt > 0, "_redeemableAt should be greater than zero");
        redeemableAt = _redeemableAt;
    }

    function getTokenIdsPage(
        address _owner,
        uint256 _offset,
        uint256 _limit
    ) public view returns (uint256[] memory) {
        uint256 balance = balanceOf(_owner);

        uint256[] memory ids = new uint256[](_limit);

        uint256 counter = 0;

        for (uint256 i = _offset; i < _offset + _limit; i++) {
            if (i >= balance) return ids;
            uint256 id = tokenOfOwnerByIndex(_owner, i);
            ids[counter++] = id;
        }

        return ids;
    }

    function safeMint(
        address _to,
        string memory _uri,
        uint256 _amount,
        uint256 _id
    ) public onlyOwner {
        require(_to != address(0), "Mint to zero address!");

        uint256 tokenId = _tokenIdCounter.current();
        require(tokenId <= MAX_TOTAL_SUPPLY, "Error: There are no more tokens left to be minted!");
        require(_id == tokenId, "TokenId conflict");

        _tokenIdCounter.increment();

        _safeMint(_to, tokenId);
        _setTokenURI(tokenId, _uri);

        backedAmounts[tokenId] = _amount;
    }

    function safeMintTokens(
        address _to,
        string[] memory _tokensURI,
        uint256[] memory _backedTokensAmount,
        uint256 fromId
    ) public onlyOwner {
        uint256 tokenId = _tokenIdCounter.current();
        require(fromId == tokenId, "TokenId conflict");

        require(_tokensURI.length > 0, "Tokens URI arrays not empty");
        require(
            _tokensURI.length == _backedTokensAmount.length,
            "Length of tokensURI and tokensAmount arrays is not equal!"
        );

        for (uint256 i = 0; i < _tokensURI.length; i++) {
            safeMint(_to, _tokensURI[i], _backedTokensAmount[i], fromId + i);
        }
    }

    function setTokensUri(uint256[] memory _ids, string[] memory _tokensURI) public onlyOwner whenNotLocked {
        require(_ids.length > 0, "ID arrays not empty");
        require(_ids.length == _tokensURI.length, "Length of ID and Data arrays is not equal!");

        for (uint256 i = 0; i < _ids.length; i++) {
            _setTokenURI(_ids[i], _tokensURI[i]);
        }
    }

    function redeem(uint256 _tokenId) public {
        require(msg.sender == ownerOf(_tokenId), "Sender not owner!");
        require(backedTokenAddress != address(0), "backedToken is not set");


        uint48 currentTime = uint48(block.timestamp);
        require(currentTime > redeemableAt, "Not redeemable!");

        uint256 amount = backedAmounts[_tokenId];
        uint256 backedTokenAmount = (amount * (10**IERC20Metadata(backedTokenAddress).decimals())) / (10**decimals());

        uint256 maxRedeem = IERC20(backedTokenAddress).balanceOf(address(this));

        require(backedTokenAmount <= maxRedeem, "Not enough token to redeem!");

        _burn(_tokenId);

        delete backedAmounts[_tokenId];

        IERC20(backedTokenAddress).transfer(msg.sender, backedTokenAmount);

        emit Redeem(_tokenId, msg.sender);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable) whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    // The following functions are overrides required by Solidity.

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function decimals() public pure returns (uint8) {
        return 18;
    }
}
