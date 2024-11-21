// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();


module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    alfajores: {
      url: process.env.CELO_ALFAJORES_URL || "https://alfajores-forno.celo-testnet.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 44787,
      gasPrice: 2000000000, // 2 gwei
    },
    alfgores: {
      url: "https://testnet-api.algoexplorer.io" || process.env.ALFAJORES_RPC_URL,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    }
  },
  etherscan: {
    apiKey: {
      alfajores: process.env.CELOSCAN_API_KEY
    },
    customChains: [
      {
        network: "alfajores",
        chainId: 44787,
        urls: {
          apiURL: "https://api-alfajores.celoscan.io/api",
          browserURL: "https://alfajores.celoscan.io/"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  // ipfs: {
  //   gateway: "https://ipfs.io",
  //   projectId: IPFS_PROJECT_ID,
  //   projectSecret: IPFS_PROJECT_SECRET,
  // }
};
