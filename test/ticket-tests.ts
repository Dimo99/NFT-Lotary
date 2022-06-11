import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  BigNumber,
  BigNumberish,
  Contract,
  ContractReceipt,
  utils,
} from "ethers";
import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";

describe("Ticket tests", () => {
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let factory: Contract;
  let ticket: Contract;
  let startBlock: BigNumberish;
  let endBlock: BigNumberish;
  const ticketPrice: BigNumberish = parseEther("0.01");
  const tokenURI: string =
    "https://ipfs.io/ipfs/QmRxwABp5reTY446ojFN97RcKbn82mprkkTuedHghsrLV4";

  async function moveBlockToStartBlock() {
    const latestBlock = await ethers.provider.getBlockNumber();
    await hre.network.provider.send("hardhat_mine", [
      utils.hexValue(BigNumber.from(startBlock).sub(latestBlock)),
    ]);
  }

  async function moveBlockToEndBlock() {
    const latestBlock = await ethers.provider.getBlockNumber();
    await hre.network.provider.send("hardhat_mine", [
      utils.hexValue(BigNumber.from(endBlock).sub(latestBlock)),
    ]);
  }

  async function moveBlockToBeforeEndBlock() {
    const latestBlock = await ethers.provider.getBlockNumber();
    await hre.network.provider.send("hardhat_mine", [
      utils.hexValue(BigNumber.from(endBlock).sub(latestBlock).sub(1)),
    ]);
  }

  async function doABatchBuy() {
    await ticket.connect(owner).buyTicket({ value: ticketPrice });
    await ticket.connect(addr1).buyTicket({ value: ticketPrice });
    await ticket.connect(addr2).buyTicket({ value: ticketPrice });

    await ticket.connect(owner).buyTicket({ value: ticketPrice });
    await ticket.connect(addr1).buyTicket({ value: ticketPrice });
    await ticket.connect(addr2).buyTicket({ value: ticketPrice });

    await ticket.connect(owner).buyTicket({ value: ticketPrice });
    await ticket.connect(addr1).buyTicket({ value: ticketPrice });
    await ticket.connect(addr2).buyTicket({ value: ticketPrice });
  }

  async function getAward(
    tx: any,
    awardType: "FinalWinnerAwarded" | "SurpriseWinnerAwarded"
  ) {
    const receipt: ContractReceipt = await tx.wait();
    const event = receipt.events?.filter((x) => x.event == awardType)![0]!;
    const ticketId: BigNumber = event.args!["ticketId"];
    const amount: BigNumber = event.args!["amount"];

    return [ticketId, amount];
  }

  beforeEach(async () => {
    await hre.network.provider.request({
      method: "hardhat_reset",
    });

    [owner, addr1, addr2] = await ethers.getSigners();

    const _ticket = await ethers.getContractFactory("Ticket");
    const ticketContract = await _ticket.deploy();

    const Factory = await ethers.getContractFactory("Factory");
    factory = await Factory.deploy(ticketContract.address);

    startBlock = 100;
    endBlock = startBlock + 1000;

    const tx = await factory
      .connect(owner)
      .createLottery(
        "NFT",
        "NFT",
        startBlock,
        endBlock,
        ticketPrice,
        "https://ipfs.io/ipfs/QmRxwABp5reTY446ojFN97RcKbn82mprkkTuedHghsrLV4"
      );

    const receipt: ContractReceipt = await tx.wait();

    const event = receipt.events?.filter(
      (x) => x.event == "NewLottaryCreated"
    )![0]!;

    const address = event.args!["lotteryAddress"];

    ticket = new hre.ethers.Contract(
      address,
      _ticket.interface,
      ethers.provider
    );
  });

  describe("Test initialize", () => {
    it("Should fail when called", async () => {
      const tx = ticket
        .connect(owner)
        .initialize(
          owner.address,
          "Lottery name",
          "LT",
          1,
          3,
          parseEther("0.01"),
          tokenURI
        );

      await expect(tx).to.be.revertedWith(
        "Initializable: contract is already initialized"
      );
    });
  });

  describe("Test buy ticket", () => {
    it("Should fail when current block is before start", async () => {
      const tx = ticket.connect(owner).buyTicket({ value: ticketPrice });

      await expect(tx).to.be.revertedWith("LotteryHasntStarted()");
    });

    it("Should fail when current block is after end", async () => {
      await moveBlockToEndBlock();

      const tx = ticket.connect(owner).buyTicket({ value: ticketPrice });

      await expect(tx).to.be.revertedWith("LotteryHasFinished()");
    });

    it("Should fail when less money are given", async () => {
      await moveBlockToStartBlock();

      const tx = ticket
        .connect(owner)
        .buyTicket({ value: parseEther("0.005") });

      await expect(tx).to.be.revertedWith("NotEnoughMoneyForATicket()");
    });

    it("Should mint ticket when exact amount of money is given", async () => {
      await moveBlockToStartBlock();

      const numberOfTickets: BigNumber = await ticket.s_numberOfTickets();

      const tx = await ticket.connect(addr1).buyTicket({ value: ticketPrice });

      await expect(tx)
        .to.emit(ticket, "Transfer")
        .withArgs(ethers.constants.AddressZero, addr1.address, numberOfTickets);

      expect((await ticket.s_numberOfTickets()).toString()).to.be.eq(
        numberOfTickets.add(1).toString()
      );
      expect(await ticket.ownerOf(numberOfTickets)).to.be.eq(addr1.address);
      expect(await ticket.s_gatheredFunds()).to.be.eq(ticketPrice);
    });

    it("Should mint ticket and return change when more money is given", async () => {
      await moveBlockToStartBlock();

      const numberOfTickets: BigNumber = await ticket.s_numberOfTickets();

      const tx = await ticket
        .connect(addr2)
        .buyTicket({ value: ticketPrice.add(parseEther("1")) });

      await expect(tx)
        .to.emit(ticket, "Transfer")
        .withArgs(ethers.constants.AddressZero, addr1.address, numberOfTickets)
        .to.changeEtherBalance(addr2, `-${ticketPrice.toString()}`);

      expect((await ticket.s_numberOfTickets()).toString()).to.be.eq(
        numberOfTickets.add(1).toString()
      );
      expect(await ticket.ownerOf(numberOfTickets)).to.be.eq(addr2.address);
      expect(await ticket.s_gatheredFunds()).to.be.eq(ticketPrice);
    });
  });

  describe("Test surprise winner", () => {
    it("Should fail if called by non owner", async () => {
      const tx = ticket.connect(addr2).drawSurpriseWinner();

      await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail if called before the start", async () => {
      const tx = ticket.connect(owner).drawSurpriseWinner();
      await expect(tx).to.be.revertedWith("LotteryHasntStarted()");
    });

    it("Should fail if called after the end", async () => {
      await moveBlockToEndBlock();

      const tx = ticket.connect(owner).drawSurpriseWinner();

      await expect(tx).to.be.revertedWith("LotteryHasFinished()");
    });

    it("Should fail if no funds are available for win", async () => {
      await moveBlockToStartBlock();

      const tx = ticket.connect(owner).drawSurpriseWinner();

      await expect(tx).to.be.revertedWith("NoFundsToBeWon()");
    });

    it("Should pick a winner and assign him half the money", async () => {
      await moveBlockToStartBlock();

      await doABatchBuy();

      const tx = await ticket.connect(owner).drawSurpriseWinner();

      expect(tx).to.emit(ticket, "SurpriseWinnerAwarded");

      const [ticketId, amount] = await getAward(tx, "SurpriseWinnerAwarded");

      expect(amount).to.be.eq(ticketPrice.mul(9).div(2));
      expect(await ticket.s_winnersRewards(ticketId)).to.be.eq(amount);
      expect(await ticket.s_gatheredFunds()).to.be.eq(amount);
    });
  });

  describe("Test final winner", () => {
    it("Should fail when called before end block", async () => {
      await moveBlockToStartBlock();

      const tx = ticket.connect(owner).drawFinalWinner();

      await expect(tx).to.be.revertedWith(
        "FinalWinnerCanOnlyBeCalculatedAfterPeriodEnds()"
      );
    });

    it("Should fail when called during end block", async () => {
      await moveBlockToBeforeEndBlock();

      const tx = ticket.connect(owner).drawFinalWinner();

      await expect(tx).to.be.revertedWith(
        "FinalWinnerCanOnlyBeCalculatedAfterPeriodEnds()"
      );
    });

    it("Should fail if no funds are available for win", async () => {
      await moveBlockToEndBlock();

      const tx = ticket.connect(owner).drawFinalWinner();

      await expect(tx).to.be.revertedWith("NoFundsToBeWon()");
    });

    it("Should pick a winner when called after end block and assign him all funds collected", async () => {
      await moveBlockToStartBlock();

      await doABatchBuy();

      await moveBlockToEndBlock();

      const tx = await ticket.connect(addr1).drawFinalWinner();

      expect(tx).to.emit(ticket, "FinalWinnerAwarded");

      const [ticketId, amount] = await getAward(tx, "FinalWinnerAwarded");

      expect(await ticket.s_winnersRewards(ticketId))
        .to.be.eq(amount)
        .to.be.eq(ticketPrice.mul(9));
      expect(await ticket.s_gatheredFunds()).to.be.eq(0);
    });
  });

  describe("Test withdraw wins for ticket", () => {
    it("Should fail when ticket is not a winning one", async () => {
      await moveBlockToStartBlock();

      await doABatchBuy();

      await moveBlockToEndBlock();

      const tx = await ticket.connect(addr1).drawFinalWinner();

      const [finalTickedId] = await getAward(tx, "FinalWinnerAwarded");

      if (finalTickedId.toString() != "0") {
        const tx = ticket.connect(owner).withdrawWinsForTicket(0);

        await expect(tx).to.be.revertedWith("TicketIsNotWinningOne()");
      } else {
        const tx = ticket.connect(owner).withdrawWinsForTicket(1);

        await expect(tx).to.be.revertedWith("TicketIsNotWinningOne()");
      }
    });

    it("Should fail when caller is not a owner and not approved for ticket", async () => {
      await moveBlockToStartBlock();

      await doABatchBuy();

      await moveBlockToEndBlock();

      const tx = await ticket.connect(addr1).drawFinalWinner();

      const [finalTickedId] = await getAward(tx, "FinalWinnerAwarded");

      const arr = [owner, addr1, addr2];
      const notOwner = arr[((finalTickedId.toNumber() % 3) + 1) % 3];

      const withdrawTx = ticket
        .connect(notOwner)
        .withdrawWinsForTicket(finalTickedId);

      await expect(withdrawTx).to.be.revertedWith(
        "YouShouldBeOwnerOrApprovedToSpendTheTicket()"
      );
    });

    it("Should work when caller is approved for ticket", async () => {
      await moveBlockToStartBlock();

      await doABatchBuy();

      await moveBlockToEndBlock();

      const tx = await ticket.connect(addr1).drawFinalWinner();

      const [ticketId, amount] = await getAward(tx, "FinalWinnerAwarded");

      expect(amount).to.be.eq(ticketPrice.mul(9));

      const arr = [owner, addr1, addr2];
      const ownerOfTicket = arr[ticketId.toNumber() % 3];
      const notOwner = arr[((ticketId.toNumber() % 3) + 1) % 3];

      await ticket.connect(ownerOfTicket).approve(notOwner.address, ticketId);

      const withdrawTx = await ticket
        .connect(notOwner)
        .withdrawWinsForTicket(ticketId);

      await expect(withdrawTx).to.changeEtherBalance(notOwner, amount);

      const withdrawTx2 = ticket
        .connect(notOwner)
        .withdrawWinsForTicket(ticketId);

      await expect(withdrawTx2).to.be.revertedWith("TicketIsNotWinningOne()");
    });

    it("Should work when caller is owner of the ticket", async () => {
      await moveBlockToStartBlock();

      await doABatchBuy();

      await moveBlockToEndBlock();

      const tx = await ticket.connect(addr1).drawFinalWinner();

      const [ticketId, amount] = await getAward(tx, "FinalWinnerAwarded");

      expect(amount).to.be.eq(ticketPrice.mul(9));

      const arr = [owner, addr1, addr2];
      let ownerOfTicket = arr[ticketId.toNumber() % 3];

      let withdrawTx = await ticket
        .connect(ownerOfTicket)
        .withdrawWinsForTicket(ticketId.toNumber());

      await expect(withdrawTx).to.changeEtherBalance(ownerOfTicket, amount);
    });
  });

  describe("Test tokenURI", () => {
    it("Should revert when ticket is not existing", async () => {
      const tx = ticket.tokenURI(0);

      await expect(tx).to.be.revertedWith("URIQueryForNonExistantToken()");
    });

    it("Should return uri for ticket", async () => {
      await moveBlockToStartBlock();

      await ticket.connect(owner).buyTicket({ value: ticketPrice });

      const ticketURI = await ticket.tokenURI(0);

      expect(ticketURI).to.be.eq(tokenURI);
    });
  });
});
