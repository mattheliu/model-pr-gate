# 一份 prompt，复刻 Model PR Gate

[English](recreate.md) · **简体中文**

复制下面**整个代码块**，交给有文件编辑、终端和联网能力的编码 Agent。
不用附原聊天或源码。它描述的是产品思想、功能契约和验收标准，目标是做出同等能力的项目，
不是保证生成逐字相同的代码。基线为 Model PR Gate v0.4.0。

这份 prompt 可以驱动开发、测试和打包；可信签发平台、账号权限以及正式发布授权需要真实存在。
它不会凭空创建提供商认证能力。已有这个项目时，Agent 应复用现有实现。

````text
请直接实现一个完整、可运行、可复用的小型开源项目，名为 Model PR Gate。
默认只接受附有可信证明、且声明来自 Astra 或 Fable 5.1 的 PR。
完成代码、测试、中英文文档、Agent skill、可选 DeepSeek Harness 插件和可安装产物，
不要停在方案、伪代码、空壳接口或“可以继续”的答复。

## 先理解这个产品的思想

我想给仓库装一个“模型工牌门禁”：维护者只加少量 CI，贡献者尽量照常提 PR。
工具要小、接入顺畅、可插拔，隐私优先，行为容易解释。

模型准入是仓库策略，不是代码质量证明。不要宣传它能识别垃圾代码、判断作者是否诚实，
或者证明某模型写的代码一定更好。

把每一条结论限制在证据支持的范围内：
- 代码风格、PR 文案、Agent 自我介绍、GitHub Verified 提交，都不能认证实际模型。
- 用户可修改的本地 session、配置、API 请求记录和自己签发的证明，也不能独立认证来源。
- 一次合规模型调用不意味着整个 PR 都来自该模型。
- 数字签名只证明某签发方作了这个声明，不自动证明声明真实或得到模型提供商背书。

“所有仓库只加几行 CI，任意提交者不安装、不改流程，又能可靠识别其本地真实模型”
无法单靠 CI 达成。产品应诚实地采用有前提的流程：

已有可信生成平台控制模型执行和最终提交
→ 平台签发最小证明，并用它已有的 GitHub 集成附到 PR
→ 仓库自己的 CI 离线验签。

只有上游平台已经集成时，提交者才可以无感使用。没有可信签发方就报告 unverified，
不要通过上传会话、偷偷代理 API、自签名或猜模型来假装实现。平台还必须处理回退模型、
子 Agent、混合来源和后续手工修改，不能把混合变更直接宣称为单一模型生成。

## 默认策略

- Astra：精确 ID `gpt-6-astra`。
- Fable 5.1：精确 ID `claude-fable-5-1`。
- `claude-fable-5-high`、`claude-fable-5` 是 Fable 5，必须拒绝。
- 仅精确匹配，不用显示名称、前缀匹配或模糊别名；允许维护者显式替换白名单。
- DeepSeek Harness 是运行环境，使用它不代表使用 DeepSeek 模型。
  DeepSeek 模型也不会自动进入默认白名单。

以上 ID 是本次复刻的明确策略；不要因为 API 变化擅自换成别的模型。
如果当前提供商或宿主不支持这些 ID，说明实际支持限制，不要伪装接通或改名冒充。

## 轻量架构和隐私

使用 Node.js 22+、ES modules 和标准库；核心、CLI、Action、DSH 插件均保持零第三方
运行依赖。开发测试可以使用隔离安装的 DSH。不要为了这个工具加数据库、账号系统、
HTTP 后台、GitHub App、请求代理、遥测、登录页或必须运行的常驻进程。

仓库结构要让验签核心只有一个维护来源。CLI、CI 和 DSH 适配器复用它；打包时可以
复制核心，但自动检查副本一致。DSH 插件放在独立目录，原有用户不必安装 DSH。
只为接口变动或实际需要增加抽象，不为假想扩展堆框架。

默认验证不联网、不检出 PR 代码、不扫描个人目录、不读取模型 API key、不上传会话。
CI 可以读取 GitHub 已提供的 PR 事件，在内存中提取证明，但日志只写固定结果和原因。
禁止把原始输入、完整 PR 正文、公钥内容、私钥、模型名、个人路径或堆栈写进结果日志。
无缓存、历史记录或埋点。下载公开工具代码、依赖与文档是正常安装/开发联网行为，
与运行时上传用户数据分清楚。

## 最小证明格式：与 version 2 兼容

使用标准库 Ed25519。payload 必须且只能有以下六个字段：

```json
{
  "version": 2,
  "issuer": "generation-service",
  "model": "gpt-6-astra",
  "repository": "OWNER/REPO",
  "number": 123,
  "sha": "0123456789abcdef0123456789abcdef01234567"
}
```

