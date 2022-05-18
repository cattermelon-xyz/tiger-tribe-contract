import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS, BASE_URI } from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    await deploy(CONTRACTS.tigerTribe, {
        from: deployer,
        args: [BASE_URI],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};

func.tags = ["nft"];

export default func;
