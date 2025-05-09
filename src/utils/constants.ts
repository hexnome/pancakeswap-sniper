require('dotenv').config();
import * as fs from 'fs';
import { ContractAbi } from 'web3';

export const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
export const BSC_RPC_URL = process.env.BSC_RPC_URL || "";
export const BSC_WSS_URL = process.env.BSC_WSS_URL || "";
export const TOKEN_CONTRACT_ADDRESS = process.env.TOKEN_CONTRACT_ADDRESS || "";
export const AMOUNT_BNB_TO_SPEND = process.env.AMOUNT_BNB_TO_SPEND || "";
export const SLIPPAGE_PERCENTAGE = process.env.SLIPPAGE_PERCENTAGE || "";
export const GAS_LIMIT = process.env.GAS_LIMIT || "";
export const PRIORITY_FEE_GWEI = process.env.PRIORITY_FEE_GWEI || "";
export const MAX_GAS_PRICE_GWEI = process.env.MAX_GAS_PRICE_GWEI || "";

// Constants and ABIs

export const PANCAKE_FACTORY_ADDRESS = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
export const PANCAKE_ROUTER_ADDRESS = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
export const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

// PancakeSwap Factory ABI (minimal for pair creation event monitoring)
export function get_bsc_factory_abi(): ContractAbi {
    const data = fs.readFileSync('src/utils/bsc_factory_v2.json', 'utf8');
    return JSON.parse(data);
}

// PancakeSwap Router ABI (minimal for swapping)
export function get_bsc_router_abi(): ContractAbi {
    const data = fs.readFileSync('src/utils/bsc_router_v2.json', 'utf8');
    return JSON.parse(data);
}


// ERC20 Token ABI (minimal)
export const ERC20_ABI = [
    'function decimals() external view returns (uint8)',
    'function symbol() external view returns (string)',
    'function name() external view returns (string)'
];