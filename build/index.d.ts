#!/usr/bin/env node
declare class TimezoneServer {
    private server;
    private port;
    constructor(port?: number);
    private handleRequest;
    private sendResponse;
    private sendError;
    private parseRequestBody;
    private convertTime;
    start(): Promise<void>;
    stop(): Promise<void>;
}
export { TimezoneServer };
