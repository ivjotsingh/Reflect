/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { srvAddRoute, srvServer } from '../srv';
import { log } from '../log/log';
import { ChatMessage, ChatSession } from './chatModels';
import { chatGetResponse, chatResponseEmitter, chatSaveAIResponse } from './chatProcessor';
import { db, dbCreateOrUpdate } from '../db/db';
import { Timestamp } from 'firebase-admin/firestore';
import { utlNewId } from '../utl/utl';

// Direct chat endpoint handler for v1/chat
async function chatMessageHandler(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    try {
        const { message, userId } = request.body as { message: string, userId: string };

        if (!message || typeof message !== 'string' || message.trim() === '') {
            return reply.status(400).send({
                status: 'error',
                message: 'Message content is required'
            });
        }

        // Ensure a chat session exists for this user
        const timestamp = Timestamp.now();
        const sessionId = userId; // Using userId as sessionId

        // Create or update the chat session
        const chatSession = new ChatSession({
            userId,
            lastActive: timestamp
        });
        await dbCreateOrUpdate(ChatSession, sessionId, chatSession);

        // Create and save user message
        const chatId = utlNewId('chat');
        const newUserMessage = new ChatMessage({
            chatId,
            sessionId,
            content: message,
            role: 'user',
            userId,
            timestamp
        });

        // We need to pass sessionId (userId) as the parentId for the collection path
        await dbCreateOrUpdate(ChatMessage, chatId, newUserMessage, sessionId);

        // Process with AI using LangChain (non-blocking)
        // Start processing but don't await the result
        void processAiResponse(userId, message);

        return reply.status(200).send({
            status: 'success',
            data: {
                message: {
                    ...newUserMessage.toResponse(),
                    id: newUserMessage._documentId()
                },
                streamingEnabled: true
            }
        });
    } catch (error) {
        log.error('Error in chat message handler', { error });
        return reply.status(500).send({
            status: 'error',
            message: 'Internal server error'
        });
    }
}

// Helper function to process AI response asynchronously
async function processAiResponse(userId: string, message: string): Promise<void> {
    try {
        const aiResponseContent = await chatGetResponse(userId, message);
        await chatSaveAIResponse(userId, aiResponseContent);
    } catch (error) {
        log.error('Error processing AI response', { error, userId });
    }
}

// Initialize chat routes
export function chatRoutesInit(path: string): void {
    // Direct chat endpoint (simplified - one session per user)
    srvAddRoute('POST', srvServer, `${path}/v1/chat`, chatMessageHandler);
    log.info('Chat routes initialized');
}
