import { BigNumber, Contract, Signer, utils } from "ethers";
import hre, { ethers } from "hardhat";
import Ticket from "../artifacts/contracts/Ticket.sol/Ticket.json";

async function run() {
  const factory = await deployment();

  factory.on("NewLottaryCreated", lottery);

  const latestBlockNumber = BigNumber.from(
    await hre.network.provider.send("eth_blockNumber")
  );

  const startBlock = latestBlockNumber.add(1);
  const blockEnd = startBlock.add(500);

  const result = await factory
    .createLottery(
      "Lottary ticket",
      "LT",
      startBlock.toString(),
      blockEnd.toString(),
      ethers.utils.parseEther("0.01"),
      "https://ipfs.io/ipfs/QmRxwABp5reTY446ojFN97RcKbn82mprkkTuedHghsrLV4"
    )
    .catch((c: any) => c);

  if (result.error) {
    console.log(result.reason);
  }
}

let ticketContract: Contract;
let addressToSigner: { [key: string]: Signer } = {};

async function lottery(address: string) {
  console.log("new lottary createrd with address: ", address);

  const [signer1, signer2, signer3, signer4] = await ethers.getSigners();
  addressToSigner[signer1.address] = signer1;
  addressToSigner[signer2.address] = signer2;
  addressToSigner[signer3.address] = signer3;
  addressToSigner[signer4.address] = signer4;

  ticketContract = new hre.ethers.Contract(
    address,
    Ticket.abi,
    hre.ethers.provider
  );

  ticketContract.on("SurpriseWinnerAwarded", surpriseWinner);

  ticketContract.on("FinalWinnerAwarded", finalWinner);

  const ticketPrice = await ticketContract.s_ticketPrice();

  console.log("Ticket bought by ", signer1.address);
  await ticketContract.connect(signer1).buyTicket({ value: ticketPrice });

  console.log("Ticket bought by ", signer2.address);
  await ticketContract.connect(signer2).buyTicket({ value: ticketPrice });

  console.log("Ticket bought by ", signer3.address);
  await ticketContract.connect(signer3).buyTicket({ value: ticketPrice });

  console.log("Ticket bought by ", signer4.address);
  await ticketContract.connect(signer4).buyTicket({ value: ticketPrice });

  console.log("Ticket bought by", signer1.address);
  await ticketContract.connect(signer1).buyTicket({ value: ticketPrice });

  console.log();
  console.log(" ----- ------- -------- ------");
  console.log();

  await ticketContract.connect(signer1).drawSurpriseWinner();

  // wait for 5s because event listener is polling and will skip event
  // https://github.com/NomicFoundation/hardhat/issues/1692#issuecomment-905674692
  await new Promise((resolve) => setTimeout(() => resolve(null), 5000));

  console.log();
  console.log(" ----- ------- -------- ------");
  console.log();

  console.log("Ticket bought by ", signer1.address);
  await ticketContract.connect(signer1).buyTicket({ value: ticketPrice });

  console.log("Ticket bought by ", signer2.address);
  await ticketContract.connect(signer2).buyTicket({ value: ticketPrice });

  console.log("Ticket bought by ", signer3.address);
  await ticketContract.connect(signer3).buyTicket({ value: ticketPrice });

  console.log("Ticket bought by ", signer4.address);
  await ticketContract.connect(signer4).buyTicket({ value: ticketPrice });

  console.log("Ticket bought by ", signer2.address);
  await ticketContract.connect(signer2).buyTicket({ value: ticketPrice });

  console.log();
  console.log(" ----- ------- -------- ------");
  console.log();

  const endBlock: BigNumber = await ticketContract.s_endBlock();
  const latestBlockNumber = BigNumber.from(
    await hre.network.provider.send("eth_blockNumber")
  );

  // progress time till the end of lotttary
  await hre.network.provider.send("hardhat_mine", [
    utils.hexValue(endBlock.sub(latestBlockNumber)),
  ]);

  await ticketContract.connect(signer2).drawFinalWinner();
}

async function deployment() {
  await hre.run("compile"); // We are compiling the contracts using subtask

  const ticket = await ethers.getContractFactory("Ticket");
  const ticketContract = await ticket.deploy();
  await ticketContract.deployed();

  const factory = await ethers.getContractFactory("Factory");
  const factoryContract = await factory.deploy(ticketContract.address);

  await factoryContract.deployed();

  return factoryContract;
}

async function surpriseWinner(ticketId: BigNumber, amount: BigNumber) {
  console.log("Surprise winner drown");
  console.log("surpsise winner wins: ", utils.formatEther(amount), " ETH");
  const winnerAddress = await ticketContract.ownerOf(ticketId);
  console.log("Surprise winner address ", winnerAddress);
  const signer = addressToSigner[winnerAddress];
  console.log(
    "Balance before award: ",
    utils.formatEther(await signer.getBalance())
  );
  await ticketContract.connect(signer).withdrawWinsForTicket(ticketId);
  console.log(
    "Balance after award withdrawn: ",
    utils.formatEther(await signer.getBalance())
  );
}

async function finalWinner(ticketId: BigNumber, amount: BigNumber) {
  console.log("Final winer drown");
  console.log("Final winer wins: ", utils.formatEther(amount), " ETH");
  const winnerAddress = await ticketContract.ownerOf(ticketId);
  console.log("Final winner address ", winnerAddress);

  const signer = addressToSigner[winnerAddress];

  console.log(
    "Balance before award: ",
    utils.formatEther(await signer.getBalance())
  );
  await ticketContract.connect(signer).withdrawWinsForTicket(ticketId);
  console.log(
    "Balance after award withdrawn: ",
    utils.formatEther(await signer.getBalance())
  );
}

run();
