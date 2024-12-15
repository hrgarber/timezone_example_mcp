import { DateTime } from 'luxon';
export interface TimezoneConversionInput {
    time: string;
    from_timezone: string;
    to_timezone: string;
}
export interface TimezoneConversionOutput {
    converted_time: string;
    source: {
        time: string;
        timezone: string;
        offset: string;
        isDST: boolean;
    };
    target: {
        time: string;
        timezone: string;
        offset: string;
        isDST: boolean;
    };
}
export declare enum ConversionErrorType {
    INVALID_TIME_FORMAT = "INVALID_TIME_FORMAT",
    INVALID_TIMEZONE = "INVALID_TIMEZONE",
    INVALID_TIMEZONE_FORMAT = "INVALID_TIMEZONE_FORMAT",
    AMBIGUOUS_TIME = "AMBIGUOUS_TIME",
    SKIPPED_TIME = "SKIPPED_TIME",
    CONVERSION_FAILED = "CONVERSION_FAILED",
    SYSTEM_ERROR = "SYSTEM_ERROR"
}
export declare class ConversionError extends Error {
    type: ConversionErrorType;
    details?: Record<string, unknown> | undefined;
    constructor(type: ConversionErrorType, message: string, details?: Record<string, unknown> | undefined);
}
export declare function validateTimezone(timezone: string): boolean;
export declare function validateTimeFormat(time: string): boolean;
export declare function parseTime(time: string, timezone: string): DateTime;
