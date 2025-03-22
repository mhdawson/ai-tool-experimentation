import LlamaStackClient from 'llama-stack-client';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { inspect } from 'node:util';

const model_id = 'meta-llama/Llama-3.1-8B-Instruct';

const client = new LlamaStackClient({
  baseURL: 'http://10.1.2.128:8321',
  timeout: 120 * 1000,
});

const verbose = false;

const log = function (message) {
  if (verbose) {
    console.log(message);
  }
};

/////////////////////////////////////
// Start MCP server and get the available tools from the MCP server
const mcpClient = new Client(
  {
    name: 'test-client',
    version: '1.0.0',
  },
  {
    capabilities: {},
  },
);

await mcpClient.connect(
  new StdioClientTransport({
    command: 'node',
    args: ['favorite-server/build/index.js'],
  }),
);

/////////////////////////////
// convert the description of the tools to the format needed by llama-stack 
let availableTools = await mcpClient.listTools();
availableTools = availableTools.tools;
for (let i = 0; i < availableTools.length; i++) {
  const tool = availableTools[i];
  tool.tool_name = tool.name;
  delete tool.name;
  tool.parameters = tool.inputSchema.properties;
  for (const [key, parameter] of Object.entries(tool.parameters)) {
    parameter.param_type = parameter.type;
    delete parameter.type;
    if (tool.inputSchema.required.includes(key)) {
      parameter.required = true;
    }
  }
  delete tool.inputSchema;
}

/////////////////////////////
// Handle responses which may include a request to run a function
async function handleResponse(messages, response) {
  // push the models response to the chat
  messages.push(response.completion_message);
  if (
    response.completion_message.tool_calls &&
    response.completion_message.tool_calls.length != 0
  ) {
    for (const tool of response.completion_message.tool_calls) {
      // log the function calls so that we see when they are called
      log('  FUNCTION CALLED WITH: ' + inspect(tool));
      console.log('  CALLED:' + tool.tool_name);
      try {
        const funcResponse = await mcpClient.callTool({
          name: tool.tool_name,
          arguments: tool.arguments,
        });

        for (let i = 0; i < funcResponse.content.length; i++) {
          messages.push({
            role: 'tool',
            content: funcResponse.content[i].text,
            call_id: tool.call_id,
            tool_name: tool.tool_name,
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
      await client.inference.chatCompletion({
        messages: messages,
        model_id: model_id,
        tools: availableTools,
      }),
    );
  } else {
    // no function calls just return the response
    return response.completion_message.content;
  }
}

/////////////////////////////
// ASK QUESTIONS

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

for (let j = 0; j < 1; j++) {
  // maintains chat history
  const messages = [
    {
      role: 'system',
      content:
        'only answer questions about a favorite color by using the response from the favorite_color_tool ' +
        'only answer questions about a favorite hockey team by using the response from the favorite_hockey_tool ' +
        'when asked for a favorite color if you have not called the favorite_color_tool, call it ' +
        'Never guess a favorite color' +
        'Do not be chatty ' +
        'Give short answers when possible',
    },
  ];

  console.log(
    `Iteration ${j} ------------------------------------------------------------`,
  );

  for (let i = 0; i < questions.length; i++) {
    console.log('QUESTION: ' + questions[i]);
    messages.push({ role: 'user', content: questions[i] });
    const response = await client.inference.chatCompletion({
      messages: messages,
      model_id: model_id,
      tools: availableTools,
    });
    console.log('  RESPONSE:' + (await handleResponse(messages, response)));
  }
}

mcpClient.close();
