import * as anchor from "@anchor-lang/core";
import { BN, Program } from "@anchor-lang/core";
import { assert } from "chai";
import { Dropsafe } from "../target/types/dropsafe";

const { Keypair, PublicKey, SystemProgram, SYSVAR_CLOCK_PUBKEY, LAMPORTS_PER_SOL } = anchor.web3;
type Signer = anchor.web3.Keypair;
type Pk = anchor.web3.PublicKey;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("dropsafe", () => {
  // 统一用 confirmed,否则取到的 blockhash 和模拟交易时的确认级别对不上
  const envProvider = anchor.AnchorProvider.env();
  const provider = new anchor.AnchorProvider(envProvider.connection, envProvider.wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);
  const program = anchor.workspace.dropsafe as Program<Dropsafe>;
  const connection = provider.connection;

  const PRICE = new BN(0.1 * LAMPORTS_PER_SOL);
  const FAR_FUTURE_SECS = 3600;
  let nextId = 1;

  // 读链上时钟:截止时间要和链上时间比较,不能用电脑时间
  const chainNow = async (): Promise<number> => {
    const info = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "confirmed");
    return Number(info!.data.readBigInt64LE(32));
  };

  const waitUntilPast = async (deadline: number) => {
    while ((await chainNow()) < deadline) await sleep(300);
  };

  const fundedWallet = async (sol = 5): Promise<Signer> => {
    const kp = Keypair.generate();
    const sig = await connection.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
    return kp;
  };

  const balance = (pk: Pk) => connection.getBalance(pk, "confirmed");

  const campaignPda = (organizer: Pk, id: BN) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("campaign"), organizer.toBuffer(), id.toArrayLike(Buffer, "le", 8)],
      program.programId
    )[0];
  const escrowPda = (campaign: Pk) =>
    PublicKey.findProgramAddressSync([Buffer.from("escrow"), campaign.toBuffer()], program.programId)[0];
  const contributionPda = (campaign: Pk, buyer: Pk) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("contribution"), campaign.toBuffer(), buyer.toBuffer()],
      program.programId
    )[0];

  interface Opts {
    organizer: Signer;
    target?: number;
    secs?: number;
    title?: string;
    price?: BN;
    deadline?: number;
  }

  const sendCreate = async (o: Opts) => {
    const id = new BN(nextId++);
    const campaign = campaignPda(o.organizer.publicKey, id);
    const deadline = o.deadline ?? (await chainNow()) + (o.secs ?? FAR_FUTURE_SECS);
    await program.methods
      .createCampaign(id, o.title ?? "Test drop", o.price ?? PRICE, o.target ?? 2, new BN(deadline))
      .accountsPartial({
        organizer: o.organizer.publicKey,
        campaign,
        escrow: escrowPda(campaign),
        systemProgram: SystemProgram.programId,
      })
      .signers([o.organizer])
      .rpc();
    return { campaign, escrow: escrowPda(campaign), deadline };
  };

  const contribute = (campaign: Pk, buyer: Signer) =>
    program.methods
      .contribute()
      .accountsPartial({
        buyer: buyer.publicKey,
        campaign,
        escrow: escrowPda(campaign),
        contribution: contributionPda(campaign, buyer.publicKey),
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

  const refund = (campaign: Pk, buyer: Signer) =>
    program.methods
      .refund()
      .accountsPartial({
        buyer: buyer.publicKey,
        campaign,
        escrow: escrowPda(campaign),
        contribution: contributionPda(campaign, buyer.publicKey),
      })
      .signers([buyer])
      .rpc();

  const release = (campaign: Pk, caller: Signer) =>
    program.methods
      .release()
      .accountsPartial({ organizer: caller.publicKey, campaign, escrow: escrowPda(campaign) })
      .signers([caller])
      .rpc();

  // 断言交易失败,且失败原因就是预期的错误。
  // 先等一下拿到新的 blockhash,否则重复交易的签名相同,会被当成"已处理"而不是真正的合约错误。
  const expectFail = async (send: () => Promise<string>, expected: string) => {
    await sleep(1000);
    let err: any;
    try {
      await send();
    } catch (e) {
      err = e;
    }
    assert.exists(err, `expected failure: ${expected}`);
    const text = [err.error?.errorCode?.code, err.message, ...(err.logs ?? [])].join("\n");
    assert.include(text, expected);
  };

  let organizer: Signer;
  before(async () => {
    organizer = await fundedWallet(20);
  });

  describe("create_campaign", () => {
    it("creates a campaign in Fundraising status", async () => {
      const { campaign, deadline } = await sendCreate({ organizer, title: "韩团专辑拼团 K-pop", target: 3 });
      const c = await program.account.campaign.fetch(campaign);
      assert.equal(c.title, "韩团专辑拼团 K-pop");
      assert.equal(c.organizer.toBase58(), organizer.publicKey.toBase58());
      assert.equal(c.targetCount, 3);
      assert.equal(c.contributorCount, 0);
      assert.equal(c.deadlineUnixTs.toNumber(), deadline);
      assert.isTrue(c.pricePerPersonLamports.eq(PRICE));
      assert.deepEqual(c.status, { fundraising: {} });
    });

    it("accepts a 50-character Chinese title and rejects 51 characters", async () => {
      await sendCreate({ organizer, title: "团".repeat(50) });
      await expectFail(() => sendCreate({ organizer, title: "团".repeat(51) }), "TitleTooLong");
    });

    it("rejects zero price, zero target and a past deadline", async () => {
      await expectFail(() => sendCreate({ organizer, price: new BN(0) }), "InvalidPrice");
      await expectFail(() => sendCreate({ organizer, target: 0 }), "InvalidTargetCount");
      const past = (await chainNow()) - 10;
      await expectFail(() => sendCreate({ organizer, deadline: past }), "DeadlineNotInFuture");
    });
  });

  describe("contribute", () => {
    it("moves the price into escrow and records the contribution", async () => {
      const buyer = await fundedWallet();
      const { campaign, escrow } = await sendCreate({ organizer });
      const before = await balance(escrow);

      await contribute(campaign, buyer);

      assert.equal((await balance(escrow)) - before, PRICE.toNumber());
      const c = await program.account.campaign.fetch(campaign);
      assert.equal(c.contributorCount, 1);
      const rec = await program.account.contribution.fetch(contributionPda(campaign, buyer.publicKey));
      assert.equal(rec.buyer.toBase58(), buyer.publicKey.toBase58());
      assert.isTrue(rec.amount.eq(PRICE));
    });

    it("rejects a second contribution from the same buyer", async () => {
      const buyer = await fundedWallet();
      const { campaign, escrow } = await sendCreate({ organizer });
      await contribute(campaign, buyer);
      const before = await balance(escrow);

      await expectFail(() => contribute(campaign, buyer), "already in use");

      assert.equal(await balance(escrow), before, "escrow must not change");
      assert.equal((await program.account.campaign.fetch(campaign)).contributorCount, 1);
    });

    it("rejects a contribution once the campaign is full", async () => {
      const { campaign } = await sendCreate({ organizer, target: 1 });
      await contribute(campaign, await fundedWallet());
      const late = await fundedWallet();
      await expectFail(() => contribute(campaign, late), "CampaignFull");
    });

    it("rejects a contribution after the deadline", async () => {
      const buyer = await fundedWallet();
      const { campaign, deadline } = await sendCreate({ organizer, secs: 3 });
      await waitUntilPast(deadline);
      await expectFail(() => contribute(campaign, buyer), "DeadlinePassed");
    });
  });

  describe("release", () => {
    const fundedCampaign = async () => {
      const created = await sendCreate({ organizer, target: 2 });
      await contribute(created.campaign, await fundedWallet());
      await contribute(created.campaign, await fundedWallet());
      return created;
    };

    it("pays the organizer once the target is reached and keeps escrow rent-exempt", async () => {
      const { campaign, escrow } = await fundedCampaign();
      const beforeOrganizer = await balance(organizer.publicKey);
      const beforeEscrow = await balance(escrow);

      await release(campaign, organizer);

      const expected = PRICE.toNumber() * 2;
      // 手续费由测试的 provider 钱包支付,所以团长收到的正好是全部托管金额
      assert.equal((await balance(organizer.publicKey)) - beforeOrganizer, expected);
      assert.equal(beforeEscrow - (await balance(escrow)), expected);
      const info = await connection.getAccountInfo(escrow, "confirmed");
      const rent = await connection.getMinimumBalanceForRentExemption(info!.data.length);
      assert.equal(info!.lamports, rent);
      assert.deepEqual((await program.account.campaign.fetch(campaign)).status, { released: {} });
    });

    it("rejects release from anyone other than the organizer", async () => {
      const { campaign, escrow } = await fundedCampaign();
      const before = await balance(escrow);
      const attacker = await fundedWallet();
      await expectFail(() => release(campaign, attacker), "NotOrganizer");
      assert.equal(await balance(escrow), before);
    });

    it("rejects a second release", async () => {
      const { campaign } = await fundedCampaign();
      await release(campaign, organizer);
      await expectFail(() => release(campaign, organizer), "AlreadyReleased");
    });

    it("rejects release before the target is reached", async () => {
      const { campaign } = await sendCreate({ organizer, target: 2 });
      await contribute(campaign, await fundedWallet());
      await expectFail(() => release(campaign, organizer), "TargetNotReached");
    });
  });

  describe("refund", () => {
    it("rejects a refund before the deadline", async () => {
      const buyer = await fundedWallet();
      const { campaign } = await sendCreate({ organizer, target: 2 });
      await contribute(campaign, buyer);
      await expectFail(() => refund(campaign, buyer), "CampaignStillActive");
    });

    it("refunds in full after a missed target, returns rent and marks the campaign Failed", async () => {
      const buyer = await fundedWallet();
      const { campaign, escrow, deadline } = await sendCreate({ organizer, target: 2, secs: 4 });
      const beforeJoin = await balance(buyer.publicKey);
      await contribute(campaign, buyer);
      await waitUntilPast(deadline);

      await refund(campaign, buyer);

      // 手续费由 provider 钱包支付,所以买家的本金和凭证租金一分不少地回来了
      assert.equal(await balance(buyer.publicKey), beforeJoin);
      const info = await connection.getAccountInfo(escrow, "confirmed");
      const rent = await connection.getMinimumBalanceForRentExemption(info!.data.length);
      assert.equal(info!.lamports, rent);
      assert.isNull(await connection.getAccountInfo(contributionPda(campaign, buyer.publicKey), "confirmed"));
      assert.deepEqual((await program.account.campaign.fetch(campaign)).status, { failed: {} });
    });

    it("rejects a second refund", async () => {
      const buyer = await fundedWallet();
      const other = await fundedWallet();
      const { campaign, escrow, deadline } = await sendCreate({ organizer, target: 3, secs: 4 });
      await contribute(campaign, buyer);
      await contribute(campaign, other);
      await waitUntilPast(deadline);
      await refund(campaign, buyer);
      const before = await balance(escrow);

      await expectFail(() => refund(campaign, buyer), "AccountNotInitialized");

      // 另一位买家的钱还在,不会被重复退款吃掉
      assert.equal(await balance(escrow), before);
      await refund(campaign, other);
    });

    it("rejects a refund from a wallet that never contributed", async () => {
      const buyer = await fundedWallet();
      const stranger = await fundedWallet();
      const { campaign, deadline } = await sendCreate({ organizer, target: 2, secs: 4 });
      await contribute(campaign, buyer);
      await waitUntilPast(deadline);
      await expectFail(() => refund(campaign, stranger), "AccountNotInitialized");
    });

    it("rejects a refund when the target was reached, even after the deadline", async () => {
      const buyer = await fundedWallet();
      const { campaign, deadline } = await sendCreate({ organizer, target: 1, secs: 4 });
      await contribute(campaign, buyer);
      await waitUntilPast(deadline);
      await expectFail(() => refund(campaign, buyer), "TargetAlreadyReached");
      // 过了截止时间,团长仍然可以提取
      await release(campaign, organizer);
    });

    it("rejects release after a failed campaign", async () => {
      const buyer = await fundedWallet();
      const { campaign, deadline } = await sendCreate({ organizer, target: 2, secs: 4 });
      await contribute(campaign, buyer);
      await waitUntilPast(deadline);
      await refund(campaign, buyer);
      await expectFail(() => release(campaign, organizer), "TargetNotReached");
    });
  });
});
