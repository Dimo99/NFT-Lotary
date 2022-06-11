import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";

describe("Factory tests", () => {
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let factory: Contract;

  beforeEach(async () => {
    [owner, addr1] = await ethers.getSigners();

    const ticket = await ethers.getContractFactory("Ticket");
    const ticketContract = await ticket.deploy();

    const Factory = await ethers.getContractFactory("Factory");
    factory = await Factory.deploy(ticketContract.address);
  });

  describe("Test create lottery", () => {
    it("Should fail when not the owner tries to create a lottery", async () => {
      const tx = factory
        .connect(addr1)
        .createLottery(
          "Lottery name",
          "LT",
          1,
          3,
          parseEther("0.01"),
          "https://ipfs.io/ipfs/QmRxwABp5reTY446ojFN97RcKbn82mprkkTuedHghsrLV4"
        );

      await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail when start block is in the past", async () => {
      const tx = factory
        .connect(owner)
        .createLottery(
          "Lottery name",
          "LT",
          0,
          30,
          parseEther("0.01"),
          "https://ipfs.io/ipfs/QmRxwABp5reTY446ojFN97RcKbn82mprkkTuedHghsrLV4?filename=metadata.json"
        );

      await expect(tx).to.be.revertedWith("StartBlockShouldNotBeInThePast()");
    });

    it("Should fail when end block is before start block", async () => {
      const blockNumber = (await ethers.provider.getBlockNumber()) + 1;
      const tx = factory
        .connect(owner)
        .createLottery(
          "Lottery name",
          "LT",
          blockNumber,
          blockNumber - 1,
          parseEther("0.01"),
          "https://ipfs.io/ipfs/QmRxwABp5reTY446ojFN97RcKbn82mprkkTuedHghsrLV4?filename=metadata.json"
        );

      await expect(tx).to.be.revertedWith(
        "TheEndBlockShouldBeLatterThanTheStartBlock()"
      );
    });

    it("Should fail when end block is equal to start block", async () => {
      const blockNumber = (await ethers.provider.getBlockNumber()) + 1;
      const tx = factory
        .connect(owner)
        .createLottery(
          "Lottery name",
          "LT",
          blockNumber,
          blockNumber,
          parseEther("0.01"),
          "https://ipfs.io/ipfs/QmRxwABp5reTY446ojFN97RcKbn82mprkkTuedHghsrLV4?filename=metadata.json"
        );

      await expect(tx).to.be.revertedWith(
        "TheEndBlockShouldBeLatterThanTheStartBlock()"
      );
    });

    it("Should fail when ticket price is zero", async () => {
      const blockNumber = (await ethers.provider.getBlockNumber()) + 1;
      const tx = factory
        .connect(owner)
        .createLottery(
          "Lottery name",
          "LT",
          blockNumber,
          blockNumber + 100,
          parseEther("0"),
          "https://ipfs.io/ipfs/QmRxwABp5reTY446ojFN97RcKbn82mprkkTuedHghsrLV4?filename=metadata.json"
        );

      await expect(tx).to.be.revertedWith("TicketPriceMustBeBiggerThanZero()");
    });

    it("Should create a lottery when called by owner", async () => {
      const blockNumber = (await ethers.provider.getBlockNumber()) + 1;
      const tx = factory
        .connect(owner)
        .createLottery(
          "Lottery name",
          "LT",
          blockNumber,
          blockNumber + 100,
          parseEther("0.01"),
          "https://ipfs.io/ipfs/QmRxwABp5reTY446ojFN97RcKbn82mprkkTuedHghsrLV4?filename=metadata.json"
        );

      await expect(tx).to.emit(factory, "NewLottaryCreated");
    });
  });
});
