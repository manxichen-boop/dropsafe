import * as anchor from "@anchor-lang/core";
import { BN, Program } from "@anchor-lang/core";
import { assert } from "chai";
import { Dropsafe } from "../target/types/dropsafe";

const { Keypair, PublicKey, SystemProgram, SYSVAR_CLOCK_PUBKEY, LAMPORTS_PER_SOL } = anchor.web3;
type Signer = anchor.web3.Keypair;
type Pk = anchor.web3.PublicKey;
type TierName = "shielded" | "standard" | "trust";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tierArg = (t: TierName) => ({ [t]: {} } as never);
const APPEAL = 60; // devnet-demo 构建的申诉期
const DAY = 86400;

describe("dropsafe v2", () => {
  const envProvider = anchor.AnchorProvider.env();
  const provider = new anchor.AnchorProvider(envProvider.connection, envProvider.wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);
  const program = anchor.workspace.dropsafe as Program<Dropsafe>;
  const connection = provider.connection;

  const PRICE = 100_000_000; // 0.1 SOL
  const UPFRONT = 70_000_000;
  const REMAINDER = 30_000_000;
  let nextId = 1;

  const pda = (...seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, program.programId)[0];
  const escrowOf = (c: Pk) => pda(Buffer.from("escrow"), c.toBuffer());
  const contributionOf = (c: Pk, b: Pk) => pda(Buffer.from("contribution"), c.toBuffer(), b.toBuffer());
  const organizerStatsOf = (o: Pk) => pda(Buffer.from("organizer"), o.toBuffer());
  const buyerStatsOf = (b: Pk) => pda(Buffer.from("buyer"), b.toBuffer());

  const chainNow = async () => {
    const info = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "confirmed");
    return Number(info!.data.readBigInt64LE(32));
  };
  const waitUntilPast = async (t: number) => {
    while ((await chainNow()) < t) await sleep(300);
  };
  const balance = (k: Pk) => connection.getBalance(k, "confirmed");
  const rentOf = async (k: Pk) => {
    const info = await connection.getAccountInfo(k, "confirmed");
    return info ? connection.getMinimumBalanceForRentExemption(info.data.length) : 0;
  };
  // 托管里可用的钱:余额减去租金
  const escrowHeld = async (c: Pk) => (await balance(escrowOf(c))) - (await rentOf(escrowOf(c)));

  const wallet = async (sol = 3): Promise<Signer> => {
    const kp = Keypair.generate();
    const sig = await connection.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
    return kp;
  };
  const wallets = (n: number) => Promise.all(Array.from({ length: n }, () => wallet()));

  // 记录一个钱包的起始余额,后面算净额时把它付的租金加回来
  const startBalances = new Map<string, number>();
  const track = async (k: Signer) => {
    startBalances.set(k.publicKey.toBase58(), await balance(k.publicKey));
    return k;
  };

  interface CreateOpts {
    organizer: Signer;
    tier?: TierName;
    target?: number;
    price?: number;
    title?: string;
    description?: string;
    imageUrl?: string;
    deadline?: number;
    delivery?: number;
  }

  const create = async (o: CreateOpts) => {
    const id = new BN(nextId++);
    const campaign = pda(Buffer.from("campaign"), o.organizer.publicKey.toBuffer(), id.toArrayLike(Buffer, "le", 8));
    const now = await chainNow();
    const deadline = o.deadline ?? now + 30 * DAY;
    const delivery = o.delivery ?? deadline + 30 * DAY;
    await program.methods
      .createCampaign(
        id,
        o.title ?? "Test drop",
        o.description ?? "A short description",
        o.imageUrl ?? "https://example.com/a.png",
        new BN(o.price ?? PRICE),
        o.target ?? 2,
        new BN(deadline),
        new BN(delivery),
        tierArg(o.tier ?? "standard")
      )
      .accountsPartial({
        organizer: o.organizer.publicKey,
        campaign,
        escrow: escrowOf(campaign),
        organizerStats: organizerStatsOf(o.organizer.publicKey),
        systemProgram: SystemProgram.programId,
      })
      .signers([o.organizer])
      .rpc();
    return { campaign, deadline, delivery, appealEnd: delivery + APPEAL };
  };

  const organizerOf = async (c: Pk) => (await program.account.campaign.fetch(c)).organizer;

  const contribute = async (c: Pk, buyer: Signer) =>
    program.methods
      .contribute()
      .accountsPartial({
        buyer: buyer.publicKey,
        campaign: c,
        escrow: escrowOf(c),
        contribution: contributionOf(c, buyer.publicKey),
        organizerStats: organizerStatsOf(await organizerOf(c)),
        buyerStats: buyerStatsOf(buyer.publicKey),
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

  const withdraw = (c: Pk, buyer: Signer) =>
    program.methods
      .withdrawBeforeFill()
      .accountsPartial({
        buyer: buyer.publicKey,
        campaign: c,
        escrow: escrowOf(c),
        contribution: contributionOf(c, buyer.publicKey),
        buyerStats: buyerStatsOf(buyer.publicKey),
      })
      .signers([buyer])
      .rpc();

  const cancel = async (c: Pk, caller: Signer) =>
    program.methods
      .cancelCampaign()
      .accountsPartial({ organizer: caller.publicKey, campaign: c, organizerStats: organizerStatsOf(await organizerOf(c)) })
      .signers([caller])
      .rpc();

  const refund = async (c: Pk, buyer: Signer, contributionBuyer: Pk = buyer.publicKey) =>
    program.methods
      .refund()
      .accountsPartial({
        buyer: buyer.publicKey,
        campaign: c,
        escrow: escrowOf(c),
        contribution: contributionOf(c, contributionBuyer),
        organizerStats: organizerStatsOf(await organizerOf(c)),
        buyerStats: buyerStatsOf(buyer.publicKey),
      })
      .signers([buyer])
      .rpc();

  const reclaim = (c: Pk, caller: Signer) =>
    program.methods
      .reclaimBond()
      .accountsPartial({ organizer: caller.publicKey, campaign: c, escrow: escrowOf(c) })
      .signers([caller])
      .rpc();

  const release = async (c: Pk, caller: Signer) =>
    program.methods
      .releaseUpfront()
      .accountsPartial({
        organizer: caller.publicKey,
        campaign: c,
        escrow: escrowOf(c),
        organizerStats: organizerStatsOf(await organizerOf(c)),
      })
      .signers([caller])
      .rpc();

  const confirm = (c: Pk, buyer: Signer, contributionBuyer: Pk = buyer.publicKey) =>
    program.methods
      .confirmDelivery()
      .accountsPartial({ buyer: buyer.publicKey, campaign: c, contribution: contributionOf(c, contributionBuyer) })
      .signers([buyer])
      .rpc();

  const report = (c: Pk, buyer: Signer, contributionBuyer: Pk = buyer.publicKey) =>
    program.methods
      .reportNotReceived()
      .accountsPartial({ buyer: buyer.publicKey, campaign: c, contribution: contributionOf(c, contributionBuyer) })
      .signers([buyer])
      .rpc();

  const settle = async (c: Pk, buyer: Pk, caller: Signer, organizerAddr?: Pk, buyerAddr?: Pk) => {
    const organizer = await organizerOf(c);
    return program.methods
      .settleSeat()
      .accountsPartial({
        caller: caller.publicKey,
        organizer: organizerAddr ?? organizer,
        buyer: buyerAddr ?? buyer,
        campaign: c,
        escrow: escrowOf(c),
        contribution: contributionOf(c, buyer),
        organizerStats: organizerStatsOf(organizer),
        buyerStats: buyerStatsOf(buyer),
      })
      .signers([caller])
      .rpc();
  };

  const finalize = async (c: Pk, caller: Signer) =>
    program.methods
      .finalizeCampaign()
      .accountsPartial({ caller: caller.publicKey, campaign: c, organizerStats: organizerStatsOf(await organizerOf(c)) })
      .signers([caller])
      .rpc();

  const expectFail = async (send: () => Promise<string>, expected: string) => {
    await sleep(700); // 拿到新的 blockhash,否则重复交易会被当成"已处理"
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

  const statusOf = async (c: Pk) => Object.keys((await program.account.campaign.fetch(c)).status)[0];
  const organizerStats = (o: Signer) => program.account.organizerStats.fetch(organizerStatsOf(o.publicKey));
  const buyerStats = (b: Signer) => program.account.buyerStats.fetch(buyerStatsOf(b.publicKey));

  // 团长净额:现在的余额减起始余额,把活动账户、金库、团长记录的租金加回来。
  // 提交交易的手续费由 provider 钱包支付,不影响这里的计算
  const organizerNet = async (o: Signer, campaigns: Pk[]) => {
    let rent = await rentOf(organizerStatsOf(o.publicKey));
    for (const c of campaigns) rent += (await rentOf(c)) + (await rentOf(escrowOf(c)));
    return (await balance(o.publicKey)) - startBalances.get(o.publicKey.toBase58())! + rent;
  };

  // 买家净额:把买家记录和还没关闭的凭证的租金加回来
  const buyerNet = async (b: Signer, campaigns: Pk[]) => {
    let rent = await rentOf(buyerStatsOf(b.publicKey));
    for (const c of campaigns) rent += await rentOf(contributionOf(c, b.publicKey));
    return (await balance(b.publicKey)) - startBalances.get(b.publicKey.toBase58())! + rent;
  };

  describe("create_campaign", () => {
    it("stores everything on-chain and takes the bond only from Shielded", async () => {
      const o = await track(await wallet(5));
      const { campaign } = await create({ organizer: o, tier: "shielded", target: 3, title: "韩团专辑拼团", description: "描述", imageUrl: "https://x.test/i.png" });
      const c = await program.account.campaign.fetch(campaign);
      assert.equal(c.title, "韩团专辑拼团");
      assert.equal(c.description, "描述");
      assert.equal(c.imageUrl, "https://x.test/i.png");
      assert.equal(c.bondTotal.toNumber(), UPFRONT * 3);
      assert.equal(c.appealEnd.toNumber(), c.deliveryDeadline.toNumber() + APPEAL);
      assert.deepEqual(c.tier, { shielded: {} });
      assert.deepEqual(c.status, { fundraising: {} });
      assert.equal(await escrowHeld(campaign), UPFRONT * 3);
      assert.equal(await organizerNet(o, [campaign]), -UPFRONT * 3);

      const std = await create({ organizer: o, tier: "standard" });
      const trust = await create({ organizer: o, tier: "trust" });
      assert.equal(await escrowHeld(std.campaign), 0);
      assert.equal(await escrowHeld(trust.campaign), 0);
      assert.equal((await organizerStats(o)).campaignsCreated.toNumber(), 3);
    });

    it("rejects invalid text, price and target", async () => {
      const o = await wallet();
      await expectFail(() => create({ organizer: o, title: "团".repeat(51) }), "TitleTooLong");
      await expectFail(() => create({ organizer: o, description: "a".repeat(281) }), "DescriptionTooLong");
      await expectFail(() => create({ organizer: o, imageUrl: "a".repeat(201) }), "ImageUrlTooLong");
      await expectFail(() => create({ organizer: o, price: 0 }), "InvalidPrice");
      await expectFail(() => create({ organizer: o, target: 0 }), "InvalidTargetCount");
    });

    it("rejects deadlines in the past and beyond the limits", async () => {
      const o = await wallet();
      const now = await chainNow();
      await expectFail(() => create({ organizer: o, deadline: now - 10 }), "DeadlineNotInFuture");
      await expectFail(() => create({ organizer: o, deadline: now + 91 * DAY }), "FundraisingTooLong");
      const deadline = now + DAY;
      await expectFail(() => create({ organizer: o, deadline, delivery: deadline }), "InvalidDeliveryDeadline");
      await expectFail(() => create({ organizer: o, deadline, delivery: deadline + 366 * DAY }), "DeliveryTooLong");
      // 上限本身是允许的
      await create({ organizer: o, deadline: now + 89 * DAY, delivery: now + 89 * DAY + 365 * DAY });
    });

    it("fits the longest English text in one transaction", async () => {
      const o = await wallet();
      const { campaign } = await create({
        organizer: o,
        title: "t".repeat(50),
        description: "d".repeat(280),
        imageUrl: "https://example.com/".padEnd(200, "x"),
      });
      assert.equal((await program.account.campaign.fetch(campaign)).description.length, 280);
    });
  });

  describe("transaction size", () => {
    it("measures how much text fits in one create transaction", async () => {
      const o = await wallet();
      const size = async (title: string, description: string, imageUrl: string) => {
        const id = new BN(nextId++);
        const campaign = pda(Buffer.from("campaign"), o.publicKey.toBuffer(), id.toArrayLike(Buffer, "le", 8));
        const now = await chainNow();
        const tx = await program.methods
          .createCampaign(id, title, description, imageUrl, new BN(PRICE), 2, new BN(now + DAY), new BN(now + 2 * DAY), tierArg("shielded"))
          .accountsPartial({
            organizer: o.publicKey,
            campaign,
            escrow: escrowOf(campaign),
            organizerStats: organizerStatsOf(o.publicKey),
            systemProgram: SystemProgram.programId,
          })
          .transaction();
        tx.feePayer = o.publicKey;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
      };
      const base = await size("", "", "");
      const budget = 1232 - base;
      console.log(`      create tx: base ${base} bytes, room for ${budget} bytes of text`);
      // 英文写满三个字段必须放得下
      assert.isAtMost(50 + 280 + 200, budget);
    });
  });

  describe("before the group fills", () => {
    it("lets a buyer withdraw in full before the group fills", async () => {
      const [o, b, other] = await wallets(3);
      await track(b);
      const { campaign } = await create({ organizer: o, target: 2 });
      await contribute(campaign, b);
      assert.equal(await escrowHeld(campaign), PRICE);
      await withdraw(campaign, b);
      assert.equal(await escrowHeld(campaign), 0);
      assert.equal(await buyerNet(b, [campaign]), 0);
      assert.equal((await program.account.campaign.fetch(campaign)).joinedCount, 0);
      assert.equal((await buyerStats(b)).campaignsJoined.toNumber(), 0);
      // 退出后名额重新开放
      await contribute(campaign, other);
      assert.equal(await escrowHeld(campaign), PRICE);
    });

    it("rejects withdrawing after the group fills", async () => {
      const [o, b1, b2] = await wallets(3);
      const { campaign } = await create({ organizer: o, target: 2 });
      await contribute(campaign, b1);
      await contribute(campaign, b2);
      assert.equal(await statusOf(campaign), "funded");
      await expectFail(() => withdraw(campaign, b1), "NotFundraising");
      assert.equal(await escrowHeld(campaign), PRICE * 2);
    });

    it("rejects a second contribution and a contribution once full", async () => {
      const [o, b1, b2, b3] = await wallets(4);
      const { campaign } = await create({ organizer: o, target: 2 });
      await contribute(campaign, b1);
      await expectFail(() => contribute(campaign, b1), "already in use");
      assert.equal(await escrowHeld(campaign), PRICE);
      await contribute(campaign, b2);
      await expectFail(() => contribute(campaign, b3), "NotFundraising");
      assert.equal(await escrowHeld(campaign), PRICE * 2);
    });

    for (const tier of ["shielded", "standard", "trust"] as TierName[]) {
      it(`${tier}: cancel lets buyers refund at once and returns any bond`, async () => {
        const o = await track(await wallet());
        const b = await track(await wallet());
        const stranger = await wallet();
        const { campaign } = await create({ organizer: o, tier, target: 2 });
        await contribute(campaign, b);
        await expectFail(() => cancel(campaign, stranger), "NotOrganizer");
        await cancel(campaign, o);
        assert.equal(await statusOf(campaign), "cancelled");
        await expectFail(() => cancel(campaign, o), "CannotCancel");
        const late = await wallet();
        await expectFail(() => contribute(campaign, late), "NotFundraising");

        await refund(campaign, b);
        assert.equal(await buyerNet(b, [campaign]), 0);
        await expectFail(() => refund(campaign, b), "AccountNotInitialized");

        if (tier === "shielded") {
          await expectFail(() => reclaim(campaign, stranger), "NotOrganizer");
          await reclaim(campaign, o);
          await expectFail(() => reclaim(campaign, o), "BondAlreadyReclaimed");
        } else {
          await expectFail(() => reclaim(campaign, o), "NoBond");
        }
        assert.equal(await escrowHeld(campaign), 0);
        assert.equal(await organizerNet(o, [campaign]), 0);
        assert.equal((await organizerStats(o)).campaignsCancelled.toNumber(), 1);

        await finalize(campaign, stranger);
        await expectFail(() => finalize(campaign, stranger), "AlreadyFinalized");
      });
    }

    it("only the buyer can withdraw or refund their own seat", async () => {
      const [o, b, stranger] = await wallets(3);
      const { campaign } = await create({ organizer: o, target: 2 });
      await contribute(campaign, b);
      await contribute(campaign, stranger);
      assert.equal(await statusOf(campaign), "funded");

      const other = await create({ organizer: o, target: 2 });
      await contribute(other.campaign, b);
      await contribute(await create({ organizer: o, target: 3 }).then((x) => x.campaign), stranger);
      // 拿别人的凭证退款:种子里有买家地址,校验不过
      await cancel(other.campaign, o);
      await expectFail(() => refund(other.campaign, stranger, b.publicKey), "ConstraintSeeds");
      assert.equal(await escrowHeld(other.campaign), PRICE);
      await refund(other.campaign, b);
      assert.equal(await escrowHeld(other.campaign), 0);
    });

    it("rejects early refunds and early bond reclaim", async () => {
      const [o, b] = await wallets(2);
      const { campaign } = await create({ organizer: o, tier: "shielded", target: 2 });
      await contribute(campaign, b);
      await expectFail(() => refund(campaign, b), "CampaignStillActive");
      await expectFail(() => reclaim(campaign, o), "BondNotReclaimable");
      await expectFail(() => release(campaign, o), "TargetNotReached");
      await expectFail(() => finalize(campaign, b), "NotFinalizable");
      assert.equal(await escrowHeld(campaign), PRICE + UPFRONT * 2);
    });
  });

  describe("normal delivery", () => {
    // 交付后每个名额分别结算,团长最终拿到全部货款,买家付了全款
    const paidAtRelease: Record<TierName, number> = { shielded: UPFRONT, standard: UPFRONT, trust: PRICE };

    for (const tier of ["shielded", "standard", "trust"] as TierName[]) {
      it(`${tier}: release, confirm and settle pay the organizer exactly the full price`, async () => {
        const o = await track(await wallet());
        const b1 = await track(await wallet());
        const b2 = await track(await wallet());
        const anyone = await wallet();
        const bond = tier === "shielded" ? UPFRONT * 2 : 0;
        const { campaign } = await create({ organizer: o, tier, target: 2 });
        await contribute(campaign, b1);
        await contribute(campaign, b2);
        assert.equal(await escrowHeld(campaign), PRICE * 2 + bond);
        await expectFail(() => confirm(campaign, b1), "NotActive");

        await expectFail(() => release(campaign, anyone), "NotOrganizer");
        await release(campaign, o);
        assert.equal(await statusOf(campaign), "active");
        assert.equal(await escrowHeld(campaign), PRICE * 2 + bond - paidAtRelease[tier] * 2);
        assert.equal(await organizerNet(o, [campaign]), paidAtRelease[tier] * 2 - bond);
        await expectFail(() => release(campaign, o), "AlreadyReleased");
        await expectFail(() => refund(campaign, b1), "RefundNotAvailable");
        await expectFail(() => reclaim(campaign, o), tier === "shielded" ? "BondNotReclaimable" : "NoBond");

        // 还没确认、申诉期没结束,团长不能领尾款
        await expectFail(() => settle(campaign, b1.publicKey, anyone), "SeatNotSettleable");
        // 发货期限前不能报告
        await expectFail(() => report(campaign, b1), "TooEarlyToReport");
        // 只有本人能确认
        await expectFail(() => confirm(campaign, anyone, b1.publicKey), "ConstraintSeeds");
        await expectFail(() => report(campaign, anyone, b1.publicKey), "ConstraintSeeds");

        await confirm(campaign, b1);
        await expectFail(() => confirm(campaign, b1), "SeatAlreadyDecided");
        await settle(campaign, b1.publicKey, anyone);
        await expectFail(() => settle(campaign, b1.publicKey, anyone), "AccountNotInitialized");
        await expectFail(() => finalize(campaign, anyone), "NotFinalizable");

        await confirm(campaign, b2);
        // 收款地址被合约固定,传别的地址会被拒绝
        await expectFail(() => settle(campaign, b2.publicKey, anyone, anyone.publicKey), "NotOrganizer");
        await settle(campaign, b2.publicKey, anyone);

        assert.equal(await escrowHeld(campaign), 0);
        assert.equal(await organizerNet(o, [campaign]), PRICE * 2);
        assert.equal(await buyerNet(b1, [campaign]), -PRICE);
        assert.equal(await buyerNet(b2, [campaign]), -PRICE);

        await finalize(campaign, anyone);
        assert.equal(await statusOf(campaign), "closed");
        await expectFail(() => finalize(campaign, anyone), "AlreadyFinalized");

        const stats = await organizerStats(o);
        assert.equal(stats[tier].funded.toNumber(), 1);
        assert.equal(stats[tier].seatsConfirmed.toNumber(), 2);
        assert.equal(stats[tier].seatsReported.toNumber(), 0);
        assert.equal(stats.totalPaidToOrganizerLamports.toNumber(), PRICE * 2);
        const bs = await buyerStats(b1);
        assert.equal(bs.campaignsJoined.toNumber(), 1);
        assert.equal(bs.seatsConfirmed.toNumber(), 1);
      });
    }

    it("loses no lamports to rounding on an odd price", async () => {
      const o = await track(await wallet());
      const [b1, b2, b3] = await wallets(3);
      const price = 1001; // upfront = 700, remainder = 301
      const { campaign } = await create({ organizer: o, tier: "shielded", target: 3, price });
      assert.equal(await escrowHeld(campaign), 700 * 3);
      for (const b of [b1, b2, b3]) await contribute(campaign, b);
      await release(campaign, o);
      for (const b of [b1, b2, b3]) {
        await confirm(campaign, b);
        await settle(campaign, b.publicKey, o);
      }
      assert.equal(await escrowHeld(campaign), 0);
      assert.equal(await organizerNet(o, [campaign]), price * 3);
    });
  });

  // 时间相关的场景一起跑:先把所有活动建好,再一起等过各个时间点
  describe("deadlines, appeals and running away", () => {
    type Scene = { organizer: Signer; buyers: Signer[]; campaign: Pk };
    const away = {} as Record<TierName, Scene>; // 团长提取后跑路,买家全部报告
    const abandoned = {} as Record<TierName, Scene>; // 团长一直不提取
    const unfilled = {} as Record<TierName, Scene>; // 没凑满
    const mixed = {} as Record<TierName, Scene>; // 一个确认,一个报告,一个没回应
    let empty: Scene; // 没人参与的失败活动
    let abandonedSilent: Scene; // 放弃但没人退款
    let sybil: { organizer: Signer; sybils: Signer[]; real: Signer; campaign: Pk };
    let t = { deadline: 0, delivery: 0, appealEnd: 0 };
    const tiers: TierName[] = ["shielded", "standard", "trust"];

    before(async function () {
      this.timeout(200_000);
      const pool = await wallets(46);
      for (const w of pool) await track(w);
      const take = (n: number) => pool.splice(0, n);

      const now = await chainNow();
      t.deadline = now + 45;
      t.delivery = t.deadline + 5;
      t.appealEnd = t.delivery + APPEAL;
      const when = { deadline: t.deadline, delivery: t.delivery };

      const build = async (tier: TierName, target: number, joining: number): Promise<Scene> => {
        const [organizer, ...buyers] = take(joining + 1);
        const { campaign } = await create({ organizer, tier, target, ...when });
        for (const b of buyers) await contribute(campaign, b);
        return { organizer, buyers, campaign };
      };

      for (const tier of tiers) {
        away[tier] = await build(tier, 2, 2);
        abandoned[tier] = await build(tier, 2, 2);
        unfilled[tier] = await build(tier, 3, 2);
        mixed[tier] = await build(tier, 3, 3);
      }
      empty = await build("shielded", 2, 0);
      abandonedSilent = await build("shielded", 1, 1);
      const [so, s1, s2, real] = take(4);
      const created = await create({ organizer: so, tier: "shielded", target: 3, ...when });
      for (const b of [s1, s2, real]) await contribute(created.campaign, b);
      sybil = { organizer: so, sybils: [s1, s2], real, campaign: created.campaign };

      for (const tier of tiers) {
        await release(away[tier].campaign, away[tier].organizer);
        await release(mixed[tier].campaign, mixed[tier].organizer);
      }
      await release(sybil.campaign, sybil.organizer);
      assert.isBelow(await chainNow(), t.deadline, "setup must finish before the deadline");
    });

    it("before the shipping deadline: reports, refunds and early claims are rejected", async () => {
      await expectFail(() => report(away.standard.campaign, away.standard.buyers[0]), "TooEarlyToReport");
      await expectFail(() => refund(abandoned.standard.campaign, abandoned.standard.buyers[0]), "DeliveryDeadlineNotReached");
      await expectFail(() => finalize(abandoned.standard.campaign, abandoned.standard.buyers[0]), "NotFinalizable");
      assert.equal(await escrowHeld(abandoned.standard.campaign), PRICE * 2);
    });

    it("after the campaign deadline: an unfilled group refunds in full on every tier", async () => {
      await waitUntilPast(t.deadline);
      const late = await wallet();
      for (const tier of tiers) {
        const { organizer, buyers, campaign } = unfilled[tier];
        const bond = tier === "shielded" ? UPFRONT * 3 : 0;
        await expectFail(() => contribute(campaign, late), "DeadlinePassed");
        await expectFail(() => withdraw(campaign, buyers[0]), "DeadlinePassed");
        await expectFail(() => cancel(campaign, organizer), "CannotCancel");
        await expectFail(() => release(campaign, organizer), "TargetNotReached");

        await refund(campaign, buyers[0]);
        assert.equal(await statusOf(campaign), "failed");
        assert.equal(await buyerNet(buyers[0], [campaign]), 0);
        await expectFail(() => refund(campaign, buyers[0]), "AccountNotInitialized");
        assert.equal(await escrowHeld(campaign), PRICE + bond);

        // 只放开:另一位买家的钱还在,取回保证金不影响它
        if (tier === "shielded") {
          await reclaim(campaign, organizer);
          await expectFail(() => reclaim(campaign, organizer), "BondAlreadyReclaimed");
        }
        assert.equal(await escrowHeld(campaign), PRICE);
        await refund(campaign, buyers[1]);
        assert.equal(await escrowHeld(campaign), 0);
        assert.equal(await organizerNet(organizer, [campaign]), 0);

        const stats = await organizerStats(organizer);
        assert.equal(stats.campaignsFailed.toNumber(), 1);
        assert.equal((await buyerStats(buyers[0])).seatsRefunded.toNumber(), 1);

        // finalize 不会把已经记录的失败再算一次
        await finalize(campaign, late);
        assert.equal((await organizerStats(organizer)).campaignsFailed.toNumber(), 1);
      }
    });

    it("finalize records a failure even when nobody joined", async () => {
      const anyone = await wallet();
      assert.equal(await statusOf(empty.campaign), "fundraising");
      await finalize(empty.campaign, anyone);
      assert.equal(await statusOf(empty.campaign), "failed");
      assert.equal((await organizerStats(empty.organizer)).campaignsFailed.toNumber(), 1);
      await expectFail(() => finalize(empty.campaign, anyone), "AlreadyFinalized");
      await reclaim(empty.campaign, empty.organizer);
      assert.equal(await escrowHeld(empty.campaign), 0);
      assert.equal(await organizerNet(empty.organizer, [empty.campaign]), 0);
    });

    it("after the shipping deadline: an abandoned group refunds in full and blocks release", async () => {
      await waitUntilPast(t.delivery);
      for (const tier of tiers) {
        const { organizer, buyers, campaign } = abandoned[tier];
        const bond = tier === "shielded" ? UPFRONT * 2 : 0;
        assert.equal(await escrowHeld(campaign), PRICE * 2 + bond);
        await expectFail(() => release(campaign, organizer), "DeliveryDeadlinePassed");

        await refund(campaign, buyers[0]);
        assert.equal(await statusOf(campaign), "abandoned");
        assert.equal(await buyerNet(buyers[0], [campaign]), 0);
        assert.equal(await escrowHeld(campaign), PRICE + bond);
        await expectFail(() => refund(campaign, buyers[0]), "AccountNotInitialized");
        // 放弃之后仍然不能提取
        await expectFail(() => release(campaign, organizer), "DeliveryDeadlinePassed");

        if (tier === "shielded") await reclaim(campaign, organizer);
        await refund(campaign, buyers[1]);
        assert.equal(await escrowHeld(campaign), 0);
        assert.equal(await organizerNet(organizer, [campaign]), 0);
        assert.equal(await buyerNet(buyers[1], [campaign]), 0);
        const stats = await organizerStats(organizer);
        assert.equal(stats.campaignsAbandoned.toNumber(), 1);
        assert.equal(stats[tier].funded.toNumber(), 1);
      }
    });

    it("finalize records an abandonment even when nobody refunds", async () => {
      const { organizer, buyers, campaign } = abandonedSilent;
      await finalize(campaign, await wallet());
      assert.equal(await statusOf(campaign), "abandoned");
      assert.equal((await organizerStats(organizer)).campaignsAbandoned.toNumber(), 1);
      await reclaim(campaign, organizer);
      assert.equal(await escrowHeld(campaign), PRICE);
      await refund(campaign, buyers[0]);
      assert.equal(await escrowHeld(campaign), 0);
    });

    it("inside the appeal window: buyers can report, and the organizer cannot claim yet", async () => {
      for (const tier of tiers) {
        const { buyers, campaign } = away[tier];
        await expectFail(() => settle(campaign, buyers[0].publicKey, buyers[0]), "SeatNotSettleable");
        await report(campaign, buyers[0]);
        await report(campaign, buyers[1]);
        await expectFail(() => report(campaign, buyers[0]), "SeatAlreadyDecided");
        await expectFail(() => confirm(campaign, buyers[0]), "SeatAlreadyDecided");
      }
    });

    it("Shielded, organizer runs away: every buyer gets the full price and the organizer nets 0", async () => {
      const { organizer, buyers, campaign } = away.shielded;
      for (const b of buyers) {
        await settle(campaign, b.publicKey, organizer);
        assert.equal(await buyerNet(b, [campaign]), 0);
      }
      assert.equal(await escrowHeld(campaign), 0);
      assert.equal(await organizerNet(organizer, [campaign]), 0);
      const stats = await organizerStats(organizer);
      assert.equal(stats.shielded.seatsReported.toNumber(), 2);
      assert.equal(stats.totalPaidToOrganizerLamports.toNumber(), UPFRONT * 2);
      assert.equal((await buyerStats(buyers[0])).seatsReported.toNumber(), 1);
    });

    it("Standard, organizer runs away: every buyer gets 30% back and the organizer keeps 70%", async () => {
      const { organizer, buyers, campaign } = away.standard;
      for (const b of buyers) {
        await settle(campaign, b.publicKey, organizer);
        assert.equal(await buyerNet(b, [campaign]), -UPFRONT);
      }
      assert.equal(await escrowHeld(campaign), 0);
      assert.equal(await organizerNet(organizer, [campaign]), UPFRONT * 2);
      assert.equal((await organizerStats(organizer)).standard.seatsReported.toNumber(), 2);
    });

    it("Trust, organizer runs away: buyers get nothing back and the report is recorded", async () => {
      const { organizer, buyers, campaign } = away.trust;
      for (const b of buyers) {
        await settle(campaign, b.publicKey, organizer);
        assert.equal(await buyerNet(b, [campaign]), -PRICE);
      }
      assert.equal(await escrowHeld(campaign), 0);
      assert.equal(await organizerNet(organizer, [campaign]), PRICE * 2);
      const stats = await organizerStats(organizer);
      assert.equal(stats.trust.seatsReported.toNumber(), 2);
      assert.equal((await buyerStats(buyers[0])).seatsReported.toNumber(), 1);
    });

    it("Shielded sybil fill: the one real buyer reports and gets the full price back", async () => {
      const { organizer, real, campaign } = sybil;
      await report(campaign, real);
      await settle(campaign, real.publicKey, real);
      assert.equal(await buyerNet(real, [campaign]), 0);
      // 托管里只剩小号那两个名额的钱:每个 remainder + 保证金
      assert.equal(await escrowHeld(campaign), (REMAINDER + UPFRONT) * 2);
      assert.equal(await organizerNet(organizer, [campaign]), UPFRONT * 3 - UPFRONT * 3);
    });

    it("mixed seats: one confirms and one reports, and the third is settled after the window", async () => {
      for (const tier of tiers) {
        const { buyers, campaign } = mixed[tier];
        await confirm(campaign, buyers[0]);
        await report(campaign, buyers[1]);
        await expectFail(() => settle(campaign, buyers[2].publicKey, buyers[0]), "SeatNotSettleable");
      }
    });

    it("after the appeal window: late reports fail and unanswered seats pay the organizer", async () => {
      await waitUntilPast(t.appealEnd);
      const anyone = await wallet();
      const expectedOrganizer: Record<TierName, number> = {
        // 3 个名额的预付款 - 3 份保证金 + 确认的 1 个和没回应的 1 个各拿 尾款+保证金
        shielded: UPFRONT * 3 - UPFRONT * 3 + (REMAINDER + UPFRONT) * 2,
        standard: UPFRONT * 3 + REMAINDER * 2,
        trust: PRICE * 3,
      };
      const reporterNet: Record<TierName, number> = { shielded: 0, standard: -UPFRONT, trust: -PRICE };

      for (const tier of tiers) {
        const { organizer, buyers, campaign } = mixed[tier];
        await expectFail(() => report(campaign, buyers[2]), "AppealWindowClosed");
        await expectFail(() => confirm(campaign, buyers[2]), "AppealWindowClosed");

        for (const b of buyers) await settle(campaign, b.publicKey, anyone);

        assert.equal(await escrowHeld(campaign), 0);
        assert.equal(await organizerNet(organizer, [campaign]), expectedOrganizer[tier]);
        assert.equal(await buyerNet(buyers[0], [campaign]), -PRICE);
        assert.equal(await buyerNet(buyers[1], [campaign]), reporterNet[tier]);
        assert.equal(await buyerNet(buyers[2], [campaign]), -PRICE);

        const stats = await organizerStats(organizer);
        assert.equal(stats[tier].funded.toNumber(), 1);
        assert.equal(stats[tier].seatsConfirmed.toNumber(), 1);
        assert.equal(stats[tier].seatsReported.toNumber(), 1);
        assert.equal(stats[tier].seatsUnconfirmed.toNumber(), 1);
        const paid = tier === "trust" ? PRICE * 3 : UPFRONT * 3 + REMAINDER * 2;
        assert.equal(stats.totalPaidToOrganizerLamports.toNumber(), paid);

        await finalize(campaign, anyone);
        assert.equal(await statusOf(campaign), "closed");
      }
    });

    it("Shielded sybil fill: after the window the organizer only gets its own money back", async () => {
      const { organizer, sybils, campaign } = sybil;
      for (const s of sybils) await settle(campaign, s.publicKey, organizer);
      assert.equal(await escrowHeld(campaign), 0);
      // 团长和小号合计净额为 0:真实买家全额拿回,没有人亏钱,也没人多拿
      let total = await organizerNet(organizer, [campaign]);
      for (const s of sybils) total += await buyerNet(s, [campaign]);
      assert.equal(total, 0);
    });
  });
});
