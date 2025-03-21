import LlamaStackClient from 'llama-stack-client';

const client = new LlamaStackClient({
  baseURL: 'http://10.1.2.128:8321',
  timeout: 120 * 1000,
});

await client.toolgroups.register({
  toolgroup_id: 'mcp::mcp_favorites',
  provider_id: 'model-context-protocol',
  mcp_endpoint: { uri: 'http://10.1.2.128:8002/sse' },
});
