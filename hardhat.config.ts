import { ethers } from "ethers";
import { HardhatUserConfig, task } from "hardhat/config";

import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";
dotenv.config();

task("deploy", "Deploys contract on a provided network").setAction(
  async (taskArguments, hre, runSuper) => {
    await hre.run("compile"); // We are compiling the contracts using subtask
    const [deployer] = await hre.ethers.getSigners(); // We are getting the deployer

    console.log("Deploying contracts with the account:", deployer.address); // We are printing the address of the deployer
    console.log("Account balance:", (await deployer.getBalance()).toString()); // We are printing the account balance

    const ticket = await hre.ethers.getContractFactory("Ticket");
    const ticketContract = await ticket.deploy();
    console.log("Waiting for Ticket deployment...");
    await ticketContract.deployed();

    console.log("Ticket contract address: ", ticketContract.address);

    const factory = await hre.ethers.getContractFactory("LotteryFactory");
    const factoryContract = await factory.deploy(ticketContract.address);

    console.log("Waiting for Factory deployment...");
    await factoryContract.deployed();

    console.log("Factory contract address: ", factoryContract.address);
    console.log("Done!");
  }
);

task("verify-contracts", "Verify")
.addParam("ticket", "The address of the Ticket logic contract")
.addParam("factory", "The address of the Factory contract")
.setAction(
  async (taskArguments, hre, runSuper) => {
    await hre.run("verify:verify", {
      address: taskArguments.ticket,
      constructorArguments: [],
    });
    await hre.run("verify:verify", {
      address: taskArguments.factory,
      constructorArguments: [taskArguments.ticket],
    });
  }
);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  }
};

export default config;
