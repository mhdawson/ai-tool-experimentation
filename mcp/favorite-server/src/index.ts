#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: 'favorite-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// handler that returns list of available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'favorite_color_tool',
        description:
          'returns the favorite color for person given their City and Country',
        inputSchema: {
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
      {
        name: 'favorite_hockey_tool',
        description:
          'returns the favorite hockey team for a person given their City and Country',
        inputSchema: {
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
    ],
  };
});

// handler that invokes appropriate tool when called
server.setRequestHandler(CallToolRequestSchema, async request => {
  if (
    request.params.name === 'favorite_color_tool' ||
    request.params.name === 'favorite_hockey_tool'
  ) {
    let text = `the ${request.params.name} returned the city or country was not valid
                assistant please ask the user for them`;

    const city = String(request.params.arguments?.city);
    const country = String(request.params.arguments?.country);

    if (city && country) {
      if (request.params.name === 'favorite_color_tool') {
        if (city === 'Ottawa' && country === 'Canada') {
          text =
            'the favorite_color_tool returned that the favorite color for Ottawa Canada is black';
        } else if (city === 'Montreal' && country === 'Canada') {
          text =
            'the favorite_color_tool returned that the favorite color for Montreal Canada is red';
        }
      } else if (request.params.name === 'favorite_hockey_tool') {
        if (city === 'Ottawa' && country === 'Canada') {
          text =
            'the favorite_hockey_tool returned that the favorite hockey team for Ottawa Canada is The Ottawa Senators';
        } else if (city === 'Montreal' && country === 'Canada') {
          text =
            'the favorite_hockey_tool returned that the favorite hockey team for Montreal Canada is the Montreal Canadians';
        }
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: text,
        },
      ],
    };
  } else {
    throw new Error('Unknown tool');
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(error => {
  console.error('Server error:', error);
  process.exit(1);
});
