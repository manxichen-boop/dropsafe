# DropSafe 2 分钟演示脚本

旁白用英文,方便评委听懂;中文是给你的提示。

## 录制前准备(提前 15 分钟)

- Phantom 打开 Testnet Mode,选 Solana Devnet。准备 2 个账户(Account 1 当团长,Account 2 当买家),各有至少 1 SOL。可在 https://faucet.solana.com 领取。
- 用 `npm run dev` 运行时,开发模式的小图标会出现在左下角。录制最好用已部署的线上地址,或者 `npm run build && npm start`。
- **提前创建一个"失败活动"**:目标 3 人、截止时间约 5 分钟、用 Account 2 参与一次。这样录制到退款环节时它刚好已过期,不用现场等。
- 把"达标提取"所需的活动在录制中现场创建(目标 1 人,截止时间选 1 hour)。
- 打开 Explorer 标签页备用。Devnet 偶尔会慢,交易确认时可以剪掉等待。

## 脚本

### 0:00–0:20 痛点(停在首页)

> "Every day, fans organize group buys for K-pop albums and limited drops. Buyers send money straight to the organizer's wallet and just hope. If the organizer runs off, the money is gone. DropSafe fixes that with an on-chain escrow on Solana."

### 0:20–0:40 创建活动(Account 1,团长)

点 **Create campaign**,填 `K-pop album group order`、`0.1` SOL、目标 `1`,选 **1 hour**,在 Phantom 确认。

> "An organizer sets a price, a target and a deadline. This creates a campaign and an escrow account owned by our program. It has no private key, so not even the organizer can take money out directly."

### 0:40–1:05 买家参与(切到 Account 2)

点 **Join for 0.1 SOL**,确认。指一下进度条和 **In escrow**,点 Escrow account 链接到 Explorer 展示余额。

> "A buyer joins, and the SOL goes into escrow, not to the organizer. You can verify it on Solana Explorer. Each wallet can only join once, because the program creates one contribution record per buyer."

### 1:05–1:25 达标提取(切回 Account 1)

点 **Withdraw 0.1 SOL**,确认。状态变成 Released。

> "The target is reached, so now, and only now, the organizer can withdraw. Nobody else can call this, and it can't be done twice."

### 1:25–1:50 失败退款(切到 Account 2,打开提前准备的失败活动)

点 **Get my 0.1 SOL back**,确认,展示 Explorer 链接。

> "Here's the case that matters most. This campaign missed its target by the deadline. The buyer takes their money back themselves. No customer service, no asking the organizer. The program enforces it."

### 1:50–2:00 收尾

> "DropSafe: group buys the organizer can't run away with. Live on Solana Devnet, with 17 passing tests. Next up: delivery confirmation and organizer deposits. Thanks!"

## 评委可能问的问题

**为什么钱是安全的?** Escrow 是 PDA:由程序地址和种子推导出来,没有私钥,只有程序按规则才能转出。

**怎么防止重复参与和重复退款?** Contribution PDA 只能 `init` 一次,所以不能重复参与。退款时关闭这个账户,所以不能重复退款。

**团长达标后拿钱跑路怎么办?** 这是当前版本的局限,也是最诚实的回答:现在只保护"凑不齐"的情况。下一步是买家确认收货后才放款,以及团长保证金。

**团长能用小号凑人数吗?** 能,所以需要上面的确认收货和保证金机制来配合。
