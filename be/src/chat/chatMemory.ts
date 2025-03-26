/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import admin from 'firebase-admin';
import { BaseMessage } from '@langchain/core/messages';
import { mapStoredMessagesToChatMessages, StoredMessage, StoredMessageData } from '@langchain/core/messages';
import { FirestoreChatMessageHistory, FirestoreDBChatMessageHistory } from '@langchain/community/stores/message/firestore';
import { log } from '../log/log';
import { ChatMessage } from './chatModels';
import { db, dbGetByFields } from '../db/db';
import { conf } from '../conf';

/**
 * Extended Firestore Chat Message History class for ReflectAI
 * Manages chat message history in Firestore
 */
export class ReflectFirestoreChatMessageHistory extends FirestoreChatMessageHistory {
    private readonly _sessionId: string;
    private readonly _userId: string;

    constructor({ collections, docs, sessionId, userId, config }: FirestoreDBChatMessageHistory) {
        super({
            collections,
            docs,
            sessionId,
            userId,
            config
        });
        this._sessionId = sessionId;
        this._userId = userId;
    }

    /**
     * Get messages from the chat history
     * @param numberOfMessages Optional limit on number of messages to retrieve
     * @returns Array of BaseMessage objects for LangChain
     */
    async getMessages(numberOfMessages: number = 23): Promise<BaseMessage[]> {
        try {
            const chatFirestoreHistory = await dbGetByFields(
                null,
                ChatMessage,
                {},
                numberOfMessages,
                [{ field: 'timestamp', direction: 'desc' }],
                this._sessionId
            );

            chatFirestoreHistory.reverse();

            const storedMessages: StoredMessage[] = [];

            chatFirestoreHistory.forEach((message) => {
                // Map role to the correct LangChain message type
                const type = message.role === 'user' ? 'human' : 'ai';

                // Use the 'message' field if available, otherwise fall back to 'content'
                const messageContent = message.message || message.content;

                const data: StoredMessageData = {
                    content: messageContent,
                    role: message.role,
                    name: undefined,
                    tool_call_id: undefined,
                    additional_kwargs: {
                        documentId: message.chatId
                    }
                };

                storedMessages.push({
                    type,
                    data
                });
            });

            return mapStoredMessagesToChatMessages(storedMessages);
        }
        catch (err) {
            log.error('Error fetching messages:', { err, sessionId: this._sessionId, userId: this._userId });
            throw new Error('Failed to retrieve messages from Firestore');
        }
    }

    /**
     * Add a message to the chat history
     * Uses the parent class implementation
     */
    async addMessage(message: BaseMessage): Promise<void> {
        return super.addMessage(message);
    }

    /**
     * Clear the chat history
     * Uses the parent class implementation
     */
    clear(): Promise<void> {
        return super.clear();
    }
}

/**
 * Creates a chat memory instance for the given user and chat
 * @param userId The user ID
 * @returns ReflectFirestoreChatMessageHistory instance
 */
export async function chatMemory(userId: string) {
    const chatMessageHistory = new ReflectFirestoreChatMessageHistory({
        collections: ['chatSessions'],
        docs: [userId],
        sessionId: userId, // Using userId as sessionId in our simplified model
        userId: userId,
        config: {
            credential: admin.credential.cert(JSON.parse(conf.env.credentials.firebase) as string)
        },
    });
    return chatMessageHistory;
}
