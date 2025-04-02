import LlamaStackClient from 'llama-stack-client';
import { inspect } from 'node:util';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import mtt from 'markdown-to-txt';

const model_id = 'meta-llama/Llama-3.1-8B-Instruct';
const SHOW_RAG_DOCUMENTS = true;

const client = new LlamaStackClient({
  baseURL: 'http://10.1.2.128:8321',
  timeout: 120 * 1000,
});

////////////////////////
// Create the RAG database

// use the first avialable provider
const provider = (await client.providers.list()).filter(
  provider => provider.api === 'vector_io',
)[0];
// register a vector database
const vector_db_id = `test-vector-db-${randomUUID()}`;
await client.vectorDBs.register({
  vector_db_id,
  provider_id: provider.provider_id,
  embedding_model: 'all-MiniLM-L6-v2',
  embedding_dimentions: 384,
});

// read in all of the files to be used with RAG
const RAGDocuments = [];
const files = await fs.promises.readdir(
  '/home/midawson/newpull/nodejs-reference-architecture/docs',
  { withFileTypes: true, recursive: true },
);
let i = 0;
for (const file of files) {
  i++;
  if (file.name.endsWith('.md')) {
    const contents = fs.readFileSync(path.join(file.path, file.name), 'utf8');
    RAGDocuments.push({
      document_id: `doc-${i}`,
      content: mtt.markdownToTxt(contents),
      mime_type: 'text/plan',
      metadata: {},
    });
  }
}

await client.toolRuntime.ragTool.insert({
  documents: RAGDocuments,
  vector_db_id,
  chunk_size_in_tokens: 125,
});

/////////////////////////////
// ASK QUESTIONS

//const questions = ['Should I use npm to start a node.js application'];
const questions = ['Should I use npm to start an application'];

for (let j = 0; j < 1; j++) {
  // maintains chat history
  const messages = [
    {
      role: 'system',
      content: 'Give short answers when possible',
    },
  ];

  console.log(
    `Iteration ${j} ------------------------------------------------------------`,
  );

  for (let i = 0; i < questions.length; i++) {
    console.log('QUESTION: ' + questions[i]);

    const rawRagResults = await client.toolRuntime.ragTool.query({
      content: questions[i],
      vector_db_ids: [vector_db_id],
    });

    const ragResults = [];
    for (let j = 0; j < rawRagResults.content.length; j++) {
      ragResults.push(rawRagResults.content[j].text);
    }

    const prompt = `Answer the question based only on the context provided
                   <question>${questions[i]}</question>
                   <context>${ragResults.join()}</context>`;

    messages.push({
      role: 'user',
      content: prompt,
    });
    const response = await client.inference.chatCompletion({
      messages: messages,
      model_id: model_id,
    });
    console.log('  RESPONSE:' + response.completion_message.content);
  }
}

////////////////////////
// REMOVE DATABASE
await client.vectorDBs.unregister(vector_db_id);
