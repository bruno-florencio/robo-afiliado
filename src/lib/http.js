const DEFAULT_TIMEOUT_MS = 15000;

async function fetchJson(url, options = {}, label = "HTTP request") {
  const response = await fetch(url, {
    ...options,
    signal: options.signal || AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`${label} retornou uma resposta invalida em JSON.`);
  }

  if (!response.ok) {
    throw new Error(`${label} falhou: ${JSON.stringify(data)}`);
  }

  return data;
}

module.exports = {
  fetchJson,
};
