import { Ollama } from 'ollama';
import { inspect } from 'node:util';
import { Agent } from 'undici';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const noTimeoutFetch = (input, init) => {
  const someInit = init || {};
  return fetch(input, {
    ...someInit,
    dispatcher: new Agent({ headersTimeout: 2700000 }),
  });
};

const REMOTE_HOST = '10.1.2.38:11434';

const ollama = new Ollama({ host: REMOTE_HOST, fetch: noTimeoutFetch });
// Make responses more deterministic
const ollamaOptions = {
  temperature: 0,
};

const verbose = false;
const log = function (message) {
  if (verbose) {
    console.log(message);
  }
};

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

// convert the description of the tools to the format needed by Ollama
let availableTools = await client.listTools();
for (let i = 0; i < availableTools.tools.length; i++) {
  availableTools.tools[i].parameters = availableTools.tools[i].inputSchema;
  delete availableTools.tools[i].inputSchema;
  availableTools.tools[i] = {
    type: 'function',
    function: availableTools.tools[i],
  };
}
availableTools = availableTools.tools;

/////////////////////////////
// Handle responses which may include a request to run a function
async function handleResponse(messages, response) {
  // push the models response to the chat
  messages.push(response.message);

  if (response.message.tool_calls && response.message.tool_calls.length != 0) {
    for (const tool of response.message.tool_calls) {
      // log the function calls so that we see when they are called
      log('  FUNCTION CALLED WITH: ' + inspect(tool));
      log('  CALLED:' + tool.function.name);
      try {
        const funcResponse = await client.callTool({
          name: tool.function.name,
          arguments: tool.function.arguments,
        });
        for (let i = 0; i < funcResponse.content.length; i++) {
          messages.push({
            role: 'tool',
            content: funcResponse.content[i].text,
          });
        }
      } catch (e) {
        messages.push({ role: 'tool', content: `tool call failed: ${e}` });
      }
    }

    // call the model again so that it can process the data returned by the
    // function calls
    return handleResponse(
      messages,
      await ollama.chat({
        model: model,
        messages: messages,
        tools: availableTools,
        options: ollamaOptions,
      }),
    );
  } else {
    // no function calls just return the response
    return response;
  }
}

/////////////////////////////
// ASK QUESTIONS

// the model to use
const model = 'llama3.1';

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

// maintains chat history
const messages = [
  {
    role: 'system',
    content:
      'only answer questions about a favorite color by using the response from the favorite_color_tool',
  },
  {
    role: 'system',
    content:
      'when asked for a favorite color if you have not called the favorite_color_tool, call it',
  },
  { role: 'system', content: 'Never guess a favorite color' },
  { role: 'system', content: 'Never mention a tool by name' },
  { role: 'system', content: 'Do not mention tools or calling a tool' },
  { role: 'system', content: 'Give short answers when possible' },
];

for (let i = 0; i < questions.length; i++) {
  console.log('QUESTION: ' + questions[i]);
  messages.push({ role: 'user', content: questions[i] });
  const response = await ollama.chat({
    model: model,
    messages: messages,
    tools: availableTools,
    options: ollamaOptions,
  });
  console.log(
    '  RESPONSE:' + (await handleResponse(messages, response)).message.content,
  );
}

client.close();