- `version` 必须为数字 2；number 是正的安全整数；sha 是 40 位小写十六进制。
- issuer 是 1–64 位标识符，首位为字母或数字，其余允许字母、数字、下划线、点、连字符。
- model 是 1–100 位标识符，首位为字母或数字，其余允许字母、数字及 `._:/-`。
- repository 是 OWNER/REPO，总长不超过 200，各部分只接受字母、数字及 `_.-`。
- 拒绝所有额外字段，不加提示词、代码、session ID、请求 ID、时间戳或私有任务标签。
- payload JSON 的 UTF-8 字节编码为无填充 base64url，得到 encoded。
- 用 Ed25519 对 encoded 字符串的 UTF-8 字节签名；签名也编码为无填充 base64url。
- 验证收到的 encoded 原始字节，不重新序列化 JSON 后验签。
- 包装成 PR 正文中的唯一一段注释：
  `<!-- model-pr-gate:v2:<encoded>.<signature> -->`
- 约束输入大小：PR 正文最多 1 MiB，encoded 最多 4096 字符，签名为 86 字符。
  存在多个 model-pr-gate 标记、旧版或畸形证明时不能通过。

维护者配置 issuer → Ed25519 公钥 PEM 的映射，不能接受私钥作为验证配置。
签名私钥只属于可信生成平台，不交给贡献者或验证 CI。
证明是公开可解码的签名，不是加密；能读 PR 的人可以看到这些字段。
签发方应使用中性名称，不在公开证明里放个人标识。

生成平台必须独立核对真实模型过程和最终变更，再调用签名函数。
提供签名 SDK、命令行 helper 和合成 demo，但不假称已经接通某个真实提供商。
密钥生成工具不能覆盖已有文件；POSIX 系统中目录权限为 0700、私钥为 0600。

## CLI 和 GitHub Action

实现离线 CLI，例如：

```sh
model-pr-gate --proof proof.txt --keys trusted-keys.json \
  --repository OWNER/REPO --pr 123 --sha FULL_HEAD_SHA
```

提供 `signAttestation(payload, privateKey)`、`verifyAttestation(subject, keys, allowedModels)`
及公钥校验入口。subject 为 `{body, repository, number, sha}`，body 含待提取的证明，
其余三个字段是独立获取的待核对值。验证结果仅包含固定 `verdict`、`reason`、`evidenceLevel`。

verdict：verified / rejected / unverified。
evidenceLevel：仅成功验签为 trusted-issuer，其余为 none。
原因至少区分 valid-proof、missing-proof、invalid-proof、untrusted-issuer、
invalid-signature、subject-mismatch、model-not-allowed。配置/执行错误使用固定错误信息。
默认退出码：0 验证通过，1 拒绝，2 缺证据或配置/执行错误。

根目录提供可分发的 GitHub Action：
- 输入：trusted-keys、可选 allowed-models、language（en / zh-CN）、mode（enforce / report）。
- 默认 enforce；report 可让拒绝或缺证据不阻止运行，但配置错误始终失败。
- 输出：verdict、reason、evidence-level；不能只凭退出码判断 report 模式是否通过。
- 从 GitHub PR 事件和 GITHUB_REPOSITORY 独立获得目标仓库、PR 编号、当前 head SHA，
  校验事件仓库一致性；不要用 merge-test SHA，也不要相信证明自己提供的待核对值。
- 可信公钥和白名单来自维护者配置，不来自 PR 作者、PR 修改的文件或工具参数。
- 无需 checkout、GitHub token 或模型 API key，不执行 PR 带来的代码。
- 提供 permissions: {} 的接入示例，处理 opened、reopened、synchronize、edited、
  ready_for_review，并为同一 PR 取消旧检查。
- 新提交使旧证明与当前 head 不匹配，需要重新签发；附加证明时保留其他正文，替换旧证明。

文档必须讲清楚：信任配置和工作流都需保护。同名必需状态可以被篡改工作流冒充，
不能只配置一个绿色状态就宣称无法绕过。支持时用来自可信仓库的必需工作流规则；
否则明确仍需维护者监督。核验当前 GitHub 官方规则，不编造设置项。
初版不实现到期、自动撤销或合并队列；说明密钥变化需重跑，异步检查存在更新延迟。

## 独立的个人日志审计

另提供可选 `model-session-audit codex|claude <指定文件>`，只检查用户明确指定的本地文件。
流式读取，仅提取可信度有限的模型记录，不输出原始对话、路径或请求 ID；去重所需 ID
可在内存中散列，不持久化。报告实际内存边界，不把随记录增长的去重状态说成常量内存。
Codex 从模型上下文记录取值，Claude 从 assistant 模型字段取值；忽略合成记录，
不要从用户文本和工具输出抓模型名。用合成格式夹具验证，不读取个人历史找样本。
结果使用 observed-* 等明确区别于验签的标识。无论日志看起来多完整，都不是合并授权。
不要建议贡献者把隐私日志传到 CI；若保留审计 Action，放在独立子目录。

## 可选 DeepSeek Harness 插件

