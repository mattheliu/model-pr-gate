# 给 Agent 的使用指南

[English](agent-guide.md) · **简体中文**

把这份指南交给正在操作仓库的 Agent 即可。需要自动发现 skill 时，把完整的 [`skills/model-pr-gate`](../skills/model-pr-gate) 目录导入 Agent 支持的 skill 目录，保留子目录结构。入口是 `SKILL.md`，同时提供中文说明和可复制的工作流模板。不需要插件、后台进程或托管 App。

## 可以直接这样交代 Agent

**给仓库接 CI**

> 使用 Model PR Gate skill，为这个仓库接入离线证明验证。保持默认 Astra/Fable 5.1 白名单，保护工作流和可信公钥，不上传 session。如果没有可信签发平台，先准备接入并明确说明缺少什么，不要临时编造一个签发方。

**处理一个 PR**

> 使用 Model PR Gate skill，检查 PR #123 当前 head SHA 的模型证明。从我们已有的可信生成平台取得证明，保留 PR 正文，不要为了让检查通过而修改仓库策略。

**接入已有生成平台**

> 使用 Model PR Gate skill，为这个可信生成服务加入最小证明签发。模型和最终提交必须来自服务的执行记录，私钥留在服务内，证明里不要加入对话、session 或请求数据。

## Agent 需要什么？

| 任务 | 输入 | 交付 |
| --- | --- | --- |
| 接仓库 CI | 目标仓库、已有签发方公钥、配置 CI 的授权 | 工作流、公钥配置和强制检查状态 |
| 验证 PR | 仓库/PR、当前 head SHA、证明、可信公钥 | `verified`、`rejected` 或 `unverified`，以及原因 |
| 接签发平台 | 可信执行记录、签发环境 | 由现有授权平台附到 PR 的最小证明 |
| 个人日志审计 | 用户明确指定的本地 session 路径 | 未认证的观察结果，不能作为合并证明 |

项目不附带正式签发方。可以用新生成的本地密钥做合成测试，但不能为了通过自己提交的 PR，就把测试公钥登记成正式可信来源。

## 最小接入步骤

使用[工作流模板](../skills/model-pr-gate/references/model-proof.yml)，把维护者认可的 Ed25519 公钥配置到 `MODEL_GATE_TRUSTED_KEYS`。Action 自动从 GitHub PR 事件获得仓库、PR 编号和 head SHA，不用配置 session 路径，更不用上传对话。

模型使用准确 ID：`gpt-6-astra`、`claude-fable-5-1`，不接受 Fable 5。固定版本时，Agent 应先解析并审核实际 commit SHA。支持时用来自可信仓库的必需工作流规则防篡改；无法强制保护时，明确说明仍依赖维护者监督。

## 本地验证已有证明

```sh
npm install --global github:mattheliu/model-pr-gate#v0.3.1
gh pr view 123 --repo OWNER/REPO --json number,headRefOid,url
model-pr-gate --proof proof.txt --keys trusted-keys.json \
  --repository OWNER/REPO --pr 123 --sha FULL_HEAD_SHA
```

用 `headRefOid`，不要用测试合并 SHA，也不要抄未验证证明自己声称的 SHA。新增提交后旧证明不再匹配；执行已获授权的 PR 更新前再核对一次 head。替换旧证明，不能重复追加，也不能覆盖其他正文。

## 检查失败怎么办？

| reason | 正确做法 |
| --- | --- |
| `missing-proof` | 向已有可信平台取得证明；没有平台就报告无法验证 |
| `subject-mismatch` | 核对仓库、PR 和 head，让平台针对实际提交重新签发 |
| `invalid-signature` / `invalid-proof` | 取得原始有效证明，不要手改签名内容 |
| `untrusted-issuer` | 由维护者通过既有可信渠道确认签发方身份 |
| `model-not-allowed` | 通过允许的模型生成流程处理，不把 Fable 5 改名成 5.1 |
| `configuration-error` | 检查公钥 JSON、语言/模式和 PR 事件，不打印私人输入 |

`report` 模式可能在证明失败时退出 0，要看 verdict，不能只看命令是否成功。本地日志的 `observed-*` 结果也不能当作 `verified`。

## Agent 完成后应该怎么汇报？

说明改了什么、使用的 Action 版本/commit、验证的 PR head、结果，以及尚未完成的签发或工作流保护。没有真正接入上游证明服务，就不能宣称“已获得提供商认证”。

公开 issue、Release 和测试里都不要放原始 session、提示词、密钥或个人路径。PR 只添加最小证明；它可被 PR 读者解码，并显示使用的模型。[隐私说明](../PRIVACY.zh-CN.md) · [签发接入](signer.zh-CN.md)
