import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS, ADDRESSES } from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    await deploy(CONTRACTS.NFTMarket, {
        from: deployer,
        args: [ADDRESSES.BUSD, deployer],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};

func.tags = ["market"];

export default func;
