import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  // Configure ts-node to use CommonJS
  // @ts-ignore
  "ts-node": {
    transpileOnly: true,
    compilerOptions: {
      module: "commonjs",
    },
  },
  networks: {
    // Flare Mainnet
    flare: {
      url: "https://flare-api.flare.network/ext/C/rpc",
      chainId: 14,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    // Coston2 Testnet
    coston2: {
      url: "https://coston2-api.flare.network/ext/C/rpc",
      chainId: 114,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    // Local Hardhat network
    hardhat: {
      chainId: 31337,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
  // Use separate tsconfig for Hardhat
  // @ts-ignore
  typescript: {
    tsconfig: "./tsconfig.hardhat.json",
  },
};

export default config;