在同一仓库独立目录实现 DSH bundle，交付可直接安装的预打包 tarball。
从官方文档/源码验证当前 API；基线可参考 DSH 0.1.2-rc.1 / Cordis 4.0.2。
记录实际验证版本，不把开发预览接口说成永久稳定。不要要求用户在安装时编译或
全局安装本项目 CLI，也不要把整个 DSH 打进插件包。

提供两个工具：
1. `model_pr_gate_preflight`：无需参数，只读取当前 `agent.options.model` 配置字段。
   输出 allowed / disallowed / unknown 和固定原因；已读配置的证据级别为 local-config，
   未知为 none。不能称为实际调用审计或 PR 认证；不检查请求、会话和历史。
2. `model_pr_gate_verify`：参数仅 repository、number、sha 和可选最小 proof 注释。
   公钥/白名单由宿主配置提供，不允许调用者传入策略。只接受一份完整注释，最多
   8192 字符，拒绝附带完整正文或日志。复用核心；缺公钥返回 missing-trusted-keys，
   缺证明返回 missing-proof，均为 unverified。

插件配置仅 trustedKeys、allowedModels、language；非法配置拒绝启用，错误不回显输入。
工具返回结构化结果及对应语言的固定解释，响应取消，卸载后清理注册。
宿主提供 skill registry 时自动注册中英文对应的 `model-pr-gate-dsh` 指南；
缺少 skill registry 时两个工具仍可用。不扫描历史、不签发、不自行提交/修改 PR。

DSH 本地策略不改变仓库 CI；单个实例使用一套明确策略。本地 verified 只表示
对传入主体和本地配置验签成功，仓库仍须独立验证真实事件。
工具参数/结果可能进入 DSH 正常日志和模型上下文。必须准确披露这点，不能因为
插件自身不联网就宣称整个宿主“绝不处理或发送任何数据”。

## 文档和 Agent 使用体验

交付英语和简体中文的 README、隐私说明、可信签发接入、Agent 使用指南，
以及可导入的通用 skill 与 DSH skill。文档说人话，先讲用途和怎么用，再讲边界。
示例可复制；机器字段跨语言稳定。安装、配置、失败处理和卸载都有明确说明。

skill 要让 Agent 做对关键决策：独立获取 PR head，尊重维护者策略，缺证明就说缺证明，
不用自签名造成功，不擅自放宽策略，不把本地记录当认证。已经获授权的 PR 更新，
用结构化参数或正文文件保留原文，并在更新前重查 head；skill 不额外授予外部写权限。

保留这份复刻 prompt 的中英文版本，并从 README 链接。使用 MIT 许可；复用已有
开源代码时保留相应许可与署名。示例只用通用 OWNER/REPO 和合成数据。

## 执行和验收

先检查当前目录及项目指令。已有本项目时增量完善；空目录才创建项目，避免覆盖无关工作。
合理决定文件结构和细节，不把可恢复的实现选择拆成逐步确认。
需要官方兼容信息时查公开文档；不要从用户私有会话、密钥或个人目录获取资料。

完成有意义的合成数据测试：允许模型、Fable 5 拒绝、缺证据、畸形/重复证明、签名和
payload 篡改、额外隐私字段、未知签发方、错误公钥、跨仓库/PR/SHA 复用、配置错误、
enforce/report 退出行为、i18n、日志不回显输入，以及 CLI/Action 的真实调用。
验证 DSH tarball 实际安装、配置组合、真实工具调用、skill 发现、取消和卸载；
不只用 mock 就声称完成集成。没有运行环境时明确说明未验证部分。
测试用临时密钥，绝不登记成真实仓库的可信签发方，也不用真实付费模型调用做验收。

在 CI 中检查 Node.js 22 / 24，DSH 测试依赖隔离安装，记录实际运行结果。
打包 CLI、DSH 插件、skill，并给出实际压缩/解压体积与依赖清单。
DSH 插件体积以几十 KB 内为目标，文档体积单独解释，不为凑数字删必要说明。
检查产物无凭据、真实会话、个人路径、缓存或 node_modules。

发布依照当前用户实际授权：默认只完成本地可运行产物；已有仓库只在授权范围内推送。
新建 GitHub 仓库默认 PRIVATE，只有针对目标仓库明确授权 PUBLIC 才公开。
不要硬编码原作者账号，也不要把这份公开 prompt 当作任何人的凭据或发布授权。
已获相应授权时，完成必要检查后直接提交、推送和发布；不能发布就准确交代限制，
不要伪造链接、测试状态、模型接入或 Marketplace 上架状态。

最终给出：实际完成的目录/仓库、使用方式、测试结果、产物及体积、依赖情况，
以及尚需接入的可信签发方或工作流保护。最后再次确认：配置预检、日志观察、
可信签发方声明、提供商独立认证是不同层次，不能混为一谈。
````

本 prompt 与项目一同按 [MIT 许可](../LICENSE) 开源。
它不包含原始聊天、真实会话、个人路径、密钥或账号授权。
