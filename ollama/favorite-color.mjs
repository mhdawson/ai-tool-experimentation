import { Ollama } from 'ollama';
import { inspect } from 'node:util'
import { Agent } from 'undici'

const noTimeoutFetch = (input, init) => {
  const someInit = init || {}
  return fetch(input, { ...someInit, dispatcher: new Agent({ headersTimeout: 2700000 }) })
}

const REMOTE_HOST = '10.1.2.38:11434';
const ollama = new Ollama({ host: REMOTE_HOST,  fetch: noTimeoutFetch })

const verbose = false;

const log = function(message) {
  if (verbose) {
    console.log(message);
  };
}

/////////////////////////////
// TOOL info for the LLM
const tools =  [{
  type: 'function',
  function: {
    name: 'favoriteColorTool',
    description: 'returns the favorite color for person given their City and Country',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'the city for the person',
        },
        country: {
          type: 'string',
          description: 'the country for the person',
        },
      },
      required: ['city', 'country'],
    },
  },
},
{
  type: 'function',
  function: {
    name: 'favoriteHockeyTeamTool',
    description: 'returns the favorite hockey team for person given their City and Country',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'the city for the person',
        },
        country: {
          type: 'string',
          description: 'the country for the person',
        },
      },
      required: ['city', 'country'],
    },
  },
}
];

/////////////////////////////
// FUNCTION IMPLEMENTATIONS
const funcs = {
  favoriteColorTool: getFavoriteColor,
  favoriteHockeyTeamTool: getFavoriteHockeyTeam
};

function getFavoriteColor(args) {
  const city = args.city;
  const country = args.country;
  if ((city === 'Ottawa') && (country === 'Canada')) {
    return 'the favoriteColorTool returned that the favorite color for Ottawa Canada is black';
  } else if ((city === 'Montreal') && (country === 'Canada')) {
    return 'the favoriteColorTool returned that the favorite color for Montreal Canada is red';
  } else {
    return `the favoriteColorTool returned The city or country
            was not valid, please ask the user for them`;
  }
};

function getFavoriteHockeyTeam(args) {
  const city = args.city;
  const country = args.country;
  if ((city === 'Ottawa') && (country === 'Canada')) {
    return 'the favoriteColorTool returned that the favorite hockey team for Ottawa Canada is The Ottawa Senators';
  } else if ((city === 'Montreal') && (country === 'Canada')) {
    return 'the favoriteColorTool returned that the favorite hockey team for Montreal Canada is the Montreal Canadians';
  } else {
    return `the favoriteColorTool returned The city or country
            was not valid, please ask the user for them`;
  }
};

/////////////////////////////
// FUNCTION IMPLEMENTATIONS
// Handle responses which may include a request to run a function
async function handleResponse(messages, response) {
  // push the models response to the chat
  messages.push(response.message);

  if (response.message.tool_calls && (response.message.tool_calls.length != 0)) {
    for (const tool of response.message.tool_calls) {
      // log the function calls so that we see when they are called
      log('  FUNCTION CALLED WITH: ' + inspect(tool));
      console.log('  CALLED:' + tool.function.name);
      const func = funcs[tool.function.name];
      if (func) {
        const funcResponse = func(tool.function.arguments);
        messages.push({ role: 'tool', content: funcResponse });
      } else {
        messages.push({ role: 'tool', content: 'invalid tool called' });
        console.log(tool.function.name);
      }
    }

    // call the model again so that it can process the data returned by the 
    // function calls
    return ( handleResponse( messages,
      await ollama.chat({ model: model, messages: messages, tools: tools})
    ));
  } else { 
    // no function calls just return the response
    return response;
  }
}


/////////////////////////////
// ASK QUESTIONS

// the model to use
//const model = 'mistral-nemo';
//const model = 'mistral';
const model = 'llama3.1';
//const model = 'firefunction-v2';
//const model = 'llama3.1:70b-instruct-q4_K_M';
//const model = 'hermes3';

const questions = ['What is my favorite color?', 
                   'My city is Ottawa',
                   'My country is Canada',
                   'I moved to Montreal. What is my favorite color now?',
                   'My city is Montreal and my country is Canada',
                   'My city is Ottawa and my country is Canada, what is my favorite color?',
                   'What is my favorite hockey team ?',
                   'My city is Montreal and my country is Canada',
                  ];

for (let j = 0; j < 10; j++) {
  // maintains chat history
  const messages = [{type: 'system', content:
    'only answer questions about a favorite color by using the response from the favoriteColorTool ' +
    'when asked for a favorite color if you have not called the favoriteColorTool, call it ' + 
    'Never guess a favorite color ' +
    'Do not be chatty ' +
    'Give short answers when possible'
  }];

  console.log(`Iteration ${j} ------------------------------------------------------------`);

  for (let i = 0; i< questions.length; i++) {
    console.log('QUESTION: ' + questions[i]);
    messages.push({ role: 'user', content: questions[i] });
    const response = await ollama.chat({ model: model, messages: messages, tools: tools});
    console.log('  RESPONSE:' + (await handleResponse(messages, response)).message.content);
  }      
}

