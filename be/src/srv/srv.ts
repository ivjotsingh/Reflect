/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { conf } from '../conf';
import { log } from '../log';
import { srvLogInfoWithRequestId } from './srvLog';

export type AuthUser = {
    authUserId: string;
    email?: string;
    avatarUrl?: string;
    emailVerified?: boolean;
}

// Extend Express Request interface to include authUser
declare global {
    namespace Express {
        interface Request {
            authUser?: AuthUser;
            requestId?: string;
        }
    }
}

export const srvServer: Express = express();
let server: any;

export const srvLogsExcludedEndpoints: string[] = [
    '/reflect/api/check/health'
];

export const srvRoutesWithoutBodyLogging: string[] = [
    '/reflect/api/user/login',
    '/reflect/api/user/register'
];

function srvLogsEnabled(requestUrl: string): boolean {
    for (let i = 0; i < srvLogsExcludedEndpoints.length; i++) {
        if (requestUrl.includes(srvLogsExcludedEndpoints[i])) {
            return false;
        }
    }
    return true;
}

export interface SrvClientInfo {
    clientIp: string;
    userAgent: string;
    referrer: string;
}

export function srvGetClientInfo(request: Request): SrvClientInfo {
    const clientInfo: SrvClientInfo = {
        clientIp: request.ip || 'NA',
        userAgent: request.headers['user-agent'] || 'NA',
        referrer: request.headers['referer'] || 'NA'
    };

    return clientInfo;
}

export async function srvInit() {
    // Enable CORS
    srvServer.use(cors({
        origin: ['http://localhost:3000', 'https://reflectai.com'],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Parse JSON bodies
    srvServer.use(express.json({ limit: '10mb' }));
    
    // Parse URL-encoded bodies
    srvServer.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware
    srvServer.use((req: Request, res: Response, next: NextFunction) => {
        // Generate a unique request ID
        req.requestId = Date.now().toString() + Math.random().toString(36).substring(2, 15);
        
        // Log incoming requests
        if (srvLogsEnabled(req.url)) {
            const logData = { 
                method: req.method, 
                url: req.url, 
                body: srvRoutesWithoutBodyLogging.includes(req.url) ? '[REDACTED]' : req.body 
            };
            
            srvLogInfoWithRequestId(req, 
                `Incoming request, method: ${logData.method}, url: ${logData.url}`, 
                { body: logData.body });
        }
        
        next();
    });

    // Error handling middleware
    srvServer.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        log.error('Error in handling request', { 
            error: err, 
            request: srvGetRequestInfoForLogging(req, true) 
        });
        
        if (err.name === 'UnauthorizedError') {
            return res.status(401).json({ 
                status: 'error', 
                message: 'Unauthorized' 
            });
        }
        
        if (err.name === 'BadRequestError') {
            return res.status(400).json({ 
                status: 'error', 
                message: err.message 
            });
        }
        
        return res.status(500).json({ 
            status: 'error', 
            message: 'Internal Server Error' 
        });
    });

    log.info('Server initialized');
}

export async function srvListen() {
    const port = conf.env.port;
    server = srvServer.listen(port, () => {
        log.info(`Server listening on port ${port}`);
    });
    return server;
}

export async function srvFini() {
    if (server) {
        server.close();
        log.info('Server closed');
    }
}

export function srvGetRequestInfoForLogging(request: Request, logRequestId: boolean = false) {
    const info: any = {
        method: request.method,
        url: request.url,
        ip: request.ip,
        headers: {
            'user-agent': request.headers['user-agent'],
            'referer': request.headers['referer']
        }
    };
    
    if (logRequestId && request.requestId) {
        info.requestId = request.requestId;
    }
    
    return info;
}
