# DeepSeek Harness 的 Model PR Gate 插件

[English](README.md) · **简体中文**

提交 PR 前检查当前配置的模型，再验证生成平台给出的签名证明。
默认只接受 **Astra 和 Fable 5.1**。

插件就在 Model PR Gate 仓库里，是可选组件。已经使用 GitHub CI 或 CLI 的项目
无需安装 DSH。插件本身**零第三方运行依赖**，不启动服务，安装时不编译，
通过 DSH 的工具和可选 skill 接口工作，复用 GitHub Action 的验签核心。

## 安装

已经安装 DeepSeek Harness 和 pnpm 后，运行：

```sh
dsh plugin --profile web add https://github.com/mattheliu/model-pr-gate/releases/download/v0.4.0/dsh-model-pr-gate-0.4.0.tgz
```

重启 DSH 即可使用两个工具。提供 skill 功能的 profile 还会自动发现
`model-pr-gate-dsh`，无需单独复制。使用其他 profile 时，把 `web` 换成实际名称。
卸载插件及其配置层：

```sh
dsh plugin --profile web remove dsh-model-pr-gate
```

已使用 **DSH 0.1.2-rc.1、Cordis 4.0.2** 验证。DSH 还在开发预览阶段，
后续接口变动可能需要更新插件。插件不提供模型接入或凭据，所选模型需要
DSH 和对应提供商本来就支持。

## 怎么用

直接对 Agent 说：

> 使用 model-pr-gate-dsh skill，先检查当前 Agent 的模型配置，再验证 PR #123
> 最新提交的证明。不上传 session，也不要改仓库的策略。

| 工具 | 作用 |
| --- | --- |
| `model_pr_gate_preflight` | 只读当前 Agent 配置的模型，无需参数 |
| `model_pr_gate_verify` | 用配置的公钥，核对一份证明与传入的 PR 信息 |

预检返回 `allowed`、`disallowed` 或 `unknown`。它读的是**配置**，
不检查实际请求、响应中的模型或变更历史，也不覆盖模型重写、回退、其他 Agent
和手工修改。`allowed` 不能证明整个 PR 来自这个模型。

验签返回 `verified`、`rejected` 或 `unverified`，以及固定的 `reason` 和
`evidenceLevel`。未配置可信公钥时返回 `missing-trusted-keys`；有公钥但没有
证明时返回 `missing-proof`，两种情况都不会验证通过。

Agent 传入 `repository`、`number`、`sha` 和可选的 `proof`。
PR 信息要独立获取，例如：

```sh
gh pr view 123 --repo OWNER/REPO --json number,headRefOid,url
```

使用 `headRefOid`，证明只传那一段 HTML 注释，不传完整 PR 正文或 session。
新增提交后需要新证明。两个工具本身不访问 GitHub、不附加证明、不签发、
不创建 PR，也不控制合并。Agent 可以在用户已授权的任务中通过已有工作流
附加平台给出的证明；仓库 CI 仍独立核对真实 PR 事件。

## 配置信任和语言

把下面这段追加到所用 profile 的 `cordis.patch.yml`，也可以单独存成补丁文件。
公钥必须来自该仓库**维护者认可的 Ed25519 签发方**：

```yaml
- id: model-pr-gate
  config:
    language: zh-CN
    trustedKeys:
      generation-service: |
        -----BEGIN PUBLIC KEY-----
        REPLACE_WITH_MAINTAINER_APPROVED_PUBLIC_KEY
        -----END PUBLIC KEY-----
    allowedModels:
      - gpt-6-astra
      - claude-fable-5-1
```

这里的占位公钥故意无效，加载前需要替换。`language: zh-CN` 会使用中文的
工具说明、结果解释和内置 skill。单独的补丁文件这样加载：

```sh
dsh --profile web --patch ./model-pr-gate.patch.yml
```

仅有三个配置项：`trustedKeys` 默认 `{}`，`allowedModels` 默认上面两个 ID，
`language` 默认 `en`。无效配置会以固定错误阻止插件启用。
DSH 补丁会替换该行的整个 config，所以覆盖时保留所有需要的设置。
公钥只来自可信配置，工具参数不能传公钥。一个插件实例使用一套策略，
应与目标仓库保持一致。

修改本地配置不会修改 GitHub CI。`claude-fable-5-high` 是 Fable 5，默认不通过。
DeepSeek 模型也默认不通过；维护者可以在插件和 CI 两端配置其他白名单。

## 隐私和可信范围

插件只读取 `agent.options.model`、调用者传入的证明及 PR 信息，以及自带的
skill 文件。不扫描会话、不读取 API 凭据、不拦截请求、不上传、不埋点，
也不保存历史或缓存。输出只有固定状态字段和对应语言的解释。

工具参数和结果仍可能进入 **DSH 自身的会话日志和模型上下文**。
插件不改变 DSH 或模型提供商的数据处理方式。请仅传最小证明；能读到证明的人
可以看到模型 ID、签发方、仓库、PR 编号、提交 SHA、格式版本和签名。

本地插件不是可信签发方。签名仍是配置的签发方所作的声明，不等于提供商独立认证。
仓库需要已有的可信生成平台来控制生成过程并核对最终提交。
插件不附带这种服务，也没有内置提供商证明连接器。

## 在本仓库开发

在仓库根目录运行：

```sh
npm test
npm run pack:dsh
dsh plugin --profile web add ./dsh-model-pr-gate-0.4.0.tgz
```

`prepare:dsh` 把现有验签核心和默认模型表复制到插件被 Git 忽略的 `core/`
目录，无需维护两套加密代码。安装包包含中英文 DSH skill 和 MIT 许可。
Release 的 tarball 无需安装脚本，也无需发布到 npm。

[DSH 官方安装说明](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish)
· [工具接口](https://deepseek-harness.github.io/deepseek-harness/en/reference/cookbook/adding-a-tool)
· [项目与 CI 指南](https://github.com/mattheliu/model-pr-gate)
