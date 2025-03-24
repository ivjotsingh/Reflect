/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { reflectFini, reflectInit } from './reflectInit';
import 'source-map-support/register';
import { log } from './log';

async function reflectMain() {
    process.on('uncaughtException', (err, origin) => {
        log.error('uncaughtException', { err, origin });
    });

    process.on('unhandledRejection', (reason, promise) => {
        log.error('unhandledRejection: promise', { promise, reason });
    });

    try {
        await reflectInit();
    }
    catch (err) {
        log.error('reflectInit failed.', { err });
        process.exit(1);
    }

    // When the cloud provider takes the server instance offline
    // SIGTERM is received followed by SIGKILL after some time.
    process.on('SIGTERM', () => {
        log.info('SIGTERM received');
        void reflectFini();
    });

    // When ^C is pressed on developer machine SIGINT is received.
    process.on('SIGINT', () => {
        log.info('SIGINT received');
        void reflectFini();
    });
}

void reflectMain();
