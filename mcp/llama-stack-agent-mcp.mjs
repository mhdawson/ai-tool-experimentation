import LlamaStackClient from 'llama-stack-client';

const model_id = 'meta-llama/Llama-3.1-8B-Instruct';

const client = new LlamaStackClient({
  baseURL: 'http://10.1.2.128:8321',
  timeout: 120 * 1000,
});

// Create the agent
const agentic_system_create_response = await client.agents.create({
  agent_config: {
    model: model_id,
    instructions: 'You are a helpful assistant',
    toolgroups: ['mcp::mcp_favorites'],
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
