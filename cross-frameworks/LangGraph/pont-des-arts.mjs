import { ChatOllama } from "@langchain/ollama";
import { Agent } from "undici";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";

const OLLAMA_SERVER = "http://10.1.2.38:11434";
//const MODEL = 'granite3.1-dense';
const MODEL = "llama3.1";
//const MODEL = "qwen2.5-coder:32b";
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
const llm = new ChatOllama({
  model: MODEL,
  baseUrl: OLLAMA_SERVER,
  temperature: 0,
});
llm.client.fetch = noTimeoutFetch;

// Create agent
const agentCheckpointer = new MemorySaver();
const agent = createReactAgent({
  llm,
  checkpointSaver: agentCheckpointer,
  tools: [new DuckDuckGoSearch({ maxResults: 3 })],
});

// Ask a question using the bee agent framework
async function askQuestion(question) {
  const response = await agent.invoke(
    { messages: [new HumanMessage(question)] },
    { configurable: { thread_id: "thread1" } },
  );
  if (SHOW_AGENT_PROCESS) {
    console.log(response.messages);
  }
  return response.messages[response.messages.length - 1].content;
}

// Ask the questions
const questions = [
  "How many seconds would it take for a leopard at full speed to run through Pont des Arts?",
  "How many seconds would it take for a leopard tortoise at full speed to run through Pont des Arts?",
];

for (let i = 0; i < questions.length; i++) {
  console.log("QUESTION: " + questions[i]);
  console.log("  RESPONSE:" + (await askQuestion(questions[i])));
}
