// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.19",
  networks: {
    hardhat: {
      chainId: 1337
    },
    alfajores: {
      url: process.env.CELO_ALFAJORES_URL || "https://alfajores-forno.celo-testnet.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 44787
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};

// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const Auction = await hre.ethers.getContractFactory("Auction");
  
  // Example parameters
  const biddingTime = 7 * 24 * 60 * 60; // 7 days in seconds
  const carbonCreditAmount = hre.ethers.parseEther("1"); // 1 CELO worth of carbon credits
  const maxBidAmount = hre.ethers.parseEther("10"); // 10 CELO maximum bid
  const minBidIncrement = 500; // 5% minimum bid increment
  
  const auction = await Auction.deploy(
    biddingTime,
    carbonCreditAmount,
    maxBidAmount,
    minBidIncrement,
    deployer.address
  );

  await auction.waitForDeployment();
  const address = await auction.getAddress();
  
  console.log("Auction deployed to:", address);
  
  // Verify contract on testnet
  if (network.name === "alfajores") {
    console.log("Verifying contract...");
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: [
        biddingTime,
        carbonCreditAmount,
        maxBidAmount,
        minBidIncrement,
        deployer.address
      ],
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// test/Auction.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Auction", function () {
  let Auction;
  let auction;
  let owner;
  let addr1;
  let addr2;
  let auctionCreator;
  
  // Test parameters
  const biddingTime = 7 * 24 * 60 * 60; // 7 days
  const carbonCreditAmount = ethers.parseEther("1");
  const maxBidAmount = ethers.parseEther("10");
  const minBidIncrement = 500; // 5%
  
  beforeEach(async function () {
    [owner, addr1, addr2, auctionCreator] = await ethers.getSigners();
    
    Auction = await ethers.getContractFactory("Auction");
    auction = await Auction.deploy(
      biddingTime,
      carbonCreditAmount,
      maxBidAmount,
      minBidIncrement,
      auctionCreator.address
    );
  });

  describe("Deployment", function () {
    it("Should set the correct auction parameters", async function () {
      expect(await auction.auctionCreator()).to.equal(auctionCreator.address);
      expect(await auction.carbonCreditAmount()).to.equal(carbonCreditAmount);
      expect(await auction.maxBidAmount()).to.equal(maxBidAmount);
      expect(await auction.minBidIncrement()).to.equal(minBidIncrement);
    });
  });

  describe("Bidding", function () {
    it("Should accept valid bids", async function () {
      const bidAmount = ethers.parseEther("2");
      await auction.connect(addr1).bid({ value: bidAmount });
      expect(await auction.highestBidder()).to.equal(addr1.address);
      expect(await auction.highestBid()).to.equal(bidAmount);
    });

    it("Should reject bids below carbonCreditAmount", async function () {
      const lowBidAmount = ethers.parseEther("0.5");
      await expect(
        auction.connect(addr1).bid({ value: lowBidAmount })
      ).to.be.revertedWith("Bid amount too low.");
    });

    it("Should reject bids above maxBidAmount", async function () {
      const highBidAmount = ethers.parseEther("11");
      await expect(
        auction.connect(addr1).bid({ value: highBidAmount })
      ).to.be.revertedWith("Bid amount exceeds maximum limit.");
    });

    it("Should enforce minimum bid increment", async function () {
      // First bid
      await auction.connect(addr1).bid({ value: ethers.parseEther("2") });
      
      // Second bid with insufficient increment
      const smallIncrementBid = ethers.parseEther("2.09"); // Less than 5% increase
      await expect(
        auction.connect(addr2).bid({ value: smallIncrementBid })
      ).to.be.revertedWith("Bid not high enough.");
      
      // Valid bid with sufficient increment
      const validIncrementBid = ethers.parseEther("2.1"); // 5% increase
      await auction.connect(addr2).bid({ value: validIncrementBid });
      expect(await auction.highestBidder()).to.equal(addr2.address);
    });
  });

  describe("Withdrawal", function () {
    it("Should allow previous bidders to withdraw", async function () {
      // First bid
      await auction.connect(addr1).bid({ value: ethers.parseEther("2") });
      
      // Second bid
      await auction.connect(addr2).bid({ value: ethers.parseEther("3") });
      
      // Check withdrawal
      const initialBalance = await ethers.provider.getBalance(addr1.address);
      await auction.connect(addr1).withdraw();
      const finalBalance = await ethers.provider.getBalance(addr1.address);
      
      expect(finalBalance - initialBalance).to.be.closeTo(
        ethers.parseEther("2"),
        ethers.parseEther("0.01") // Allow for gas costs
      );
    });
  });

  describe("Auction End", function () {
    it("Should not allow ending before time", async function () {
      await expect(auction.auctionEnd()).to.be.revertedWith(
        "Auction not yet ended."
      );
    });

    it("Should transfer funds to auction creator on end", async function () {
      // Place a bid
      await auction.connect(addr1).bid({ value: ethers.parseEther("2") });
      
      // Advance time to end of auction
      await time.increase(biddingTime + 1);
      
      // Check creator balance before and after
      const initialBalance = await ethers.provider.getBalance(auctionCreator.address);
      await auction.auctionEnd();
      const finalBalance = await ethers.provider.getBalance(auctionCreator.address);
      
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("2"));
    });

    it("Should not allow ending twice", async function () {
      await auction.connect(addr1).bid({ value: ethers.parseEther("2") });
      await time.increase(biddingTime + 1);
      await auction.auctionEnd();
      
      await expect(auction.auctionEnd()).to.be.revertedWith(
        "auctionEnd already called."
      );
    });
  });
});

// .env
PRIVATE_KEY=your_private_key_here
