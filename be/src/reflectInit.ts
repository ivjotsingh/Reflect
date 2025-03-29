/*
 * ReflectAI - AI Chat Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { log, logFini, logInit, LogErrorMonitoringTools } from './log/log';
import { conf, confInit } from './conf';
import { dbInit } from './db';
import { healthCheckInit, healthCheckRoutesInit } from './healthCheck';
import { srvFini, srvInit, srvListen, srvServer } from './srv';
import { chatInit, chatRoutesInit } from './chat';
import { llmInit } from './llm';
import { simulatorRouter, simulatorInit } from './simulator';
import { moodTrackerRoutesInit } from './moodTracker';
import { callInit, callRoutesInit } from './call';

async function reflectRoutesInit() {
    /*
     * Initialize API routes
     */
    healthCheckRoutesInit('/reflect/api/healthCheck');
    chatRoutesInit('/reflect/api/chat');
    moodTrackerRoutesInit('/reflect/api/mood');
    callRoutesInit('/reflect/api/call', srvServer);

    // Initialize the simulator routes
    srvServer.register(simulatorRouter, { prefix: '/reflect/api' });
}

export async function reflectInit() {
    const logErrorTargets: LogErrorMonitoringTools[] = ['SENTRY'];
    await logInit(true, true, {
        enableConsoleLogs: conf.env.enableConsoleLogs,
        enableDebugLogs: conf.env.enableDebugLogs,
        environment: conf.env.environment,
        version: conf.env.version
    }, 'reflect-ai', logErrorTargets);

    healthCheckInit();
    await confInit();
    dbInit(conf.env.credentials.firebase);
    await llmInit();
    chatInit();
    callInit(); // Initialize call module
    simulatorInit(); // Initialize simulator module
    await srvInit();

    await reflectRoutesInit();
    await srvListen();

    log.info('ReflectAI Service started');
}

export async function reflectFini() {
    log.info('ReflectAI Service shutting down');
    await srvFini();
    await logFini();
    process.exit(0);
}
