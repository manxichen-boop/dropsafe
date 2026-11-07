"use client";

import { useMemo } from "react";
import { AnchorProvider, Program } from "@anchor-lang/core";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { Keypair, PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./config";
import idl from "./idl/dropsafe.json";
import type { Dropsafe } from "./idl/dropsafe";

// 没连钱包时也要能读链上数据,所以用一个只读的占位钱包(它永远不会签名)。
const readOnlyWallet = {
  publicKey: Keypair.generate().publicKey,
  signTransaction: () => Promise.reject(new Error("Wallet not connected")),
  signAllTransactions: () => Promise.reject(new Error("Wallet not connected")),
};

export function useDropsafe() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    const provider = new AnchorProvider(connection, wallet ?? (readOnlyWallet as never), {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
    return new Program<Dropsafe>({ ...idl, address: PROGRAM_ID.toBase58() } as unknown as Dropsafe, provider);
  }, [connection, wallet]);
}

export const campaignPda = (organizer: PublicKey, campaignId: { toArrayLike: Function }) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("campaign"), organizer.toBuffer(), campaignId.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  )[0];

export const escrowPda = (campaign: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("escrow"), campaign.toBuffer()], PROGRAM_ID)[0];

export const contributionPda = (campaign: PublicKey, buyer: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("contribution"), campaign.toBuffer(), buyer.toBuffer()],
    PROGRAM_ID
  )[0];

export const organizerStatsPda = (organizer: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("organizer"), organizer.toBuffer()], PROGRAM_ID)[0];

export const buyerStatsPda = (buyer: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("buyer"), buyer.toBuffer()], PROGRAM_ID)[0];

// 名额凭证里没有活动地址,只能用 PDA 反推它属于哪个活动。Devnet 上数量很少,够用
export function seatsByCampaign<T extends { publicKey: PublicKey; account: { buyer: PublicKey } }>(
  campaigns: PublicKey[],
  seats: T[]
): Record<string, T[]> {
  const owners = new Map<string, string>();
  const buyers = new Set(seats.map((seat) => seat.account.buyer.toBase58()));
  for (const campaign of campaigns) {
    for (const buyer of buyers) {
      owners.set(contributionPda(campaign, new PublicKey(buyer)).toBase58(), campaign.toBase58());
    }
  }
  const grouped: Record<string, T[]> = {};
  for (const seat of seats) {
    const owner = owners.get(seat.publicKey.toBase58());
    if (owner) (grouped[owner] ??= []).push(seat);
  }
  return grouped;
}
