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

const hre = require("hardhat");

async function main() {
  // Deploy CarbonCreditToken
  const initialSupply = hre.ethers.utils.parseUnits("1000000", 18);
  const CarbonCreditToken = await hre.ethers.getContractFactory("CarbonCreditToken");
  const carbonToken = await CarbonCreditToken.deploy(initialSupply);
  await carbonToken.deployed();
  console.log("CarbonCreditToken deployed to:", carbonToken.address);

  // Deploy CarbonCreditAuction with CarbonCreditToken address
  const CarbonCreditAuction = await hre.ethers.getContractFactory("CarbonCreditAuction");
  const carbonAuction = await CarbonCreditAuction.deploy(carbonToken.address);
  await carbonAuction.deployed();
  console.log("CarbonCreditAuction deployed to:", carbonAuction.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });