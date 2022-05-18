/* eslint-disable camelcase */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import { ethers, network } from "hardhat";
import { MockContract, MockContractFactory, smock } from "@defi-wonderland/smock";
// eslint-disable-next-line node/no-missing-import
import {
    TigerTribe,
    TigerTribe__factory,
    MockERC20,
    MockERC20__factory,
    MockHecta,
    MockHecta__factory,
} from "../typechain";
import { BigNumber } from "ethers";

chai.use(smock.matchers);

const ZERO_ADDRESS = ethers.utils.getAddress("0x0000000000000000000000000000000000000000");

describe("TigerTribe", () => {
    let owner: SignerWithAddress;
    let other: SignerWithAddress;
    let tigerTribe: TigerTribe;
    let busdFake: MockContract<MockERC20>;
    let erc20Factory: MockContractFactory<MockERC20__factory>;
    let mockHecta: MockHecta;

    const NAME = "Hectagon Tiger Tribe";
    const SYMBOL = "HTT";

    const BASE_URI = "https://nft.hectagon.finance/";
    const NEW_BASE_URI = "https://nft.hectagon.finance/v2/";

    const NOW = Math.floor(Date.now() / 1000);
    const ONE_DAY_IN_TIMESTAMP = 86400;
    const TWO_DAYS_IN_TIMESTAMP = 172800;

    const MOCK_AMOUNT_BUSD_BACKED = "10000000000000000000"; // ~ 10
    const MOCK_URI_TOKEN = "example.json";
    const MOCK_NEW_URI_TOKEN = "example1.json";

    const MOCK_WITHDRAW_AMOUNT = "10000000000000000000"; // ~10

    const HECTA_NAME = "Hectagon";
    const HECTA_SYMBOL = "HECTA";
    const HECTA_INITIAL_MINT = "100000000000"; // ~100

    const BUSD_NAME = "busdERC20";
    const BUSD_SYMBOL = "BUSD";
    const BUSD_INITIAL_MINT = "100000000000000000000"; // ~100

    const TOKENS_URI = [MOCK_URI_TOKEN, MOCK_URI_TOKEN];
    const BACKED_TOKENS_AMOUNT = [MOCK_AMOUNT_BUSD_BACKED, MOCK_AMOUNT_BUSD_BACKED];
    beforeEach(async () => {
        [owner, other] = await ethers.getSigners();

        tigerTribe = await new TigerTribe__factory(owner).deploy(BASE_URI);

        erc20Factory = await smock.mock("MockERC20");
        busdFake = await erc20Factory.deploy(BUSD_NAME, BUSD_SYMBOL);
        await busdFake.mint(owner.address, BUSD_INITIAL_MINT);
        await busdFake.mint(other.address, BUSD_INITIAL_MINT);
        await busdFake.mint(tigerTribe.address, BUSD_INITIAL_MINT);
    });

    describe("base-contract", () => {
        describe("constructed", () => {
            it("can be constructed", async () => {
                expect(await tigerTribe.name()).to.equal(NAME);
                expect(await tigerTribe.symbol()).to.equal(SYMBOL);
            });
        });
        describe("getCurrentCounter", () => {
            it("can be get current counter", async () => {
                expect(await tigerTribe.getCurrentCounter()).to.equal(1);
            });
        });

        describe("setBaseURI", () => {
            it("can set base uri by owner contract", async () => {
                await tigerTribe.setBaseURI(NEW_BASE_URI);
                expect(await tigerTribe.baseURI()).to.equal(NEW_BASE_URI);
            });

            it("can set base uri by only owner contract", async () => {
                await expect(tigerTribe.connect(other).setBaseURI(NEW_BASE_URI)).to.be.reverted;
            });
        });

        describe("withdraw", () => {
            beforeEach(async () => {
                await busdFake.mint(tigerTribe.address, BUSD_INITIAL_MINT);
            });

            it("can withdraw by owner contract", async () => {
                const busdBalanceBeforeWithdraw = await busdFake.balanceOf(owner.address);

                await tigerTribe.withdraw(busdFake.address, MOCK_WITHDRAW_AMOUNT);

                const busdBalanceAfterWithdraw = await busdFake.balanceOf(owner.address);

                expect(BigNumber.from(MOCK_WITHDRAW_AMOUNT)).to.equal(
                    busdBalanceAfterWithdraw.sub(busdBalanceBeforeWithdraw)
                );
            });

            it("can emits after withdraw", async () => {
                expect(await tigerTribe.withdraw(busdFake.address, MOCK_WITHDRAW_AMOUNT))
                    .to.emit(tigerTribe, "Withdraw")
                    .withArgs(busdFake.address, MOCK_WITHDRAW_AMOUNT);
            });

            it("can withdraw only by owner contract", async () => {
                await expect(
                    tigerTribe.connect(other).withdraw(busdFake.address, MOCK_WITHDRAW_AMOUNT)
                ).to.be.reverted;
            });
        });
    });

    describe("backed-token", () => {
        beforeEach(async () => {
            await tigerTribe.setBackedToken(busdFake.address);
        });

        describe("setBackedToken", () => {
            it("can set backed token by only owner contract", async () => {
                await expect(tigerTribe.connect(other).setBackedToken(busdFake.address)).to.be
                    .reverted;
            });

            it("cannot set to zero adress", async () => {
                await expect(tigerTribe.setBackedToken(ZERO_ADDRESS)).to.be.reverted;
            });
        });
    });

    describe("mint-redeem", () => {
        beforeEach(async () => {
            await tigerTribe.setBackedToken(busdFake.address);
            await tigerTribe.setRedeemableAt((NOW + ONE_DAY_IN_TIMESTAMP).toString());
        });

        describe("safeMint", () => {
            it("can mint by owner contract", async () => {
                await tigerTribe.safeMint(
                    owner.address,
                    MOCK_URI_TOKEN,
                    BigNumber.from(MOCK_AMOUNT_BUSD_BACKED),
                    1
                );

                await expect(await tigerTribe.ownerOf(1)).to.equal(owner.address);

                await expect(await tigerTribe.tokenURI(1)).to.equal(BASE_URI + MOCK_URI_TOKEN);

                const backedAmount = await tigerTribe.backedAmounts(1);
                expect(backedAmount).to.equal(MOCK_AMOUNT_BUSD_BACKED);
            });

            it("can mint multiple tokens by owner contract", async () => {
                await tigerTribe.safeMintTokens(owner.address, TOKENS_URI, BACKED_TOKENS_AMOUNT, 1);

                await expect(await tigerTribe.ownerOf(1)).to.equal(owner.address);
                await expect(await tigerTribe.ownerOf(2)).to.equal(owner.address);
            });

            it("can mint to other address by owner contract", async () => {
                await tigerTribe.safeMint(
                    other.address,
                    MOCK_URI_TOKEN,
                    MOCK_AMOUNT_BUSD_BACKED,
                    1
                );

                await expect(await tigerTribe.ownerOf(1)).to.equal(other.address);
            });

            it("can not mint to zero address", async () => {
                await expect(
                    tigerTribe.safeMint(ZERO_ADDRESS, MOCK_URI_TOKEN, MOCK_AMOUNT_BUSD_BACKED, 1)
                ).to.be.reverted;
            });

            it("can mint only by owner contract", async () => {
                await expect(
                    tigerTribe
                        .connect(other)
                        .safeMint(owner.address, MOCK_URI_TOKEN, MOCK_AMOUNT_BUSD_BACKED, 1)
                ).to.be.reverted;
            });

            it("can mint multiple tokens only by owner contract", async () => {
                await expect(
                    tigerTribe
                        .connect(other)
                        .safeMintTokens(owner.address, TOKENS_URI, BACKED_TOKENS_AMOUNT, 1)
                ).to.be.reverted;
            });

            it("can not mint multiple tokens if arrays length not equal", async () => {
                await expect(
                    tigerTribe
                        .connect(other)
                        .safeMintTokens(
                            owner.address,
                            TOKENS_URI,
                            [...BACKED_TOKENS_AMOUNT, MOCK_AMOUNT_BUSD_BACKED],
                            1
                        )
                ).to.be.reverted;
            });

            it("can not mint if conflict token Id", async () => {
                await expect(
                    tigerTribe.safeMint(owner.address, MOCK_URI_TOKEN, MOCK_AMOUNT_BUSD_BACKED, 0)
                ).to.be.reverted;
            });

            it("can not mint multiple if from token Id conflict", async () => {
                await expect(
                    tigerTribe.safeMintTokens(
                        owner.address,
                        TOKENS_URI,
                        [...BACKED_TOKENS_AMOUNT, MOCK_AMOUNT_BUSD_BACKED],
                        1
                    )
                ).to.be.reverted;
            });

            it("can not mint over MAX_TOTAL_SUPPLY", async () => {
                const tokenUri = new Array(9).fill(new Array(111).fill("uri"));
                const backedTokenAmount = new Array(9).fill(new Array(111).fill("100"));
                for (let index = 0; index < tokenUri.length; index++) {
                    const tx = await tigerTribe.safeMintTokens(
                        owner.address,
                        tokenUri[index],
                        backedTokenAmount[index],
                        111 * index + 1
                    );
                    await tx.wait();
                }
                await expect(
                    tigerTribe.safeMint(owner.address, "uri", "100", 1000)
                ).to.be.revertedWith("Error: There are no more tokens left to be minted!");
            });

            describe("setTokensUri", () => {
                it("can set multiple tokens uri by owner", async () => {
                    await tigerTribe.safeMintTokens(
                        owner.address,
                        TOKENS_URI,
                        BACKED_TOKENS_AMOUNT,
                        1
                    );

                    await tigerTribe.setTokensUri(
                        ["1", "2"],
                        [MOCK_NEW_URI_TOKEN, MOCK_NEW_URI_TOKEN]
                    );

                    expect(await tigerTribe.tokenURI(1)).to.equal(BASE_URI + MOCK_NEW_URI_TOKEN);
                    expect(await tigerTribe.tokenURI(2)).to.equal(BASE_URI + MOCK_NEW_URI_TOKEN);
                });

                it("can set multiple tokens uri only by owner", async () => {
                    await expect(
                        tigerTribe
                            .connect(other)
                            .safeMintTokens(owner.address, TOKENS_URI, BACKED_TOKENS_AMOUNT, 1)
                    ).to.be.reverted;
                });
            });

            describe("getTokenIdsPage", () => {
                it("can get token page", async () => {
                    await tigerTribe.safeMintTokens(
                        owner.address,
                        TOKENS_URI,
                        BACKED_TOKENS_AMOUNT,
                        1
                    );

                    await tigerTribe.setTokensUri(
                        ["1", "2"],
                        [MOCK_NEW_URI_TOKEN, MOCK_NEW_URI_TOKEN]
                    );

                    const ids = await tigerTribe.getTokenIdsPage(owner.address, "0", "10");

                    expect(ids[0].toString()).to.equal("1");
                    expect(ids[1].toString()).to.equal("2");
                    expect(ids[2].toString()).to.equal("0");
                });
            });
        });

        describe("redeem", () => {
            it("can not redeem before redeemable", async () => {
                await tigerTribe.safeMint(
                    owner.address,
                    MOCK_URI_TOKEN,
                    MOCK_AMOUNT_BUSD_BACKED,
                    1
                );

                await expect(tigerTribe.redeem("1")).to.be.revertedWith("Not redeemable!");
            });

            it("can redeem only by owner token", async () => {
                await tigerTribe.safeMint(
                    owner.address,
                    MOCK_URI_TOKEN,
                    MOCK_AMOUNT_BUSD_BACKED,
                    1
                );

                await network.provider.send("evm_increaseTime", [TWO_DAYS_IN_TIMESTAMP]);

                await tigerTribe.approve(tigerTribe.address, "1");
                await expect(tigerTribe.connect(other).redeem("1")).to.be.reverted;
            });

            it("can redeem by owner token", async () => {
                await tigerTribe.safeMint(
                    owner.address,
                    MOCK_URI_TOKEN,
                    MOCK_AMOUNT_BUSD_BACKED,
                    1
                );

                const busdBalanceBeforeRedeem = await busdFake.balanceOf(owner.address);

                await network.provider.send("evm_increaseTime", [TWO_DAYS_IN_TIMESTAMP]);

                await tigerTribe.approve(tigerTribe.address, "1");
                await tigerTribe.redeem("1");

                const busdBalanceAfteredeem = await busdFake.balanceOf(owner.address);

                expect(busdBalanceAfteredeem.sub(busdBalanceBeforeRedeem)).to.equal(
                    BigNumber.from(MOCK_AMOUNT_BUSD_BACKED)
                );
            });

            it("can emits after redeem", async () => {
                await tigerTribe.safeMint(
                    owner.address,
                    MOCK_URI_TOKEN,
                    MOCK_AMOUNT_BUSD_BACKED,
                    1
                );

                await network.provider.send("evm_increaseTime", [TWO_DAYS_IN_TIMESTAMP]);

                await tigerTribe.approve(tigerTribe.address, "1");

                expect(await tigerTribe.redeem("1"))
                    .to.emit(tigerTribe, "Redeem")
                    .withArgs(1, owner.address);
            });

            it("will burn token after redeem", async () => {
                await tigerTribe.safeMint(
                    owner.address,
                    MOCK_URI_TOKEN,
                    MOCK_AMOUNT_BUSD_BACKED,
                    1
                );

                await network.provider.send("evm_increaseTime", [TWO_DAYS_IN_TIMESTAMP]);

                await tigerTribe.approve(tigerTribe.address, "1");
                await tigerTribe.redeem("1");

                await expect(tigerTribe.ownerOf("1")).to.revertedWith(
                    "ERC721: owner query for nonexistent token"
                );
            });

            it("will redeem correctlly with token have decimal 9", async () => {
                mockHecta = await new MockHecta__factory(owner).deploy(HECTA_NAME, HECTA_SYMBOL);
                await mockHecta.mint(tigerTribe.address, HECTA_INITIAL_MINT); // 100 * 10^9

                await tigerTribe.setBackedToken(mockHecta.address);

                await tigerTribe.safeMint(
                    owner.address,
                    MOCK_URI_TOKEN,
                    MOCK_AMOUNT_BUSD_BACKED, // 10 * 10^18, mint with decimal 18
                    1
                );

                await network.provider.send("evm_increaseTime", [TWO_DAYS_IN_TIMESTAMP]);

                await tigerTribe.approve(tigerTribe.address, "1");
                await tigerTribe.redeem("1");

                const ownerHectaBalanceAfteredeem: BigNumber = await mockHecta.balanceOf(
                    owner.address
                );

                const contractBalanceOwnerAfteredeem: BigNumber = await mockHecta.balanceOf(
                    tigerTribe.address
                );

                expect(BigNumber.from(10 * 10 ** 9)).to.equal(ownerHectaBalanceAfteredeem);
                expect(BigNumber.from(90 * 10 ** 9)).to.equal(contractBalanceOwnerAfteredeem);
            });
        });

        describe("transfer", () => {
            it("can transfer when not pause", async () => {
                await tigerTribe.safeMint(
                    owner.address,
                    MOCK_URI_TOKEN,
                    BigNumber.from(MOCK_AMOUNT_BUSD_BACKED),
                    1
                );

                await tigerTribe.transferFrom(owner.address, other.address, "1");

                expect(await tigerTribe.ownerOf("1")).to.equal(other.address);
            });

            it("can not transfer when pause", async () => {
                await tigerTribe.safeMint(
                    owner.address,
                    MOCK_URI_TOKEN,
                    BigNumber.from(MOCK_AMOUNT_BUSD_BACKED),
                    1
                );

                await tigerTribe.pause();

                await expect(tigerTribe.transferFrom(owner.address, other.address, "1")).to.be
                    .reverted;

                await tigerTribe.unpause();

                await tigerTribe.transferFrom(owner.address, other.address, "1");
            });
        });
    });
});
