# DropSafe

**On-chain escrow for group buys on Solana, with three levels of buyer protection.** Built for the MLH Solana Hackathon (Best Beginner Hack, DeFi Track).

**Live demo (Solana Devnet):** https://dropsafe-three.vercel.app

**Devnet program (v2):** [`HPuN91VgkVKQ5kNRS79Q6kci1XJYBV9ux9fhQsQubxV2`](https://explorer.solana.com/address/HPuN91VgkVKQ5kNRS79Q6kci1XJYBV9ux9fhQsQubxV2?cluster=devnet)

This is a hackathon prototype on Devnet. It uses test SOL and has not been audited.

## The problem

Fans organize group buys for K-pop merch and limited drops every day. Buyers send money straight to the organizer's personal wallet and hope for the best. If the group never fills or the organizer disappears, getting money back depends on that same person's goodwill.

## The solution

Buyers pay into an **escrow account controlled by the program**. It has no private key, so funds move only through the program's instructions. Every group buy states its protection up front, and an organizer picks a tier when creating it. The tier can't be changed later.

| Tier | Organizer deposits at creation | Organizer receives once the group fills | A buyer who reports non-delivery gets |
| --- | --- | --- | --- |
| **Shielded** | `upfront * target_count` as a bond | `upfront * joined_count` | `remainder + upfront` from the bond, which is the full price |
| **Standard** | Nothing | `upfront * joined_count` | `remainder`, which is 30% |
| **Unsecured** (`Trust` in the program) | Nothing | `price * joined_count`, which is 100% | Nothing. There is no money-back protection, and the report is only recorded |

Where `upfront = price * 7 / 10` and `remainder = price - upfront`, so the two always add up to exactly `price`.

**The most a buyer can lose = the upfront share minus the bond share.** That is 0% on Shielded, 70% on Standard and 100% on Unsecured, provided they report during the appeal window.

Whatever the tier, every buyer takes their full payment back when:
- the group doesn't fill by the deadline,
- the organizer cancels before the group fills, or
- the group fills but the organizer doesn't withdraw before the shipping deadline.

A buyer can also leave for a full refund at any time before the group fills.

## Architecture

```mermaid
flowchart LR
    W[Next.js app + Phantom] -- signed transactions --> S[DropSafe program]
    S --> C[Campaign PDA]
    S --> E[(Escrow PDA)]
    S --> P[Contribution PDA, one per seat]
    S --> O[OrganizerStats PDA]
    S --> B[BuyerStats PDA]
    S --> X[CampaignExt PDA]
    S --> H[Shipment PDA, one per seat]
    S --> Y[OrganizerStatsExt PDA]
```

| Account | Seeds | Purpose |
| --- | --- | --- |
| Campaign | `"campaign", organizer, campaign_id (u64 LE)` | Terms of the group buy, including its title, description and image link |
| Escrow | `"escrow", campaign` | Holds buyer payments and the organizer's bond |
| Contribution | `"contribution", campaign, buyer` | One seat. Closed when settled, refunded or left, with rent returned to the buyer |
| OrganizerStats | `"organizer", organizer` | The organizer's record, split by tier |
| BuyerStats | `"buyer", buyer` | The buyer's record |
| CampaignExt | `"campaign_ext", campaign` | Created with every new group buy. Holds the organizer's declared longest transit time. A group buy without it was created before v2.2 and keeps one shared appeal window |
| Shipment | `"shipment", contribution` | One seat's shipment statement: chain time it was recorded, the ETA, a hash of the tracking reference and whether the buyer extended once. Kept after settlement as a public record |
| OrganizerStatsExt | `"organizer_stats_ext", organizer` | Seats settled with no shipment record, and unverified buyer reports. Kept apart from OrganizerStats so older accounts never need migrating |

### Time model (v2.2)

| Variable | Meaning | Set by |
| --- | --- | --- |
| `ship_by` (`delivery_deadline`) | Latest time to record a shipment | Organizer, at creation |
| `max_transit` | Longest allowed gap between recording a shipment and its ETA, at most 60 days | Organizer, at creation |
| `eta` | When this seat's buyer should expect the goods, between now and now + `max_transit` | Organizer, when recording the shipment |
| report window | From `eta` if shipped, otherwise from `ship_by`, for one appeal period (7 days, 60 seconds on Devnet), plus one more if the buyer extended | The program, per seat |

A buyer can report "not shipped" once `ship_by` passes with no shipment record, or "shipped but not received" once the seat's ETA passes. Both are paid by the same tier rule (100%, 30% or 0%). The program never decides whether a parcel really arrived. It records each side's statement and the deadline, and pays by the rule agreed when the buyer joined.

## Money flow

```mermaid
flowchart TD
    OR[Organizer] -- "Shielded: bond at creation" --> E[(Escrow)]
    BU[Buyers] -- "price on joining" --> E
    E -- "release_upfront: 70%, or 100% on Unsecured" --> OR
    E -- "refund or leaving: full price" --> BU
    E -- "reclaim_bond: failed, abandoned or cancelled" --> OR
    E -- "settle_seat: confirmed or unanswered" --> OR
    E -- "settle_seat: reported" --> BU
```

## State machines

**Campaign**

```mermaid
stateDiagram-v2
    [*] --> Fundraising: create_campaign
    Fundraising --> Funded: last seat joins
    Fundraising --> Cancelled: cancel_campaign
    Fundraising --> Failed: deadline passed and not full
    Funded --> Active: release_upfront, before the shipping deadline
    Funded --> Abandoned: shipping deadline passed with no release
    Active --> Closed: every seat settled, then finalize_campaign
    Failed --> [*]
    Cancelled --> [*]
    Abandoned --> [*]
    Closed --> [*]
```

`Failed` and `Abandoned` are written by the first refund or by `finalize_campaign`, which anyone can call. The organizer's record counts each one once, even if nobody ever refunds.

**Seat**

```mermaid
stateDiagram-v2
    [*] --> Paid: contribute
    Paid --> [*]: leave or refund
    Paid --> Paid: record_shipment_batch (organizer, before ship_by) / extend_waiting (buyer, once)
    Paid --> Confirmed: confirm_delivery, before the seat's deadline
    Paid --> Reported: report_unshipped (no shipment, after ship_by) or report_not_received (shipped, after ETA)
    Confirmed --> [*]: settle_seat
    Reported --> [*]: settle_seat
    Paid --> [*]: settle_seat after the seat's own deadline (default settlement)
```

## Rules the program enforces

- Fundraising lasts at most 90 days, and shipping at most 365 days after that.
- The appeal window is fixed by the program at 7 days (60 seconds on the Devnet demo build), so an organizer can't shorten it.
- Each seat's report window opens at its ETA (or at `ship_by` with no shipment record) and closes one appeal period later, inclusive at the start and exclusive at the end. At exactly the closing second, reports, confirmations and extensions fail and the seat can be settled. The program and the app use the same rule.
- Shipments can be recorded only after the group fills and before `ship_by`, so a late record can't erase an overdue seat. The ETA must be between now and now + `max_transit`, so an organizer can't push a buyer's report window months away.
- A shipment batch lists 1 to 8 seats, which is what fits in one 1,232-byte transaction (measured in the tests). Every seat and record address is re-derived on-chain, and the batch is atomic: one bad seat and nothing is written.
- Each seat settles on its own deadline. One buyer extending never holds up the other seats. The group buy closes only when every seat is settled.
- If no report arrives before a seat's deadline, that seat is settled by the preset rule and the remainder goes to the organizer. No report doesn't prove the goods arrived.
- An organizer can't join their own group buy. The whole transaction fails, so no seat is created and no money moves.
- The remainder reaches the organizer only after the buyer confirms or the appeal window ends.
- Every payout checks the escrow balance first and goes to an address fixed by the program, so anyone can safely call `settle_seat` and `finalize_campaign`.

## Threat model

| Threat | Shielded | Standard | Unsecured |
| --- | --- | --- | --- |
| Abusing deadlines to lock funds for years | Prevented | Prevented | Prevented |
| Setting an appeal window too short to use | Prevented | Prevented | Prevented |
| Organizer never moves forward after filling | Prevented | Prevented | Prevented |
| Organizer takes the money and runs | Prevented | Partly: buyer recovers 30% | Not prevented |
| Organizer fills seats with their own wallets | Prevented: the bond backs every seat, so a real buyer still gets the full price | Not prevented | Not prevented |
| Buyer falsely reports non-delivery | Partly, see below | Not prevented | No effect on money |
| Organizer records a fake shipment | Not prevented, see below | Not prevented | Not prevented |
| Organizer sets a far-off ETA to delay reports | Limited by `max_transit` (at most 60 days) | Limited | Limited |
| Inflating a reputation with fake activity | Not prevented | Not prevented | Not prevented |
| Program upgrade changes the rules | Disclosed, see below | Disclosed | Disclosed |

- **False reports:** on Shielded, an organizer can check each buyer's on-chain record and choose not to ship to a suspicious buyer without losing money. If the organizer ships and the buyer still reports, the organizer loses that seat's money. The planned answer is a jury.
- **Reputation:** records are public and the organizer can't delete them, but extra wallets can inflate them. Treat them as a reference only.
- **Upgrades:** the deployer's wallet currently holds the upgrade authority, so it could change the rules. This must move to a multisig or be frozen before mainnet.
- **A filled group proves nothing:** because of extra wallets, a full group doesn't show real demand. The organizer's own wallet can't take a seat, but other wallets they control can.
- **Fake shipment records:** the organizer may submit fabricated shipment information to bypass the unshipped report. The program verifies that a shipment statement exists and when it was made, but can't verify that a parcel was really sent or delivered. Buyers then rely on the ETA-based non-receipt report, and those reports stay unverified unless an arbitration mechanism is added. The ETA cap and the on-chain hash of the tracking reference limit the damage and leave evidence for later.
- **Records are statements, not facts:** "no shipment record" means the organizer made no statement on DropSafe, not that nothing was sent. The organizer profile counts these seats separately from buyer reports, and labels both as unverified.
- **Organizer disappears before the shipping deadline:** buyers can only report after the shipping deadline, so protection starts late. The group buy window shows both the shipping deadline and when reports open.
- **Malicious reports on Unsecured:** a report costs nothing and nobody adjudicates it, so it can be used to drag down an organizer's record. The organizer profile shows these as "Y of X settled seats reported not received" and says the reports are unverified. A report is not a confirmed failure to deliver.
- **A buyer misses the appeal window:** a buyer who stays offline for the whole window can't report afterwards. The group buy window shows a countdown during the appeal window, and My Wallet lists seats that can still be reported. Reminders reduce this risk but don't replace reporting.

## Roadmap

These are planned and not built.

- **Complaint deposits and a random jury.** Buyers post a deposit to complain. Jurors are drawn with verifiable randomness (Switchboard or ORAO), weighted by stake to resist extra wallets. Jurors who vote with the minority or don't vote lose stake. If too few vote, the draw runs once more, and only then does the case default to the buyer.
- **Why a bond limits collusion.** Each seat's bond matches that seat's upfront payment, so an organizer colluding with their own wallets only moves their own money and can't take a real buyer's. What collusion can still attack is the signal from a filled group and the reputation.
- **Harder-to-fake reputation.** A protocol fee, weighting by distinct buyers and their history, and optional proof of identity such as Civic Pass.
- **Lower bonds for proven organizers**, based on their record.
- **Custom tiers** with a slider instead of three fixed levels.
- **Official delays** that extend the shipping deadline, with an exit for buyers who disagree.
- **Milestone payouts** with shipping proof hashes, and direct payment to merchants.
- **USDC** and other tokens.
- **Image hash checks**, because an image link can change today.
- **Organizer declares they can't deliver**, which opens refunds for those seats at once instead of waiting for the shipping deadline. It would need the organizer's signature and would work seat by seat.
- **Appeal reminders** by email or wallet notification. A failed notification would never change the on-chain appeal deadline or any funds.

## Run it

You need Node.js. The app talks to the program already deployed on Devnet.

```bash
cd app
npm install
npm run dev
```

Open http://localhost:3000. In Phantom, turn on Testnet Mode and select Solana Devnet. Get Devnet SOL at https://faucet.solana.com.

The program ID and RPC URL live in [`app/src/lib/config.ts`](app/src/lib/config.ts). The app is a pixel desktop called DropSafe OS. Each feature opens in its own window, and the **View** menu switches between English and 中文.

### Build and test the program

You need Rust, the Solana CLI and Anchor 1.2.2.

```bash
cd program
npm install
npm test
```

This runs 4 Rust unit tests twice, once for each build (the appeal-window boundaries at one second before, at and after the deadline), then builds with `devnet-demo` and runs 33 integration tests on a local validator. The integration tests take about 4 minutes, because they wait through real deadlines and a real appeal window.

### The `devnet-demo` feature

The Devnet deployment is built with the `devnet-demo` cargo feature, which shortens the appeal window from 7 days to 60 seconds so a full flow can be demonstrated. Nothing else changes. A build without the feature uses 7 days:

```bash
anchor build                                   # 7-day appeal window
anchor build -- --features devnet-demo         # 60-second appeal window, used on Devnet
```

### Known limits of the text fields

One create transaction has room for about 800 bytes of text (the v2.2 accounts take some of the space). A title, a link and a full English description fit. A Chinese description uses three bytes per character, so the form asks for shorter text when the total won't fit.

## Earlier versions

- The tag `v1-submission` has no staged payouts. Its program is at `6KcTuoAX6u5SRdX563VhbrXWiBrMwAfGxST5ud9RaQgX`.
- The 70/30 version without tiers is at `6Sno3DHv8uPp9aER9hhdToEnKFLHZwzJZjMNX5GnDj8u`.

## Tech stack

Anchor (Rust) · Solana Devnet · Next.js App Router · TypeScript · Tailwind CSS · Solana Wallet Adapter (Phantom)
