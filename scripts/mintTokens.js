const { ethers } = require("hardhat");
const { ADDRESSES } = require("./constants");
const fs = require("fs");
const path = require("path");

const FROM_ID = 1;
const TO_ID = 999;

const TOKENS_URI = [];
const BACKED_TOKENS_AMOUNT = [];
const TO = "0x8703d1C3cd670dd678ddFacA1e98237f6a342C3C";
async function main() {
    const TigerTribe = await ethers.getContractFactory("TigerTribe");
    const tigerTribe = await TigerTribe.attach(ADDRESSES.tigerTribe);

    for (let index = FROM_ID; index <= TO_ID; index++) {
        const rawdata = fs.readFileSync(path.join(__dirname, `metadata/${index}.json`));
        const metadata = JSON.parse(rawdata);
        TOKENS_URI.push(`${index}.json`);
        BACKED_TOKENS_AMOUNT.push(metadata.amount);
    }
    const pageSize = 100;
    const pageNumber = Math.ceil(TO_ID / pageSize);

    for (let index = 0; index < pageNumber; index++) {
        const tx = await tigerTribe.safeMintTokens(
            TO,
            TOKENS_URI.slice(index * pageSize, (index + 1) * pageSize),
            BACKED_TOKENS_AMOUNT.slice(index * pageSize, (index + 1) * pageSize),
            index * pageSize + 1
        );
        try {
            await tx.wait();
        } catch (error) {
            console.log("from Id", index * pageSize + 1);
        }
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
