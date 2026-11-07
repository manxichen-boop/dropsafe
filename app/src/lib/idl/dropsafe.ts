/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/dropsafe.json`.
 */
export type Dropsafe = {
  "address": "6KcTuoAX6u5SRdX563VhbrXWiBrMwAfGxST5ud9RaQgX",
  "metadata": {
    "name": "dropsafe",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "DropSafe: on-chain group-buying escrow"
  },
  "instructions": [
    {
      "name": "contribute",
      "docs": [
        "买家参与:把每人金额转入托管金库"
      ],
      "discriminator": [
        82,
        33,
        68,
        131,
        32,
        0,
        205,
        95
      ],
      "accounts": [
        {
          "name": "buyer",
          "docs": [
            "买家:必须签名,支付团购金额和参与凭证的租金"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "campaign",
          "docs": [
            "要参与的活动:用种子校验它确实是本程序创建的活动"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.organizer",
                "account": "campaign"
              },
              {
                "kind": "account",
                "path": "campaign.campaignId",
                "account": "campaign"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "docs": [
            "托管金库:用种子校验它确实属于这个活动,钱不会被转到别处"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "campaign"
              }
            ]
          }
        },
        {
          "name": "contribution",
          "docs": [
            "参与凭证:由 \"contribution\" + 活动地址 + 买家地址推导。",
            "`init` 只能成功一次,所以同一买家第二次参与时交易会直接失败,天然防止重复参与"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  105,
                  98,
                  117,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign"
              },
              {
                "kind": "account",
                "path": "buyer"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "docs": [
            "Solana 系统程序:转账和创建账户时需要"
          ],
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createCampaign",
      "docs": [
        "团长创建一个团购活动和它的托管金库"
      ],
      "discriminator": [
        111,
        131,
        187,
        98,
        160,
        193,
        114,
        244
      ],
      "accounts": [
        {
          "name": "organizer",
          "docs": [
            "团长:必须签名,并支付两个新账户的租金"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "campaign",
          "docs": [
            "活动账户:地址由 \"campaign\" + 团长地址 + 活动编号推导,",
            "所以同一团长不能用同一编号创建两次"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "organizer"
              },
              {
                "kind": "arg",
                "path": "campaignId"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "docs": [
            "托管金库:地址由 \"escrow\" + 活动地址推导,一个活动对应一个金库"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "campaign"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "docs": [
            "Solana 系统程序:创建账户时需要"
          ],
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "campaignId",
          "type": "u64"
        },
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "pricePerPersonLamports",
          "type": "u64"
        },
        {
          "name": "targetCount",
          "type": "u32"
        },
        {
          "name": "deadlineUnixTs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "refund",
      "docs": [
        "未达标且已过截止时间:买家取回自己的钱"
      ],
      "discriminator": [
        2,
        96,
        183,
        251,
        63,
        208,
        46,
        46
      ],
      "accounts": [
        {
          "name": "buyer",
          "docs": [
            "买家:只能本人签名取回自己的钱"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "campaign",
          "docs": [
            "要退款的活动"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.organizer",
                "account": "campaign"
              },
              {
                "kind": "account",
                "path": "campaign.campaignId",
                "account": "campaign"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "docs": [
            "这个活动的托管金库,退款从这里扣"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "campaign"
              }
            ]
          }
        },
        {
          "name": "contribution",
          "docs": [
            "买家的参与凭证:种子里有买家地址,所以不能拿别人的凭证来退款。",
            "`close = buyer` 表示退款后关闭账户、租金还给买家;",
            "账户没了,第二次退款就会失败,防止重复退款"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  105,
                  98,
                  117,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign"
              },
              {
                "kind": "account",
                "path": "buyer"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "release",
      "docs": [
        "达标后:团长提取托管金库里的 SOL"
      ],
      "discriminator": [
        253,
        249,
        15,
        206,
        28,
        127,
        193,
        241
      ],
      "accounts": [
        {
          "name": "organizer",
          "docs": [
            "调用者:必须签名,并且必须是这个活动的团长,否则返回 NotOrganizer"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "campaign",
          "docs": [
            "要提取资金的活动"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.organizer",
                "account": "campaign"
              },
              {
                "kind": "account",
                "path": "campaign.campaignId",
                "account": "campaign"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "docs": [
            "这个活动的托管金库"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "campaign"
              }
            ]
          }
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "campaign",
      "discriminator": [
        50,
        40,
        49,
        11,
        157,
        220,
        229,
        192
      ]
    },
    {
      "name": "contribution",
      "discriminator": [
        182,
        187,
        14,
        111,
        72,
        167,
        242,
        212
      ]
    },
    {
      "name": "escrow",
      "discriminator": [
        31,
        213,
        123,
        187,
        186,
        22,
        218,
        155
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "titleTooLong",
      "msg": "Title must be 50 characters or fewer"
    },
    {
      "code": 6001,
      "name": "invalidPrice",
      "msg": "Price per person must be greater than 0"
    },
    {
      "code": 6002,
      "name": "invalidTargetCount",
      "msg": "Target count must be greater than 0"
    },
    {
      "code": 6003,
      "name": "deadlineNotInFuture",
      "msg": "Deadline must be in the future"
    },
    {
      "code": 6004,
      "name": "notFundraising",
      "msg": "Campaign is not accepting contributions"
    },
    {
      "code": 6005,
      "name": "deadlinePassed",
      "msg": "The campaign deadline has passed"
    },
    {
      "code": 6006,
      "name": "campaignFull",
      "msg": "The campaign is already full"
    },
    {
      "code": 6007,
      "name": "campaignStillActive",
      "msg": "The campaign is still active; refunds open after the deadline"
    },
    {
      "code": 6008,
      "name": "targetAlreadyReached",
      "msg": "The campaign reached its target, so refunds are not available"
    },
    {
      "code": 6009,
      "name": "notOrganizer",
      "msg": "Only the organizer can do this"
    },
    {
      "code": 6010,
      "name": "targetNotReached",
      "msg": "The campaign has not reached its target"
    },
    {
      "code": 6011,
      "name": "alreadyReleased",
      "msg": "Funds have already been released"
    },
    {
      "code": 6012,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    }
  ],
  "types": [
    {
      "name": "campaign",
      "docs": [
        "一次团购活动。任何人都能读取,只有本程序能修改。"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "organizer",
            "docs": [
              "团长的钱包地址"
            ],
            "type": "pubkey"
          },
          {
            "name": "campaignId",
            "docs": [
              "团长自选的活动编号,用来区分同一团长的多个活动"
            ],
            "type": "u64"
          },
          {
            "name": "title",
            "docs": [
              "活动名称"
            ],
            "type": "string"
          },
          {
            "name": "pricePerPersonLamports",
            "docs": [
              "每人需要支付的金额(单位 lamports,1 SOL = 10 亿 lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "targetCount",
            "docs": [
              "目标人数,达到后团长才能提取"
            ],
            "type": "u32"
          },
          {
            "name": "contributorCount",
            "docs": [
              "当前参与人数。退款时不减少,这样已失败的活动不可能\"变回\"达标"
            ],
            "type": "u32"
          },
          {
            "name": "deadlineUnixTs",
            "docs": [
              "截止时间(Unix 时间戳,单位秒)"
            ],
            "type": "i64"
          },
          {
            "name": "status",
            "docs": [
              "活动状态"
            ],
            "type": {
              "defined": {
                "name": "campaignStatus"
              }
            }
          },
          {
            "name": "bump",
            "docs": [
              "Campaign PDA 的 bump,之后校验地址时不用重新计算"
            ],
            "type": "u8"
          },
          {
            "name": "escrowBump",
            "docs": [
              "Escrow PDA 的 bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "campaignStatus",
      "docs": [
        "活动状态"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "fundraising"
          },
          {
            "name": "failed"
          },
          {
            "name": "released"
          }
        ]
      }
    },
    {
      "name": "contribution",
      "docs": [
        "买家的参与凭证。每个买家在每个活动里只有一个,既防止重复参与,也记录可退金额。"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "campaign",
            "docs": [
              "所属活动"
            ],
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "docs": [
              "买家钱包地址"
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "实际支付的金额,退款时按此金额退回"
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "escrow",
      "docs": [
        "托管金库:买家的 SOL 存放在这个账户的余额里。",
        "它归本程序所有,没有私钥,团长也无法直接转走,只有程序按规则才能动用。"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "campaignSeed",
      "docs": [
        "Campaign PDA 的种子前缀"
      ],
      "type": "bytes",
      "value": "[99, 97, 109, 112, 97, 105, 103, 110]"
    },
    {
      "name": "contributionSeed",
      "docs": [
        "Contribution(买家参与凭证)PDA 的种子前缀"
      ],
      "type": "bytes",
      "value": "[99, 111, 110, 116, 114, 105, 98, 117, 116, 105, 111, 110]"
    },
    {
      "name": "escrowSeed",
      "docs": [
        "Escrow(托管金库)PDA 的种子前缀"
      ],
      "type": "bytes",
      "value": "[101, 115, 99, 114, 111, 119]"
    }
  ]
};
