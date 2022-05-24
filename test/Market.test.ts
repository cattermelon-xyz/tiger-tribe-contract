/* eslint-disable camelcase */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { MockContract, MockContractFactory, smock } from "@defi-wonderland/smock";
import {
    Market,
    Market__factory,
    TigerTribe,
    TigerTribe__factory,
    MockERC20__factory,
    MockERC20,
} from "../typechain";
const { BigNumber } = ethers;

chai.use(smock.matchers);

describe("Market", () => {
    let owner: SignerWithAddress;
    let other: SignerWithAddress;
    let tester: SignerWithAddress;
    let tigerTribe: TigerTribe;
    let market: Market;
    let busdFake: MockContract<MockERC20>;
    let erc20Factory: MockContractFactory<MockERC20__factory>;

    const provider = waffle.provider;

    const BASE_URI = "https://nft.hectagon.finance/";

    const MOCK_AMOUNT_BUSD_BACKED = "10000000000000000000"; // ~ 10
    const MOCK_AMOUNT_BUSD = "20000000000000000000"; // ~ 20
    const MOCK_URI_TOKEN = "example.json";

    const BUSD_NAME = "busdERC20";
    const BUSD_SYMBOL = "BUSD";
    const BUSD_INITIAL_MINT = "100000000000000000000"; // 100

    const BNB = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    beforeEach(async () => {
        [owner, other, tester] = await ethers.getSigners();

        tigerTribe = await new TigerTribe__factory(owner).deploy(BASE_URI);
        erc20Factory = await smock.mock("MockERC20");
        busdFake = await erc20Factory.deploy(BUSD_NAME, BUSD_SYMBOL);
        await busdFake.mint(owner.address, BUSD_INITIAL_MINT);
        await busdFake.mint(tester.address, BUSD_INITIAL_MINT);
        await busdFake.mint(tigerTribe.address, BUSD_INITIAL_MINT);

        market = await new Market__factory(owner).deploy(other.address);
        await market.enableTokens(busdFake.address);
    });

    describe("constructor", () => {
        it("can be constructed", async () => {
            expect(await market.taxRecipient()).to.equal(other.address);
            expect(await market.acceptedTokens(busdFake.address)).to.equal(true);
            expect(await market.acceptedTokens(BNB)).to.equal(true);
        });
    });

    describe("disableTokens", () => {
        it("must be valid ECR20 token", async () => {
            await market.disableTokens(busdFake.address);
            expect(await market.acceptedTokens(busdFake.address)).to.equal(false);
        });
    });

    describe("disableTokens", () => {
        it("must be valid ECR20 token", async () => {
            await market.disableTokens(busdFake.address);
            await market.enableTokens(busdFake.address);
            expect(await market.acceptedTokens(busdFake.address)).to.equal(true);
        });
    });

    describe("setNFTAddress", () => {
        it("must be valid ECR721 token", async () => {
            await expect(market.setNFTAddress(busdFake.address)).to.be.reverted;
        });
    });

    describe("setTax", () => {
        it("must be done by owner", async () => {
            await market.setTax("100");
            expect(await market.tax()).to.be.equal("100");
        });

        it("must be done by only owner", async () => {
            await expect(market.connect(other).setTax("100")).to.be.reverted;
        });
    });

    describe("setTaxRecipient", () => {
        it("must be done by owner", async () => {
            await market.setTaxRecipient(owner.address);
            expect(await market.taxRecipient()).to.be.equal(owner.address);
        });

        it("must be done by only wner", async () => {
            await expect(market.connect(other).setTaxRecipient(owner.address)).to.be.reverted;
        });
    });

    describe("Exchange activity", () => {
        beforeEach(async () => {
            await tigerTribe.setBackedToken(busdFake.address);
            await tigerTribe.safeMint(
                owner.address,
                MOCK_URI_TOKEN,
                BigNumber.from(MOCK_AMOUNT_BUSD_BACKED),
                1
            );
            await market.setNFTAddress(tigerTribe.address);
        });

        describe("addListing", () => {
            it("adding successfully with ECR20 currency", async () => {
                await tigerTribe.approve(market.address, 1);
                const trx = await market.addListing(
                    1,
                    BigNumber.from(MOCK_AMOUNT_BUSD_BACKED),
                    busdFake.address
                );
                await expect(trx)
                    .to.emit(market, "NewListing")
                    .withArgs(owner.address, 1, MOCK_AMOUNT_BUSD_BACKED, busdFake.address);
                const [returnedCount, ids, sellers, prices, currencies] =
                    await market.getListingSlice(0, 1);
                await expect(returnedCount).to.be.eq(1);
                await expect(ids[0]).to.be.eq(1);
                await expect(sellers[0]).to.be.eq(owner.address);
                await expect(prices[0]).to.be.eq(BigNumber.from(MOCK_AMOUNT_BUSD_BACKED));
                await expect(currencies[0]).to.be.eq(busdFake.address);
            });

            it("adding successfully with BNB currency", async () => {
                await tigerTribe.approve(market.address, 1);
                const trx = await market.addListing(
                    1,
                    BigNumber.from(MOCK_AMOUNT_BUSD_BACKED),
                    BNB
                );
                await expect(trx)
                    .to.emit(market, "NewListing")
                    .withArgs(owner.address, 1, MOCK_AMOUNT_BUSD_BACKED, BNB);
                const [returnedCount, ids, sellers, prices, currencies] =
                    await market.getListingSlice(0, 1);
                await expect(returnedCount).to.be.eq(1);
                await expect(ids[0]).to.be.eq(1);
                await expect(sellers[0]).to.be.eq(owner.address);
                await expect(prices[0]).to.be.eq(BigNumber.from(MOCK_AMOUNT_BUSD_BACKED));
                await expect(currencies[0]).to.be.eq(BNB);
            });
        });

        describe("changeListingPrice", () => {
            it("change successfully with ECR20 currency", async () => {
                await tigerTribe.approve(market.address, 1);
                await market.addListing(
                    1,
                    BigNumber.from(MOCK_AMOUNT_BUSD_BACKED),
                    busdFake.address
                );
                const trx = await market.changeListingPrice(
                    1,
                    BigNumber.from(MOCK_AMOUNT_BUSD),
                    busdFake.address
                );

                await expect(trx)
                    .to.emit(market, "ListingPriceChange")
                    .withArgs(owner.address, 1, MOCK_AMOUNT_BUSD, busdFake.address);

                const [returnedCount, ids, sellers, prices, currencies] =
                    await market.getListingSlice(0, 1);
                await expect(returnedCount).to.be.eq(1);
                await expect(ids[0]).to.be.eq(1);
                await expect(sellers[0]).to.be.eq(owner.address);
                await expect(prices[0]).to.be.eq(BigNumber.from(MOCK_AMOUNT_BUSD));
                await expect(currencies[0]).to.be.eq(busdFake.address);
            });

            it("change successfully with BNB currency", async () => {
                await tigerTribe.approve(market.address, 1);
                await market.addListing(
                    1,
                    BigNumber.from(MOCK_AMOUNT_BUSD_BACKED),
                    busdFake.address
                );
                const trx = await market.changeListingPrice(
                    1,
                    BigNumber.from(MOCK_AMOUNT_BUSD),
                    BNB
                );

                await expect(trx)
                    .to.emit(market, "ListingPriceChange")
                    .withArgs(owner.address, 1, MOCK_AMOUNT_BUSD, BNB);

                const [returnedCount, ids, sellers, prices, currencies] =
                    await market.getListingSlice(0, 1);
                await expect(returnedCount).to.be.eq(1);
                await expect(ids[0]).to.be.eq(1);
                await expect(sellers[0]).to.be.eq(owner.address);
                await expect(prices[0]).to.be.eq(BigNumber.from(MOCK_AMOUNT_BUSD));
                await expect(currencies[0]).to.be.eq(BNB);
            });
        });

        describe("cancelListing", () => {
            it("cancel successfully", async () => {
                await tigerTribe.approve(market.address, 1);
                await market.addListing(
                    1,
                    BigNumber.from(MOCK_AMOUNT_BUSD_BACKED),
                    busdFake.address
                );
                await expect(await tigerTribe.ownerOf(1)).to.be.eq(market.address);

                const trx = await market.cancelListing(1);
                await expect(await tigerTribe.ownerOf(1)).to.be.eq(owner.address);

                await expect(trx).to.emit(market, "CancelledListing").withArgs(owner.address, 1);

                const [returnedCount] = await market.getListingSlice(0, 1);
                await expect(returnedCount).to.be.eq(0);
            });
        });

        describe("purchaseListing", () => {
            it("purchaseListing successfully with ECR20 currency", async () => {
                const mockAmount = BigNumber.from(MOCK_AMOUNT_BUSD_BACKED);
                const taxAmount = mockAmount.mul(BigNumber.from(10)).div(BigNumber.from(1000));
                const finalPrice = mockAmount.sub(taxAmount);

                await tigerTribe.approve(market.address, 1);
                await market.addListing(1, mockAmount, busdFake.address);
                await busdFake.connect(tester).approve(market.address, mockAmount);

                const trx = await market.connect(tester).purchaseListing(1);

                await expect(trx)
                    .to.emit(market, "PurchasedListing")
                    .withArgs(tester.address, owner.address, 1, mockAmount, busdFake.address);

                await expect(await busdFake.balanceOf(other.address)).to.be.eq(taxAmount);
                await expect(await busdFake.balanceOf(tester.address)).to.be.eq(
                    BigNumber.from(BUSD_INITIAL_MINT).sub(mockAmount)
                );
                await expect(await busdFake.balanceOf(owner.address)).to.be.eq(
                    finalPrice.add(BigNumber.from(BUSD_INITIAL_MINT))
                );

                await expect(await tigerTribe.ownerOf(1)).to.be.eq(tester.address);

                const [returnedCount] = await market.getListingSlice(0, 1);
                await expect(returnedCount).to.be.eq(0);
            });

            it("purchaseListing successfully with BNB currency", async () => {
                const otherBalanceInWei = await provider.getBalance(other.address);
                const testerBalanceInWeiBefore = await provider.getBalance(tester.address);
                const mockAmount = BigNumber.from(MOCK_AMOUNT_BUSD_BACKED);
                const taxAmount = mockAmount.mul(BigNumber.from(10)).div(BigNumber.from(1000));
                const finalPrice = mockAmount.sub(taxAmount);

                await tigerTribe.approve(market.address, 1);
                await market.addListing(1, mockAmount, BNB);

                const ownerBalanceInWeiBefore = await provider.getBalance(owner.address);

                const options = { value: MOCK_AMOUNT_BUSD_BACKED };
                const trx = await market.connect(tester).purchaseListing(1, options);
                await expect(trx)
                    .to.emit(market, "PurchasedListing")
                    .withArgs(tester.address, owner.address, 1, mockAmount, BNB);

                const receipt = await trx.wait();
                const gasUsed = receipt.cumulativeGasUsed.mul(receipt.effectiveGasPrice);

                const testerBalanceInWeiAfter = await provider.getBalance(tester.address);

                await expect(testerBalanceInWeiAfter).to.be.eq(
                    testerBalanceInWeiBefore.sub(gasUsed).sub(mockAmount)
                );

                await expect(await provider.getBalance(other.address)).to.be.eq(
                    otherBalanceInWei.add(taxAmount)
                );

                await expect(await provider.getBalance(owner.address)).to.be.eq(
                    ownerBalanceInWeiBefore.add(finalPrice)
                );

                await expect(await tigerTribe.ownerOf(1)).to.be.eq(tester.address);

                const [returnedCount] = await market.getListingSlice(0, 1);
                await expect(returnedCount).to.be.eq(0);
            });
        });
    });
});
