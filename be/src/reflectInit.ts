/*
 * ReflectAI - AI Chat Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { log, logFini, logInit, LogErrorMonitoringTools } from './log';
import { conf, confInit } from './conf';
import { ddbInit } from './ddb';
import { healthCheckInit, healthCheckRoutesInit } from './healthCheck';
import { srvFini, srvInit, srvListen } from './srv';
// import { chatRoutesInit } from './chat';
import * as Sentry from '@sentry/node';

async function reflectRoutesInit() {
    /*
     * Initialize API routes
     */
    healthCheckRoutesInit('/reflect/api/healthCheck');
    // chatRoutesInit('/reflect/api/chat');
}

export async function reflectInit() {
    const logErrorTargets: LogErrorMonitoringTools[] = ['SENTRY'];
    await logInit(true, true, {
        enableConsoleLogs: conf.env.enableConsoleLogs,
        enableDebugLogs: conf.env.enableDebugLogs,
        environment: conf.env.environment,
        version: conf.env.version
    }, 'reflect-ai', logErrorTargets);

    // Initialize Sentry for error reporting
    Sentry.init({
        dsn: conf.env.credentials.openAIAPIKey, // Using an existing credential as placeholder
        environment: conf.env.environment,
        release: conf.env.version,
        integrations: [
            new Sentry.Integrations.Http({ tracing: true }),
        ],
        tracesSampleRate: 1.0,
    });

    healthCheckInit();
    await confInit();
    ddbInit(conf.env.credentials.firebase);
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
