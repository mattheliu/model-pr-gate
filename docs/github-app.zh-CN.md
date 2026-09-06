[English](github-app.md) · **简体中文**

# Model PR Gate

默认从一个本地只读的 session 检查工具开始：汇总 Codex / Claude Code 记录中的模型，检查是否符合白名单。Node.js 22+，零第三方运行时依赖。需要远端准入时，可选用项目中的签名验证 GitHub App 原型。

**它验证的是可信生成系统签发的声明，无法仅通过代码判断实际使用了哪个模型。** 当前项目包含验证服务、签名工具、密钥工具、演示和测试；尚未接入具体模型提供商，也未部署到真实仓库。

## 本地体验

在项目目录运行：

```sh
npm test
npm run demo
```

演示使用临时内存密钥，展示 Astra、Fable 5.1 通过，其他模型及缺失证明被拒绝。测试包含真实 HTTP webhook 请求和模拟 GitHub API，不会写入 GitHub。

## 默认方案：本地检查，最小输出

```sh
node bin/inspect-session.js codex /path/to/session.jsonl gpt-6-astra
node bin/inspect-session.js claude /path/to/session.jsonl
```

无需安装依赖，无需 API key，无需联网，无后台进程。每次仅检查你显式指定的文件；逐行读取后丢弃原始记录，不复制 session，不自动扫描其他目录，不写缓存。

输出仅包含模型标识、记录计数、完整性提示和本地白名单比对结果。不会导出对话、代码、工具参数、工作目录、session ID、request ID、response ID、时间戳或完整日志。请求 ID 仅在内存中散列去重，用于计数。不要把原始 session 加入 PR 附件。

- `observed-models-allowed` / 退出码 0：观察到的模型都在白名单，**不代表日志完整或 PR 已被认证**。
- `observed-disallowed-model` / 退出码 1：观察到白名单以外模型。
- `unknown` / 退出码 2：记录不足、解析失败或证据关联不完整。

Codex 读取 `turn_context.payload.model`（配置模型），统计 `token_usage_record.payload.response_id`。Claude Code 读取 assistant 消息的 `message.model`（本地记录的响应模型），按顶层 `requestId` 去重，忽略 `<synthetic>`。模型记录数不等于 API 请求数；重试、流式分段、子任务和缺失日志可能影响覆盖范围。本工具不会从提示词或代码中搜索模型名，也不会将模型别名自动映射成另一个版本。

默认只接受 `gpt-6-astra` 与 `claude-fable-5-1`，不接受 Fable 5 的 ID。严格准入需要可信调用网关核对实际模型，并将证明绑定 PR head SHA。若采用这一步，仅传递最小模型证明，无需上传对话或源代码；下方 GitHub App 是可选原型，不是默认运行方式。

## 可选 GitHub App 工作方式

1. 可信生成系统执行模型调用、生成变更、推送提交、创建 PR。
2. 系统从自身执行记录提取模型标识和 runId，读取最终 head SHA，为仓库、PR 编号、SHA、模型等字段签署 Ed25519 证明。
3. 系统将证明添加到 PR 正文。正文可保留普通文字，证明必须且只能出现一次。
4. GitHub 的 PR webhook 触发独立服务。服务验证 webhook HMAC，再读取 GitHub 上 PR 的最新正文和 SHA。
5. 服务验证证明签名、签发方权限、模型白名单和提交绑定，写入 `model-pr-gate` Check Run，结果为 success 或 failure。
6. 仓库分支规则要求该 GitHub App 的检查成功，才能合并。

服务不检出或执行 PR 代码。策略和可信公钥位于服务端，PR 无法修改它们。

## 接入可信签发系统

生成证明密钥（与 GitHub App 的 RSA 私钥是两套独立密钥）：

```sh
node bin/keygen.js keys
cp policy.example.json policy.local.json
```

将 `keys/issuer-public.pem` 的完整 PEM 文本填入 `policy.local.json` 的 `trustedIssuers.generation-service.publicKey` 字段；可用以下命令完成：

```sh
node --input-type=module -e 'import fs from "node:fs"; const p=JSON.parse(fs.readFileSync("policy.local.json","utf8")); p.trustedIssuers["generation-service"].publicKey=fs.readFileSync("keys/issuer-public.pem","utf8"); fs.writeFileSync("policy.local.json",JSON.stringify(p,null,2));'
```

将 `payload.example.json` 复制为自己的 payload，设置以下字段：

| 字段 | 含义 |
| --- | --- |
| version | 固定为 1 |
| issuer | 与策略中的签发方名称一致 |
| repository | 目标仓库的准确 `OWNER/REPO` |
| number | PR 编号，整数 |
| sha | PR 当前 head 的完整 40 位 SHA |
| model | 精确匹配白名单，区分大小写 |
| runId | 可信生成系统中的可审计任务 ID |
| issuedAt | 签发时的 Unix 秒时间戳 |

