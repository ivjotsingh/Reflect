/*
 * ReflectAI - AI Chat Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { FastifyInstance, FastifyRequest, FastifyReply, RouteHandlerMethod } from 'fastify';
import { srvLogsExcludedEndpoints, srvRoutesWithoutBodyLogging } from './srv';

/**
 * Add a route to the Fastify server
 * @param method - HTTP method (GET or POST)
 * @param server - Fastify server instance
 * @param endpoint - API endpoint path
 * @param handler - Route handler function
 * @param enableLogs - Whether to enable request logging for this endpoint
 * @param preHandler - Optional middleware to run before the main handler
 */
export function srvAddRoute(
    method: 'GET' | 'POST',
    server: FastifyInstance,
    endpoint: string,
    handler: RouteHandlerMethod,
    enableLogs = true,
    preHandler?: RouteHandlerMethod
): void {
    const routeOptions: any = {
        handler: handler,
    };

    if (preHandler) {
        routeOptions.preHandler = preHandler;
    }

    if (method === 'GET') {
        server.get(endpoint, routeOptions);
    } else {
        server.post(endpoint, routeOptions);
    }

    // Add to excluded logs list if logs are disabled
    if (!enableLogs && !srvLogsExcludedEndpoints.includes(endpoint)) {
        srvLogsExcludedEndpoints.push(endpoint);
    }
}
