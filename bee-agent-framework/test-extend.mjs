import { BeeAgent } from 'bee-agent-framework/agents/bee/agent';
import { OllamaChatLLM } from 'bee-agent-framework/adapters/ollama/chat';
import { TokenMemory } from 'bee-agent-framework/memory/tokenMemory';
import { SlidingMemory } from 'bee-agent-framework/memory/slidingMemory';
import { Ollama } from 'ollama';
import { DynamicTool, StringToolOutput } from 'bee-agent-framework/tools/base';
import { z } from 'zod';
import { Agent } from 'undici';
import { BaseMessage } from "bee-agent-framework/llms/primitives/message";
import {
  BeeSystemPrompt,
} from "bee-agent-framework/agents/bee/prompts";
import {PromptTemplate} from "bee-agent-framework/template";

const OLLAMA_SERVER = 'http://10.1.2.38:11434';
const MODEL = 'llama3.1';
const CHECK_FUNCIONS_RELEVANCE = true;
const SHOW_AGENT_PROCESS = false; 

const noTimeoutFetch = (input, init) => {
  const someInit = init || {}
  return fetch(input, { ...someInit, dispatcher: new Agent({ headersTimeout: 2700000 }) })
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

/////////////////////////////////////
// agents that we'll use to answer users questions
// one has the functions available the other does not

class ExtendedBeeAgent extends BeeAgent {

  constructor(input) {
    super(input);
    const funcsRelevantArr = [
      `Based only on the descriptions in this request answer Yes if one of the functions described might
       be able to answer the question. Only respond with Yes or No.`];
    for(let i in availableTools) {
      funcsRelevantArr.push(`- description ${i}: ${input.tools[i].description}`);
    };
    this.functionsRelevantPrompt = funcsRelevantArr.join('\n');

    this.checkToolAgent = new BeeAgent({
      llm: input.llm,
      memory: new TokenMemory({ llm: input.llm }), 
      tools: [],
    });

    this.noToolsPrompt =  new PromptTemplate({
      schema: z.object({
        instructions: z.string().default('You are a helpful assistant'),
        tools: z.array(
          z
            .object({
              name: z.string().min(1),
              description: z.string().min(1),
              schema: z.string().min(1),
            })
            .passthrough(),
        ),
      }),
      template: 'You are a helpful assistant, answer questions based on your trained knowledge',
    });

    this.originalTemplates = this.input.templates;
  };

  async functionsRelevant(question, messages) {
    this.checkToolAgent.memory.reset();
    this.checkToolAgent.memory.addMany(messages);
    const result = await this.checkToolAgent 
      .run({ prompt: `${this.functionsRelevantPrompt}\n- question: ${question}` 
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

  async _run(input, options, run) {
    if (CHECK_FUNCIONS_RELEVANCE) {
      const useFunctions = await this.functionsRelevant(input.prompt, this.memory.messages); 
      if (!useFunctions) {
        if (!this.input.templates)
          this.input.templates = {};
        this.input.templates.system = this.noToolsPrompt;
      }
    };

    const result = await super._run(input, options, run);
    this.input.templates = this.originalTemplates;
    return result;
  }
}

/////////////////////////////////////
// Use agent to ask questions

let agent = new ExtendedBeeAgent({
  llm,
  memory: new TokenMemory({ llm }),
  tools: availableTools,
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
