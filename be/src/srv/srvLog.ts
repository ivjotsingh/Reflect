/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { FastifyRequest } from 'fastify';
import { log, LogLevel } from '../log/log';

export function srvGetRequestId(request: FastifyRequest): string {
    return request.requestId || 'no-request-id';
}

export function srvLogWarnWithRequestId(request: FastifyRequest, message: string,
    metadata?: { [key: string]: unknown }, debugParams?: { [key: string]: unknown }) {
    message = `${srvGetRequestId(request)}: ${message}`;
    log.log(LogLevel.Warn, message, true, metadata, debugParams);
}

export function srvLogInfoWithRequestId(request: FastifyRequest, message: string,
    metadata?: { [key: string]: unknown }, debugParams?: { [key: string]: unknown }) {
    message = `${srvGetRequestId(request)}: ${message}`;
    log.log(LogLevel.Info, message, false, metadata, debugParams);
}

export function srvLogErrorWithRequestId(request: FastifyRequest, message: string,
    metadata?: { [key: string]: unknown }, debugParams?: { [key: string]: unknown }) {
    message = `${srvGetRequestId(request)}: ${message}`;
    log.log(LogLevel.Error, message, true, metadata, debugParams);
}
