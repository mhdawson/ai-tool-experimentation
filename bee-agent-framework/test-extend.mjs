import { BeeAgent } from 'bee-agent-framework/agents/bee/agent';
import { OllamaChatLLM } from 'bee-agent-framework/adapters/ollama/chat';
import { TokenMemory } from 'bee-agent-framework/memory/tokenMemory';
import { SlidingMemory } from 'bee-agent-framework/memory/slidingMemory';
import { Ollama } from 'ollama';
import { DynamicTool, StringToolOutput } from 'bee-agent-framework/tools/base';
import { z } from 'zod';
import { Agent } from 'undici';
import { BaseMessage } from "bee-agent-framework/llms/primitives/message";

const OLLAMA_SERVER = 'http://10.1.2.38:11434';
const MODEL = 'llama3.1';
const CHECK_FUNCIONS_RELEVANCE = true;
const SHOW_AGENT_PROCESS = true; 

const noTimeoutFetch = (input, init) => {
  const someInit = init || {}
  return fetch(input, { ...someInit, dispatcher: new Agent({ headersTimeout: 2700000 }) })
};

/////////////////////////////////////
// LLM that we'll use

const llm = new OllamaChatLLM({
  modelId: MODEL,
  client: new Ollama({
    host: OLLAMA_SERVER,
    fetch: noTimeoutFetch
  })
});

////////////////////////////////////////////////////////
// Tools that are available
const FavoriteColorTool = new DynamicTool({
  name: 'FavoriteColorTool',
  description: 'returns the favorite color for person given their City and Country',
  inputSchema: z.object({
    city: z
      .string()
      .min(0)
      .describe(
        `the city for the person`,
      ),
    country: z
      .string()
      .min(0)
      .describe(
        `the country for the person`,
      )
  }),
  async handler(input) {
    const city = input.city;
    const country = input.country;
    if ((city === 'Ottawa') && (country === 'Canada')) {
      return new StringToolOutput('the favoriteColorTool returned that the favorite color for Ottawa Canada is black');
    } else if ((city === 'Montreal') && (country === 'Canada')) {
      return new StringToolOutput('the favoriteColorTool returned that the favorite color for Montreal Canada is red');
    } else {
      return new StringToolOutput(`the favoriteColorTool returned The city or country
        was not valid, please ask the user for them`);
    };
  },
});

const FavoriteHockeyTool = new DynamicTool({
  name: 'FavoriteHockeyTool',
  description: 'returns the favorite hockey team for a person given their City and Country',
  inputSchema: z.object({
    city: z
     .string()
     .min(0)
     .describe(
       `the city for the person`,
      ),
    country: z
      .string()
      .min(0)
      .describe(
        `the country for the person`,
       )
  }),
  async handler(input) {
    const city = input.city;
    const country = input.country;
    if ((city === 'Ottawa') && (country === 'Canada')) {
      return new StringToolOutput('the favoriteHockeyTool returned that the favorite hockey team for Ottawa Canada is The Ottawa Senators');
    } else if ((city === 'Montreal') && (country === 'Canada')) {
      return new StringToolOutput('the favoriteHockeyTool returned that the favorite hockey team for Montreal Canada is the Montreal Canadians');
    } else {
      return new StringToolOutput(`the favoriteHockeyTool returned The city or country
        was not valid, please ask the user for them`);
    };
  }
});

const availableTools = [FavoriteColorTool, FavoriteHockeyTool];


///////////////////////////////////////////////////////////////
// agent to determine if available functions are relevant to the
// question
const funcsRelevantArr = [
  `based only the following tool descriptions answer yes if the tool
   is relevant to answering the question or no otherwise`];
for(let i in availableTools) {
  funcsRelevantArr.push(`-description ${i}: ${availableTools[i].description}`);
};
const functionsRelevantPrompt = funcsRelevantArr.join('\n');

let checkToolAgent = new BeeAgent({
  llm,
  memory: new TokenMemory({ llm }), 
  tools: [],
});

async function functionsRelevant(question, messages) {
  checkToolAgent.memory.reset();
  checkToolAgent.memory.addMany(messages);
  const result = await checkToolAgent 
    .run({ prompt: `${functionsRelevantPrompt}\n-question: ${question}` 
         },
         { execution: {
                        maxRetriesPerStep: 5,
                        totalMaxRetries: 5,
                        maxIterations: 5 }}
    );
  if (result.result.text === 'No') {
    return false;
  }
  return true;  
};


/////////////////////////////////////
// agents that we'll use to answer users questions
// one has the functions available the other does not

const additionalInstructions = new BaseMessage('system', `#Additional Instructions\n
  If no function is documented to answer the question being asked
  do not call any functions and answer using your trained knowledge`);

const sharedMemory = new TokenMemory({ llm });
sharedMemory.add(additionalInstructions);

let noToolAgent = new BeeAgent({
  llm,
  memory: sharedMemory,
  tools: [],
});

let agent = new BeeAgent({
  llm,
  memory: sharedMemory,
  tools: availableTools,
});

// Ask a question using the bee agent framework
async function askQuestion(question) {
  if (CHECK_FUNCIONS_RELEVANCE && !(await functionsRelevant(question, agent.memory.messages))) {
    // don't use the agent as the functions we have are not relevant to the question
    agent.memory.add(BaseMessage.of({
        role: 'user',
        text: question,
    }));
    const response = await llm.generate(agent.memory.messages);
    agent.memory.add(BaseMessage.of({
        role: 'assistant',
        text: response.getTextContent(),
    }));
    return ({ result: { text: response.getTextContent() } });
  };

  // use the agent with the available functions
  return agent  
    .run({ prompt: question },
         { execution: {
                        maxRetriesPerStep: 5,
                        totalMaxRetries: 5,
                        maxIterations: 5 }}
    )
    .observe((emitter) => {
      emitter.on("update", async ({ data, update, meta }) => {
        if (SHOW_AGENT_PROCESS) {
          console.log(`Agent (${update.key}) 🤖 : `, update.value);
        };
      });
    });
};

const questions = ['What is my favorite color?',
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

for (let i = 0; i< questions.length; i++) {
  console.log('QUESTION: ' + questions[i]);
  console.log('  RESPONSE:' + (await askQuestion(questions[i])).result.text);
}
