/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { log } from '../log';

function confThrow(msg: string): never {
    throw new Error(msg);
}

class ConfEnv {
    public credentials = {
        firebase: process.env.REFLECT_FIREBASE_CREDENTIALS || confThrow('REFLECT_FIREBASE_CREDENTIALS not set'),
        openAIAPIKey: process.env.REFLECT_OPENAI_API_KEY || 'sk-xxxxxx',
    };
    public enableConsoleLogs = process.env.REFLECT_ENABLE_CONSOLE_LOGS !== 'false';
    public enableDebugLogs = process.env.REFLECT_ENABLE_DEBUG_LOGS === 'true';
    public environment = process.env.REFLECT_ENVIRONMENT || 'development';
    public host = '';   // initialized later
    public port = process.env.REFLECT_PORT || 8080;
    public url = '';    // initialized later
    public version = process.env.REFLECT_VERSION || '0.0.0.1';

    async init() {
        this.host = process.env.REFLECT_HOST || await this.getLocalIp() || 'localhost';
        this.url = `http://${this.host}:${this.port}`;
        return;
    }

    async getLocalIp() {
        try {
            return '127.0.0.1';
        }
        catch (err) {
            return undefined;
        }
    }
}

export type Conf = { env: ConfEnv };

export const conf: Conf = {
    env: new ConfEnv()
};

export async function confInit() {
    await conf.env.init();

    Object.entries(conf.env).forEach(([key, value]) => {
        const sensitiveKeys = ['credentials'];
        if (sensitiveKeys.includes(key))
            value = 'xxxxxxx';
        log.info(`conf.env.${key} = ${value}`);
    });

    log.info('Configuration initialized');
}
