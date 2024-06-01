//here goes our deployment script
const hre = require('hardhat');
// const ethers = require('ethers');
const { ethers } = require("hardhat");
// const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    //Get the contract to deploy and deploy 
    const KYC = await hre.ethers.getContractFactory("KYC");
    const kyc = await KYC.deploy();
    await kyc.deployed();

    console.log("KYC deployed to", kyc.address);
}

//We recommend this pattern to be able to use async/await eveverywhere
main() 
    .then(() => process.exit(0))
    .catch((error) => {
        console.log(error);
        process.exit(1);
    });

/**
 * @dev to deploy run :
 * npx hardhat run scripts/deploy.js --network holesky
 * note this should match the network specified in the hardhatconfig 
 */
