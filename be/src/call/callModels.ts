/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { dbDocument, dbTimestamp } from '../db/db';

/**
 * Call session response interface for API responses
 */
export interface CallSessionResponse {
    sessionId: string;
    userId: string;
    startTime: number;
    endTime?: number;
    duration: number;
    status: 'active' | 'completed';
}

/**
 * Call transcript response interface for API responses
 */
export interface CallTranscriptResponse {
    transcriptId: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: number;
}

/**
 * Call session database model
 */
export class CallSession extends dbDocument {
    public _id: string;
    public userId: string;
    public startTime: dbTimestamp;
    public endTime?: dbTimestamp;
    public duration: number; // in seconds
    public status: 'active' | 'completed';

    constructor(init: Partial<CallSession>) {
        super(init);
        this._id = init._id || '';
        this.userId = init.userId || '';
        this.startTime = init.startTime || new Date() as any;
        this.endTime = init.endTime;
        this.duration = init.duration || 0;
        this.status = init.status || 'active';
    }

    static override _collection(): string {
        return 'CallSessions';
    }

    override _documentId(): string {
        return this._id;
    }

    toResponse(): CallSessionResponse {
        return {
            sessionId: this._documentId(),
            userId: this.userId,
            startTime: this.startTime.toDate().getTime(),
            endTime: this.endTime ? this.endTime.toDate().getTime() : undefined,
            duration: this.duration,
            status: this.status
        };
    }
}

/**
 * Call transcript database model for storing conversation transcripts
 */
export class CallTranscript extends dbDocument {
    public transcriptId: string;
    public sessionId: string;
    public content: string;
    public role: 'user' | 'assistant';
    public userId: string;
    public timestamp: dbTimestamp;

    constructor(init: Partial<CallTranscript>) {
        super(init);
        this.transcriptId = init.transcriptId || '';
        this.sessionId = init.sessionId || '';
        this.content = init.content || '';
        this.role = init.role || 'user';
        this.userId = init.userId || '';
        this.timestamp = init.timestamp || new Date() as any;
    }

    static override _collection(sessionId?: string): string {
        if (sessionId) {
            return `CallSessions/${sessionId}/CallTranscripts`;
        }
        throw new Error('Session ID is required for call transcripts');
    }

    override _documentId(): string {
        return this.transcriptId;
    }

    toResponse(): CallTranscriptResponse {
        return {
            transcriptId: this.transcriptId,
            content: this.content,
            role: this.role,
            timestamp: this.timestamp.toDate().getTime()
        };
    }
}
