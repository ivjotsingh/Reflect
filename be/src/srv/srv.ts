/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { conf } from '../conf';
import { log } from '../log/log';
import { srvLogInfoWithRequestId } from './srvLog';

export type AuthUser = {
    authUserId: string;
    email?: string;
    avatarUrl?: string;
    emailVerified?: boolean;
}

declare module 'fastify' {
    export interface FastifyRequest {
        authUser?: AuthUser;
        requestId?: string;
    }
    export interface FastifyReply {
        ngResponse: unknown;
        ngError: boolean;
    }
}

export const srvServer: FastifyInstance = fastify({ 
    logger: false, 
    keepAliveTimeout: 60000, 
    bodyLimit: 10 * 1024 * 1024 // 10MB
});
let server: any;

export const srvLogsExcludedEndpoints: string[] = [
    '/reflect/api/healthCheck'
];

export const srvRoutesWithoutBodyLogging: string[] = [
    '/reflect/api/user/login',
    '/reflect/api/user/register'
];

export interface SrvClientInfo {
    clientIp: string;
    userAgent: string;
    referrer: string;
}

function srvLogsEnabled(requestUrl: string): boolean {
    for (let i = 0; i < srvLogsExcludedEndpoints.length; i++) {
        if (requestUrl.includes(srvLogsExcludedEndpoints[i])) {
            return false;
        }
    }
    return true;
}

export function srvGetClientInfo(request: FastifyRequest): SrvClientInfo {
    const clientInfo: SrvClientInfo = {
        clientIp: request.ip || 'NA',
        userAgent: request.headers['user-agent'] as string || 'NA',
        referrer: request.headers['referer'] as string || 'NA'
    };

    return clientInfo;
}

export async function srvInit() {
    // Enable CORS
    await srvServer.register(cors, {
        origin: ['https://cdn-bgp.bluestacks.com', 'http://localhost:3000',
            'http://local.testngg.net', 'https://local.testngg.net', 'http://nitin.testngg.net:8000',
            'https://local.now.gg', 'https://wsup.ai', 'https://ifp-demo.abctest.in', 'https://reflectai.com'],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization']
    });

    // Hook to set initial state for each request
    srvServer.addHook('onRequest', async function srvOnRequestHook(request, reply) {
        reply.ngError = false;
    });

    // Set error handler
    srvServer.setErrorHandler(async function (error, request, reply) {
        reply.ngError = true;
        log.error('Error in handling request', { 
            error: error.message,
            stack: error.stack, 
            url: request.url,
            method: request.method
        });
        
        // Handle different error types
        if (error.statusCode === 401) {
            return await reply.status(401).send({ 
                status: 'error', 
                message: 'Unauthorized' 
            });
        } else if (error.statusCode === 400) {
            return await reply.status(400).send({ 
                status: 'error', 
                message: error.message || 'Bad request' 
            });
        } else {
            return await reply.status(500).send({ 
                status: 'error', 
                message: 'Internal server error' 
            });
        }
    });

    // Logging for incoming requests
    srvServer.addHook('preHandler', (request, reply, done) => {
        const logData = { method: request.method, url: request.url, body: request.body };
        if (srvLogsEnabled(request.url)) {
            if (srvRoutesWithoutBodyLogging.includes(request.url)) {
                logData.body = '[REDACTED]';
            }
            srvLogInfoWithRequestId(request,
                `Incoming request, method: ${logData.method}, url: ${logData.url}`, { body: logData.body });
        }
        done();
    });

    // Capture response for logging
    srvServer.addHook('onSend', (request, reply, payload, done) => {
        reply.ngResponse = payload;
        if (srvLogsEnabled(request.url)) {
            if (srvRoutesWithoutBodyLogging.includes(request.url)) {
                reply.ngResponse = '[REDACTED]';
            }
            srvLogInfoWithRequestId(request, 'onSend',
                {
                    requestUrl: request.url,
                    statusCode: reply.statusCode
                }
            );
        }
        done();
    });

    // Log response completion time
    srvServer.addHook('onResponse', async (request, reply) => {
        if (srvLogsEnabled(request.url)) {
            srvLogInfoWithRequestId(request, `Response completed in ${reply.getResponseTime()} ms`);
        }
    });

    log.info('srv initialized');
}

export async function srvListen() {
    try {
        const port = Number(conf.env.port) || 3000;
        const host = conf.env.host || '0.0.0.0';
        
        server = await srvServer.listen({ port, host });
        log.info(`Server is running on ${host}:${port}`);
    } catch (error) {
        log.error('Error starting server', { error });
        process.exit(1);
    }
}

export async function srvFini() {
    if (server) {
        await srvServer.close();
        log.info('Server closed');
    }
}

export function srvGetRequestInfoForLogging(request: FastifyRequest, logRequestId: boolean = false) {
    const requestInfo: any = {
        url: request.url,
        method: request.method,
        headers: request.headers,
        query: request.query,
        params: request.params,
        ip: request.ip
    };
    
    if (logRequestId && request.requestId) {
        requestInfo.requestId = request.requestId;
    }
    
    return requestInfo;
}
