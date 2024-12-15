#!/usr/bin/env node
import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import { DateTime } from 'luxon';
import {
    TimezoneConversionInput,
    TimezoneConversionOutput,
    ConversionError,
    ConversionErrorType,
    validateTimezone,
    validateTimeFormat,
    parseTime
} from './types.js';

interface ErrorResponse {
    error: string;
    type?: string;
    details?: unknown;
}

class TimezoneServer {
    private server: HttpServer;
    private port: number;

    constructor(port: number = 3001) {
        this.port = port;
        this.server = createServer(this.handleRequest.bind(this));
    }

    private async handleRequest(req: IncomingMessage, res: ServerResponse) {
        try {
            // Set CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
            // Handle preflight requests
            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }
    
            // Only accept POST requests to /convert
            if (req.method !== 'POST' || req.url !== '/convert') {
                this.sendError(res, 404, 'Not Found');
                return;
            }
    
            if (!req.headers['content-type']?.includes('application/json')) {
                this.sendError(res, 400, 'Content-Type must be application/json');
                return;
            }
    
            // Parse request body
            const body = await this.parseRequestBody(req);
            const result = await this.convertTime(body);
            
            this.sendResponse(res, 200, result);
        } catch (error) {
            if (error instanceof ConversionError) {
                this.sendError(res, 400, error.message, error.type, error.details);
            } else {
                console.error('Unexpected error:', error);
                this.sendError(res, 500, 'Internal Server Error', 'SYSTEM_ERROR');
            }
        }
    }
    
    private sendResponse(res: ServerResponse, statusCode: number, data: any) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }
    
    private sendError(
        res: ServerResponse,
        statusCode: number,
        message: string,
        type?: string,
        details?: unknown
    ) {
        const errorResponse: ErrorResponse = {
            error: message
        };
        
        if (type) {
            errorResponse.type = type;
        }
        
        if (details) {
            errorResponse.details = details;
        }
        
        this.sendResponse(res, statusCode, errorResponse);
    }

    private parseRequestBody(req: IncomingMessage): Promise<TimezoneConversionInput> {
        return new Promise((resolve, reject) => {
            let data = '';
            req.on('data', (chunk: string) => {
                data += chunk;
            });
            req.on('end', () => {
                try {
                    const body = JSON.parse(data);
                    if (!body.time || !body.from_timezone || !body.to_timezone) {
                        reject(new ConversionError(
                            ConversionErrorType.INVALID_TIME_FORMAT,
                            'Missing required fields: time, from_timezone, to_timezone'
                        ));
                        return;
                    }
                    resolve(body as TimezoneConversionInput);
                } catch (error) {
                    reject(new ConversionError(
                        ConversionErrorType.INVALID_TIME_FORMAT,
                        'Invalid JSON payload'
                    ));
                }
            });
        });
    }

    private async convertTime(args: TimezoneConversionInput): Promise<TimezoneConversionOutput> {
        // Validate timezones first
        if (!validateTimezone(args.from_timezone)) {
            throw new ConversionError(
                ConversionErrorType.INVALID_TIMEZONE,
                `Invalid source timezone: ${args.from_timezone}`,
                { timezone: args.from_timezone }
            );
        }
        if (!validateTimezone(args.to_timezone)) {
            throw new ConversionError(
                ConversionErrorType.INVALID_TIMEZONE,
                `Invalid target timezone: ${args.to_timezone}`,
                { timezone: args.to_timezone }
            );
        }
    
        // Validate time format
        if (!validateTimeFormat(args.time)) {
            throw new ConversionError(
                ConversionErrorType.INVALID_TIME_FORMAT,
                'Invalid time format. Expected HH:MM',
                { time: args.time }
            );
        }
    
        try {
            const [hours, minutes] = args.time.split(':').map(Number);
            
            // Create DateTime object for today with the given time in source timezone
            const now = DateTime.now();
            const sourceTime = DateTime.fromObject(
                {
                    year: now.year,
                    month: now.month,
                    day: now.day,
                    hour: hours,
                    minute: minutes,
                    second: 0,
                    millisecond: 0
                },
                {
                    zone: args.from_timezone
                }
            );
    
            // Check if the time is valid in the source timezone
            if (!sourceTime.isValid) {
                throw new ConversionError(
                    ConversionErrorType.INVALID_TIME_FORMAT,
                    'Invalid time for the given timezone',
                    {
                        time: args.time,
                        timezone: args.from_timezone,
                        reason: sourceTime.invalidReason
                    }
                );
            }
    
            // Check for DST transitions
            const beforeTime = sourceTime.minus({ hours: 1 });
            const afterTime = sourceTime.plus({ hours: 1 });
            
            if (beforeTime.isInDST !== afterTime.isInDST) {
                // We're in a DST transition period
                if (beforeTime.offset !== afterTime.offset) {
                    throw new ConversionError(
                        ConversionErrorType.SKIPPED_TIME,
                        'This time does not exist due to daylight saving time transition',
                        {
                            time: args.time,
                            timezone: args.from_timezone,
                            transition: 'DST',
                            before: beforeTime.toISO(),
                            after: afterTime.toISO()
                        }
                    );
                }
            }
    
            // Convert to target timezone
            const targetTime = sourceTime.setZone(args.to_timezone);
            if (!targetTime.isValid) {
                throw new ConversionError(
                    ConversionErrorType.CONVERSION_FAILED,
                    'Failed to convert to target timezone',
                    {
                        reason: targetTime.invalidReason,
                        invalidExplanation: targetTime.invalidExplanation
                    }
                );
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
        } catch (error) {
            if (error instanceof ConversionError) {
                throw error;
            }
    
            // Handle unexpected errors
            console.error('Unexpected error during conversion:', error);
            throw new ConversionError(
                ConversionErrorType.SYSTEM_ERROR,
                'An unexpected error occurred during time conversion',
                { error: error instanceof Error ? error.message : String(error) }
            );
        }
    }
    
    public start(): Promise<void> {
        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                console.log(`Timezone conversion server running at http://localhost:${this.port}`);
                resolve();
            });
        });
    }
    
    public stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Force close any remaining connections
            this.server.closeAllConnections();
            
            this.server.close((err) => {
                if (err) {
                    console.error('Error closing server:', err);
                    reject(err);
                } else {
                    console.log('Server stopped successfully');
                    resolve();
                }
            });
        });
    }
}

export { TimezoneServer };

// Start the server if not in test mode
if (process.env.NODE_ENV !== 'test') {
    const port = parseInt(process.env.PORT || '3001', 10);
    const server = new TimezoneServer(port);
    server.start().catch(console.error);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\nShutting down server...');
        try {
            await server.stop();
            console.log('Server stopped successfully');
            process.exit(0);
        } catch (error) {
            console.error('Error stopping server:', error);
            process.exit(1);
        }
    });
}