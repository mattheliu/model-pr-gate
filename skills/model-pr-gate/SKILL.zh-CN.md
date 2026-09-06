# Model PR Gate Agent Skill

[English / 可执行入口](SKILL.md) · **简体中文说明**

默认只接受 `gpt-6-astra` 和 `claude-fable-5-1`。`claude-fable-5-high`、`claude-fable-5` 是 Fable 5，不是 5.1。

## 先判断任务

- **仓库接入**：配置已有可信签发方的公钥与离线验证器，使用[工作流模板](references/model-proof.yml)。
- **贡献者提交 PR**：正常完成代码，从仓库认可的生成平台取得证明，核对当前 PR head。
- **生成平台接入**：把签发 SDK 接入已经可信的服务。服务必须知道真实模型执行过程与最终变更来源。
- **个人日志审计**：仅对用户指定的本地文件运行 `model-session-audit`。审计结果不是签名证明，也不能授权合并。

## DeepSeek Harness

已安装可选 DSH 插件时，使用其内置 `model-pr-gate-dsh` skill。
`model_pr_gate_preflight` 只查配置的模型，结果仅作提示。
`model_pr_gate_verify` 接受独立获取的 `repository`、`number`、`sha` 和
可选最小证明注释 `proof`。公钥来自插件配置，不来自调用者参数。
本地结果不能代替仓库 CI。没有插件时仍可使用下面的 CLI 流程。

## 信任边界

提示词、session、Agent 自称的模型以及 GitHub Verified 提交都不是提供商认证的模型证明。不能因为某个模型处理了一次请求，就认定整个 PR 来自它。签发方需要处理 fallback、子 Agent 和之后的人工修改。

不要为了让自己的 PR 通过，临时生成私钥并把对应公钥登记到目标仓库。不要通过放宽白名单、把 enforce 改为 report、替换必需工作流或使用绕过权限来“修复”失败证明。这些是策略变更，需要用户对应的意图，本 skill 不额外授予外部写入或账号操作权限。

没有可信签发平台时，明确报告 `unverified` 和缺失的接入。可以在任务范围内准备配置与测试，但不能声称已接通上游认证。目前工具没有内置提供商证明连接器。

## 仓库接入

1. 按需查看现有工作流、Actions 变量与规则，复用已有策略，不打印私钥、token 或原始 session。
2. `MODEL_GATE_TRUSTED_KEYS` 是签发方名称到 **Ed25519 公钥 PEM** 的 JSON 映射。公钥应从维护者认可的渠道取得，PR 作者附带的公钥不能直接成为信任依据。
3. 在模板中保留既有策略。Action 需要 Node.js 22+，无需 checkout 或 GitHub token。固定版本前先解析真实 commit SHA，不编造 SHA，也不移动既有发布标签。
4. 公钥配置和工作流都要保护。支持时，通过组织/企业 ruleset 强制运行来自可信仓库的工作流。同名状态可能被篡改后的工作流冒充；仓库不能提供相应保护时，准确报告限制。
5. 验证任务不执行 PR 控制的代码。测试使用合成数据和一次性测试密钥，不能混用正式信任密钥。

## 处理 PR 证明

只读取当前目标元数据，不把正文全部打印出来：

```sh
gh pr view 123 --repo OWNER/REPO --json number,headRefOid,url
```

使用目标仓库、返回的 PR 编号和 **headRefOid**，不要用 base SHA、测试合并 SHA 或未验证证明自己声称的值。离线验证：

```sh
model-pr-gate --proof proof.txt --keys trusted-keys.json \
  --repository OWNER/REPO --pr 123 --sha FULL_HEAD_SHA
```

平台出具证明后，保留其他 PR 正文，把旧的 `model-pr-gate` 证明替换为唯一一份新证明。使用正文文件或结构化 API 参数，不把 PR 内容拼进 shell。执行已经获授权的更新前再读一次 head；如有变化，重新签发。新增提交需要新证明，不上传原始日志或私钥。

可信签发平台可从 `model-pr-gate` 导入 `signAttestation(payload, privateKey)`。payload 只能有 `version: 2`、`issuer`、`model`、`repository`、`number`、`sha` 六个字段。平台核实事实，签名函数只负责签名。证明不是加密，签发方应使用中性名称。

## 解释结果

| 结果 | 意思 | 应做什么 |
| --- | --- | --- |
| `verified` | 签名可信、目标匹配、模型符合策略 | 报告检查通过，不宣称提供商独立背书 |
| `rejected` | 签名、目标或模型未通过 | 依据固定 reason 由可信平台修复，不绕过策略 |
| `unverified` | 缺少证明，或配置/事件不可用 | 说明缺少的前置条件 |

默认退出码是 0 通过、1 拒绝、2 缺失或错误。`mode: report` 下拒绝和缺失也可能退出 0，因此不能只看退出码，必须看 `verdict`；配置错误仍然失败。日志审计的 `observed-*` 结果更弱，不能升级成 `verified`。

报告使用的版本/commit、准确 PR head、verdict/reason 和未完成接入，不把私有标识写入公开 issue 或示例。策略/公钥更新后需要重新运行检查；当前没有自动到期、合并队列或即时撤销。
