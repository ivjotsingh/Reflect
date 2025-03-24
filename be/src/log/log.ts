/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import * as Sentry from '@sentry/node';

export enum LogLevel {
    Debug,
    Info,
    Warn,
    Error
}

export type LogErrorMonitoringTools = 'SENTRY';

type LogEnvironmentConf = {
    environment: string;
    enableDebugLogs: boolean;
    version: string;
    enableConsoleLogs: boolean;
}

function logParseFunctionFromStackTrace(stackTrace: string): string {
    try {
        if (stackTrace) {
            const regex = /at ([^(]+) \(([^:]+):(\d+):(\d+)\)/;
            const lines = stackTrace.split('\n');
            const matches = lines.map((line) => line.match(regex)).filter(Boolean);
            const functionName = matches[0]?.[1];
            if (functionName) return functionName.replace(/\s*\[.*?\]\s*/g, '').replace('Object.', '');
            else return '';
        }
        else {
            return '';
        }
    }
    catch {
        // using info so that we don't run in recursion ever
        console.info('Exception while parsing function name from stackTrace', { trace: stackTrace });
        return '';
    }
}

class LogLogger {
    private logLevel: LogLevel;
    private enableConsoleLogs: boolean;
    private version: string;

    constructor(
        public logToErrorMonitoringTools: boolean, 
        public logErrorTargets: LogErrorMonitoringTools[],
        environmentConf: LogEnvironmentConf, 
        logGroup: string
    ) {
        if (environmentConf.enableDebugLogs) {
            this.logLevel = LogLevel.Debug;
        }
        else {
            this.logLevel = LogLevel.Info;
        }
        this.enableConsoleLogs = environmentConf.enableConsoleLogs;
        this.version = environmentConf.version;
    }

    static extractMessage(err: Error) {
        return err.message;
    }

    static getSeverityFromLogLevel(logLevel: LogLevel) {
        switch (logLevel) {
            case LogLevel.Debug: {
                return 'info';
            }
            case LogLevel.Info: {
                return 'info';
            }
            case LogLevel.Warn: {
                return 'warning';
            }
            case LogLevel.Error: {
                return 'error';
            }
        }
    }

    log(
        level: LogLevel, 
        message: string, 
        logToErrorMonitoringTools: boolean,
        metadata?: { [key: string]: unknown }, 
        debugParams?: { [key: string]: unknown },
        customError?: Error, 
        framesToSkip?: number
    ) {
        if (level < this.logLevel) return;

        const enableDebugParameters = Reflect.get(log, 'enableDebugParameters') as boolean || false;
        if (enableDebugParameters && typeof debugParams !== 'undefined') {
            message = `${message}, debugParams:${JSON.stringify(debugParams)}`;
        }

        const severity = LogLogger.getSeverityFromLogLevel(level);
        const ts = new Date();
        const tsMsg = `[${ts.toISOString()}]: `;
        let errorReportMessage = message;
        message = `${LogLevel[level]}: ${message}`;
        
        if (typeof metadata !== 'undefined') {
            Object.entries(metadata).forEach(([key, value]) => {
                if (value instanceof Error) {
                    errorReportMessage = `${errorReportMessage}: ${LogLogger.extractMessage(value)}`;
                    message = `${message} ${value.stack}`;
                }
                else message = `${message} { ${key}:${JSON.stringify(value)} }`;
            });
        }

        if (this.enableConsoleLogs) process.stdout.write(`${tsMsg}${message}\n`);

        if (this.logToErrorMonitoringTools && logToErrorMonitoringTools && level === LogLevel.Error) {
            if (customError) {
                Sentry.captureException(customError);
            } else {
                Sentry.captureMessage(errorReportMessage, {
                    level: severity as Sentry.SeverityLevel,
                    extra: metadata
                });
            }
        }
    }

    debug(message: string, metadata?: { [key: string]: unknown }, debugParams?: { [key: string]: unknown }) {
        this.log(LogLevel.Debug, message, false, metadata, debugParams);
    }

    info(message: string, metadata?: { [key: string]: unknown }, debugParams?: { [key: string]: unknown }) {
        this.log(LogLevel.Info, message, false, metadata, debugParams);
    }

    warn(message: string, metadata?: { [key: string]: unknown }, debugParams?: { [key: string]: unknown }) {
        this.log(LogLevel.Warn, message, true, metadata, debugParams);
    }

    error(message: string, metadata?: { [key: string]: unknown }, debugParams?: { [key: string]: unknown }, customError?: Error) {
        this.log(LogLevel.Error, message, true, metadata, debugParams, customError);
    }
}

export let log: LogLogger; // common for all modules

class LogModuleLogger {
    private moduleName: string;
    public static mLog: LogLogger;

    constructor(moduleName: string) {
        this.moduleName = moduleName;
    }

    debug(message: string, metadata?: { [key: string]: unknown }, debugParams?: { [key: string]: unknown }) {
        LogModuleLogger.mLog.log(LogLevel.Debug, `[${this.moduleName}] ${message}`, false, metadata, debugParams);
    }

    info(message: string, metadata?: { [key: string]: unknown }, debugParams?: { [key: string]: unknown }) {
        LogModuleLogger.mLog.log(LogLevel.Info, `[${this.moduleName}] ${message}`, false, metadata, debugParams);
    }

    warn(message: string, metadata?: { [key: string]: unknown }, debugParams?: { [key: string]: unknown }) {
        LogModuleLogger.mLog.log(LogLevel.Warn, `[${this.moduleName}] ${message}`, true, metadata, debugParams);
    }

    error(message: string, metadata?: { [key: string]: unknown }, debugParams?: { [key: string]: unknown }, customError?: Error) {
        LogModuleLogger.mLog.log(LogLevel.Error, `[${this.moduleName}] ${message}`, true, metadata, debugParams, customError);
    }

    log(level: LogLevel, message: string, logToErrorMonitoringTools: boolean,
        metadata?: { [key: string]: unknown }, debugParams?: { [key: string]: unknown },
        customError?: Error,
    ) {
        LogModuleLogger.mLog.log(level, `[${this.moduleName}] ${message}`, logToErrorMonitoringTools, metadata, debugParams, customError);
    }
}

export async function logInit(
    logToErrorMonitoringTools: boolean,
    logToCloudWatch: boolean,
    environmentConf: LogEnvironmentConf, 
    logGroup: string, 
    logErrorTargets?: LogErrorMonitoringTools[]
) {
    log = new LogLogger(logToErrorMonitoringTools, logErrorTargets || ['SENTRY'], environmentConf, logGroup);
    LogModuleLogger.mLog = log;
    return log;
}

export function logFini() {
    // Clean up any resources if needed
}

export function logInitModuleLogger(moduleName: string) {
    return new LogModuleLogger(moduleName);
}
