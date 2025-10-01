#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { parseScheduleData } from './tools/scheduleParser.js';
import { processActionItems } from './tools/actionProcessor.js';
import { syncAppointments } from './tools/appointmentSync.js';
// Define our tools
const TOOLS = [
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
    }
];
// Create server instance
const server = new Server({
    name: 'tshla-medical-mcp',
    version: '1.0.0',
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
        switch (name) {
            case 'parse_schedule': {
                const { scheduleText, date } = args;
                const result = await parseScheduleData(scheduleText, date);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case 'process_actions': {
                const { actionText, source, doctorId } = args;
                const result = await processActionItems(actionText, source, doctorId);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case 'sync_appointments': {
                const { appointments, mode = 'merge' } = args;
                const result = await syncAppointments(appointments, mode);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case 'get_doctor_schedule': {
                const { doctorId, startDate, endDate } = args;
                // This would connect to your existing appointment system
                const result = {
                    doctorId,
                    startDate: startDate || new Date().toISOString().split('T')[0],
                    endDate: endDate || new Date().toISOString().split('T')[0],
                    appointments: [], // Would fetch from database
                    message: 'Schedule retrieved successfully'
                };
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
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
    console.error('TSHLA Medical MCP Server running on stdio');
}
main().catch(console.error);
//# sourceMappingURL=index.js.map