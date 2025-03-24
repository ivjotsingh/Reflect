/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import * as firebase from 'firebase-admin';
import {
    DocumentData, FieldValue, Firestore, OrderByDirection,
    Timestamp, WhereFilterOp
} from 'firebase-admin/firestore';
import { log } from '../log';
import { firestore } from 'firebase-admin';

const ddbLogTransactionTimeMs = 5000;
const ddbLogRetryCountThreshold = 2;

class DdbFirestore extends Firestore {
    constructor(settings: FirebaseFirestore.Settings) {
        super(settings);
    }

    async runTransactionInternal<T>(
        updateFunction: DdbTransactionCallback<T>,
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
                const ddbTxn = txn as DdbTransaction;
                ddbTxn.onSuccess = (f: Function) => { onSuccessFunctors.push(f); };
                return await updateFunction(ddbTxn, singleCycleTxnMetadata);
            });

            const duration = Date.now() - start;

            if (duration >= ddbLogTransactionTimeMs || retryCount >= ddbLogRetryCountThreshold) {
                await ddbLogDelayedTransaction(retryCount, duration, { ...metadata, txnMetadata });
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
        updateFunction: DdbTransactionCallback<T>, metadata?: Record<string, unknown>
    ): Promise<T> {
        const { result, onSuccessFunctors } = await this.runTransactionInternal(updateFunction, metadata);
        for (const f of onSuccessFunctors) await f();
        return result;
    }
}

export let ddb: DdbFirestore;

export function ddbServerTimestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
}

export function ddbTimestamp(ts: Date) {
    return Timestamp.fromDate(ts);
}

export function ddbNow() {
    return ddbTimestamp(new Date());
}

export function ddbDefaultExpiryTimestamp(): DdbTimestamp {
    return ddbTimestamp(new Date('2060-01-01T00:00:00.000Z'));
}

export function ddbGetExpiryTimestamp(): DdbTimestamp {
    const date = new Date();
    date.setHours(date.getHours() + 72);
    return ddbTimestamp(date);
}

export type DdbQuery = firebase.firestore.Query;
export type DdbTransaction = FirebaseFirestore.Transaction & { onSuccess: (f: Function) => void };
export type DdbServerTimestamp = ReturnType<typeof firebase.firestore.FieldValue.serverTimestamp>;
export type DdbTimestamp = FirebaseFirestore.Timestamp;
export type DdbDocumentType<T> = typeof DdbDocument & (new (init: Partial<T>) => T);
export type DdbTransactionCallback<T> = (txn: DdbTransaction, txnMetadata: Record<string, unknown>) => Promise<T>;
export type DdbConnection<T> = { nodes: T[]; pageInfo: { hasNextPage: boolean; cursor: string | null } };

export class DdbDocument {
    public createdAt: DdbTimestamp | DdbServerTimestamp;
    public updatedAt: DdbTimestamp | DdbServerTimestamp;

    constructor(init: Partial<DdbDocument>) {
        this.createdAt = init.createdAt || ddbServerTimestamp();
        this.updatedAt = init.updatedAt || ddbServerTimestamp();
    }

    static _collection(grandParentId?: string, parentId?: string): string {
        throw new Error(`Should be implemented by derived class, parentId ${parentId}, grandParentId ${grandParentId}`);
    }
    
    _documentId(): string { 
        throw new Error('Should be implemented by derived class.'); 
    }

    async delete(grandParentId?: string, parentId?: string) {
        const cls = this.constructor as typeof DdbDocument;
        if (grandParentId && parentId) {
            await ddb.collection(cls._collection(grandParentId, parentId)).doc(this._documentId()).delete();
        }
        else if (grandParentId) {
            await ddb.collection(cls._collection(grandParentId)).doc(this._documentId()).delete();
        }
        else {
            await ddb.collection(cls._collection()).doc(this._documentId()).delete();
        }
    }

    async get(txn: DdbTransaction, grandParentId?: string, parentId?: string) {
        const cls = this.constructor as typeof DdbDocument;
        let docref;
        if (grandParentId && parentId) {
            docref = ddb.collection(cls._collection(grandParentId, parentId)).doc(this._documentId());
        }
        else if (grandParentId) {
            docref = ddb.collection(cls._collection(grandParentId)).doc(this._documentId());
        }
        else {
            docref = ddb.collection(cls._collection()).doc(this._documentId());
        }
        const snapshot = await txn.get(docref);
        if (!snapshot.exists) throw new Error('Document does not exist.');
        Object.assign(this, snapshot.data());
    }

