// scripts/interact-celo.js
const { ethers } = require("hardhat");

async function main() {
  const AUCTION_ADDRESS = "YOUR_DEPLOYED_CONTRACT_ADDRESS";
  const auction = await ethers.getContractAt("Auction", AUCTION_ADDRESS);

  // Get auction details
  const auctionCreator = await auction.auctionCreator();
  const endTime = await auction.auctionEndTime();
  const highestBid = await auction.highestBid();
  
  console.log("Auction Details:");
  console.log("Creator:", auctionCreator);
  console.log("End Time:", new Date(endTime * 1000).toLocaleString());
  console.log("Highest Bid:", ethers.formatEther(highestBid), "CELO");

  // Place a bid (example)
  const bidAmount = ethers.parseEther("0.2");
  console.log("Placing bid of", ethers.formatEther(bidAmount), "CELO");
  
  const bidTx = await auction.bid({ value: bidAmount });
  await bidTx.wait();
  console.log("Bid placed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });