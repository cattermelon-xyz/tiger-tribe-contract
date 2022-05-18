const { ethers } = require("hardhat");
const { ADDRESSES } = require("../constants");

const SYMBOL = "HECTA";

async function main() {
    const TigerTribe = await ethers.getContractFactory("TigerTribe");
    const tigerTribe = await TigerTribe.attach(ADDRESSES.tigerTribe);
    await tigerTribe.setBackedToken(
        SYMBOL,
        "0x0000000000000000000000000000000000000000",
        Date.now()
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
