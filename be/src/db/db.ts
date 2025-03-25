/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import * as firebase from 'firebase-admin';
import { FieldValue, Firestore, OrderByDirection, Timestamp } from 'firebase-admin/firestore';
import { log } from '../log';
import { firestore } from 'firebase-admin';
import { UtlDataOnly, UtlExcludeCreatedAt } from '../utl/utl';

const dbLogTransactionTimeMs = 5000;
const dbLogRetryCountThreshold = 2;

class dbFirestore extends Firestore {
    constructor(settings: FirebaseFirestore.Settings) {
        super(settings);
    }

    async runTransactionInternal<T>(
        updateFunction: dbTransactionCallback<T>,
        metadata: Record<string, unknown> = {}
    ): Promise<{ result: T; onSuccessFunctors: Function[] }> {
        let retryCount = -1;
        const start = Date.now();
        let onSuccessFunctors: Function[] = [];
        const txnMetadata: Record<string, unknown> = {};
        let singleCycleTxnMetadata: Record<string, unknown> = {};

        try {
            const txnResult = await super.runTransaction(async txn => {
                retryCount = retryCount + 1;
                if (retryCount >= 1)
                    txnMetadata[retryCount] = singleCycleTxnMetadata;
                singleCycleTxnMetadata = {};
                onSuccessFunctors = [];
                const dbTxn = txn as dbTransaction;
                dbTxn.onSuccess = (f: Function) => { onSuccessFunctors.push(f); };
                return await updateFunction(dbTxn, singleCycleTxnMetadata);
            });

            const duration = Date.now() - start;

            if (duration >= dbLogTransactionTimeMs || retryCount >= dbLogRetryCountThreshold) {
                await dbLogDelayedTransaction(retryCount, duration, { ...metadata, txnMetadata });
            }

            return { result: txnResult, onSuccessFunctors };
        }
        catch (err) {
            if (err instanceof Error && err.message.includes('ABORTED')) {
                log.error(`Error occurred in transaction`, { err, metadata, txnMetadata });
            }
            throw err;
        }
    }

    override async runTransaction<T>(
        updateFunction: dbTransactionCallback<T>, metadata?: Record<string, unknown>
    ): Promise<T> {
        const { result, onSuccessFunctors } = await this.runTransactionInternal(updateFunction, metadata);
        for (const f of onSuccessFunctors) await f();
        return result;
    }
}

export let db: dbFirestore;

export function dbServerTimestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
}

export function dbTimestamp(ts: Date) {
    return Timestamp.fromDate(ts);
}

export function dbNow() {
    return dbTimestamp(new Date());
}

export function dbDefaultExpiryTimestamp(): dbTimestamp {
    return dbTimestamp(new Date('2060-01-01T00:00:00.000Z'));
}

export function dbGetExpiryTimestamp(): dbTimestamp {
    const date = new Date();
    date.setHours(date.getHours() + 72);
    return dbTimestamp(date);
}

export type dbQuery = firebase.firestore.Query;
export type dbTransaction = FirebaseFirestore.Transaction & { onSuccess: (f: Function) => void };
export type dbServerTimestamp = ReturnType<typeof firebase.firestore.FieldValue.serverTimestamp>;
export type dbTimestamp = FirebaseFirestore.Timestamp;
export type dbDocumentType<T> = typeof dbDocument & (new (init: Partial<T>) => T);
export type dbTransactionCallback<T> = (txn: dbTransaction, txnMetadata: Record<string, unknown>) => Promise<T>;
export type dbConnection<T> = { nodes: T[]; pageInfo: { hasNextPage: boolean; cursor: string | null } };

export class dbDocument {
    public createdAt: dbTimestamp | dbServerTimestamp;
    public updatedAt: dbTimestamp | dbServerTimestamp;

    constructor(init: Partial<dbDocument>) {
        this.createdAt = init.createdAt || dbServerTimestamp();
        this.updatedAt = init.updatedAt || dbServerTimestamp();
    }

    static _collection(grandParentId?: string, parentId?: string): string {
        throw new Error(`Should be implemented by derived class, parentId ${parentId}, grandParentId ${grandParentId}`);
    }

    _documentId(): string {
        throw new Error('Should be implemented by derived class.');
    }

    async delete(grandParentId?: string, parentId?: string) {
        const cls = this.constructor as typeof dbDocument;
        if (grandParentId && parentId) {
            await db.collection(cls._collection(grandParentId, parentId)).doc(this._documentId()).delete();
        }
        else if (grandParentId) {
            await db.collection(cls._collection(grandParentId)).doc(this._documentId()).delete();
        }
        else {
            await db.collection(cls._collection()).doc(this._documentId()).delete();
        }
    }

    async get(txn: dbTransaction, grandParentId?: string, parentId?: string) {
        const cls = this.constructor as typeof dbDocument;
        let docref;
        if (grandParentId && parentId) {
            docref = db.collection(cls._collection(grandParentId, parentId)).doc(this._documentId());
        }
        else if (grandParentId) {
            docref = db.collection(cls._collection(grandParentId)).doc(this._documentId());
        }
        else {
            docref = db.collection(cls._collection()).doc(this._documentId());
        }
        const snapshot = await txn.get(docref);
        if (!snapshot.exists) throw new Error('Document does not exist.');
        Object.assign(this, snapshot.data());
    }

