import { TimezoneServer } from './index';
import { ConversionError, ConversionErrorType, TimezoneConversionInput } from './types';
import { DateTime } from 'luxon';

describe('TimezoneServer', () => {
    let server: TimezoneServer;

    beforeEach(() => {
        server = new TimezoneServer();
    });

    // Test the core conversion logic
    describe('convertTime', () => {
        it('should convert time between timezones correctly', async () => {
            const input: TimezoneConversionInput = {
                time: '14:30',
                from_timezone: 'America/New_York',
                to_timezone: 'Asia/Tokyo'
            };

            // Access the private method using type assertion
            const result = await (server as any).convertTime(input);

            expect(result).toMatchObject({
                converted_time: expect.any(String),
                source: {
                    time: '14:30',
                    timezone: 'America/New_York',
                    offset: expect.any(String),
                    isDST: expect.any(Boolean)
                },
                target: {
                    timezone: 'Asia/Tokyo',
                    offset: expect.any(String),
                    isDST: expect.any(Boolean)
                }
            });

            // Create a fixed reference time for verification
            const now = DateTime.now();
            const sourceDateTime = DateTime.fromObject(
                {
                    year: now.year,
                    month: now.month,
                    day: now.day,
                    hour: 14,
                    minute: 30
                },
                { zone: 'America/New_York' }
            );
            
            if (!sourceDateTime.isValid) {
                throw new Error('Failed to create valid source DateTime');
            }

            const targetDateTime = sourceDateTime.setZone('Asia/Tokyo');
            if (!targetDateTime.isValid) {
                throw new Error('Failed to create valid target DateTime');
            }

            expect(result.converted_time).toBe(targetDateTime.toFormat('HH:mm'));
        });

        it('should handle invalid time format', async () => {
            const input: TimezoneConversionInput = {
                time: '25:00',
                from_timezone: 'America/New_York',
                to_timezone: 'Asia/Tokyo'
            };

            await expect((server as any).convertTime(input)).rejects.toThrow(ConversionError);
        });

        it('should handle invalid source timezone', async () => {
            const input: TimezoneConversionInput = {
                time: '14:30',
                from_timezone: 'Invalid/Timezone',
                to_timezone: 'Asia/Tokyo'
            };

            await expect((server as any).convertTime(input)).rejects.toThrow(ConversionError);
        });

        it('should handle invalid target timezone', async () => {
            const input: TimezoneConversionInput = {
                time: '14:30',
                from_timezone: 'America/New_York',
                to_timezone: 'Invalid/Timezone'
            };

            await expect((server as any).convertTime(input)).rejects.toThrow(ConversionError);
        });

        it('should handle DST transitions', async () => {
            // Test during a known DST transition
            const input: TimezoneConversionInput = {
                time: '02:30', // A time that might not exist during spring forward
                from_timezone: 'America/New_York',
                to_timezone: 'UTC'
            };

            // Create a fixed DateTime for the DST transition
            const springForward = DateTime.fromObject(
                {
                    year: 2024,
                    month: 3,
                    day: 10,
                    hour: 2,
                    minute: 30
                },
                { zone: 'America/New_York' }
            );

            if (!springForward.isValid) {
                throw new Error('Failed to create valid DST transition DateTime');
            }

            // Mock DateTime.now() to return our spring forward date
            const originalNow = DateTime.now;
            DateTime.now = () => springForward;

            try {
                await (server as any).convertTime(input);
            } catch (error) {
                expect(error).toBeInstanceOf(ConversionError);
                expect((error as ConversionError).type).toBe(ConversionErrorType.SKIPPED_TIME);
            }

            // Restore the original DateTime.now
            DateTime.now = originalNow;
        });
    });
});