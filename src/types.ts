import { DateTime } from 'luxon';

// Input parameters for timezone conversion
export interface TimezoneConversionInput {
    time: string;          // Format: HH:MM
    from_timezone: string; // e.g., "America/New_York"
    to_timezone: string;   // e.g., "Asia/Tokyo"
}

// Structured output for conversion results
export interface TimezoneConversionOutput {
    converted_time: string;
    source: {
        time: string;
        timezone: string;
        offset: string;    // e.g., "-04:00"
        isDST: boolean;    // Daylight Saving Time status
    };
    target: {
        time: string;
        timezone: string;
        offset: string;    // e.g., "+09:00"
        isDST: boolean;    // Daylight Saving Time status
    };
}

// MCP Tool Input Schema for timezone conversion
export const timezoneConversionSchema = {
    type: 'object',
    properties: {
        time: {
            type: 'string',
            description: 'Time in HH:MM format (24-hour)',
            pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
        },
        from_timezone: {
            type: 'string',
            description: 'Source timezone (e.g., "America/New_York")'
        },
        to_timezone: {
            type: 'string',
            description: 'Target timezone (e.g., "Asia/Tokyo")'
        }
    },
    required: ['time', 'from_timezone', 'to_timezone'],
    additionalProperties: false
};

// Error types for better error handling
export enum ConversionErrorType {
    INVALID_TIME_FORMAT = 'INVALID_TIME_FORMAT',
    INVALID_TIMEZONE = 'INVALID_TIMEZONE',
    INVALID_TIMEZONE_FORMAT = 'INVALID_TIMEZONE_FORMAT',
    AMBIGUOUS_TIME = 'AMBIGUOUS_TIME',           // During DST transitions
    SKIPPED_TIME = 'SKIPPED_TIME',              // During DST transitions
    CONVERSION_FAILED = 'CONVERSION_FAILED',
    SYSTEM_ERROR = 'SYSTEM_ERROR'
}

export class ConversionError extends Error {
    constructor(
        public type: ConversionErrorType,
        message: string,
        public details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'ConversionError';
    }
}

// Timezone validation helper
export function validateTimezone(timezone: string): boolean {
    return DateTime.local().setZone(timezone).isValid;
}

// Time format validation helper
export function validateTimeFormat(time: string): boolean {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
}

// Convert time string to DateTime
export function parseTime(time: string, timezone: string): DateTime {
    const [hours, minutes] = time.split(':').map(Number);
    return DateTime.local().setZone(timezone).set({
        hour: hours,
        minute: minutes,
        second: 0,
        millisecond: 0
    });
}