    set(txn: DdbTransaction, grandParentId?: string, parentId?: string) {
        const cls = this.constructor as typeof DdbDocument;
        let docref;
        if (grandParentId && parentId) {
            docref = ddb.collection(cls._collection(grandParentId, parentId)).doc(this._documentId());
        }
        else if (grandParentId) {
            docref = ddb.collection(cls._collection(grandParentId)).doc(this._documentId());
        }
        else {
            docref = ddb.collection(cls._collection()).doc(this._documentId());
        }
        const json = JSON.parse(JSON.stringify(this)) as DdbDocument;
        this.updatedAt = ddbServerTimestamp();
        ddbUpdateRecursively(this, json);
        txn.set(docref, json);
    }
}

export class DdbExpireableDocument extends DdbDocument {
    public expiryAt: DdbTimestamp;

    constructor(init: Partial<DdbExpireableDocument>) {
        super(init);
        this.expiryAt = init.expiryAt || ddbDefaultExpiryTimestamp();
    }
}

function ddbUpdateRecursively(obj: object, json: any) {
    Object.entries(obj).forEach(([key, value]) => {
        if (value instanceof FieldValue || value instanceof firestore.Timestamp) {
            json[key] = value;
        }
        else if (value !== null && typeof value === 'object') {
            ddbUpdateRecursively(value, json[key]);
        }
    });
}

export async function ddbGetById<T extends DdbDocument>(
    txn: DdbTransaction | null,
    cls: DdbDocumentType<T>,
    id: string,
    parentId?: string,
    childrenId?: string
): Promise<T | null> {
    let docRef;
    if (parentId && childrenId) {
        docRef = ddb.collection(cls._collection(parentId, childrenId)).doc(id);
    } else if (parentId) {
        docRef = ddb.collection(cls._collection(parentId)).doc(id);
    } else {
        docRef = ddb.collection(cls._collection()).doc(id);
    }

    const snapshot = txn ? await txn.get(docRef) : await docRef.get();
    if (!snapshot.exists) return null;

    const data = snapshot.data() as Partial<T>;
    return new cls(data);
}

export async function ddbGetByIdOrThrow<T extends DdbDocument>(
    txn: DdbTransaction | null,
    cls: DdbDocumentType<T>,
    id: string,
    parentId?: string
): Promise<T> {
    const doc = await ddbGetById(txn, cls, id, parentId);
    if (!doc) throw new Error(`Document with id ${id} not found`);
    return doc;
}

export async function ddbGetByFields<T extends DdbDocument, K extends keyof T>(
    txn: DdbTransaction | null,
    cls: DdbDocumentType<T>,
    fields: { [key: string]: any },
    limit: number | null = null,
    orderByFields: { field: any; direction: OrderByDirection }[] = [],
    parentId?: string
): Promise<T[]> {
    let query: firebase.firestore.Query = parentId
        ? ddb.collection(cls._collection(parentId))
        : ddb.collection(cls._collection());

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
        return new cls(data);
    });
}

export function ddbIncrementValue(n: number) {
    return firebase.firestore.FieldValue.increment(n);
}

export function ddbArrayUnionValue(a: unknown) {
    return firebase.firestore.FieldValue.arrayUnion(a);
}

export async function ddbUpdateFields<T extends DdbDocument>(
    cls: DdbDocumentType<T>,
    documentId: string,
    fields: { [key: string]: any },
    parentId?: string
): Promise<void> {
    let docRef;
    if (parentId) {
        docRef = ddb.collection(cls._collection(parentId)).doc(documentId);
    } else {
        docRef = ddb.collection(cls._collection()).doc(documentId);
    }

    const updateData = {
        ...fields,
        updatedAt: ddbServerTimestamp()
    };

    await docRef.update(updateData);
}

export async function ddbCreateOrUpdate<T extends DdbDocument>(
    cls: DdbDocumentType<T>,
    documentId: string,
    fields: { [key: string]: any },
    parentId?: string
): Promise<void> {
    let docRef;
    if (parentId) {
        docRef = ddb.collection(cls._collection(parentId)).doc(documentId);
    } else {
        docRef = ddb.collection(cls._collection()).doc(documentId);
    }

    const snapshot = await docRef.get();
    const updateData = {
        ...fields,
        updatedAt: ddbServerTimestamp()
    };

    if (!snapshot.exists) {
        updateData.createdAt = ddbServerTimestamp();
    }

    await docRef.set(updateData, { merge: true });
}

export function ddbInit(firebaseCredentials: string): void {
    try {
        const serviceAccount = JSON.parse(firebaseCredentials);
        firebase.initializeApp({
            credential: firebase.credential.cert(serviceAccount)
        });

        ddb = new DdbFirestore({});
        log.info('Database initialized');
    } catch (error) {
        log.error('Failed to initialize database', { error });
        throw error;
    }
}

async function ddbLogDelayedTransaction(retryCount: number, duration: number, metadata: Record<string, unknown>) {
    log.warn('Delayed transaction', {
        retryCount,
        duration,
        ...metadata
    });
}
