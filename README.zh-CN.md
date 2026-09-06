# Model PR Gate

[English](README.md) · **简体中文**

**凭可信模型证明接收 PR，默认只接受 Astra 和 Fable 5.1。**

生成平台签发一份小证明，仓库 CI 离线验签。
Node.js 22+，零第三方运行依赖，不上传 session，不需要后台服务。

**需要你信任的生成平台出具证明。** 本项目提供签名和验证工具，没有内置提供商认证服务。
缺少证明就返回 `unverified`，不会从代码猜模型。

## 接入仓库

把签发方的**公钥**配置到 Actions 变量 `MODEL_GATE_TRUSTED_KEYS`
（[JSON 格式](docs/usage.zh-CN.md#配置)），私钥留在生成平台。
将下面的工作流保存为 `.github/workflows/model-proof.yml`：

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
      - uses: mattheliu/model-pr-gate@v0.4.0
        with:
          trusted-keys: ${{ vars.MODEL_GATE_TRUSTED_KEYS }}
```

无需 checkout 或 token。**公钥配置和工作流都必须受保护**，只要求同名检查成功不足以防止绕过。
详见[检查保护说明](docs/usage.zh-CN.md#保护检查)。

## 默认模型

| 模型 | 精确 ID |
| --- | --- |
| Astra | `gpt-6-astra` |
| Fable 5.1 | `claude-fable-5-1` |

Fable 5，包括 `claude-fable-5-high`，不会通过。维护者可[替换白名单](docs/usage.zh-CN.md#配置)。

## 使用指南

- [CI 参数、CLI 和开发说明](docs/usage.zh-CN.md)
- [接入可信签发平台](docs/signer.zh-CN.md)
- [DeepSeek Harness 插件](plugins/dsh/README.zh-CN.md)：预检、验签、内置 skill
- [Agent 使用指南](docs/agent-guide.zh-CN.md) · [可导入的 skill](skills/model-pr-gate/SKILL.md)
- 复刻整个项目：[中文 prompt](prompts/recreate.zh-CN.md) · [English prompt](prompts/recreate.md)

证明包含模型和 PR 元数据，不含对话或代码；能读 PR 的人也能解码证明。[隐私说明](PRIVACY.zh-CN.md)。

## 想法来源

项目的最初想法来自 [@arkuy99](https://x.com/arkuy99) 的
[这条帖子](https://x.com/arkuy99/status/2096425638018306166?s=20)。

[MIT 许可](LICENSE)。
