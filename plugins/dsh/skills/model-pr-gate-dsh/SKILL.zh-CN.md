# 在 DeepSeek Harness 中使用 Model PR Gate

调用 `model_pr_gate_preflight`，参数为 `{}`，检查当前 Agent **配置的**模型。
`allowed` 只作提示：它不检查实际请求、回退模型、子 Agent、此前编辑或手工修改。
不能把它说成“PR 已通过来源验证”。

默认允许 `gpt-6-astra` 和 `claude-fable-5-1`。`claude-fable-5-high` 属于 Fable 5，
不是 5.1。DeepSeek 模型需要维护者批准修改白名单才符合要求。
修改 DSH 配置不会修改仓库 CI 的策略。

验证 PR 时：

1. 独立获取目标仓库、PR 编号及最新的 `headRefOid`，例如：
   `gh pr view 123 --repo OWNER/REPO --json number,headRefOid,url`。
   不从证明中复制待核对信息，也不使用 merge-test SHA。
2. 向已有可信生成平台获取证明。调用 `model_pr_gate_verify`，传入 `repository`、
   `number`、`sha`，以及只含最小 HTML 注释的 `proof`；缺少证明就省略 `proof`。
   不向工具传完整 PR 正文、session、提示词、代码、API key 或签名私钥。
3. 查看 `verdict`、`reason`、`evidenceLevel`。缺少可信公钥时，使用维护者已有的
   信任配置，不直接采纳 PR 作者给出的公钥。缺少证明就是 `unverified`，不能伪造。
4. 在已获授权更新 PR 的任务中，保留其他正文，用结构化 API 参数或正文文件把旧证明
   替换成唯一的新证明。更新前重读 head；有新提交就重新获取证明。
   插件的两个工具只读，本身不会附加证明或提交 PR。

`verified` 表示传入的 PR 信息和**本地**信任配置通过了检查。
仓库 CI 仍需独立核对真实 PR 事件。不通过修改公钥、白名单、执行模式或工作流保护
来让自己的 PR 过关。插件不包含提供商认证或可信签发服务。

分别报告配置检查和证明验证结果。没有接入签发方就明确说明。
工具参数和结果可能进入 DSH 正常日志和模型上下文，因此保持最小输入。
插件自身不上传任何内容。

使用文档：https://github.com/mattheliu/model-pr-gate/tree/main/plugins/dsh
