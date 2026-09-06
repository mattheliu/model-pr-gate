# Model PR Gate

[English](README.md) · **简体中文**

**默认只接受 Astra 和 Fable 5.1 的 PR。**

做法很简单：读取 Codex 或 Claude Code 的会话记录，检查里面的模型，把结果交给 CI。发现其他模型，或者记录无法确认，就让检查失败。

零第三方依赖，不要 API key，不上传会话，不开后台服务。需要 Node.js 22+。

**先说清一个边界：本地记录可以修改。** 检查通过，表示“记录里的模型符合要求”，不等于独立证明了 PR 确实由这些模型完成。你还需要确认这份记录对应当前 PR 的工作。

## 本地用

```sh
npm install --global github:mattheliu/model-pr-gate#v0.2.0
model-pr-gate codex ./session.jsonl
# Claude Code 用这个：
model-pr-gate claude ./session.jsonl
```

不用填写白名单，默认精确匹配：

| 模型 | 接受的 ID |
| --- | --- |
| Astra | `gpt-6-astra` |
| Fable 5.1 | `claude-fable-5-1` |

Fable 5 的 `claude-fable-5`、`claude-fable-5-high` 不会通过。工具不做模糊匹配，也不把显示名称当作调用 ID。[Fable 5.1 官方 model ID](https://platform.claude.com/docs/en/models/fable-5-1/overview)。

如果需要替换默认白名单：

```sh
model-pr-gate codex ./session.jsonl gpt-6-astra YOUR_VERIFIED_MODEL_ID
```

安装时下载工具，检查时完全离线。只读你指定的文件，不自动扫描其他目录。

## 接到 GitHub CI

在生成会话文件的步骤后，加这几行：

```yaml
- uses: mattheliu/model-pr-gate@v0.2.0
  with:
    agent: codex
    session: ./session.jsonl
```

发现其他模型、文件不存在或记录不完整时，任务失败。要阻止合并，把这个任务设为仓库分支规则里的必需检查。

Action 本身不需要 token 或写权限；runner 上需要 Node.js 22+。正式接入时，可以把版本号换成审核过的 commit SHA，固定使用的代码。

会话文件必须已在 runner 上。GitHub CI 不能直接读取你电脑里的记录。不要为了跑检查，把原始 session 提交到仓库或上传成公开附件。贡献者提供的日志也可能伪造，不能单靠它认证来源。

其他选项都是可选的：

```yaml
- uses: mattheliu/model-pr-gate@v0.2.0
  id: model-audit
  with:
    agent: claude
    session: ./session.jsonl
    mode: report           # 只报告，不阻止；默认 enforce
    language: zh-CN        # 中文提示；默认 en
    allowed-models: |      # 替换默认白名单，每行一个准确 ID
      gpt-6-astra
      YOUR_VERIFIED_MODEL_ID
```

## 怎么看结果

| 退出码 | 结果 | 意思 |
| --- | --- | --- |
| 0 | `observed-models-allowed` | 看到的模型都符合白名单 |
| 1 | `observed-disallowed-model` | 发现了其他模型 |
| 2 | `unknown` / 出错 | 缺少记录、记录不完整、格式错误或无法读取 |

`report` 模式不会因为不符合或无法确认而让任务失败；模式名或语言配置写错仍会失败。Action 输出 `verdict` 和 `evidence-level`，后者固定为 `local-unverified`，表示未经独立认证的本地证据。

Codex 记录的是每轮**配置的模型**；Claude 记录的是**随响应保存的模型字段**。它们都不是提供商签名回执。子任务的 session 要单独检查，统计数量也不能当作账单数据。

## 隐私和体积

逐行读取，不保存原始记录。命令行只返回模型、计数和结果；CI 日志更少，只显示结果和证据级别。不会导出对话、代码、目录、session ID 或请求 ID。

CLI 安装包只包含命令、解析器和文档，除 Node.js 外没有运行依赖。用合成数据测过：约 1.7 MB、2 万行记录，单机耗时约 0.09 秒，常驻内存峰值约 66 MiB（包含 Node.js）。实际表现取决于机器和输入；用于计数的唯一 ID 越多，内存也会增加。详见[隐私说明](PRIVACY.zh-CN.md)。

## 中英文

```sh
model-pr-gate --lang zh-CN --help
model-pr-gate --lang en --help
```

提示支持中英文。JSON 字段名和结果值保持一致，不会因为切换语言影响其他工具。

## 需要更可靠的证明？

源码里另有可选的[签名证明 GitHub App](docs/github-app.zh-CN.md)，不会随小型 CLI 一起安装。由可信生成服务签署“模型＋PR 提交”的证明，再由 App 验证。前提仍然是签发服务本身可信。

## 开发

```sh
git clone https://github.com/mattheliu/model-pr-gate.git
cd model-pr-gate
npm test
```

测试均用合成数据，MIT 许可。仓库不包含真实会话或私人凭据。
