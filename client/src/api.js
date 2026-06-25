const BASE = '/api';

export async function apiFetch(path, { body, method, ...opts } = {}) {
  const options = {
    method: method ?? (body !== undefined ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  };
  if (body !== undefined) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, options);

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: res.statusText }));
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return res.json();
}
