import { PublicKey } from "@solana/web3.js";

// 所有链上配置都集中在这里。
export const PROGRAM_ID = new PublicKey("HPuN91VgkVKQ5kNRS79Q6kci1XJYBV9ux9fhQsQubxV2");

// 默认连 Devnet。本地调试时可用 NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899 覆盖。
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

export const CLUSTER = "devnet";

// 仅用于本地调试:开启后可用浏览器内的临时钱包,不需要 Phantom。线上不要开启。
export const ENABLE_BURNER_WALLET = process.env.NEXT_PUBLIC_ENABLE_BURNER_WALLET === "true";

export const explorerTx = (signature: string) =>
  `https://explorer.solana.com/tx/${signature}?cluster=${CLUSTER}`;

export const explorerAddress = (address: string) =>
  `https://explorer.solana.com/address/${address}?cluster=${CLUSTER}`;
