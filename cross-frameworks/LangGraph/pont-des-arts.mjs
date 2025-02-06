import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { Agent } from 'undici';
import { MemorySaver } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { DuckDuckGoSearch } from '@langchain/community/tools/duckduckgo_search';
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

  //defaultModel = 'granite3.1-dense';
  //defaultModel = 'llama3.1';
  defaultModel = 'llama3.1:8b-instruct-q4_K_M';
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
  llm = new ChatOllama({
    model: model,
    baseUrl: server,
    temperature: TEMPERATURE,
  });
  llm.client.fetch = noTimeoutFetch;
} else if (LLM_CLIENT === 'openai') {
  llm = await new ChatOpenAI({
    model: model,
    TEMPERATURE: 0,
    apiKey: process.env.OPENAI_API_KEY,
    configuration: {
      baseURL: server,
    },
  });
}

// Create agent
const agentCheckpointer = new MemorySaver();
const agent = createReactAgent({
  llm,
  checkpointSaver: agentCheckpointer,
  tools: [new DuckDuckGoSearch({ maxResults: 5 })],
});

// Ask a question using the bee agent framework
async function askQuestion(question) {
  const response = await agent.invoke(
    { messages: [new HumanMessage(question)] },
    { configurable: { thread_id: 'thread1' } },
  );
  if (SHOW_AGENT_PROCESS) {
    console.log(response.messages);
  }
  return response.messages[response.messages.length - 1].content;
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
