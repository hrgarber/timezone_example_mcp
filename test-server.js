#!/usr/bin/env node
import http from 'http';
import { DateTime } from 'luxon';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_PORT = 3001;

// Helper function to make HTTP requests to the server
const makeRequest = (data) => {
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

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk.toString();
            });
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    resolve({ statusCode: res.statusCode, body: result });
                } catch (error) {
                    reject(new Error(`Failed to parse response: ${error}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Request failed: ${error.message}`));
        });

        req.write(JSON.stringify(data));
        req.end();
    });
};

// Test cases
const testCases = [
    {
        name: "Standard timezone conversion (NY to Tokyo)",
        data: {
            time: "14:30",
            from_timezone: "America/New_York",
            to_timezone: "Asia/Tokyo"
        },
        validate: (response) => {
            const { statusCode, body } = response;
            if (statusCode !== 200) return false;
            
            // Verify response structure
            if (!body.converted_time || !body.source || !body.target) return false;
            
            // Verify timezone offsets
            const sourceOffset = DateTime.now().setZone('America/New_York').toFormat('ZZ');
            const targetOffset = DateTime.now().setZone('Asia/Tokyo').toFormat('ZZ');
            
            return body.source.offset === sourceOffset && 
                   body.target.offset === targetOffset;
        }
    },
    {
        name: "DST transition handling (London to NY during BST)",
        data: {
            time: "01:30",
            from_timezone: "Europe/London",
            to_timezone: "America/New_York"
        },
        validate: (response) => {
            const { statusCode, body } = response;
            return statusCode === 200 && body.source.isDST !== undefined;
        }
    },
    {
        name: "Invalid time format",
        data: {
            time: "25:00",
            from_timezone: "America/New_York",
            to_timezone: "Asia/Tokyo"
        },
        validate: (response) => {
            const { statusCode, body } = response;
            return statusCode === 400 && 
                   body.type === "INVALID_TIME_FORMAT" &&
                   body.error.includes("Invalid time format");
        }
    },
    {
        name: "Invalid source timezone",
        data: {
            time: "14:30",
            from_timezone: "Invalid/Timezone",
            to_timezone: "Asia/Tokyo"
        },
        validate: (response) => {
            const { statusCode, body } = response;
            return statusCode === 400 && 
                   body.type === "INVALID_TIMEZONE" &&
                   body.error.includes("Invalid source timezone");
        }
    },
    {
        name: "Missing required fields",
        data: {
            time: "14:30"
            // Missing timezones
        },
        validate: (response) => {
            const { statusCode, body } = response;
            return statusCode === 400 && 
                   body.error.includes("Missing required fields");
        }
    },
    {
        name: "Same timezone conversion",
        data: {
            time: "14:30",
            from_timezone: "America/New_York",
            to_timezone: "America/New_York"
        },
        validate: (response) => {
            const { statusCode, body } = response;
            return statusCode === 200 && 
                   body.converted_time === "14:30" &&
                   body.source.offset === body.target.offset;
        }
    },
    {
        name: "UTC conversion",
        data: {
            time: "12:00",
            from_timezone: "UTC",
            to_timezone: "America/New_York"
        },
        validate: (response) => {
            const { statusCode, body } = response;
            return statusCode === 200 && 
                   body.source.offset === "+00:00";
        }
    }
];

// Run tests
console.log('Running Timezone Server Tests\n');

const runTests = async () => {
    let passed = 0;
    let failed = 0;
    
    for (const test of testCases) {
        process.stdout.write(`Testing: ${test.name}... `);
        
        try {
            const response = await makeRequest(test.data);
            const success = test.validate(response);
            
            if (success) {
                console.log('\x1b[32m%s\x1b[0m', 'PASSED');
                passed++;
            } else {
                console.log('\x1b[31m%s\x1b[0m', 'FAILED');
                console.log('Response:', JSON.stringify(response.body, null, 2));
                failed++;
            }
        } catch (error) {
            console.log('\x1b[31m%s\x1b[0m', 'ERROR');
            console.error('Error:', error.message);
            failed++;
        }
        
        console.log('-'.repeat(50));
    }
    
    // Print summary
    console.log('\nTest Summary:');
    console.log(`Total Tests: ${testCases.length}`);
    console.log(`Passed: \x1b[32m${passed}\x1b[0m`);
    console.log(`Failed: \x1b[31m${failed}\x1b[0m`);
    
    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
};

runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});