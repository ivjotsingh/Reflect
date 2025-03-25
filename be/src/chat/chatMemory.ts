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
    async getMessages(numberOfMessages: number = 20): Promise<BaseMessage[]> {
        try {
            // Get messages from Firestore
            const messagesRef = db.collection(ChatMessage._collection(this._sessionId));
            const query = await messagesRef
                .orderBy('timestamp', 'desc')
                .limit(numberOfMessages)
                .get();
                
            const chatMessages = query.docs.map(doc => doc.data() as ChatMessage);
            
            // Reverse to get chronological order
            chatMessages.reverse();
            
            const storedMessages: StoredMessage[] = [];
            
            // Convert to LangChain StoredMessage format
            chatMessages.forEach((message) => {
                const data: StoredMessageData = {
                    content: message.content,
                    role: message.role,
                    name: undefined,
                    tool_call_id: undefined,
                    additional_kwargs: {
                        documentId: message._documentId()
                    }
                };
                
                storedMessages.push({
                    type: message.role,
                    data
                });
            });
            
            // Map to LangChain BaseMessage objects
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
 * @param chatId The chat ID
 * @returns ReflectFirestoreChatMessageHistory instance
 */
export async function chatMemory(userId: string, chatId: string) {
    const chatMessageHistory = new ReflectFirestoreChatMessageHistory({
        collections: ['chatSessions'],
        docs: [userId],
        sessionId: userId, // Using userId as sessionId in our simplified model
        userId: userId,
        config: {
            // Use the already initialized Firebase app
            projectId: process.env.FIREBASE_PROJECT_ID || 'reflect-ai-dev'
        },
    });
    return chatMessageHistory;
}
