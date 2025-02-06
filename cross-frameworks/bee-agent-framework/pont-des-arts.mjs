import { BeeAgent } from 'bee-agent-framework/agents/bee/agent';
import { OllamaChatLLM } from 'bee-agent-framework/adapters/ollama/chat';
import { OpenAIChatLLM } from 'bee-agent-framework/adapters/openai/chat';
import OpenAI from 'openai';
import { TokenMemory } from 'bee-agent-framework/memory/tokenMemory';
import { Ollama } from 'ollama';
import { Agent } from 'undici';
import { DuckDuckGoSearchTool } from 'bee-agent-framework/tools/search/duckDuckGoSearch';
import process from 'node:process';

const SHOW_AGENT_PROCESS = process.env.SHOW_AGENT_PROCESS
  ? process.env.SHOW_AGENT_PROCESS !== 'false'
  : true;
const TEMPERATURE = process.env.TEMPERATURE
  ? parseFloat(process.env.TEMPERATURE)
  : 0;
const LLM_CLIENT = process.env.LLM_CLIENT || 'ollama';

let defaultServer;
let defaultModel;
if (LLM_CLIENT === 'ollama') {
  defaultServer = 'http://10.1.2.38:11434';

  defaultModel = 'granite3.1-dense';
  //defaultModel = 'llama3.1';
  //defaultModel = 'llama3.1:8b-instruct-q4_K_M';
  //defaultModel = 'qwen2.5-coder:32b';
} else if (LLM_CLIENT === 'openai') {
  defaultServer = '';

  defaultModel = 'granite-3-8b-instruct';
}

const model = process.env.MODEL || defaultModel;
const server = process.env.SERVER || defaultServer;

if (!(process.env.QUIET === 'true')) {
  console.log('LLM Client: ' + LLM_CLIENT);
  console.log('Server: ' + server);
  console.log('Model: ' + model);
  console.log('Temperature: ' + TEMPERATURE);
}

const noTimeoutFetch = (input, init) => {
  const someInit = init || {};
  return fetch(input, {
    ...someInit,
    dispatcher: new Agent({ headersTimeout: 2700000 }),
  });
};

/////////////////////////////////////
// LLM that we'll use
let llm;
if (LLM_CLIENT === 'ollama') {
  llm = new OllamaChatLLM({
    modelId: model,
    parameters: {
      temperature: TEMPERATURE,
    },
    client: new Ollama({
      host: server,
      fetch: noTimeoutFetch,
    }),
  });
} else if (LLM_CLIENT === 'openai') {
  llm = new OpenAIChatLLM({
    client: new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: server,
    }),
    modelId: model,
    parameters: {
      temperature: TEMPERATURE,
    },
  });
}

// Create agent
let agent = new BeeAgent({
  llm,
  memory: new TokenMemory({ llm }),
  tools: [
    new DuckDuckGoSearchTool({
      maxResults: 5,
      throttle: { limit: 2, interval: 100 },
    }),
  ],
});

// Ask a question using the bee agent framework
async function askQuestion(question) {
  const response = await agent
    .run(
      { prompt: question },
      {
        execution: {
          maxRetriesPerStep: 5,
          totalMaxRetries: 10,
          maxIterations: 10,
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

// Ask the questions
const questions = [
  'How many seconds would it take for a leopard at full speed to run through Pont des Arts?',
  'How many seconds would it take for a leopard tortoise at full speed to run through Pont des Arts?',
];

for (let i = 0; i < questions.length; i++) {
  console.log('QUESTION: ' + questions[i]);
  console.log('  RESPONSE:' + (await askQuestion(questions[i])));
}
