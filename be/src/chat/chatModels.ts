/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { dbDocument, dbTimestamp } from '../db/db';

export interface ChatMessageResponse {
    messageId: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: number;
}

export class ChatSession extends dbDocument {
    public userId: string;
    public lastActive: dbTimestamp;

    constructor(init: Partial<ChatSession>) {
        super(init);
        this.userId = init.userId || '';
        this.lastActive = init.lastActive || new Date() as any;
    }

    static override _collection(): string {
        return 'ChatSessions';
    }

    override _documentId(): string {
        return this.userId; // Using userId as sessionId
    }
}

export class ChatMessage extends dbDocument {
    public chatId: string;
    public sessionId: string;  // Using userId as sessionId in our simplified model
    public content: string;
    public role: 'user' | 'assistant';
    public userId: string;
    public timestamp: dbTimestamp;

    constructor(init: Partial<ChatMessage>) {
        super(init);
        this.sessionId = init.sessionId || '';
        this.content = init.content || '';
        this.role = init.role || 'user';
        this.userId = init.userId || '';
        this.timestamp = init.timestamp || new Date() as any;
    }

    static override _collection(sessionId?: string): string {
        if (sessionId) {
            return `ChatSessions/${sessionId}/ChatMessages`;
        }
        throw new Error('Session ID is required for chat messages');
    }

    override _documentId(): string {
        return this.chatId;
    }

    toResponse(): ChatMessageResponse {
        return {
            messageId: this._documentId(),
            content: this.content,
            role: this.role,
            timestamp: this.timestamp.toDate().getTime(),
        };
    }
}
