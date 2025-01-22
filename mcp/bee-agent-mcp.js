import { BeeAgent } from 'bee-agent-framework/agents/bee/agent';
import { OllamaChatLLM } from 'bee-agent-framework/adapters/ollama/chat';
import { TokenMemory } from 'bee-agent-framework/memory/tokenMemory';
import { Ollama } from 'ollama';
import { Agent } from 'undici';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { MCPTool } from 'bee-agent-framework/tools/mcp';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const OLLAMA_SERVER = 'http://10.1.2.38:11434';
const MODEL = 'granite3.1-dense';
//const MODEL = 'llama3.1';
const SHOW_AGENT_PROCESS = false;

const noTimeoutFetch = (input, init) => {
  const someInit = init || {};
  return fetch(input, {
    ...someInit,
    dispatcher: new Agent({ headersTimeout: 2700000 }),
  });
};

/////////////////////////////////////
// LLM that we'll use

const llm = new OllamaChatLLM({
  modelId: MODEL,
  parameters: {
    temperature: 0,
  },
  client: new Ollama({
    host: OLLAMA_SERVER,
    fetch: noTimeoutFetch,
  }),
});

/////////////////////////////////////
// Get the available tools from the MCP server
const client = new Client(
  {
    name: 'test-client',
    version: '1.0.0',
  },
  {
    capabilities: {},
  },
);

await client.connect(
  new StdioClientTransport({
    command: 'node',
    args: ['favorite-server/build/index.js'],
  }),
);
const availableTools = await MCPTool.fromClient(client);

/////////////////////////////////////
// Use agent to ask questions

let agent = new BeeAgent({
  llm,
  memory: new TokenMemory({ llm }),
  tools: availableTools,
});

// Ask a question using the bee agent framework
async function askQuestion(question) {
  return agent
    .run(
      { prompt: question },
      {
        execution: {
          maxRetriesPerStep: 5,
          totalMaxRetries: 5,
          maxIterations: 5,
        },
      },
    )
    .observe(emitter => {
      emitter.on('update', async ({ update }) => {
        if (SHOW_AGENT_PROCESS) {
          console.log(`Agent (${update.key}) 🤖 : `, update.value);
        }
      });
    });
}

const questions = [
  'What is my favorite color?',
  'My city is Ottawa',
  'My country is Canada',
  'I moved to Montreal. What is my favorite color now?',
  'My city is Montreal and my country is Canada',
  'What is the fastest car in the world?',
  'My city is Ottawa and my country is Canada, what is my favorite color?',
  'What is my favorite hockey team ?',
  'My city is Montreal and my country is Canada',
  'Who was the first president of the United States?',
];

for (let i = 0; i < questions.length; i++) {
  console.log('QUESTION: ' + questions[i]);
  console.log('  RESPONSE:' + (await askQuestion(questions[i])).result.text);
}

client.close();
