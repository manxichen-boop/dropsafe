/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/dropsafe.json`.
 */
export type Dropsafe = {
  "address": "HPuN91VgkVKQ5kNRS79Q6kci1XJYBV9ux9fhQsQubxV2",
  "metadata": {
    "name": "dropsafe",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "DropSafe: on-chain group-buying escrow"
  },
  "instructions": [
    {
      "name": "cancelCampaign",
      "docs": [
        "成团前团长取消"
      ],
      "discriminator": [
        66,
        10,
        32,
        138,
        122,
        36,
        134,
        202
      ],
      "accounts": [
        {
          "name": "organizer",
          "docs": [
            "只有团长能取消"
          ],
          "signer": true
        },
        {
          "name": "campaign",
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
          "name": "organizerStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  103,
                  97,
                  110,
                  105,
                  122,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "campaign.organizer",
                "account": "campaign"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "confirmDelivery",
      "docs": [
        "买家确认收货"
      ],
      "discriminator": [
        11,
        109,
        227,
        53,
        179,
        190,
        88,
        155
      ],
      "accounts": [
        {
          "name": "buyer",
          "docs": [
            "只有买家本人能确认"
          ],
          "signer": true
        },
        {
          "name": "campaign",
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
          "name": "contribution",
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
      "name": "contribute",
      "docs": [
        "买家付款参与"
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
            "买家:必须签名,支付团购金额和租金"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "campaign",
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
            "托管金库:用种子确认它属于这个活动"
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
            "名额凭证:init 只能成功一次,同一钱包不能参与两次"
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
          "name": "organizerStats",
          "docs": [
            "团长记录:满员时给对应档位的成团数加 1"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  103,
                  97,
                  110,
                  105,
                  122,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "campaign.organizer",
                "account": "campaign"
              }
            ]
          }
        },
        {
          "name": "buyerStats",
          "docs": [
            "买家记录:第一次参与时初始化"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  121,
                  101,
                  114
                ]
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
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createCampaign",
      "docs": [
        "团长创建活动;全额保障档同时存入保证金"
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
            "团长:必须签名,支付租金;全额保障档还要存入保证金"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "campaign",
          "docs": [
            "活动账户:地址由团长和活动编号推导,同一编号不能创建两次"
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
            "托管金库,一个活动对应一个"
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
          "name": "organizerStats",
          "docs": [
            "团长记录:第一次创建活动时初始化"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  103,
                  97,
                  110,
                  105,
                  122,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "organizer"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
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
          "name": "description",
          "type": "string"
        },
        {
          "name": "imageUrl",
          "type": "string"
        },
        {
          "name": "price",
          "type": "u64"
        },
        {
          "name": "targetCount",
          "type": "u32"
        },
        {
          "name": "deadline",
          "type": "i64"
        },
        {
          "name": "deliveryDeadline",
          "type": "i64"
        },
        {
          "name": "tier",
          "type": {
            "defined": {
              "name": "tier"
            }
          }
        }
      ]
    },
    {
      "name": "finalizeCampaign",
      "docs": [
        "记录活动的最终结果,任何人都可以调用,只能一次"
      ],
      "discriminator": [
        241,
        76,
        201,
        221,
        33,
        222,
        220,
        138
      ],
      "accounts": [
        {
          "name": "caller",
          "docs": [
            "任何人都可以调用"
          ],
          "signer": true
        },
        {
          "name": "campaign",
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
          "name": "organizerStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  103,
                  97,
                  110,
                  105,
                  122,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "campaign.organizer",
                "account": "campaign"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "reclaimBond",
      "docs": [
        "团长取回保证金:活动失败、放弃或取消后"
      ],
      "discriminator": [
        18,
        133,
        105,
        58,
        246,
        52,
        103,
        31
      ],
      "accounts": [
        {
          "name": "organizer",
          "docs": [
            "只有团长能取回,收款地址就是团长自己"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "campaign",
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
    },
    {
      "name": "refund",
      "docs": [
        "买家全额取回:未成团、团长放弃、活动已取消"
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
            "买家本人"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "campaign",
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
            "名额凭证:退款后关闭,所以不能重复退款"
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
          "name": "organizerStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  103,
                  97,
                  110,
                  105,
                  122,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "campaign.organizer",
                "account": "campaign"
              }
            ]
          }
        },
        {
          "name": "buyerStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  121,
                  101,
                  114
                ]
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
      "name": "releaseUpfront",
      "docs": [
        "团长提取预付款,按档位转出"
      ],
      "discriminator": [
        166,
        159,
        45,
        33,
        185,
        139,
        208,
        163
      ],
      "accounts": [
        {
          "name": "organizer",
          "docs": [
            "只有团长能提取,收款地址就是团长自己"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "campaign",
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
          "name": "organizerStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  103,
                  97,
                  110,
                  105,
                  122,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "campaign.organizer",
                "account": "campaign"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "reportNotReceived",
      "docs": [
        "买家在申诉期内报告未收到"
      ],
      "discriminator": [
        129,
        188,
        185,
        211,
        68,
        88,
        59,
        26
      ],
      "accounts": [
        {
          "name": "buyer",
          "docs": [
            "只有买家本人能报告"
          ],
          "signer": true
        },
        {
          "name": "campaign",
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
          "name": "contribution",
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
      "name": "settleSeat",
      "docs": [
        "结算一个名额,任何人都可以调用"
      ],
      "discriminator": [
        246,
        125,
        128,
        220,
        21,
        123,
        194,
        135
      ],
      "accounts": [
        {
          "name": "caller",
          "docs": [
            "任何人都可以调用,钱只会转给合约固定的地址"
          ],
          "signer": true
        },
        {
          "name": "organizer",
          "docs": [
            "团长:收款地址由合约固定"
          ],
          "writable": true
        },
        {
          "name": "buyer",
          "docs": [
            "买家:收款和收回租金的地址由合约固定"
          ],
          "writable": true
        },
        {
          "name": "campaign",
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
            "名额凭证:结算后关闭,所以不能重复结算"
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
          "name": "organizerStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  103,
                  97,
                  110,
                  105,
                  122,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "campaign.organizer",
                "account": "campaign"
              }
            ]
          }
        },
        {
          "name": "buyerStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  121,
                  101,
                  114
                ]
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
      "name": "withdrawBeforeFill",
      "docs": [
        "成团前买家退出,全额退回"
      ],
      "discriminator": [
        112,
        68,
        187,
        207,
        233,
        102,
        128,
        167
      ],
      "accounts": [
        {
          "name": "buyer",
          "docs": [
            "买家本人"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "campaign",
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
            "名额凭证:种子里有买家地址,不能退别人的。退出时关闭,租金还给买家"
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
          "name": "buyerStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  121,
                  101,
                  114
                ]
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
    }
  ],
  "accounts": [
    {
      "name": "buyerStats",
      "discriminator": [
        99,
        111,
        219,
        74,
        172,
        73,
        248,
        140
      ]
    },
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
    },
    {
      "name": "organizerStats",
      "discriminator": [
        133,
        62,
        23,
        127,
        40,
        14,
        217,
        218
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
      "name": "descriptionTooLong",
      "msg": "Description must be 280 characters or fewer"
    },
    {
      "code": 6002,
      "name": "imageUrlTooLong",
      "msg": "Image URL must be 200 bytes or fewer"
    },
    {
      "code": 6003,
      "name": "invalidPrice",
      "msg": "Price per person must be greater than 0"
    },
    {
      "code": 6004,
      "name": "invalidTargetCount",
      "msg": "Target count must be greater than 0"
    },
    {
      "code": 6005,
      "name": "deadlineNotInFuture",
      "msg": "Deadline must be in the future"
    },
    {
      "code": 6006,
      "name": "fundraisingTooLong",
      "msg": "Fundraising can last at most 90 days"
    },
    {
      "code": 6007,
      "name": "invalidDeliveryDeadline",
      "msg": "The shipping deadline must be after the campaign deadline"
    },
    {
      "code": 6008,
      "name": "deliveryTooLong",
      "msg": "The shipping period can last at most 365 days"
    },
    {
      "code": 6009,
      "name": "notFundraising",
      "msg": "Campaign is not accepting contributions"
    },
    {
      "code": 6010,
      "name": "deadlinePassed",
      "msg": "The campaign deadline has passed"
    },
    {
      "code": 6011,
      "name": "campaignFull",
      "msg": "The campaign is already full"
    },
    {
      "code": 6012,
      "name": "notOrganizer",
      "msg": "Only the organizer can do this"
    },
    {
      "code": 6013,
      "name": "campaignStillActive",
      "msg": "Refunds open after the campaign deadline"
    },
    {
      "code": 6014,
      "name": "deliveryDeadlineNotReached",
      "msg": "Refunds open after the shipping deadline if the organizer has not withdrawn"
    },
    {
      "code": 6015,
      "name": "refundNotAvailable",
      "msg": "This campaign is not in a refundable state"
    },
    {
      "code": 6016,
      "name": "cannotCancel",
      "msg": "Only a fundraising campaign can be cancelled, before its deadline"
    },
    {
      "code": 6017,
      "name": "noBond",
      "msg": "This campaign has no organizer bond"
    },
    {
      "code": 6018,
      "name": "bondNotReclaimable",
      "msg": "The bond can be reclaimed only after the campaign failed, was abandoned or was cancelled"
    },
    {
      "code": 6019,
      "name": "bondAlreadyReclaimed",
      "msg": "The bond has already been reclaimed"
    },
    {
      "code": 6020,
      "name": "targetNotReached",
      "msg": "The campaign has not reached its target"
    },
    {
      "code": 6021,
      "name": "alreadyReleased",
      "msg": "The upfront payment has already been released"
    },
    {
      "code": 6022,
      "name": "deliveryDeadlinePassed",
      "msg": "The shipping deadline has passed, so the organizer can no longer withdraw"
    },
    {
      "code": 6023,
      "name": "notActive",
      "msg": "The organizer has not released the upfront payment yet"
    },
    {
      "code": 6024,
      "name": "seatAlreadyDecided",
      "msg": "This seat has already been confirmed or reported"
    },
    {
      "code": 6025,
      "name": "appealWindowClosed",
      "msg": "The appeal window has closed"
    },
    {
      "code": 6026,
      "name": "tooEarlyToReport",
      "msg": "Non-delivery can be reported only after the shipping deadline"
    },
    {
      "code": 6027,
      "name": "seatNotSettleable",
      "msg": "This seat cannot be settled until the buyer confirms or the appeal window closes"
    },
    {
      "code": 6028,
      "name": "notFinalizable",
      "msg": "This campaign's outcome is not decided yet"
    },
    {
      "code": 6029,
      "name": "alreadyFinalized",
      "msg": "This campaign has already been finalized"
    },
    {
      "code": 6030,
      "name": "insufficientEscrow",
      "msg": "The escrow does not hold enough funds for this payment"
    },
    {
      "code": 6031,
      "name": "wrongBuyer",
      "msg": "This contribution does not belong to this buyer"
    },
    {
      "code": 6032,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    }
  ],
  "types": [
    {
      "name": "buyerStats",
      "docs": [
        "买家的链上记录"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "campaignsJoined",
            "type": "u64"
          },
          {
            "name": "seatsConfirmed",
            "type": "u64"
          },
          {
            "name": "seatsReported",
            "type": "u64"
          },
          {
            "name": "seatsRefunded",
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
      "name": "campaign",
      "docs": [
        "一次团购活动"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "organizer",
            "type": "pubkey"
          },
          {
            "name": "campaignId",
            "type": "u64"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "imageUrl",
            "type": "string"
          },
          {
            "name": "price",
            "docs": [
              "每人金额(lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "targetCount",
            "type": "u32"
          },
          {
            "name": "joinedCount",
            "type": "u32"
          },
          {
            "name": "deadline",
            "docs": [
              "募集截止时间"
            ],
            "type": "i64"
          },
          {
            "name": "deliveryDeadline",
            "docs": [
              "发货期限"
            ],
            "type": "i64"
          },
          {
            "name": "appealEnd",
            "docs": [
              "申诉截止时间 = delivery_deadline + APPEAL_WINDOW,创建时算好存下来"
            ],
            "type": "i64"
          },
          {
            "name": "tier",
            "type": {
              "defined": {
                "name": "tier"
              }
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "campaignStatus"
              }
            }
          },
          {
            "name": "upfrontReleased",
            "type": "bool"
          },
          {
            "name": "bondTotal",
            "docs": [
              "创建时存入的保证金总额"
            ],
            "type": "u64"
          },
          {
            "name": "bondReclaimed",
            "type": "bool"
          },
          {
            "name": "seatsResolved",
            "docs": [
              "已结算的名额数"
            ],
            "type": "u32"
          },
          {
            "name": "finalized",
            "type": "bool"
          },
          {
            "name": "bump",
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
            "name": "funded"
          },
          {
            "name": "active"
          },
          {
            "name": "failed"
          },
          {
            "name": "abandoned"
          },
          {
            "name": "cancelled"
          },
          {
            "name": "closed"
          }
        ]
      }
    },
    {
      "name": "contribution",
      "docs": [
        "买家的名额凭证,结算、退款、退出时关闭,租金退还给买家"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "contributionStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "contributionStatus",
      "docs": [
        "名额状态"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "paid"
          },
          {
            "name": "confirmed"
          },
          {
            "name": "reported"
          }
        ]
      }
    },
    {
      "name": "escrow",
      "docs": [
        "托管金库:存放买家付款和团长保证金。它归本程序所有,没有私钥。"
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
    },
    {
      "name": "organizerStats",
      "docs": [
        "团长的链上记录"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "organizer",
            "type": "pubkey"
          },
          {
            "name": "campaignsCreated",
            "type": "u64"
          },
          {
            "name": "campaignsFailed",
            "type": "u64"
          },
          {
            "name": "campaignsAbandoned",
            "type": "u64"
          },
          {
            "name": "campaignsCancelled",
            "type": "u64"
          },
          {
            "name": "shielded",
            "type": {
              "defined": {
                "name": "tierStats"
              }
            }
          },
          {
            "name": "standard",
            "type": {
              "defined": {
                "name": "tierStats"
              }
            }
          },
          {
            "name": "trust",
            "type": {
              "defined": {
                "name": "tierStats"
              }
            }
          },
          {
            "name": "totalPaidToOrganizerLamports",
            "docs": [
              "实际付给团长的金额,不含退还的保证金"
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
      "name": "tier",
      "docs": [
        "保障档位,创建后不可修改"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "shielded"
          },
          {
            "name": "standard"
          },
          {
            "name": "trust"
          }
        ]
      }
    },
    {
      "name": "tierStats",
      "docs": [
        "团长在某一档位下的记录"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "funded",
            "type": "u64"
          },
          {
            "name": "seatsConfirmed",
            "docs": [
              "买家主动确认的名额"
            ],
            "type": "u64"
          },
          {
            "name": "seatsUnconfirmed",
            "docs": [
              "申诉期结束仍无回应的名额"
            ],
            "type": "u64"
          },
          {
            "name": "seatsReported",
            "docs": [
              "买家报告未收到的名额"
            ],
            "type": "u64"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "buyerSeed",
      "type": "bytes",
      "value": "[98, 117, 121, 101, 114]"
    },
    {
      "name": "campaignSeed",
      "type": "bytes",
      "value": "[99, 97, 109, 112, 97, 105, 103, 110]"
    },
    {
      "name": "contributionSeed",
      "type": "bytes",
      "value": "[99, 111, 110, 116, 114, 105, 98, 117, 116, 105, 111, 110]"
    },
    {
      "name": "escrowSeed",
      "type": "bytes",
      "value": "[101, 115, 99, 114, 111, 119]"
    },
    {
      "name": "organizerSeed",
      "type": "bytes",
      "value": "[111, 114, 103, 97, 110, 105, 122, 101, 114]"
    }
  ]
};
