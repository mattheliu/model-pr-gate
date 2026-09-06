# 接入可信签发方

[English](signer.md) · **简体中文**

这份说明给原本就在生成代码的平台使用，不要求贡献者上传日志或再安装一个工具。目前没有内置提供商接入；可信生成平台需要实现下面的流程，严格准入才有实际意义。

## 1. 创建密钥

```sh
node bin/keygen.js keys
```

`issuer-private.pem` 只保存在可信生成服务。把公钥登记到信任它的仓库中。签发方名称使用 `generation-service` 这类中性名称，不要用人名或私有任务名。公钥不是秘密，但配置不能被 PR 篡改。

## 2. 为最终提交签名

服务必须知道实际运行了哪些模型，包括 fallback 和子任务，并确认最终提交确实来自这次生成。不能直接接收客户端报来的 SHA 和模型名称就签名。混合模型或无法归因的修改需要明确规则，不能默认为单一模型完成。发生过一次 API 调用，不等于代码就来自这次调用。

`attestation.example.json` 展示了 version 2 的准确格式。填写最终仓库、PR 编号、SHA、签发方和模型，然后在可信服务执行：

```sh
node bin/sign-attestation.js keys/issuer-private.pem payload.json
```

服务也可以从 `model-pr-gate` 导入 `signAttestation(payload, privateKey)`。只接受说明中的六个字段，不接受任务 ID、提示词、时间戳或其他元数据。

输出是一段已签名的 HTML 注释。由平台现有且已授权的 GitHub 集成将它附到 PR 正文；本 SDK 不会代为写入或索取 GitHub 凭据。更新时替换旧证明，不要重复添加。新增提交后需要重新签发。

## 3. 仓库 CI 验证

使用 README 中的默认 Action。仓库、PR 编号和当前 head SHA 来自 GitHub 事件，不采信证明自己声明的目标。公钥和模型白名单来自可信工作流配置。Action 不发网络请求，只把固定结果写到 CI 日志。

签名证明的是签发方的声明，不保证签发方诚实。需要保护签发服务、密钥配置和验证工作流。当前没有自动到期、撤销、全仓库重新检查或合并队列支持。能读 PR 的人也能读证明，并知道使用的模型。
