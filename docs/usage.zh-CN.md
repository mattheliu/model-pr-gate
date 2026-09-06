# CI、CLI 和开发说明

[English](usage.md) · **简体中文** · [项目首页](../README.zh-CN.md)

先使用 [README 中的工作流](../README.zh-CN.md#接入仓库)。验证需要已有的可信生成平台；
[签发接入说明](signer.zh-CN.md) 介绍如何为最终 PR 提交出具证明。

## 配置

仓库 Actions 变量 `MODEL_GATE_TRUSTED_KEYS` 是签发方名称到 Ed25519 **公钥 PEM** 的映射。
将下面的占位符替换成维护者认可的真实公钥：

```json
{"generation-service":"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"}
```

签名私钥留在可信生成平台内，不放进 PR 或验证任务。验证器不接受私钥作为信任配置。

| Action 参数 | 默认值 | 作用 |
| --- | --- | --- |
| `trusted-keys` | 必填 | 可信签发方公钥的 JSON 映射 |
| `allowed-models` | Astra 和 Fable 5.1 | 每行一个精确 ID，替换默认白名单 |
| `language` | `en` | 提示语言：`en` 或 `zh-CN` |
| `mode` | `enforce` | `report` 只报告，不因拒绝或缺少证明而阻止运行 |

例如，明确列出默认模型，并使用中文提示：

```yaml
- uses: mattheliu/model-pr-gate@v0.4.0
  with:
    trusted-keys: ${{ vars.MODEL_GATE_TRUSTED_KEYS }}
    language: zh-CN
    allowed-models: |
      gpt-6-astra
      claude-fable-5-1
```

Fable 5 不是 Fable 5.1：`claude-fable-5-high`、`claude-fable-5` 均不符合默认策略。
不做模糊匹配。[Fable 5.1 官方模型 ID](https://platform.claude.com/docs/en/models/fable-5-1/overview)。
配置错误始终失败，`report` 模式也一样。

## 保护检查

**公钥配置和工作流都必须受保护**，否则贡献者可能把验证器替换成直接返回成功的步骤。
支持时，使用组织/企业的[必需工作流规则](https://docs.github.com/en/enterprise-cloud%40latest/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)，
从可信仓库指定工作流，并限制绕过权限。同名必需状态不能证明实际执行了哪段代码。
如果仓库无法强制使用可信工作流，仍需维护者监督。

正式使用时可固定到审核过的 commit SHA，避免标签移动造成代码变化。
自定义 runner 需要 Node.js 22+。Action 读取 GitHub 已提供的 PR 事件，核对仓库、
PR 编号和当前 head SHA，无需检出代码、token 或网络请求。
不要使用测试合并 SHA，也不要从证明里复制待核对的值。

## 结果与限制

| 默认退出码 | 结果 | 意思 |
| --- | --- | --- |
| 0 | `verified` | 签名可信、PR/head 匹配、模型符合要求 |
| 1 | `rejected` | 证明无效、不匹配或模型不符合 |
| 2 | `unverified` / 出错 | 缺少证明，或者配置、事件有误 |

Action 输出 `verdict`、`reason`、`evidence-level`；CLI JSON 使用 `evidenceLevel`。
`trusted-issuer` 表示信任配置中的签发方，不代表提供商独立认证。
CI 日志只有固定结果，不打印证明内容、模型名或路径。
[按 reason 排查](agent-guide.zh-CN.md#检查失败怎么办)。

`report` 模式下，拒绝和缺少证明也可能退出 0，所以要看 verdict，不能只看命令是否成功。
配置错误仍然退出 2。

新增提交需要新证明。当前未实现证明到期、自动撤销或合并队列，换公钥后需要重跑检查。
PR 编辑后的 CI 更新是异步的，旧的绿色状态不是即时撤销机制。
更新证明时只保留一份当前证明，并保留其他 PR 正文。

## 本地 CLI

```sh
npm install --global github:mattheliu/model-pr-gate#v0.4.0
model-pr-gate --proof proof.txt --keys trusted-keys.json \
  --repository OWNER/REPO --pr 123 --sha FULL_HEAD_SHA
model-pr-gate --lang zh-CN --help
```

PR head 需要独立获取，例如运行
`gh pr view 123 --repo OWNER/REPO --json number,headRefOid,url`，使用返回的 `headRefOid`。
CLI 使用默认模型策略；自定义白名单可通过 Action、SDK 或 DSH 插件配置。

个人需要离线查看模型记录时，可以运行：

```sh
model-session-audit codex ./session.jsonl
model-session-audit claude ./session.jsonl
```

这只是本地记录检查，**不是签名证明，也不能授权合并**。原始 session 留在本地。
可选审计 Action 位于 `mattheliu/model-pr-gate/actions/session-audit@v0.4.0`，
仅用于 runner 原本已有该文件的情况，不要为了检查而上传隐私日志。[隐私说明](../PRIVACY.zh-CN.md)。

## 开发与迁移

在源码仓库中运行：

```sh
npm test
npm run demo
npm run pack:dsh
```

测试使用合成数据和一次性密钥。CI 覆盖 Node.js 22 / 24 和真实 DSH 安装包集成。
可选 [DSH 指南](../plugins/dsh/README.zh-CN.md) 包含安装、配置、卸载和插件开发说明。

v0.3 的根目录 Action 从日志审计改为签名验证，旧 HTTP GitHub App 已移除，
v0.2 仍保留在 Git 历史中。当前验证无需后台服务，不分发真实会话或凭据。[MIT 许可](../LICENSE)。
