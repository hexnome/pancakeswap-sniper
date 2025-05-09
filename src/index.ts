import { ethers } from "ethers"
import fs from "fs"
import { AMOUNT_BNB_TO_SPEND, BSC_RPC_URL, BSC_WSS_URL, ERC20_ABI, get_bsc_factory_abi, get_bsc_router_abi, MAX_GAS_PRICE_GWEI, PANCAKE_FACTORY_ADDRESS, PANCAKE_ROUTER_ADDRESS, PRIORITY_FEE_GWEI, PRIVATE_KEY, SLIPPAGE_PERCENTAGE, TOKEN_CONTRACT_ADDRESS, WBNB_ADDRESS } from "./utils/constants";
import { Wallet } from "web3";

// Initialize provider and wallet
const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
const wsProvider = new ethers.WebSocketProvider(BSC_WSS_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const account = wallet.address;

const ROUTER_ABI = get_bsc_router_abi();
const FACTORY_ABI = get_bsc_factory_abi();
// Initialize contract instances
const factory = new ethers.Contract(PANCAKE_FACTORY_ADDRESS, FACTORY_ABI, wsProvider);
const router = new ethers.Contract(PANCAKE_ROUTER_ADDRESS, ROUTER_ABI, wallet);
const targetToken = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ERC20_ABI, provider);

// Convert amounts to proper format
const bnbToSpend = ethers.parseEther(AMOUNT_BNB_TO_SPEND);
const maxGasPrice = ethers.parseUnits(MAX_GAS_PRICE_GWEI, 'gwei');
const priorityFee = ethers.parseUnits(PRIORITY_FEE_GWEI, 'gwei');

// Logger
const logger = {
    info: (message: any) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] INFO: ${message}`);
        fs.appendFileSync('bot-logs.txt', `[${timestamp}] INFO: ${message}\n`);
    },
    error: (message: any) => {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ERROR: ${message}`);
        fs.appendFileSync('bot-logs.txt', `[${timestamp}] ERROR: ${message}\n`);
    }
};

async function initialize() {
    try {
        // Get token info
        const tokenSymbol = await targetToken.symbol();
        const tokenName = await targetToken.name();
        const tokenDecimals = await targetToken.decimals();

        logger.info(`Bot initialized for token: ${tokenName} (${tokenSymbol})`);
        logger.info(`Wallet address: ${account}`);
        logger.info(`Token contract address: ${TOKEN_CONTRACT_ADDRESS}`);
        logger.info(`Amount to spend: ${AMOUNT_BNB_TO_SPEND} BNB`);
        logger.info(`Priority fee (bribe): ${PRIORITY_FEE_GWEI} Gwei`);
        logger.info(`Max gas price: ${MAX_GAS_PRICE_GWEI} Gwei`);
        logger.info(`Slippage: ${SLIPPAGE_PERCENTAGE}%`);

        return { tokenSymbol, tokenDecimals };
    } catch (error) {
        logger.error(`Initialization error: ${error}`);
        // If we can't get token info, it might not be deployed yet or wrong address
        logger.info(`Could not get token info. Will continue monitoring for pool creation.`);
        return { tokenSymbol: "UNKNOWN", tokenDecimals: 18 };
    }
}
async function buyToken(tokenAddress: any) {
    try {
        logger.info(`Executing buy for pair: ${tokenAddress}`);

        const block = await provider.getBlock("latest");
        const currentTimestamp = block?.timestamp || 9999999999999;
        // Calculate minimum amount out based on slippage
        const path = [WBNB_ADDRESS, TOKEN_CONTRACT_ADDRESS];
        console.log("amountsOut-->", bnbToSpend);
        console.log("wallet-->", wallet);


        // Prepare transaction
        const deadline = Math.floor(Date.now() / 1000) + 60 * 5; // 5 minutes from now

        // Get current gas price
        const feeData = await provider.getFeeData();
        console.log("FeeData-->", feeData)
        const currentGasPrice = feeData.gasPrice;
        if (!currentGasPrice) { return }
        let gasPrice = currentGasPrice + priorityFee;

        // Cap gas price at maximum
        if (gasPrice > maxGasPrice) {
            gasPrice = maxGasPrice;
        }

        logger.info(`Current gas price: ${ethers.formatUnits(currentGasPrice, 'gwei')} Gwei`);
        logger.info(`Using gas price: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei`);

        console.log({WBNB_ADDRESS, tokenAddress, wallet: wallet.address, value: bnbToSpend})
        // // Execute swap
        const tx = await router
            .swapExactETHForTokensSupportingFeeOnTransferTokens(
                0,
                [WBNB_ADDRESS, tokenAddress],
                wallet.address,
                currentTimestamp + 1000000000,
                {
                    value: 10000
                });

        logger.info(`Transaction submitted: ${tx.hash}`);

        const receipt = await tx.wait();
        logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);

        return {
            success: true,
            hash: tx.hash,
            blockNumber: receipt.blockNumber
        };
    } catch (error) {
        logger.error(`Buy failed: ${error}`);
        return {
            success: false,
            error: error
        };
    }
}

async function monitorForPairCreation() {
    const tokenAddress = ethers.getAddress(TOKEN_CONTRACT_ADDRESS);

    logger.info(`Starting to monitor for pair creation with token: ${tokenAddress}`);
    logger.info(`Waiting for liquidity to be added...`);

    return new Promise((resolve) => {
        console.log("listening-->")
        // Listen for PairCreated events involving our token
        factory.on('PairCreated', async (token0, token1, pairAddress, _) => {
            token0 = token0.toLowerCase();
            token1 = token1.toLowerCase();
            const tokenAddress = TOKEN_CONTRACT_ADDRESS.toLowerCase();

            if ((token0 === tokenAddress && token1 === WBNB_ADDRESS.toLowerCase()) ||
                (token1 === tokenAddress && token0 === WBNB_ADDRESS.toLowerCase())) {
                logger.info(`Pair created! Address: ${pairAddress}`);
                logger.info(`Token0: ${token0}`);
                logger.info(`Token1: ${token1}`);

                // Stop listening for events
                factory.removeAllListeners('PairCreated');

                // Execute buy
                const result = await buyToken(tokenAddress);
                resolve(result);
            }
        });
    });
}

// Main execution function
async function main() {
    try {
        logger.info('------------------------');
        logger.info('PancakeSwap Sniper Bot Started');
        logger.info('------------------------');

        // Initialize and get token info
        await initialize();

        // Monitor for pool creation and buy when detected
        const result: any = await monitorForPairCreation();

        if (result.success) {
            logger.info('------------------------');
            logger.info('Buy completed successfully!');
            logger.info(`Transaction hash: ${result.hash}`);
            logger.info('------------------------');
        } else {
            logger.info('------------------------');
            logger.info('Buy failed!');
            logger.info(`Error: ${result.error}`);
            logger.info('------------------------');
        }



    } catch (error) {
        logger.error(`Bot execution failed: ${error}`);
    } finally {
        if (wsProvider) {
            wsProvider.pause();
            logger.info('WebSocket connection closed');
        }
        logger.info('Bot execution completed');
    }
}

// Start the bot
main();