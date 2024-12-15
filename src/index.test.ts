import { TimezoneServer } from './index';
import { ConversionError, ConversionErrorType } from './types';
import http from 'http';

interface TestResponse {
    statusCode: number;
    body: any;
}

const TEST_PORT = 3001;

describe('TimezoneServer', () => {
    let server: TimezoneServer;

    beforeAll(async () => {
        jest.setTimeout(10000); // Increase timeout for all tests
        server = new TimezoneServer(TEST_PORT);
        try {
            await server.start();
            // Give the server a moment to fully initialize
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error('Failed to start server:', error);
            throw error;
        }
    });

    afterAll(async () => {
        if (server) {
            try {
                await server.stop();
                // Give the server a moment to fully close
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error('Failed to stop server:', error);
                throw error;
            }
        }
    });

    const makeRequest = (data: any): Promise<TestResponse> => {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: TEST_PORT,
                path: '/convert',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const req = http.request(options, (res: http.IncomingMessage) => {
                let body = '';
                res.on('data', (chunk: Buffer) => {
                    body += chunk.toString();
                });
                res.on('end', () => {
                    try {
                        resolve({
                            statusCode: res.statusCode ?? 500,
                            body: JSON.parse(body)
                        });
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error}`));
                    }
                });
            });

            req.on('error', (error: Error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });

            req.write(JSON.stringify(data));
            req.end();
        });
    };

    it('should convert time between timezones correctly', async () => {
        const response = await makeRequest({
            time: '14:30',
            from_timezone: 'America/New_York',
            to_timezone: 'Asia/Tokyo',
        });

        expect(response.statusCode).toBe(200);
        expect(response.body).toMatchObject({
            converted_time: expect.any(String),
            source: {
                time: '14:30',
                timezone: 'America/New_York',
                offset: expect.any(String),
                isDST: expect.any(Boolean),
            },
            target: {
                timezone: 'Asia/Tokyo',
                offset: expect.any(String),
                isDST: expect.any(Boolean),
            },
        });
    });

    it('should handle invalid time format', async () => {
        const response = await makeRequest({
            time: '25:00',
            from_timezone: 'America/New_York',
            to_timezone: 'Asia/Tokyo',
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toMatchObject({
            error: expect.stringContaining('Invalid time format'),
            type: ConversionErrorType.INVALID_TIME_FORMAT,
        });
    });

    it('should handle invalid timezone', async () => {
        const response = await makeRequest({
            time: '14:30',
            from_timezone: 'Invalid/Timezone',
            to_timezone: 'Asia/Tokyo',
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toMatchObject({
            error: expect.stringContaining('Invalid source timezone'),
            type: ConversionErrorType.INVALID_TIMEZONE,
        });
    });

    it('should handle missing required fields', async () => {
        const response = await makeRequest({
            time: '14:30',
            // Missing timezones
        });

        expect(response.statusCode).toBe(400);
        expect(response.body.error).toContain('Missing required fields');
    });

    it('should handle invalid JSON payload', async () => {
        const options = {
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/convert',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };
    
        return new Promise<void>((resolve, reject) => {
            const req = http.request(options, (res: http.IncomingMessage) => {
                let body = '';
                res.on('data', (chunk: Buffer) => {
                    body += chunk.toString();
                });
                
                res.on('end', () => {
                    try {
                        expect(res.statusCode).toBe(400);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            });
    
            req.on('error', (error) => {
                console.error('Request error:', error);
                reject(error);
            });
    
            // Set a timeout for the request
            req.setTimeout(3000, () => {
                req.destroy();
                reject(new Error('Request timed out'));
            });
    
            req.write('invalid json');
            req.end();
        });
    }, 10000); // Increase test timeout to 10 seconds
});