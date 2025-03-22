import LlamaStackClient from 'llama-stack-client';
import { inspect } from 'node:util';

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

/////////////////////////////
// TOOL info for the LLM
const availableTools = [
  {
    tool_name: 'favorite_color_tool',
    description:
      'returns the favorite color for person given their City and Country',
    parameters: {
      city: {
        param_type: 'string',
        description: 'the city for the person',
        required: true,
      },
      country: {
        param_type: 'string',
        description: 'the country for the person',
        required: true,
      },
    },
  },
  {
    tool_name: 'favorite_hockey_tool',
    description:
      'returns the favorite hockey team for a person given their City and Country',
    parameters: {
      city: {
        param_type: 'string',
        description: 'the city for the person',
        required: true,
      },
      country: {
        param_type: 'string',
        description: 'the country for the person',
        required: true,
      },
    },
  },
];

/////////////////////////////
// FUNCTION IMPLEMENTATIONS
const funcs = {
  favorite_color_tool: getFavoriteColor,
  favorite_hockey_tool: getFavoriteHockeyTeam,
};

function getFavoriteColor(args) {
  const city = args.city;
  const country = args.country;
  if (city === 'Ottawa' && country === 'Canada') {
    return 'the favoriteColorTool returned that the favorite color for Ottawa Canada is black';
  } else if (city === 'Montreal' && country === 'Canada') {
    return 'the favoriteColorTool returned that the favorite color for Montreal Canada is red';
  } else {
    return `the favoriteColorTool returned The city or country
            was not valid, assistant please ask the user for them`;
  }
}

function getFavoriteHockeyTeam(args) {
  const city = args.city;
  const country = args.country;
  if (city === 'Ottawa' && country === 'Canada') {
    return 'the favoriteHocketTool returned that the favorite hockey team for Ottawa Canada is The Ottawa Senators';
  } else if (city === 'Montreal' && country === 'Canada') {
    return 'the favoriteHockeyTool returned that the favorite hockey team for Montreal Canada is the Montreal Canadians';
  } else {
    return `the favoriteHockeyTool returned The city or country
            was not valid, please ask the user for them`;
  }
}

/////////////////////////////
// FUNCTION IMPLEMENTATIONS
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
      const func = funcs[tool.tool_name];
      if (func) {
        const funcResponse = func(tool.arguments);
        messages.push({
          role: 'tool',
          content: funcResponse,
          call_id: tool.call_id,
          tool_name: tool.tool_name,
        });
      } else {
        messages.push({
          role: 'tool',
          call_id: tool.call_id,
          tool_name: tool.tool_name,
          content: 'invalid tool called',
        });
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

const model_id = 'meta-llama/Llama-3.1-8B-Instruct';

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
