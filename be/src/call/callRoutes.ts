/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { srvAddRoute } from '../srv';
import { log } from '../log/log';
import { CallSession, CallTranscript } from './callModels';
import { db } from '../db/db';
import { dbGetAll } from '../db/dbHelpers';
import { callWebsocketInit } from './callWebsocket';

/**
 * Handle request to get a user's call history
 */
async function callGetHistoryHandler(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    try {
        const { userId } = request.params as { userId: string };

        if (!userId) {
            return reply.status(400).send({
                status: 'error',
                message: 'User Name is required'
            });
        }

        // Query calls for this user
        const callSessions = await dbGetAll(
            CallSession,
            db.collection(CallSession._collection()).where('userId', '==', userId)
        );

        // Convert to response format
        const calls = callSessions.map((session: CallSession) => session.toResponse());

        return reply.status(200).send({
            status: 'success',
            calls
        });
    } catch (error) {
        log.error('Error getting call history', { error });
        return reply.status(500).send({
            status: 'error',
            message: 'Internal server error'
        });
    }
}

/**
 * Handle request to get call transcripts for a specific call session
 */
async function callGetTranscriptsHandler(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    try {
        const { sessionId } = request.params as { sessionId: string };

        if (!sessionId) {
            return reply.status(400).send({
                status: 'error',
                message: 'Session ID is required'
            });
        }

        // Query call session to verify it exists
        const sessionRef = db.collection(CallSession._collection()).doc(sessionId);
        const sessionDoc = await sessionRef.get();

        if (!sessionDoc.exists) {
            return reply.status(404).send({
                status: 'error',
                message: 'Call session not found'
            });
        }

        // Query transcripts for this session
        const transcripts = await dbGetAll(
            CallTranscript,
            db.collection(CallTranscript._collection(sessionId)).orderBy('timestamp', 'asc')
        );

        // Convert to response format
        const messages = transcripts.map((transcript: CallTranscript) => transcript.toResponse());

        return reply.status(200).send({
            status: 'success',
            sessionId,
            messages
        });
    } catch (error) {
        log.error('Error getting call transcripts', { error });
        return reply.status(500).send({
            status: 'error',
            message: 'Internal server error'
        });
    }
}

/**
 * Initialize call routes
 * @param path API base path
 * @param server Fastify server instance
 */
export function callRoutesInit(path: string, server: FastifyInstance): void {
    // Initialize WebSocket server
    callWebsocketInit(server);

    // HTTP routes for call history and transcript retrieval
    srvAddRoute('GET', server, `${path}/v1/calls/:userId`, callGetHistoryHandler);
    srvAddRoute('GET', server, `${path}/v1/calls/:sessionId/transcripts`, callGetTranscriptsHandler);

    log.info('Call routes initialized');
}
