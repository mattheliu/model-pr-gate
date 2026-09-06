const messages = {
  en: {
    proofHelp: 'Usage: model-pr-gate --proof proof.txt --keys trusted-keys.json --repository OWNER/REPO --pr 123 --sha HEAD_SHA [--lang en|zh-CN]\nVerifies minimal signed proofs offline.',
    proof: 'Model proof check', proofError: 'Unable to verify proof. Check inputs and trusted public keys.',
    help: 'Usage: model-session-audit [--lang en|zh-CN] <codex|claude> <session.jsonl> [allowed-model-id ...]\nDefaults: Astra and Fable 5.1. Exit: 0 allowed, 1 disallowed, 2 unknown/error.\nChecks local records; does not prove PR authorship.',
    error: 'Unable to inspect session. Check agent name, language and file readability.',
    auditError: 'Session could not be audited. Check inputs and file availability.',
    audit: 'Model session audit', evidence: 'Evidence'
  },
  'zh-CN': {
    proofHelp: '用法：model-pr-gate --proof proof.txt --keys trusted-keys.json --repository OWNER/REPO --pr 123 --sha HEAD_SHA [--lang en|zh-CN]\n离线验证最小签名证明。',
    proof: '模型证明检查', proofError: '无法验证证明，请检查输入和可信公钥。',
    help: '用法：model-session-audit [--lang en|zh-CN] <codex|claude> <session.jsonl> [允许的模型 ID ...]\n默认：仅接受 Astra 和 Fable 5.1。退出码：0 符合，1 不符合，2 无法确认或出错。\n检查本地记录，不证明 PR 的真实模型来源。',
    error: '无法读取会话。请检查工具名称、语言选项和文件是否可读。',
    auditError: '无法检查会话。请检查输入和文件是否存在。',
    audit: '模型会话检查', evidence: '证据级别'
  }
};
export function strings(lang = 'en') {
  if (!Object.hasOwn(messages, lang)) throw new Error('Unsupported language');
  return messages[lang];
}
