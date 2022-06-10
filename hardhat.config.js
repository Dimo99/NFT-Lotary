const { ethers } = require("ethers");
const { task } = require("hardhat/config");

require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("dotenv").config();

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

    const factory = await hre.ethers.getContractFactory("LottaryFactory");
    const factoryContract = await factory.deploy(ticketContract.address);

    console.log("Waiting for Factory deployment...");
    await factoryContract.deployed();

    console.log("Factory contract address: ", factoryContract.address);
    console.log("Done!");
  }
);

task("verify-contracts", "Verify").setAction(
  async (taskArguments, hre, runSuper) => {
    await hre.run("verify:verify", {
      address: "0x3652600729f124a26A55a40aA7c9578c0b82f935",
      constructorArguments: [],
    });
    await hre.run("verify:verify", {
      address:"0xA86A87B0102272CD144c95068559CF484C0DbfF4",
      constructorArguments: ["0x3652600729f124a26A55a40aA7c9578c0b82f935"],
    });
  }
);

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  networks: {
    ropsten: {
      url: process.env.URI,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  solidity: "0.8.9",
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY
  }
};
