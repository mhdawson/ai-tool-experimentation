import { Ollama } from 'ollama';
import { argv } from 'node:process';
import { readFileSync } from 'node:fs';
import { Agent } from 'undici'

const noTimeoutFetch = (input, init) => {
  const someInit = init || {}
  return fetch(input, { ...someInit, dispatcher: new Agent({ headersTimeout: 2700000 }) })
}

const REMOTE_HOST = '10.1.2.38:11434';
const ollama = new Ollama({ host: REMOTE_HOST,  fetch: noTimeoutFetch })

// the model to use
//const model = 'mistral-nemo';
//const model = 'mistral';
//const model = 'llama3.1';
//const model = 'llama3.1:8b-instruct-q4_K_M';
const model = 'llama3.1:70b-instruct-q4_K_M';
//const model = 'firefunction-v2';
//const model = 'hermes3';
//const model = 'phi3:medium-128k';
//const model = 'gemma2:27b';

const chatContent = readFileSync(argv[2]);

async function doRating(data) {

  const messages = [{role: 'system', content:
    'you are a helpful agent that reviews a chat transcript and figures out how well questions about the users ' +
    'favorite color are answered ' +
    'The LLM can ask clarifying questions. ' +
    'The LLM should ask for the City and Country, if it has not already been provided, when asked for a favorite color. ' 
  }];

  const ratingQuestion = 
    'Use only the conversation in the context to find answers ' + 
    'Given that the right answer when you are in Ottawa Canada is black and that the right answer is when you are in Montreal Canada is red, report the percentage success in the conversation in answering the question "what is my favorite color" ' + 
    'Only answers where the specific color is returned should be considered as an instance for calculation of the percentage' + 
    'Do not include requests for additional information in the total requests for a favorite color' + 
    'Explain your answers ' + 
    'Always return the percentage in the format [Percentage: X].\n ' + 
    '<context> ' + 
    data + 
    '<context/> ';

  messages.push({ role: 'user', content: ratingQuestion });
  console.log(new Date());
  const response = await ollama.chat({ model: model, options: {temperature: 0},  messages: messages});
  console.log(response.message.content);
  console.log(new Date());
}

const lines = chatContent.toString().split('\n');
let startingLine = 1;
for (let i = 1; i< lines.length; i++ ) {
   if (lines[i].includes('--------------------------------------')){
     const block = lines.slice(startingLine, i).join('\n'); 
     await doRating(block);
     startingLine = i + 1;
   }
}
const block = lines.slice(startingLine).join('\n'); 
await doRating(block);

