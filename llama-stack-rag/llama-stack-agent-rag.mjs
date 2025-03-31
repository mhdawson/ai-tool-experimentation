import LlamaStackClient from 'llama-stack-client';
import { inspect } from 'node:util';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const model_id = 'meta-llama/Llama-3.1-8B-Instruct';

const client = new LlamaStackClient({
  baseURL: 'http://10.1.2.128:8321',
  timeout: 120 * 1000,
});

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
      document_id: `num-${i}`,
      content: contents,
      mime_type: 'text/plan',
      metadata: {},
    });
  }
}

await client.toolRuntime.ragTool.insert({
  documents: RAGDocuments,
  vector_db_id,
  chunk_size_in_tokens: 512,
});

// Create the agent
const agentic_system_create_response = await client.agents.create({
  agent_config: {
    model: model_id,
    instructions:
      'You are a helpful assistant, answer questions only based on information in the documents provided',
    toolgroups: [
      {
        name: 'builtin::rag/knowledge_search',
        args: { vector_db_ids: [vector_db_id] },
      },
    ],
    tool_choice: 'auto',
    input_shields: [],
    output_shields: [],
    max_infer_iters: 10,
  },
});
const agent_id = agentic_system_create_response.agent_id;

// Create a session that will be used to ask the agent a sequence of questions
const sessionCreateResponse = await client.agents.session.create(agent_id, {
  session_name: 'agent1',
});
const session_id = sessionCreateResponse.session_id;

/////////////////////////////
// ASK QUESTIONS

const questions = ['Is starting Node.js with npm a good idea?'];

for (let j = 0; j < 1; j++) {
  console.log(
    `Iteration ${j} ------------------------------------------------------------`,
  );

  for (let i = 0; i < questions.length; i++) {
    console.log('QUESTION: ' + questions[i]);
    const responseStream = await client.agents.turn.create(
      agent_id,
      session_id,
      {
        stream: true,
        messages: [{ role: 'user', content: questions[i] }],
      },
    );

    // as of March 2025 only streaming was supported
    let response = '';
    for await (const chunk of responseStream) {
      if (chunk.event.payload.event_type === 'turn_complete') {
        response = response + chunk.event.payload.turn.output_message.content;
      }
    }
    console.log('  RESPONSE:' + response);
  }
}
