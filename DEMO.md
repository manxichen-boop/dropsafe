# DropSafe 2 分钟演示脚本

旁白用英文,方便评委听懂;中文是给你的提示。

网站是 **DropSafe OS** 像素桌面:左边一列是桌面图标,**Rules** 和 **Privacy & Terms** 在右下角,顶部是菜单栏(File / View / Window / Help),每个功能都在一个可以拖动的窗口里打开。双击图标打开窗口,按 Esc 关闭最上面的窗口。第一次打开网站时会自动打开 **Read Me** 和 **Group Buys**。

三档保障在界面上的名字是 **Shielded / Standard / Unsecured**(中文:全额保障团 / 部分保障团 / 无资金保障团)。

录制思路:**提前准备好处在不同阶段的团购,录的时候只切换窗口、点按钮,不在镜头前等时间。** Devnet 演示版的申诉期只有 60 秒,很多状态现场等不出来。

## 录制前准备(约 30 分钟)

### 工具和浏览器

- 用 QuickTime(文件 → 新建屏幕录制)录屏就够;想加摄像头小窗可以用 OBS 或 Loom。
- 浏览器窗口约 1440×900,缩放 100%,关掉书签栏和多余的扩展图标,只留 Phantom。
- 用线上地址 https://dropsafe-three.vercel.app 录。菜单栏 **View** 里切换 **English / 中文**,英文旁白配英文界面。
- 开录前关掉多余的窗口,只留桌面。另开一个 Explorer 标签页备用。

### 钱包

- Phantom 打开 Testnet Mode,选 Solana Devnet。准备 3 个账户:**A 团长,B、C 买家**,各有至少 0.5 SOL,可在 https://faucet.solana.com 领取。
- 第一次打开网站要在 Phantom 里批准连接:点菜单栏右上角的 **Connect Wallet**。
- **换账户:** 只在 Phantom 里切换不够,网站仍连着原账户。先在 Phantom 切换,再点菜单栏右上角的钱包地址选 **Disconnect**,然后 **Connect Wallet** 批准。视频里这段剪掉。
- 每笔交易先弹 DropSafe 自己的确认框(**Please confirm**),点 **Confirm** 后才弹 Phantom。成功后出现 **Done** 框,点 **Back to desktop** 回到窗口。
- Phantom 弹窗出现后要在 30 秒内批准,否则交易过期,页面会提示 **Something went wrong**,重试即可。

### 提前准备三个团购(都用 A 创建)

在 **New Group Buy** 里:截止时间点 **2 min**,发货期限点 **Demo: 2 minutes**,**Longest transit time** 选 **Demo: 1 minute**。

| 团 | 档位 | 人数 | 要准备到的状态 | 录哪一段 |
| --- | --- | --- | --- | --- |
| ① 正常交付 | Shielded | 2 人,B、C 参团 | A 点 **Withdraw** 提取预付款,再在 **Shipping** 里给两个名额提交发货记录,ETA 设在开录前一点点 | 0:50–1:10 |
| ② 团长逾期 | Shielded | 2 人,B、C 参团 | A 提取预付款后**不提交发货记录**。开录时发货期限要刚过 | 1:10–1:30 |
| ③ 团长发货 | Standard | 2 人,B、C 参团 | A 提取预付款,停在这里 | 0:30–0:50 |

- 团 ② 的报告窗口只有 60 秒(发货期限之后),建议**单独录这一段**,再剪进视频。
- 团 ① 在 ETA 之后 60 秒内要完成确认,同样建议单独录。
- 全部准备好后完整彩排一次,确认每个团都处在正确的状态。

## 脚本

### 0:00–0:15 痛点(桌面,打开 Read Me)

> "Fans organize group buys for K-pop albums and limited drops every day. Buyers send money straight to the organizer's wallet and hope. DropSafe holds that money in an on-chain escrow on Solana instead."

### 0:15–0:30 三档保障(双击 **New Group Buy**,指三档选项)

> "An organizer picks one of three protection levels. Shielded means depositing a bond first, so a buyer who reports a problem in time loses nothing. Standard pays 70% up front, so a buyer can lose up to 70%. Unsecured pays everything up front, with no money-back protection. Buyers see this before they join."

### 0:30–0:50 团长提交发货记录(账户 A,打开团 ③)

在 **Shipping** 区域点 **Select all**,填 ETA 和物流参考信息(比如 `TRACK-001`),点 **Record shipments for 2 seats**。

> "Once the group fills, the organizer records shipments, up to eight seats in one transaction, each with an ETA. Only a hash of the tracking reference goes on-chain. This is the organizer's own statement: the program can't see a real parcel, so it only records who said what, and when."

### 0:50–1:10 正常交付(切到 B,打开团 ①)

先指窗口顶部的黄色申诉倒计时横幅和 **Where the money is** 面板。点 **I received my goods**,再在 **Seats** 里点 **Settle this seat**。

