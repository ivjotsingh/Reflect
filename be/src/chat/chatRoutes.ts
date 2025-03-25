/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { Request, Response } from 'express';
import { srvAddRoute, srvServer } from '../srv';
import { log } from '../log/log';
import { ChatMessage } from './chatModels';
import { chatGetResponse, chatResponseEmitter, chatSaveAIResponse } from './chatProcessor';
import { db, dbCreateOrUpdate } from '../db/db';
import { Timestamp } from 'firebase-admin/firestore';
import { utlNewId } from '../utl/utl';

// Direct chat endpoint handler for v1/chat
async function chatMessageHandler(req: Request, res: Response): Promise<any> {
    try {
        const { message, userId } = req.body;

        if (!message || typeof message !== 'string' || message.trim() === '') {
            return res.status(400).json({
                status: 'error',
                message: 'Message content is required'
            });
        }

        // Create and save user message
        const timestamp = Timestamp.now();
        const chatId = utlNewId('chat');
        const newUserMessage = new ChatMessage({
            sessionId: userId, // Use userId directly as the sessionId
            content: message,
            role: 'user',
            userId,
            timestamp
        });

        await dbCreateOrUpdate(ChatMessage, chatId, newUserMessage);

        // Process with AI using LangChain (non-blocking)
        chatGetResponse(userId, message)
            .then(async (aiResponseContent) => {
                // Save AI response once complete
                await chatSaveAIResponse(userId, aiResponseContent);
            })
            .catch(error => {
                log.error('Error processing AI response', { error, userId });
            });

        return res.status(200).json({
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
        log.error('Failed to send message', { error, userId: req.body.userId });
        return res.status(500).json({
            status: 'error',
            message: 'Failed to process message'
        });
    }
}

// Initialize chat routes
export function chatRoutesInit(path: string): void {
    // Direct chat endpoint (simplified - one session per user)
    srvAddRoute('POST', srvServer, `${path}/v1/chat`, chatMessageHandler);
    log.info('Chat routes initialized');
}
