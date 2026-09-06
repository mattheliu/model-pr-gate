import { sign } from 'node:crypto';
export function appJwt(appId, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const input = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: now - 60, exp: now + 540, iss: appId })}`;
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
}
export function githubClient({ appId, privateKey, fetchImpl = fetch }) {
  async function request(path, token, method = 'GET', body) {
    const response = await fetchImpl(`https://api.github.com${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'model-pr-gate' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`GitHub API ${method} failed (${response.status})`);
    return response.json();
  }
  return {
    async installation(id) {
      const { token } = await request(`/app/installations/${id}/access_tokens`, appJwt(appId, privateKey), 'POST', {});
      if (!token) throw new Error('GitHub returned no installation token');
      return {
        getPR: (repo, number) => request(`/repos/${repo}/pulls/${number}`, token),
        createCheck: (repo, check) => request(`/repos/${repo}/check-runs`, token, 'POST', check)
      };
    }
  };
}
