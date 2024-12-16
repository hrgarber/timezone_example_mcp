#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import { DateTime } from 'luxon';
import { ConversionError, ConversionErrorType, validateTimezone, validateTimeFormat, timezoneConversionSchema } from './types.js';
export class TimezoneServer {
    constructor() {
        this.server = new Server({
            name: 'timezone-server',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
        // Error handling
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }
    setupToolHandlers() {
        // Register available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'convert_timezone',
                    description: 'Convert time between different timezones with DST handling',
                    inputSchema: timezoneConversionSchema,
                },
            ],
        }));
        // Handle tool execution
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (request.params.name !== 'convert_timezone') {
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
            }
            try {
                // Validate and type-cast the input
                const args = request.params.arguments;
                if (!args.time || !args.from_timezone || !args.to_timezone ||
                    typeof args.time !== 'string' ||
                    typeof args.from_timezone !== 'string' ||
                    typeof args.to_timezone !== 'string') {
                    throw new McpError(ErrorCode.InvalidParams, 'Invalid parameters: requires time, from_timezone, and to_timezone as strings');
                }
                const input = {
                    time: args.time,
                    from_timezone: args.from_timezone,
                    to_timezone: args.to_timezone
                };
                const result = await this.convertTime(input);
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
                if (error instanceof ConversionError) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Conversion Error: ${error.message}\nType: ${error.type}${error.details ? `\nDetails: ${JSON.stringify(error.details, null, 2)}` : ''}`,
                            },
                        ],
                        isError: true,
                    };
                }
                throw error;
            }
        });
    }
    async convertTime(args) {
        // Validate timezones first
        if (!validateTimezone(args.from_timezone)) {
            throw new ConversionError(ConversionErrorType.INVALID_TIMEZONE, `Invalid source timezone: ${args.from_timezone}`, { timezone: args.from_timezone });
        }
        if (!validateTimezone(args.to_timezone)) {
            throw new ConversionError(ConversionErrorType.INVALID_TIMEZONE, `Invalid target timezone: ${args.to_timezone}`, { timezone: args.to_timezone });
        }
        // Validate time format
        if (!validateTimeFormat(args.time)) {
            throw new ConversionError(ConversionErrorType.INVALID_TIME_FORMAT, 'Invalid time format. Expected HH:MM', { time: args.time });
        }
        try {
            const [hours, minutes] = args.time.split(':').map(Number);
            // Create DateTime object for today with the given time in source timezone
            const now = DateTime.now();
            const sourceTime = DateTime.fromObject({
                year: now.year,
                month: now.month,
                day: now.day,
                hour: hours,
                minute: minutes,
                second: 0,
                millisecond: 0
            }, {
                zone: args.from_timezone
            });
            // Check if the time is valid in the source timezone
            if (!sourceTime.isValid) {
                throw new ConversionError(ConversionErrorType.INVALID_TIME_FORMAT, 'Invalid time for the given timezone', {
                    time: args.time,
                    timezone: args.from_timezone,
                    reason: sourceTime.invalidReason
                });
            }
            // Check for DST transitions
            const beforeTime = sourceTime.minus({ hours: 1 });
            const afterTime = sourceTime.plus({ hours: 1 });
            if (beforeTime.isInDST !== afterTime.isInDST) {
                // We're in a DST transition period
                if (beforeTime.offset !== afterTime.offset) {
                    throw new ConversionError(ConversionErrorType.SKIPPED_TIME, 'This time does not exist due to daylight saving time transition', {
                        time: args.time,
                        timezone: args.from_timezone,
                        transition: 'DST',
                        before: beforeTime.toISO(),
                        after: afterTime.toISO()
                    });
                }
            }
            // Convert to target timezone
            const targetTime = sourceTime.setZone(args.to_timezone);
            if (!targetTime.isValid) {
                throw new ConversionError(ConversionErrorType.CONVERSION_FAILED, 'Failed to convert to target timezone', {
                    reason: targetTime.invalidReason,
                    invalidExplanation: targetTime.invalidExplanation
                });
            }
            // Format the result
            return {
                converted_time: targetTime.toFormat('HH:mm'),
                source: {
                    time: args.time,
                    timezone: args.from_timezone,
                    offset: sourceTime.toFormat('ZZ'),
                    isDST: sourceTime.isInDST
                },
                target: {
                    time: targetTime.toFormat('HH:mm'),
                    timezone: args.to_timezone,
                    offset: targetTime.toFormat('ZZ'),
                    isDST: targetTime.isInDST
                }
            };
        }
        catch (error) {
            if (error instanceof ConversionError) {
                throw error;
            }
            // Handle unexpected errors
            console.error('Unexpected error during conversion:', error);
            throw new ConversionError(ConversionErrorType.SYSTEM_ERROR, 'An unexpected error occurred during time conversion', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Timezone MCP server running on stdio');
    }
}
// Start the server
const server = new TimezoneServer();
server.start().catch(console.error);