    set(txn: dbTransaction, grandParentId?: string, parentId?: string) {
        const cls = this.constructor as typeof dbDocument;
        let docref;
        if (grandParentId && parentId) {
            docref = db.collection(cls._collection(grandParentId, parentId)).doc(this._documentId());
        }
        else if (grandParentId) {
            docref = db.collection(cls._collection(grandParentId)).doc(this._documentId());
        }
        else {
            docref = db.collection(cls._collection()).doc(this._documentId());
        }
        const json = JSON.parse(JSON.stringify(this)) as dbDocument;
        this.updatedAt = dbServerTimestamp();
        dbUpdateRecursively(this, json);
        txn.set(docref, json);
    }
}

export class dbExpireableDocument extends dbDocument {
    public expiryAt: dbTimestamp;

    constructor(init: Partial<dbExpireableDocument>) {
        super(init);
        this.expiryAt = init.expiryAt || dbDefaultExpiryTimestamp();
    }
}

function dbUpdateRecursively(obj: object, json: any) {
    Object.entries(obj).forEach(([key, value]) => {
        if (value instanceof FieldValue || value instanceof firestore.Timestamp) {
            json[key] = value;
        }
        else if (value !== null && typeof value === 'object') {
            dbUpdateRecursively(value, json[key]);
        }
    });
}

export async function dbGetById<T extends dbDocument>(
    txn: dbTransaction | null,
    cls: dbDocumentType<T>,
    id: string,
    parentId?: string,
    childrenId?: string
): Promise<T | null> {
    let docRef;
    if (parentId && childrenId) {
        docRef = db.collection(cls._collection(parentId, childrenId)).doc(id);
    } else if (parentId) {
        docRef = db.collection(cls._collection(parentId)).doc(id);
    } else {
        docRef = db.collection(cls._collection()).doc(id);
    }

    const snapshot = txn ? await txn.get(docRef) : await docRef.get();
    if (!snapshot.exists) return null;

    const data = snapshot.data() as Partial<T>;
    return new cls(data) as T;
}

export async function dbGetByIdOrThrow<T extends dbDocument>(
    txn: dbTransaction | null,
    cls: dbDocumentType<T>,
    id: string,
    parentId?: string
): Promise<T> {
    const doc = await dbGetById(txn, cls, id, parentId);
    if (!doc) throw new Error(`Document with id ${id} not found`);
    return doc;
}

export async function dbGetByFields<T extends dbDocument, K extends keyof T>(
    txn: dbTransaction | null,
    cls: dbDocumentType<T>,
    fields: { [key: string]: any },
    limit: number | null = null,
    orderByFields: { field: any; direction: OrderByDirection }[] = [],
    parentId?: string
): Promise<T[]> {
    let query: firebase.firestore.Query = parentId
        ? db.collection(cls._collection(parentId))
        : db.collection(cls._collection());

    Object.entries(fields).forEach(([field, value]) => {
        if (Array.isArray(value)) {
            query = query.where(field, 'in', value);
        } else {
            query = query.where(field, '==', value);
        }
    });

    if (orderByFields.length > 0) {
        orderByFields.forEach(orderBy => {
            query = query.orderBy(orderBy.field, orderBy.direction);
        });
    }

    if (limit !== null) {
        query = query.limit(limit);
    }

    const snapshot = txn ? await txn.get(query) : await query.get();
    return snapshot.docs.map(doc => {
        const data = doc.data() as Partial<T>;
        return new cls(data) as T;
    });
}

export function dbIncrementValue(n: number) {
    return firebase.firestore.FieldValue.increment(n);
}

export function dbArrayUnionValue(a: unknown) {
    return firebase.firestore.FieldValue.arrayUnion(a);
}

export async function dbUpdateFields<T extends dbDocument>(
    cls: dbDocumentType<T>,
    documentId: string,
    fields: { [key: string]: any },
    parentId?: string
): Promise<void> {
    let docRef;
    if (parentId) {
        docRef = db.collection(cls._collection(parentId)).doc(documentId);
    } else {
        docRef = db.collection(cls._collection()).doc(documentId);
    }

    const updateData = {
        ...fields,
        updatedAt: dbServerTimestamp()
    };

    await docRef.update(updateData);
}

export function dbInit(firebaseCredentials: string): void {
    try {
        type DdbFirestoreSettings = {
            project_id: string;
            private_key: string;
            client_email: string;
        };
        const ddbFirestoreSettings = JSON.parse(firebaseCredentials) as DdbFirestoreSettings;

        db = new dbFirestore({
            projectId: ddbFirestoreSettings.project_id,
            credentials: { client_email: ddbFirestoreSettings.client_email, private_key: ddbFirestoreSettings.private_key }
        });
    } catch (error) {
        log.error('Failed to initialize database', { error });
        throw error;
    }
}

async function dbLogDelayedTransaction(retryCount: number, duration: number, metadata: Record<string, unknown>) {
    log.warn('Delayed transaction', {
        retryCount,
        duration,
        ...metadata
    });
}

export async function dbCreateOrUpdate<T extends dbDocument>(
    cls: dbDocumentType<T>,
    documentId: string,
    fields: { [K in keyof UtlExcludeCreatedAt<(UtlDataOnly<T>)>]: T[K] },
    parentId?: string,
    childrenId?: string
) {
    let collectionPath;
    if (parentId && childrenId) {
        collectionPath = cls._collection(parentId, childrenId);
    }
    else if (parentId) {
        collectionPath = cls._collection(parentId);
    }
    else {
        collectionPath = cls._collection();
    }
    const docRef = db.collection(collectionPath).doc(documentId);
    await docRef.set({ ...fields }, { merge: true });
}