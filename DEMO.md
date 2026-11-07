# DropSafe 2 分钟演示脚本

旁白用英文,方便评委听懂;中文是给你的提示。

## 录制前准备(提前 15 分钟)

- Phantom 打开 Testnet Mode,选 Solana Devnet。准备 3 个账户(A 团长,B、C 买家),各有至少 1 SOL。可在 https://faucet.solana.com 领取。
- 用线上地址录制。第一次打开时要在 Phantom 里批准连接网站。
- 钱包弹窗出现后要在 30 秒内确认。拖太久交易会过期,页面会提示重试。如果弹窗没出现,点工具栏的 Phantom 图标,或者刷新页面重试。
- Devnet 版本的申诉期是 60 秒。创建页的截止时间选 **2 min**,发货期限选 **Demo: 2 minutes**。
- 提前准备两个全额保障团(Shielded,目标 2 人,每人 0.1 SOL),都用 A 创建,用 B、C 参与:
  - **团购一(正常交付):** A 提取预付款,先不要确认。录制时演示确认和结算。
  - **团购二(团长跑路):** A 提取预付款后什么都不做。开录前算好时间,让它在录制这一段时刚好进入 Appeal window。这个窗口只有 60 秒,建议单独录这段,再剪进视频。
- 打开 Explorer 标签页备用。Devnet 偶尔会慢,交易确认时可以剪掉等待。

## 脚本

### 0:00–0:15 痛点(停在首页)

> "Fans organize group buys for K-pop albums and limited drops every day. Buyers send money straight to the organizer's wallet and hope. DropSafe holds that money in an on-chain escrow on Solana instead."

### 0:15–0:35 三档保障(打开创建页,指三张卡片)

> "An organizer picks one of three protection levels. Shielded means depositing a bond first, so a buyer who reports non-delivery in time loses nothing. Standard pays 70% up front, so a buyer can lose up to 70%. Trust pays everything up front. Buyers see this before they join."

### 0:35–1:00 全额保障团正常交付(打开团购一)

指 **Where the money is** 面板和名额团子。切到 B,点 **I received my goods**,再点 **Settle this seat**。

> "Here's a Shielded group. The money sits in an account with no private key, split between buyer payments and the organizer's bond. The buyer confirms delivery. Settling that seat pays the organizer the rest of the price and returns the bond for that seat."

### 1:00–1:25 团长跑路(打开团购二,切到 C)

点 **I didn't receive my goods. Get 0.1 SOL back**,再点 **Settle this seat**,展示 Explorer 链接。

> "Now the organizer took the upfront payment and vanished. After the shipping deadline, the buyer reports it. The bond covers that seat, so the buyer gets the full price back, and the organizer ends up with nothing from it."

### 1:25–1:40 团长主页(点团长地址)

> "Every organizer has an on-chain record, split by tier, that they can't delete. It can still be inflated with extra wallets, so it's a reference and not a guarantee."

### 1:40–2:00 局限和 Roadmap

> "To be clear about the limits: on Standard a buyer can still lose 70%, on Trust everything. On Shielded, a buyer can falsely report and cost an honest organizer that seat's money. The program is also still upgradeable. Next we plan complaint deposits and a randomly drawn, staked jury. DropSafe: every group buy tells you what you can lose before you join. Thanks!"

## 评委可能问的问题

**钱放在哪里,谁能动?** Escrow 是 PDA:由程序地址和种子推导出来,没有私钥,只有程序的指令才能转出。但程序目前可以升级,持有升级权限的部署钱包可以改规则,这是原型阶段的局限。

**为什么是 70%?** 团长需要钱去下单。全额保障团用等额保证金抵消这笔预付款的风险。

**团长用小号凑满怎么办?** 全额保障团里,每个名额的保证金都对应自己的预付款,所以团长和小号串通只是左手倒右手,拿不走真实买家的钱。但成团信号和信誉记录仍然可以被刷,所以成团不代表真实需求。

**买家收到货还谎称没收到怎么办?** 全额保障团里,团长可以查看买家记录,决定是否给可疑买家发货,不发货也不亏。但发了货又被谎报,就会损失这个名额的钱。计划用投诉押金和陪审团解决。

**为什么不是到期自动放款?** Solana 程序不能定时运行,所以要有人发一笔结算交易。任何人都可以发,钱只会转到合约固定的地址。

**申诉期为什么只有 60 秒?** 这是 Devnet 演示构建。正式构建是 72 小时,由合约固定,团长改不了。