在可信生成系统中运行：

```sh
node bin/sign.js keys/issuer-private.pem payload.json
```

将输出的 `<!-- model-pr-gate:... -->` 注释加入 PR 正文。新提交需要针对新的 SHA 重新签发。证明没有时间到期机制：它长期证明某个固定提交的生成记录；未来超过 60 秒的签发时间会被拒绝。

**签发接口不能接受贡献者随意传入的模型名称和 SHA 后直接签名。** 系统必须控制调用、确认实际返回的模型标识、追踪变更并校验签发的最终提交。如果发生模型 fallback、人工修改或多个模型共同参与，系统应记录实际情况，只为符合策略的完整变更签发证明。`bin/sign.js` 是底层签名工具，不会自行检查这些事实。

默认 ID 为 `gpt-6-astra` 和 `claude-fable-5-1`。Fable 5.1 的调用 ID 已根据 [Anthropic 官方文档](https://platform.claude.com/docs/en/models/fable-5-1/overview)核实；不接受 Fable 5，也不按模糊前缀放行。只将签名私钥保存在可信生成系统，验证服务仅需公钥。

## 安装 GitHub App

在 GitHub 创建 App，配置：

- Repository permissions：**Pull requests: Read-only**、**Checks: Read and write**；Metadata 使用默认 Read-only。
- Subscribe to events：**Pull request**。
- Webhook URL：`https://YOUR-SERVICE/webhooks/github`，使用 JSON。
- Webhook secret：至少 32 个随机字符。
- 生成 GitHub App RSA 私钥，记录 App ID，将 App 安装到目标仓库。

部署 Node 服务，准备配置：

```sh
cp .env.example .env
# 编辑 .env：App ID、App RSA 私钥路径、webhook secret、策略路径
node --env-file=.env src/server.js
```

默认监听 `127.0.0.1:3000`，通过 HTTPS 反向代理暴露 webhook；`GET /healthz` 返回存活状态。密钥和 `.env` 不应提交。示例策略保留占位公钥，未配置时服务会启动失败。

在一个测试 PR 上触发检查成功后，为目标分支配置 required status check：选择 **model-pr-gate**，并将来源限制为刚安装的 GitHub App。不要选“任何来源”；其他 Action 或账号的同名状态不能作为可信证明。关闭不需要的绕过权限，并保护策略管理入口。

当前支持 opened、reopened、synchronize、edited、ready_for_review。对已经存在的 PR，可编辑正文触发检查。未实现 Checks 页面的 Re-run webhook；重新检查请编辑 PR 或在 App 设置中重新投递 delivery。

## 边界与上线要求

- 这是可本地运行的 MVP，不是已验证的生产部署。真实安装权限、fork PR、分支保护阻断和网络部署仍需在目标仓库做端到端验收。
- GitHub Check Run 属于提交 SHA，而不是独立的 PR 授权记录。同一仓库多个 PR 共用同一 head SHA 时，检查可能复用或相互覆盖。若必须严格隔离到 PR，应要求每个 PR 使用唯一 head 提交，或增加最终合并服务在合并前重新校验 PR；本版不提供该合并服务。
- GitHub webhook 是异步的。正文编辑后的状态更新存在短暂窗口。对固定 SHA 的成功签名本身仍可验证，但不要将删除正文当作即时撤销机制。
- 本版同步处理 webhook，每次 GitHub API 请求有 8 秒超时；总处理时间可能超过 GitHub delivery 等待时间。失败返回 503，不会伪造成功；GitHub 不保证自动重投失败事件，需要监控并重新投递。既有成功检查不会因服务停机自动失效。
- 同一个 PR 的事件在单个进程内串行执行，并读取最新 PR 状态，避免简单的乱序覆盖；本版仅适用于单实例。生产使用应加入持久化任务队列、按 PR 分布式串行化、失败重试和周期性对账。
- 模型白名单或公钥变化后，需要重启并重新检查相关开放 PR；已有绿色检查不会自动撤销。未实现定时撤销、模型混用分析、逐行来源追踪、merge queue 的 merge_group 支持。
- 签名证明的是签发方的声明。生成系统被攻破或签发方谎报模型时，这个验证器无法独立发现。

## 文件

- `src/proof.js`：签发与验证模型证明。
- `src/github.js`：App JWT、installation token、GitHub REST 客户端。
- `src/server.js`：webhook 服务和 Check Run 发布。
- `bin/`：密钥、签名和离线演示工具。
- `test/gate.test.js`：证明篡改、权限限制、webhook、竞态和 API 故障测试。

## GitHub 官方参考

- [Webhook 签名校验](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [GitHub App 身份认证](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app)
- [Check Runs API](https://docs.github.com/en/rest/checks/runs)
- [受保护分支与必需检查](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
