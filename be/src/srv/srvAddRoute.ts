/*
 * ReflectAI - AI Chat Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import { srvLogsExcludedEndpoints, srvRoutesWithoutBodyLogging } from './srv';

/**
 * Add a route to the Express server
 * @param method - HTTP method (GET or POST)
 * @param server - Express server instance
 * @param endpoint - API endpoint path
 * @param handler - Route handler function
 * @param enableFeVersionCheck - Whether to enable frontend version check for this endpoint
 * @param enableLogs - Whether to enable request logging for this endpoint
 * @param preHandler - Optional middleware to run before the main handler
 */
export function srvAddRoute(
    method: 'GET' | 'POST',
    server: Express,
    endpoint: string,
    handler: RequestHandler,
    enableFeVersionCheck = false,
    enableLogs = true,
    preHandler?: RequestHandler
): void {
    if (method === 'GET') {
        if (preHandler) {
            server.get(endpoint, preHandler, handler);
        } else {
            server.get(endpoint, handler);
        }
    } else {
        if (preHandler) {
            server.post(endpoint, preHandler, handler);
        } else {
            server.post(endpoint, handler);
        }
    }

    // Disable logs for this endpoint if specified
    if (!enableLogs && !srvLogsExcludedEndpoints.includes(endpoint)) {
        srvLogsExcludedEndpoints.push(endpoint);
    }
}
