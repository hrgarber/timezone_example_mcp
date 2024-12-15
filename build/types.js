import { DateTime } from 'luxon';
// Error types for better error handling
export var ConversionErrorType;
(function (ConversionErrorType) {
    ConversionErrorType["INVALID_TIME_FORMAT"] = "INVALID_TIME_FORMAT";
    ConversionErrorType["INVALID_TIMEZONE"] = "INVALID_TIMEZONE";
    ConversionErrorType["INVALID_TIMEZONE_FORMAT"] = "INVALID_TIMEZONE_FORMAT";
    ConversionErrorType["AMBIGUOUS_TIME"] = "AMBIGUOUS_TIME";
    ConversionErrorType["SKIPPED_TIME"] = "SKIPPED_TIME";
    ConversionErrorType["CONVERSION_FAILED"] = "CONVERSION_FAILED";
    ConversionErrorType["SYSTEM_ERROR"] = "SYSTEM_ERROR";
})(ConversionErrorType || (ConversionErrorType = {}));
export class ConversionError extends Error {
    constructor(type, message, details) {
        super(message);
        this.type = type;
        this.details = details;
        this.name = 'ConversionError';
    }
}
// Timezone validation helper
export function validateTimezone(timezone) {
    return DateTime.local().setZone(timezone).isValid;
}
// Time format validation helper
export function validateTimeFormat(time) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
}
// Convert time string to DateTime
export function parseTime(time, timezone) {
    const [hours, minutes] = time.split(':').map(Number);
    return DateTime.local().setZone(timezone).set({
        hour: hours,
        minute: minutes,
        second: 0,
        millisecond: 0
    });
}
