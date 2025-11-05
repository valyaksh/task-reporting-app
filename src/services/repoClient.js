import { auth } from './auth'
// src/services/repoClient.js
const base64 = {
  encode: (str) => btoa(unescape(encodeURIComponent(str))),
  decode: (b64) => decodeURIComponent(escape(atob(b64))),
};

function getConfig() {
  return {
    provider: 'github',
    owner: import.meta.env.VITE_REPO_OWNER,
    repo: import.meta.env.VITE_REPO_NAME,
    branch: import.meta.env.VITE_REPO_BRANCH || 'main',
    basePath: import.meta.env.VITE_REPO_BASEPATH || 'public/data',
    githubToken: auth.getToken(),
    gitlabToken: undefined,
    gitlabProjectId: undefined,
  };
}

function headers(provider, token) {
  if (provider === 'github') {
    return {
      'Accept': 'application/vnd.github+json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }
  return {
    'Accept': 'application/json',
    ...(token ? { 'PRIVATE-TOKEN': token } : {}),
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  };
}

export async function getFile(path) {
  const cfg = getConfig();
  const rel = `${cfg.basePath}/${path}`.replace(/^\//, '');
  const t = Date.now(); // cache-busting

  if (cfg.provider === 'github') {
    // Contents API + t= для обхода возможного CDN
    const url =
        `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${rel}?ref=${cfg.branch}&t=${t}`;
    const res = await fetch(url, {
      headers: headers('github', cfg.githubToken),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`GitHub get failed: ${res.status}`);
    const json = await res.json();
    const content = base64.decode((json.content || '').replace(/\n/g, ''));
    return { content, sha: json.sha };
  } else {
    const project = encodeURIComponent(cfg.gitlabProjectId || `${cfg.owner}/${cfg.repo}`);
    const filePath = encodeURIComponent(rel);
    const url =
        `https://gitlab.com/api/v4/projects/${project}/repository/files/${filePath}?ref=${cfg.branch}&t=${t}`;
    const res = await fetch(url, {
      headers: headers('gitlab', cfg.gitlabToken),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`GitLab get failed: ${res.status}`);
    const json = await res.json();
    const content = base64.decode(json.content || '');
    return { content, last_commit_id: json.last_commit_id };
  }
}

export async function putFile(path, content, message = 'chore: update data via app', sha) {
  const cfg = getConfig();
  const rel = `${cfg.basePath}/${path}`.replace(/^\//, '');

  if (cfg.provider === 'github') {
    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${rel}`;
    const body = { message, content: base64.encode(content), branch: cfg.branch, ...(sha ? { sha } : {}) };
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        ...headers('github', cfg.githubToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`GitHub put failed: ${res.status}`);
    return res.json();
  } else {
    const project = encodeURIComponent(cfg.gitlabProjectId || `${cfg.owner}/${cfg.repo}`);
    const filePath = encodeURIComponent(rel);
    const updateUrl = `https://gitlab.com/api/v4/projects/${project}/repository/files/${filePath}`;
    const payload = { branch: cfg.branch, content, commit_message: message };

    let res = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        ...headers('gitlab', cfg.gitlabToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (res.status === 404) {
      res = await fetch(updateUrl, {
        method: 'POST',
        headers: {
          ...headers('gitlab', cfg.gitlabToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });
    }
    if (!res.ok) throw new Error(`GitLab save failed: ${res.status}`);
    return res.json();
  }
}
