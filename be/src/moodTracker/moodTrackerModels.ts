/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { dbDocument, dbTimestamp } from '../db/db';

export type MoodType = 'Great' | 'Good' | 'Okay' | 'Down' | 'Stressed' | 'Angry';

export interface MoodResponse {
    id: string;
    userId: string;
    mood: MoodType;
    timestamp: number;
    date: string;
}

export class UserMood extends dbDocument {
    public userId: string;
    public mood: MoodType;
    public timestamp: dbTimestamp;
    public date: string; // Format: YYYY-MM-DD

    constructor(init: Partial<UserMood>) {
        super(init);
        this.userId = init.userId || '';
        this.mood = init.mood || 'Okay';
        this.timestamp = init.timestamp || new Date() as any;
        this.date = init.date || new Date().toISOString().split('T')[0];
    }

    static override _collection(): string {
        return 'UserMoods';
    }

    override _documentId(): string {
        // Using userId_date as the document ID to ensure one mood per day per user
        return `${this.userId}_${this.date}`;
    }

    toResponse(): MoodResponse {
        return {
            id: this._documentId(),
            userId: this.userId,
            mood: this.mood,
            timestamp: this.timestamp.toDate().getTime(),
            date: this.date
        };
    }
}