> "The ETA has passed, so this buyer's own report window is open. The money sits in an account with no private key. The buyer confirms delivery, and settling the seat pays the organizer the rest of the price and returns the bond for that seat. Every seat has its own deadline."

### 1:10–1:30 团长逾期未发货(切到 C,打开团 ②)

指名额状态 "Past the shipping deadline with no shipment record"。点 **Not shipped by the deadline. Get 0.1 SOL back**,再点 **Settle this seat**,在 Done 框里点 **View transaction on Solana Explorer**。

> "Here the organizer took the upfront payment and never recorded a shipment. That's something the program can actually check, so the buyer reports it and the bond pays the full price back. The organizer ends up with nothing from this seat."

### 1:30–1:45 我的订单和团长记录

打开 **My Orders**,指 **In progress** 和按团购分组的 **History**;再在团购窗口里点团长地址,打开 **Organizer Profile**。

> "Buyers see every order and its history, read straight from the chain with Explorer links. Organizers get a public record they can't delete, including seats with no shipment record. Reports are shown as unverified, not as proven fraud."

### 1:45–2:00 局限和 Roadmap

> "To be clear about the limits: the program can't prove a parcel arrived, so a report on a shipped seat is unverified. On Standard a buyer can still lose 70%, on Unsecured everything. The program is still upgradeable. Next we plan complaint deposits and a randomly drawn, staked jury. DropSafe: every group buy tells you what you can lose before you join. Thanks!"

### 有时间可以加的镜头(各 5 秒)

- **Wait longer: extend once**:买家把自己名额的截止时间延后一个申诉期,只能用一次。
- **Escrow Monitor** 或 **On-chain Activity**:展示数据直接从链上读出。

## 剪辑技巧

- **分段录,后期剪。** 每段单独录,失败只重录那一段。
- **剪掉等待。** Phantom 弹窗、交易确认的几秒钟剪掉或加速。
- **鼠标慢一点**,点之前停半秒,观众才看得清点了哪里。
- **旁白另外录。** 先录画面,再对着画面录旁白。

## 评委可能问的问题

**钱放在哪里,谁能动?** Escrow 是 PDA:由程序地址和种子推导出来,没有私钥,只有程序的指令才能转出。但程序目前可以升级,持有升级权限的部署钱包可以改规则,这是原型阶段的局限。

**为什么是 70%?** 团长需要钱去下单。全额保障团用等额保证金抵消这笔预付款的风险。

**团长用小号凑满怎么办?** 全额保障团里,每个名额的保证金都对应自己的预付款,所以团长和小号串通只是左手倒右手,拿不走真实买家的钱。但成团信号和信誉记录仍然可以被刷,所以成团不代表真实需求。

**买家收到货还谎称没收到怎么办?** 全额保障团里,团长可以查看买家记录,决定是否给可疑买家发货,不发货也不亏。但发了货又被谎报,就会损失这个名额的钱。计划用投诉押金和陪审团解决。

**为什么不是到期自动放款?** Solana 程序不能定时运行,所以要有人发一笔结算交易。任何人都可以发,钱只会转到合约固定的地址。

**申诉期为什么只有 60 秒?** 这是 Devnet 演示构建。正式构建是 7 天,由合约固定,团长改不了。界面上申诉截止时间旁边也写着这一点。

**合约怎么知道货有没有寄出?** 它不知道。发货记录只是团长的声明,合约能验证的只有"有没有声明、什么时候声明的"。所以我们把两种报告分开:没有声明且过了发货期限,这是平台规则层面可以确认的事实;有声明但买家说没收到,这只是买家单方面的报告,标注为未经仲裁。团长伪造发货记录挡不住,这一点写在威胁模型里。ETA 有上限,团长没法用很远的 ETA 无限拖延。

**货在路上耽搁了怎么办?** 每个名额的报告窗口从自己的 ETA 开始算。买家可以把自己名额的截止时间延长一次,不影响其他名额,也不改团长的发货期限。

**买家一直不说话怎么办?** 每个名额到自己的截止时间后,按预设规则默认结算给团长,钱不会永远卡在合约里。界面上写的是"申诉期限内未收到买家报告,按预设规则结算",不说成买家确认收到。

**团长能不能自己参团凑人数?** 不能用自己的钱包:合约直接拒绝,整笔交易回滚,不会创建名额也不会转账。但团长仍然可以用别的钱包参团,所以成团不等于真实需求,这一点写在威胁模型里。

**为什么叫"无资金保障团"?** 这一档成团后全款直接给团长,买家报告未收到也拿不回钱,只留下记录。改名是为了不让人误以为"信任"代表平台担保。团长主页上这类报告标注为"未经仲裁",不算确认违约。

**为什么做成像素桌面?** 每个功能是一个独立窗口,团购详情、托管余额、我的订单和链上动态可以并排打开对照。
