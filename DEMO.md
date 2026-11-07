# DropSafe 2 分钟演示脚本

旁白用英文,方便评委听懂;中文是给你的提示。

## 录制前准备(提前 15 分钟)

- Phantom 打开 Testnet Mode,选 Solana Devnet。准备 3 个账户(A 团长,B、C 买家),各有至少 1 SOL。可在 https://faucet.solana.com 领取。
- 录制用线上地址。首次打开时需要在 Phantom 里批准连接这个网站。
- 钱包弹窗出现后要在 30 秒内确认。拖太久交易会过期,页面会提示重试。如果弹窗没出现,点工具栏的 Phantom 图标,或者刷新页面重试。
- **提前准备一个“失败活动”**:目标 3 人、截止时间约 5 分钟、用 B 参与一次。
- **提前准备一个“申诉活动”**:打开 `/create?demo=1`(发货期和申诉期各 2 分钟),目标 1 人,截止时间选 2 min。用 B 参与,用 A 提取 70%。大约 3–4 分钟后,它会进入 Dispute window,然后马上开录这一段,这个窗口只有 2 分钟。
- 导航栏可以切换 EN / 中文。视频建议用英文,也可以切一下展示中文。
- 打开 Explorer 标签页备用。Devnet 偶尔会慢,交易确认时可以剪掉等待。

## 脚本

### 0:00–0:15 痛点(停在首页)

> "Fans organize group buys for K-pop albums and limited drops every day. Buyers send money straight to the organizer's wallet and hope. DropSafe puts that money in an on-chain escrow on Solana instead."

### 0:15–0:30 创建活动(账户 A,团长)

点 **Create a group buy**,填 `K-pop album group order`、`0.1` SOL、目标 `2`,截止时间选 **1 hour**,在 Phantom 确认。

> "An organizer sets a price, a target and deadlines. This creates an escrow account owned by our program. It has no private key, so not even the organizer can take money out directly."

### 0:30–0:50 买家参与(切到 B,再切到 C)

各点一次 **Join for 0.1 SOL**。指一下名额团子和 **Where the money is** 面板,点 **View on Solana Explorer** 展示余额。

> "Buyers join, and the SOL goes into escrow, not to the organizer. Anyone can verify that on Solana Explorer."

### 0:50–1:10 分阶段放款(切回 A,提取后切到 B)

A 点 **Withdraw 0.14 SOL (70%)**。切到 B,点 **I got my goods. Release 0.03 SOL**。

> "The target is reached, but the organizer only gets 70% to place the order. The last 30% stays locked. When a buyer has their goods, they confirm, and only then does their share go to the organizer."

### 1:10–1:30 未收到货(B,打开提前准备的申诉活动)

点 **I didn't get my goods. Get ... SOL back**,确认,展示 Explorer 链接。

> "If the shipping deadline passes and the goods never came, the buyer reports it and takes their 30% back. If nobody complains by the end of the dispute window, the organizer can claim the rest."

### 1:30–1:45 没达标(B,打开提前准备的失败活动)

点 **Get my 0.1 SOL back**,确认。

> "And if the group buy never fills, every buyer takes their money back themselves. No customer service, no asking the organizer."

### 1:45–2:00 收尾

> "To be clear about the limits: an organizer who runs off after withdrawing still keeps the 70%, so we cap the damage rather than remove it. Next up are organizer deposits and dispute handling. DropSafe: no target, no payout. Live on Solana Devnet. Thanks!"

## 评委可能问的问题

**为什么钱是安全的?** Escrow 是 PDA:由程序地址和种子推导出来,没有私钥,只有程序按规则才能转出。

**怎么防止重复参与和重复退款?** Contribution PDA 只能 `init` 一次,所以不能重复参与。退款时关闭这个账户,所以不能重复退款。

**团长达标后拿钱跑路怎么办?** 他最多卷走 70%,剩下 30% 买家可以在发货期限后取回。这是限制损失,不是彻底解决,下一步是团长保证金。

**买家收到货还谎称没收到怎么办?** 他能拿回 30%,目前没有仲裁,这是当前版本的局限。

**团长能用小号凑人数吗?** 能。保证金机制可以提高这样做的成本。

**为什么不是到期自动放款?** Solana 程序不能定时运行,所以申诉期结束后,要由团长发一笔交易来领取。

**团长一直不提取,钱会卡死吗?** 不会。过了发货期限,团长就不能再提取,买家可以全额取回。
