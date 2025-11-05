// src/hooks/useJsonData.js
import { useEffect, useState, useCallback } from 'react';
import { getFile, putFile } from '../services/repoClient';

async function fetchLocal(path) {
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  const url = `${base}/data/${path}?_=${Date.now()}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
  if (!res.ok) {
    if (res.status === 404) return []; // нет локального файла — пустой массив
    const txt = await res.text();
    throw new Error(`Local fetch failed ${res.status}: ${url}\nResponse: ${txt.slice(0,180)}...`);
  }
  const raw = await res.text();
  if (raw.trim().startsWith('<')) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export default function useJsonData(path, {
  repoEnabled = false,
  autoPull = false,
} = {}) {

  const filename = path;
  const [data, setData] = useState([]);
  const [repoMeta, setRepoMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const saveLocal = useCallback((next) => {
    setData(next);
    try {
      localStorage.setItem(`json:${filename}`, JSON.stringify(next));
    } catch {}
  }, [filename]);

  useEffect(() => {
    const key = `json:${filename}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        setData(JSON.parse(cached));
        return;
      } catch {}
    }
    fetchLocal(filename).then((initial) => {
      setData(initial);
      try { localStorage.setItem(key, JSON.stringify(initial)); } catch {}
    }).catch(()=>{});
  }, [filename]);

  const pullFromRepo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getFile(filename);
      const text = (res?.content ?? '');
      const parsed = text ? JSON.parse(text) : [];
      setRepoMeta({ sha: res?.sha, content: text });
      saveLocal(parsed);
      return parsed;
    } catch (e) {
      setError(e);
      return data;
    } finally {
      setLoading(false);
    }
  }, [filename, saveLocal, data]);

  const pushToRepo = useCallback(async (message = 'chore: update via app', overrideData = null) => {
    if (!repoEnabled) {
      console.info('[useJsonData] repo disabled, skip PUT');
      return { skipped: true, reason: 'repoDisabled' };
    }

    const targetJson = overrideData ?? data ?? [];
    const nextText = JSON.stringify(targetJson, null, 2) + '\n';
    const prevText = (repoMeta?.content ?? '');

    if (prevText === nextText || prevText.trimEnd() === nextText.trimEnd()) {
      console.info('[useJsonData] skip PUT (no changes)');
      return { skipped: true, reason: 'noChanges' };
    }

    try {
      const res = await putFile(filename, nextText, message, repoMeta?.sha);
      const newSha = res?.content?.sha ?? repoMeta?.sha;
      setRepoMeta({ sha: newSha, content: nextText });

      saveLocal(targetJson);
      return res;
    } catch (e) {
      const msg = String(e || '');
      if (msg.includes('409') || msg.toLowerCase().includes('sha')) {
        const latest = await getFile(filename);
        const latestText = latest?.content ?? '';
        if (latestText === nextText || latestText.trimEnd() === nextText.trimEnd()) {
          setRepoMeta({ sha: latest?.sha, content: latestText });
          saveLocal(targetJson);
          console.info('[useJsonData] server already has desired content, skip re-PUT');
          return { skipped: true, reason: 'alreadyUpToDate' };
        }
        const res2 = await putFile(filename, nextText, message, latest?.sha);
        const newSha2 = res2?.content?.sha ?? latest?.sha;
        setRepoMeta({ sha: newSha2, content: nextText });
        saveLocal(targetJson);
        return res2;
      }
      throw e;
    }
  }, [repoEnabled, filename, data, repoMeta, saveLocal]);

  useEffect(() => {
    if (autoPull && repoEnabled) {
      pullFromRepo().catch((e) => setError(e));
    }
  }, [autoPull, repoEnabled, pullFromRepo]);

  return { data, setData: saveLocal, loading, error, pullFromRepo, pushToRepo };
}
