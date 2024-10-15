import { BeeAgent } from "bee-agent-framework/agents/bee/agent";
import { OllamaChatLLM } from "bee-agent-framework/adapters/ollama/chat";
import { TokenMemory } from "bee-agent-framework/memory/tokenMemory";
import { Ollama } from "ollama";
import { FavoriteColorTool } from "./src/dist/favoriteColorTool.js"
import { FavoriteHockeyTool } from "./src/dist/favoriteHockeyTool.js"
import { Agent } from 'undici';

const OLLAMA_SERVER = 'http://10.1.2.38:11434';

const model = 'llama3.1';
//const model = 'gabegoodhart/granite-functioncalling:20b';
//const model = 'hermes3';

const noTimeoutFetch = (input, init) => {
  const someInit = init || {}
  return fetch(input, { ...someInit, dispatcher: new Agent({ headersTimeout: 2700000 }) })
}

const llm = new OllamaChatLLM({
  modelId: model,
  client: new Ollama({
    host: OLLAMA_SERVER,
    fetch: noTimeoutFetch
  })
});

const agent = new BeeAgent({
  llm,
  memory: new TokenMemory({ llm }),
  tools: [new FavoriteColorTool(), new FavoriteHockeyTool()],
});


// Ask a question using the bee agent framework
async function askQuestion(question) {
  return agent
    .run({ prompt: question },
         { execution: {
                        maxRetriesPerStep: 5,
                        totalMaxRetries: 5,
                        maxIterations: 5 }}
    )
    .observe((emitter) => {
      emitter.on("update", async ({ data, update, meta }) => {
        console.log(`Agent (${update.key}) 🤖 : `, update.value);
      });
    });
};

const questions = ['What is my favorite color?',
                   'My city is Ottawa',
                   'My country is Canada',
                   'I moved to Montreal. What is my favorite color now?',
                   'My city is Montreal and my country is Canada',
                   'What is the fastest car in the world ?',
                   'My city is Ottawa and my country is Canada, what is my favorite color?',
                   'What is my favorite hockey team ?',
                   'My city is Montreal and my country is Canada',
                  ];

for (let i = 0; i< questions.length; i++) {
  console.log('QUESTION: ' + questions[i]);
  console.log('  RESPONSE:' + (await askQuestion(questions[i])).result.text);
}
