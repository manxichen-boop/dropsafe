# DropSafe 2 分钟演示脚本

旁白用英文,方便评委听懂;中文是给你的提示。

网站现在是 **DropSafe OS** 像素桌面:左边一列是桌面图标,**Rules** 和 **Privacy & Terms** 在右下角,顶部是菜单栏(File / View / Window / Help),每个功能都在一个可以拖动的窗口里打开。双击图标打开窗口,按 Esc 关闭最上面的窗口。第一次打开网站时会自动打开 **Read Me** 和 **Group Buys**。

三档保障在界面上的名字是 **Shielded / Standard / Unsecured**(中文:全额保障团 / 部分保障团 / 无资金保障团)。**Group Buys** 列表按"募集中 → 等待收货 → 已结束"排序,已结束的默认隐藏,勾选 **Show ended** 才显示。

## 录制前准备(提前 15 分钟)

- Phantom 打开 Testnet Mode,选 Solana Devnet。准备 3 个账户(A 团长,B、C 买家),各有至少 1 SOL。可在 https://faucet.solana.com 领取。
- 用线上地址录制。第一次打开时要在 Phantom 里批准连接网站。点菜单栏右上角的 **Connect Wallet** 连接。
- 录英文版:菜单栏 **View** 里切换 **English / 中文**。
- **换账户的步骤:** 只在 Phantom 里切换不够,网站仍会连着原账户。要先在 Phantom 切换账户,再点菜单栏右上角的钱包地址,选 **Disconnect**,然后点 **Connect Wallet**,在弹窗里批准。也可以在 **My Wallet** 窗口里断开。视频里这段可以剪掉。
- 每笔交易先弹出 DropSafe 自己的确认框(**Please confirm**),点 **Confirm** 后才会弹 Phantom。成功后出现 **Done** 框,点 **Back to desktop** 回到窗口。
- Phantom 弹窗出现后要在 30 秒内确认。拖太久交易会过期,页面会弹出 **Something went wrong** 提示重试。如果弹窗没出现,点工具栏的 Phantom 图标,或者刷新页面重试。
- Devnet 版本的申诉期是 60 秒。在 **New Group Buy** 窗口里,截止时间选 **2 min**,发货期限选 **Demo: 2 minutes**。
- 提前准备两个全额保障团(Shielded,目标 2 人,每人 0.1 SOL),都用 A 创建,用 B、C 参与:
  - **团购一(正常交付):** A 点 **Withdraw** 提取预付款,先不要确认。录制时演示确认和结算。
  - **团购二(团长跑路):** A 提取预付款后什么都不做。开录前算好时间,让它在录制这一段时刚好进入 Appeal window。这个窗口只有 60 秒,建议单独录这段,再剪进视频。
- 开录前关掉多余的窗口,只留桌面。打开 Explorer 标签页备用。Devnet 偶尔会慢,交易确认时可以剪掉等待。

## 脚本

### 0:00–0:15 痛点(停在桌面,打开 Read Me)

> "Fans organize group buys for K-pop albums and limited drops every day. Buyers send money straight to the organizer's wallet and hope. DropSafe holds that money in an on-chain escrow on Solana instead."

### 0:15–0:35 三档保障(双击 **New Group Buy**,指三档选项;或打开 **Rules** 窗口的对比表)

> "An organizer picks one of three protection levels. Shielded means depositing a bond first, so a buyer who reports non-delivery in time loses nothing. Standard pays 70% up front, so a buyer can lose up to 70%. Unsecured pays everything up front, with no money-back protection at all. Buyers see this before they join."

### 0:35–1:00 全额保障团正常交付(**Group Buys** 窗口里打开团购一)

指 **Where the money is** 面板和像素名额团子。切到 B,点 **I received my goods**,再点 **Settle this seat**。

> "Here's a Shielded group. The money sits in an account with no private key, split between buyer payments and the organizer's bond. The buyer confirms delivery. Settling that seat pays the organizer the rest of the price and returns the bond for that seat."

可选:打开 **Escrow Monitor** 或 **On-chain Activity** 窗口,展示刚才的交易直接从链上读出。

### 1:00–1:25 团长跑路(打开团购二,切到 C)

先指窗口顶部的黄色申诉倒计时横幅("If your goods didn't arrive, report it before this")。也可以先打开 **My Wallet**,在 **Can report** 一栏里点进这个团。然后点 **I didn't receive my goods. Get 0.1 SOL back**,再点 **Settle this seat**,在 Done 框里点 **View transaction on Solana Explorer**。

> "Now the organizer took the upfront payment and vanished. After the shipping deadline, the buyer reports it. The bond covers that seat, so the buyer gets the full price back, and the organizer ends up with nothing from it."

### 1:25–1:40 团长主页(在团购窗口里点团长地址,打开 **Organizer Profile** 窗口)

> "Every organizer has an on-chain record, split by tier, that they can't delete. It can still be inflated with extra wallets, so it's a reference and not a guarantee."

### 1:40–2:00 局限和 Roadmap

> "To be clear about the limits: on Standard a buyer can still lose 70%, on Unsecured everything. On Shielded, a buyer can falsely report and cost an honest organizer that seat's money. The program is also still upgradeable. Next we plan complaint deposits and a randomly drawn, staked jury. DropSafe: every group buy tells you what you can lose before you join. Thanks!"

## 评委可能问的问题

**钱放在哪里,谁能动?** Escrow 是 PDA:由程序地址和种子推导出来,没有私钥,只有程序的指令才能转出。但程序目前可以升级,持有升级权限的部署钱包可以改规则,这是原型阶段的局限。

**为什么是 70%?** 团长需要钱去下单。全额保障团用等额保证金抵消这笔预付款的风险。

**团长用小号凑满怎么办?** 全额保障团里,每个名额的保证金都对应自己的预付款,所以团长和小号串通只是左手倒右手,拿不走真实买家的钱。但成团信号和信誉记录仍然可以被刷,所以成团不代表真实需求。

**买家收到货还谎称没收到怎么办?** 全额保障团里,团长可以查看买家记录,决定是否给可疑买家发货,不发货也不亏。但发了货又被谎报,就会损失这个名额的钱。计划用投诉押金和陪审团解决。

**为什么不是到期自动放款?** Solana 程序不能定时运行,所以要有人发一笔结算交易。任何人都可以发,钱只会转到合约固定的地址。

**申诉期为什么只有 60 秒?** 这是 Devnet 演示构建。正式构建是 7 天,由合约固定,团长改不了。界面上申诉截止时间旁边也写着这一点。

**团长能不能自己参团凑人数?** 不能用自己的钱包:合约直接拒绝,整笔交易回滚,不会创建名额也不会转账。但团长仍然可以用别的钱包参团,所以成团不等于真实需求,这一点写在威胁模型里。

**为什么叫"无资金保障团"?** 这一档成团后全款直接给团长,买家报告未收到也拿不回钱,只留下记录。改名是为了不让人误以为"信任"代表平台担保。团长主页上这类报告标注为"未经仲裁",不算确认违约。

**为什么做成像素桌面?** 每个功能是一个独立窗口,团购详情、托管余额和链上动态可以并排打开对照。界面只改了前端,合约和 v2 一样。
