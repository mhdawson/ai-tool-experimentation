import { BeeAgent } from 'bee-agent-framework/agents/bee/agent';
import { OllamaChatLLM } from 'bee-agent-framework/adapters/ollama/chat';
import { TokenMemory } from 'bee-agent-framework/memory/tokenMemory';
import { Ollama } from 'ollama';
import { Agent } from 'undici';
import { DuckDuckGoSearchTool } from 'bee-agent-framework/tools/search/duckDuckGoSearch';

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

// Create agent
let agent = new BeeAgent({
  llm,
  memory: new TokenMemory({ llm }),
  tools: [new DuckDuckGoSearchTool()],
});

// Ask a question using the bee agent framework
async function askQuestion(question) {
  const response = await agent
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

  return response.result.text;
}

console.log(
  await askQuestion(
    'How many seconds would it take for a leopard at full speed to run through Pont des Arts?',
  ),
);
