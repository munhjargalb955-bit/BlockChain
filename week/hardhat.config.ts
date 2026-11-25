import hardhatToolboxMochaEthers
  from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

import {
  configVariable,
  defineConfig
} from "hardhat/config";

export default defineConfig({

  plugins: [
    hardhatToolboxMochaEthers
  ],

  solidity: {
    version: "0.8.34",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },

  networks: {

    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
      chainId: 31338
    },

    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
      chainId: 31338
    },

    sepolia: {
      type: "http",
      chainType: "l1",
      chainId: 11155111,
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [
        configVariable("SEPOLIA_PRIVATE_KEY")
      ]
    }
  },

  test: {
    mocha: {
      timeout: 40_000
    }
  }
});
