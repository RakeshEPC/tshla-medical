#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { parseScheduleData } from './tools/scheduleParser.js';
import { processActionItems } from './tools/actionProcessor.js';
import { syncAppointments } from './tools/appointmentSync.js';
import {
  getPumpContext,
  savePumpSession,
  trackPumpFeedback,
  detectPumpConflicts,
  getPumpAnalytics,
  cleanupExpiredSessions,
} from './tools/pumpContext.js';

// Define our tools (existing + new Context 7 tools)
const TOOLS = [
  // Existing medical tools
  {
    name: 'parse_schedule',
    description: 'Parse pasted schedule data and convert to structured appointment format',
    inputSchema: {
      type: 'object',
      properties: {
        scheduleText: {
          type: 'string',
          description: 'Raw schedule text copied from scheduling system'
        },
        date: {
          type: 'string',
          description: 'Date for the schedule (YYYY-MM-DD format)'
        }
      },
      required: ['scheduleText']
    }
  },
  {
    name: 'process_actions',
    description: 'Process action items from dictation notes or other sources',
    inputSchema: {
      type: 'object',
      properties: {
        actionText: {
          type: 'string',
          description: 'Text containing action items to process'
        },
        source: {
          type: 'string',
          description: 'Source of the actions (dictation, note, etc)'
        },
        doctorId: {
          type: 'string',
          description: 'ID of the doctor'
        }
      },
      required: ['actionText']
    }
  },
  {
    name: 'sync_appointments',
    description: 'Sync parsed appointments with the existing appointment system',
    inputSchema: {
      type: 'object',
      properties: {
        appointments: {
          type: 'array',
          description: 'Array of appointment objects to sync'
        },
        mode: {
          type: 'string',
          enum: ['merge', 'replace'],
          description: 'How to sync - merge with existing or replace'
        }
      },
      required: ['appointments']
    }
  },
  {
    name: 'get_doctor_schedule',
    description: 'Get the current schedule for a specific doctor',
    inputSchema: {
      type: 'object',
      properties: {
        doctorId: {
          type: 'string',
          description: 'ID or name of the doctor'
        },
        startDate: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD)'
        },
        endDate: {
          type: 'string',
          description: 'End date (YYYY-MM-DD)'
        }
      },
      required: ['doctorId']
    }
  },
  // NEW: Context 7 Pump Drive Tools
  {
    name: 'get_pump_context',
    description: 'Get complete pump drive context for a user including session, feedback history, and analytics',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to retrieve context for'
        },
        includeAnalytics: {
          type: 'boolean',
          description: 'Whether to include analytics data (default: false)'
        }
      },
      required: ['userId']
    }
  },
  {
    name: 'save_pump_session',
    description: 'Save pump drive assessment session with responses and progress',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        responses: {
          type: 'object',
          description: 'User responses to assessment questions (key-value pairs)'
        },
        priorities: {
          type: 'array',
          description: 'User selected priorities'
        },
        selectedFeatures: {
          type: 'array',
          description: 'Features selected by user (optional)'
        },
        freeText: {
          type: 'string',
          description: 'Free text response (optional)'
        },
        completedQuestions: {
          type: 'array',
          description: 'List of completed question IDs'
        },
        totalQuestions: {
          type: 'number',
          description: 'Total number of questions in assessment'
        }
      },
      required: ['userId', 'responses']
    }
  },
  {
    name: 'track_pump_feedback',
    description: 'Track user feedback on pump recommendations to improve accuracy',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Session ID from assessment'
        },
        userId: {
          type: 'string',
          description: 'User ID'
        },
        recommendedPump: {
          type: 'string',
          description: 'Pump that was recommended'
        },
        actualPump: {
          type: 'string',
          description: 'Pump user actually chose (null if still deciding)'
        },
        feedbackType: {
          type: 'string',
          enum: ['same', 'different', 'still_deciding'],
          description: 'Type of feedback'
        },
        reason: {
          type: 'string',
          description: 'Reason for choice (optional)'
        },
        reasonCategory: {
          type: 'string',
          enum: ['cost', 'insurance', 'tubeless', 'cgm', 'other'],
          description: 'Category of reason (optional)'
        }
      },
      required: ['sessionId', 'userId', 'recommendedPump', 'feedbackType']
    }
  },
  {
    name: 'detect_pump_conflicts',
    description: 'Detect conflicts and contradictions in user pump preferences',
    inputSchema: {
      type: 'object',
      properties: {
        responses: {
          type: 'object',
          description: 'User responses to assessment questions'
        },
        selectedFeatures: {
          type: 'array',
          description: 'Features selected by user (optional)'
        }
      },
      required: ['responses']
    }
  },
  {
    name: 'get_pump_analytics',
    description: 'Get recommendation accuracy analytics and trends',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to analyze (default: 30)'
        }
      }
    }
  },
  {
    name: 'cleanup_expired_sessions',
    description: 'Clean up expired pump drive sessions (admin tool)',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Create server instance
const server = new Server({
  name: 'tshla-medical-mcp-context7',
  version: '2.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      // Existing medical tools
      case 'parse_schedule': {
        const { scheduleText, date } = args;
        result = await parseScheduleData(scheduleText, date);
        break;
      }
      case 'process_actions': {
        const { actionText, source, doctorId } = args;
        result = await processActionItems(actionText, source, doctorId);
        break;
      }
      case 'sync_appointments': {
        const { appointments, mode = 'merge' } = args;
        result = await syncAppointments(appointments, mode);
        break;
      }
      case 'get_doctor_schedule': {
        const { doctorId, startDate, endDate } = args;
        result = {
          doctorId,
          startDate: startDate || new Date().toISOString().split('T')[0],
          endDate: endDate || new Date().toISOString().split('T')[0],
          appointments: [],
          message: 'Schedule retrieved successfully'
        };
        break;
      }

      // NEW: Context 7 Pump Drive Tools
      case 'get_pump_context': {
        const { userId, includeAnalytics = false } = args;
        result = getPumpContext(userId, includeAnalytics);
        break;
      }
      case 'save_pump_session': {
        result = savePumpSession(args);
        break;
      }
      case 'track_pump_feedback': {
        result = trackPumpFeedback(args);
        break;
      }
      case 'detect_pump_conflicts': {
        result = detectPumpConflicts(args);
        break;
      }
      case 'get_pump_analytics': {
        const { days = 30 } = args;
        result = getPumpAnalytics(days);
        break;
      }
      case 'cleanup_expired_sessions': {
        result = cleanupExpiredSessions();
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
  catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('TSHLA Medical MCP Server (with Context 7) running on stdio');
}

main().catch(console.error);
