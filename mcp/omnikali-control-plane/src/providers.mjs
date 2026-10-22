function requireKey(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_NOT_CONFIGURED`);
  return value;
}

async function json(url, headers, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

export async function askModel(provider, prompt, model) {
  if (provider === 'openai') {
    const data = await json('https://api.openai.com/v1/responses', { authorization: `Bearer ${requireKey('OPENAI_API_KEY')}` }, {
      model: model || process.env.OPENAI_MODEL || 'gpt-6-astra', input: prompt
    });
    return { provider, model: data.model || model, text: data.output_text || '' };
  }
  if (provider === 'gemini') {
    const data = await json('https://generativelanguage.googleapis.com/v1beta/interactions', { 'x-goog-api-key': requireKey('GEMINI_API_KEY') }, {
      model: model || process.env.GEMINI_MODEL || 'gemini-3.8-flash', input: prompt, store: false
    });
    return { provider, model: data.model || model, text: data.output_text || '' };
  }
  if (provider === 'grok') {
    const data = await json('https://api.x.ai/v1/responses', { authorization: `Bearer ${requireKey('XAI_API_KEY')}` }, {
      model: model || process.env.XAI_MODEL || 'grok-4.7', input: prompt
    });
    return { provider, model: data.model || model, text: data.output_text || '' };
  }
  throw new Error('PROVIDER_NOT_SUPPORTED');
}
