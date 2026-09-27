export function createAgentExecutor({ baseUrl = process.env.HELIX_AGENT_BRIDGE_URL || 'http://127.0.0.1:8093', token = process.env.AGENT_TOKEN, fetchImpl = fetch }) {
  if (!token) throw new Error('AGENT_TOKEN is required');
  return async task => {
    const payload = task?.payload && typeof task.payload === 'object' ? task.payload : {};
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/execute`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ command: String(payload.command || ''), cwd: String(payload.cwd || '/root'), timeout: payload.timeout }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.error || `agent returned HTTP ${response.status}`), { code: `AGENT_HTTP_${response.status}` });
    return body;
  };
}
