/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import os from 'os';
import { Request, Response } from 'express';
import { conf } from '../conf';
import { log } from '../log';
import { srvServer, srvAddRoute } from '../srv';

interface CheckHealthResponse {
    status: string;
    hostname: string;
    pid: number;
    uptime: string;
    version: string;
}

function secondsToHuman(seconds: number): string {
    const days = Math.floor(seconds / (3600 * 24));
    seconds %= 3600 * 24;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(' ');
}

async function checkHealthHandler(req: Request, res: Response): Promise<void> {
    const response: CheckHealthResponse = {
        status: 'success',
        hostname: os.hostname(),
        pid: process.pid,
        uptime: secondsToHuman(process.uptime()),
        version: conf.env.version,
    };
    res.json(response);
}

interface CheckResourceUsageResponse {
    status: string;
    hostname: string;
    pid: number;
    memoryUsage: NodeJS.MemoryUsage;
    resourceUsage: NodeJS.ResourceUsage;
    version: string;
}

async function checkResourceUsageHandler(req: Request, res: Response): Promise<void> {
    const response: CheckResourceUsageResponse = {
        status: 'success',
        hostname: os.hostname(),
        pid: process.pid,
        memoryUsage: process.memoryUsage(),
        resourceUsage: process.resourceUsage(),
        version: conf.env.version,
    };
    res.json(response);
}

export function checkRoutesInit(path: string): void {
    srvAddRoute('GET', srvServer, `${path}/health`, checkHealthHandler);
    srvAddRoute('GET', srvServer, `${path}/resourceUsage`, checkResourceUsageHandler);
}

export function checkInit(): void {
    log.info('Health check module initialized');
}
