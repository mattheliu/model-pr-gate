# Model PR Gate

[English](README.md) · **简体中文**

**凭签名证明，只接受 Astra 和 Fable 5.1 的 PR，不上传 session。**

可信生成平台出具一份小证明，仓库自己的 CI 离线验签。不需要第三方 GitHub App、会话上传、API key 或后台服务。需要 Node.js 22+，零第三方依赖。

**工具验证已有证据，不会凭代码猜模型。** 你需要一个可信的生成平台来签发证明。本项目提供签发和验证代码，但尚未接入 OpenAI 或 Anthropic 的原生证明服务。没有可信签发方时，结果就是“无法验证”。

## 会分享什么？

只有模型 ID、提交 SHA、签发方、仓库、PR 编号、格式版本和签名。仓库和 PR 编号用于防止证明被复制到其他地方。

不包含对话、代码、session ID、请求 ID、个人路径或时间戳；格式会拒绝额外字段。证明是签名，不是加密，能看 PR 的人也能解码这些字段。

由生成平台把证明自动附到 PR 正文里，提交者不需要找日志或上传 session。

## 仓库怎么接？

先把可信签发方的**公钥**放到仓库 Actions 变量 `MODEL_GATE_TRUSTED_KEYS`，内容是 JSON：
`{"generation-service":"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"}`。

私钥始终留在可信生成平台，不交给贡献者的 PR 任务。然后加这个工作流：

```yaml
name: Model proof
on:
  pull_request:
    types: [opened, reopened, synchronize, edited, ready_for_review]
permissions: {}
concurrency:
  group: model-proof-${{ github.event.pull_request.number }}
  cancel-in-progress: true
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: mattheliu/model-pr-gate@v0.3.1
        with:
          trusted-keys: ${{ vars.MODEL_GATE_TRUSTED_KEYS }}
```

无需 checkout，也不需要 token。Action 只读取 GitHub 已经提供给 runner 的 PR 事件，不发 API 请求。自定义 runner 要有 Node.js 22+；正式使用可以固定到审核过的 commit SHA。

**要防止绕过，公钥和工作流都必须受保护。** 贡献者不能把验证步骤改成直接返回成功。支持时，请使用组织或企业的[必需工作流规则](https://docs.github.com/en/enterprise-cloud%40latest/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)，从可信仓库指定工作流，并限制绕过权限。仅要求一个同名状态成功，不能证明真正的验证器运行过。如果无法强制使用可信工作流，就需要维护者监督，不能宣称它是无法绕过的合并门禁。

## 默认接受哪些模型？

| 模型 | 精确匹配的 ID |
| --- | --- |
| Astra | `gpt-6-astra` |
| Fable 5.1 | `claude-fable-5-1` |

Fable 5，包括 `claude-fable-5-high`，不会通过。不做模糊匹配。[Fable 5.1 官方 ID](https://platform.claude.com/docs/en/models/fable-5-1/overview)。

可选参数：`language: zh-CN` 使用中文提示；`mode: report` 只报告，不因证明缺失或无效而阻止；`allowed-models` 每行一个 ID，替换默认白名单。配置错误始终失败，默认模式是 `enforce`。

| 退出码 | 结果 | 意思 |
| --- | --- | --- |
| 0 | `verified` | 签名可信，PR 和提交匹配，模型符合要求 |
| 1 | `rejected` | 证明无效、不匹配或模型不符合 |
| 2 | `unverified` / 出错 | 缺少证明，或者配置、事件有误 |

Action 输出 `verdict`、`reason`、`evidence-level`。CI 日志只有固定结果，不打印证明内容或模型名。`trusted-issuer` 表示信任该签发方，不代表提供商独立背书。

## 谁来签发？

见[签发接入说明](docs/signer.zh-CN.md)。签发方必须控制生成过程，并确认最终提交。给客户端随便报的模型名称或可修改的 session 签名，不会让它变可信。

代码新增提交后必须重新签发。当前没有证明到期或自动撤销，换公钥后需要重新跑检查。CI 异步执行，PR 编辑后存在更新延迟；旧的绿色状态不是即时撤销机制。暂不支持合并队列。

## 给编码 Agent 使用

可直接阅读[Agent 使用指南](docs/agent-guide.zh-CN.md)，或导入
[Model PR Gate skill](skills/model-pr-gate/SKILL.md)。指南和 skill 均有中英文版本，
覆盖仓库接入、PR 验证和可信签发平台接入，不会把本地日志当成认证证据。

## 本地工具

```sh
npm install --global github:mattheliu/model-pr-gate#v0.3.1
model-pr-gate --proof proof.txt --keys trusted-keys.json \
  --repository OWNER/REPO --pr 123 --sha FULL_HEAD_SHA
model-pr-gate --lang zh-CN --help
```

个人需要离线查看自己的模型记录时，另有审计命令：

```sh
model-session-audit codex ./session.jsonl
model-session-audit claude ./session.jsonl
```

本地审计**不是**签名证明。原始 session 留在本地。旧审计 Action 放在 `mattheliu/model-pr-gate/actions/session-audit@v0.3.1`，仅适用于 runner 原本就有日志的情况，不推荐为了检查而上传隐私日志。

## 隐私、迁移和开发

[隐私说明](PRIVACY.zh-CN.md)。仓库不含真实会话或凭据。

v0.3 的默认 Action 从日志检查改为签名验证，旧 HTTP GitHub App 已移除，v0.2 仍保留在 Git 历史中。这一版不启动任何服务。

```sh
npm test
npm run demo
```

测试使用合成数据，覆盖签名篡改、跨 PR 复用、隐私和 CLI/CI 接入。MIT 许可。
