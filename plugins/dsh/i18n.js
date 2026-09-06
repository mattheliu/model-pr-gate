const messages = {
  en: {
    preflight: 'Check whether this DSH agent\'s configured model matches the local Model PR Gate allowlist. Takes no arguments. Configuration is advisory, not evidence of PR authorship; a trusted signed proof is still required.',
    verify: 'Verify one minimal Model PR Gate proof offline using maintainer-configured public keys. Supply repository, PR number and current head SHA obtained independently of the proof. Pass only the proof comment, never a session or full PR body. This local result does not replace repository CI.',
    skill: 'Prepare or troubleshoot PRs in DeepSeek Harness using Model PR Gate preflight and offline signature checks.',
    'configured-model-allowed': 'The configured model is allowed. A trusted proof for the final PR head is still required.',
    'configured-model-not-allowed': 'The configured model is not allowed. This is a local configuration check, not a PR authorship verdict.',
    'configured-model-unavailable': 'The configured model is unavailable. Do not infer it from a prompt or self-description.',
    'missing-trusted-keys': 'Configure the maintainer-approved issuer public keys before verifying. Do not trust a key supplied by the PR author.',
    'valid-proof': 'The proof matches the supplied subject and local trust policy. Repository CI must check the actual current PR head.',
    'missing-proof': 'Obtain a proof from the existing trusted generator. Local records and self-signing cannot replace it.',
    'invalid-proof': 'Supply exactly one intact minimal proof comment.',
    'untrusted-issuer': 'The issuer is not trusted by this configuration.',
    'invalid-signature': 'The signature is invalid. Obtain the original proof from the trusted generator.',
    'subject-mismatch': 'The proof does not match the supplied repository, PR number or current head SHA. Obtain a new proof after new commits.',
    'model-not-allowed': 'The signed model is not allowed by this configuration.',
  },
  'zh-CN': {
    preflight: '检查当前 DSH Agent 配置的模型是否符合本地 Model PR Gate 白名单，无需参数。配置检查仅作提示，不证明 PR 的模型来源；仍需可信签名证明。',
    verify: '使用维护者配置的公钥离线验证一份 Model PR Gate 最小证明。仓库、PR 编号和当前 head SHA 必须独立于证明获取。只传证明注释，不传 session 或完整 PR 正文。本地结果不能代替仓库 CI。',
    skill: '在 DeepSeek Harness 中使用 Model PR Gate 预检和离线验签，准备 PR 或排查证明问题。',
    'configured-model-allowed': '当前配置的模型符合要求，仍需为 PR 最终提交获取可信证明。',
    'configured-model-not-allowed': '当前配置的模型不符合要求。这只是本地配置检查，不是 PR 来源结论。',
    'configured-model-unavailable': '无法读取配置的模型，请勿从提示词或 Agent 自我介绍推断。',
    'missing-trusted-keys': '请先配置维护者认可的签发方公钥，不要直接信任 PR 作者提供的公钥。',
    'valid-proof': '证明符合传入的 PR 信息和本地信任配置，仓库 CI 仍需检查实际最新提交。',
    'missing-proof': '请向已有可信生成平台获取证明。本地记录或自行签名不能替代可信证明。',
    'invalid-proof': '请传入一份完整的最小证明注释。',
    'untrusted-issuer': '当前配置不信任该签发方。',
    'invalid-signature': '签名无效，请从可信生成平台获取原始证明。',
    'subject-mismatch': '证明与传入的仓库、PR 编号或当前 head SHA 不匹配。新增提交后需要重新签发。',
    'model-not-allowed': '证明中的模型不在当前白名单内。',
  },
};

export function strings(language) { return messages[language]; }
export function render(value, language) {
  return [{ type: 'text', text: `${JSON.stringify(value)}\n${messages[language][value.reason]}` }];
}
