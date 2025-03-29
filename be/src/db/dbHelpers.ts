/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { db, dbDocument, dbDocumentType } from './db';
import { Query } from 'firebase-admin/firestore';

/**
 * Get all documents from a query
 * @param cls Document class
 * @param query Firestore query
 * @returns Array of documents
 */
export async function dbGetAll<T extends dbDocument>(
    cls: dbDocumentType<T>,
    query: Query
): Promise<T[]> {
    const snapshot = await query.get();
    const results: T[] = [];
    
    snapshot.forEach(doc => {
        // Create instance of class and initialize with document data
        const instance = new (cls as any)();
        Object.assign(instance, doc.data());
        results.push(instance);
    });
    
    return results;
}
