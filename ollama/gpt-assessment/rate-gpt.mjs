import ollama from 'ollama';
import { argv } from 'node:process';
import { readFileSync } from 'node:fs';

const chatContent = readFileSync(argv[2]);

import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});


async function doRating(data) {

  const messages = [{role: 'system', content:
    'you are a helpful agent that reviews a chat transcript and figures out how well questions about the users ' +
    'favorite color ' +
    'The LLM can ask clarifying questions. ' +
    'The LLM should ask for the City and Country, if it has not already been provided, when asked for a favorite color. ' 
  }];

  const ratingQuestion = 
    'Use only the conversation in the context to find numbers. ' + 
    'Given that the right answer when you are in Ottawa Canada is black and that the right answer is when you are in Montreal Canada is red, report the percentage success in the conversation in answering the question "what is my favorite color" ' + 
    'Always return the percentage in the format [Percentage: X].\n ' + 
    '<context> ' + 
    data + 
    '<context/> ';

  messages.push({ role: 'user', content: ratingQuestion });
  const chatCompletion = await client.chat.completions.create({
    messages: messages,
    model: 'gpt-4o'
  });
  console.log(chatCompletion.choices[0].message);
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
