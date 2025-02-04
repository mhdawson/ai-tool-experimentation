import { BeeAgent } from 'bee-agent-framework/agents/bee/agent';
import { OllamaChatLLM } from 'bee-agent-framework/adapters/ollama/chat';
//import { OpenAIChatLLM } from 'bee-agent-framework/adapters/openai/chat';
import { TokenMemory } from 'bee-agent-framework/memory/tokenMemory';
import { Ollama } from 'ollama';
import { Agent } from 'undici';
import { DuckDuckGoSearchTool } from 'bee-agent-framework/tools/search/duckDuckGoSearch';

const OLLAMA_SERVER = 'http://10.1.2.38:11434';
//const MODEL = 'granite3.1-dense';
const MODEL = 'llama3.1';
//const MODEL = 'qwen2.5-coder:32b';
const SHOW_AGENT_PROCESS = true;

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

/*
const llm = new OpenAIChatLLM({
  modelId: "gpt-4o-mini",
//  azure: true,
  parameters: {
    max_tokens: 10,
    stop: ["post"],
  },
});
*/

// Create agent
let agent = new BeeAgent({
  llm,
  memory: new TokenMemory({ llm }),
  tools: [
    new DuckDuckGoSearchTool({ maxResults: 3, throttle: { interval: 1000 } }),
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

// Ask the questions
const questions = [
  'How many seconds would it take for a leopard at full speed to run through Pont des Arts?',
  'How many seconds would it take for a leopard tortoise at full speed to run through Pont des Arts?',
];

for (let i = 0; i < questions.length; i++) {
  console.log('QUESTION: ' + questions[i]);
  console.log('  RESPONSE:' + (await askQuestion(questions[i])));
}
