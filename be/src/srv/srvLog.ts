/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { Request } from 'express';
import { log, LogLevel } from '../log';

export function srvGetRequestId(request: Request): string {
    return request.requestId || 'no-request-id';
}

export function srvLogWarnWithRequestId(request: Request, message: string,
    metadata?: { [key: string]: unknown }, debugParams?: { [key: string]: unknown }) {
    message = `${srvGetRequestId(request)}: ${message}`;
    log.log(LogLevel.Warn, message, true, metadata, debugParams);
}

export function srvLogInfoWithRequestId(request: Request, message: string,
    metadata?: { [key: string]: unknown }, debugParams?: { [key: string]: unknown }) {
    message = `${srvGetRequestId(request)}: ${message}`;
    log.log(LogLevel.Info, message, false, metadata, debugParams);
}

export function srvLogErrorWithRequestId(request: Request, message: string,
    metadata?: { [key: string]: unknown }, debugParams?: { [key: string]: unknown }) {
    message = `${srvGetRequestId(request)}: ${message}`;
    log.log(LogLevel.Error, message, true, metadata, debugParams);
}
