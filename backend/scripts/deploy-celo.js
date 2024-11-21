// scripts/deploy-celo.js
const { ethers } = require("hardhat");

async function main() {
  // Get network config
  const provider = new ethers.JsonRpcProvider("https://alfajores-forno.celo-testnet.org");
  const network = await provider.getNetwork();
  console.log("Deploying to Celo Alfajores, ChainId:", network.chainId);

  const [deployer] = await ethers.getSigners();
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Deploying with address:", deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "CELO");

  // Deploy the contract
  const Auction = await ethers.getContractFactory("Auction");
  
  // Convert auction parameters to CELO values
  const biddingTime = 7 * 24 * 60 * 60; // 7 days in seconds
  const carbonCreditAmount = ethers.parseEther("0.1"); // 0.1 CELO minimum
  const maxBidAmount = ethers.parseEther("1"); // 1 CELO maximum
  const minBidIncrement = 500; // 5% minimum increment
  
  console.log("Starting deployment...");
  const auction = await Auction.deploy(
    biddingTime,
    carbonCreditAmount,
    maxBidAmount,
    minBidIncrement,
    deployer.address,
    {
      gasPrice: ethers.parseUnits("2", "gwei")
    }
  );

  await auction.waitForDeployment();
  const address = await auction.getAddress();
  
  console.log("Auction deployed to:", address);
  console.log("Deployment transaction:", auction.deploymentTransaction().hash);

  // Verify the contract
  console.log("Waiting for blocks to be mined...");
  await auction.deploymentTransaction().wait(5); // Wait for 5 block confirmations

  console.log("Verifying contract on Celoscan...");
  try {
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
    console.log("Contract verified successfully");
  } catch (error) {
    console.error("Verification error:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
