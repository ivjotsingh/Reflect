/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import * as fs from 'fs';
import * as path from 'path';
import * as hnswlib from 'hnswlib-node';
import { log } from '../log/log';
import { EmbeddingService } from './embeddingService';

/**
 * Document interface for storing text data with metadata
 */
export interface Document {
    id: string;
    text: string;
    metadata?: Record<string, any>;
}

/**
 * SearchResult interface for vector search results
 */
export interface SearchResult {
    document: Document;
    score: number;
}

/**
 * In-memory vector database using hnswlib
 */
export class VectorStore {
    private static instance: VectorStore;
    private index: hnswlib.HierarchicalNSW;
    private documents: Map<number, Document>;
    private dimension: number;
    private maxElements: number;
    private indexFilePath: string;
    private docStorePath: string;
    private embeddings: EmbeddingService;
    private isInitialized: boolean = false;

    private constructor() {
        this.dimension = 1536; // Default OpenAI embedding dimension
        this.maxElements = 10000; // Maximum documents to store
        this.documents = new Map();
        this.indexFilePath = path.join(__dirname, '../../brain/vector_index.bin');
        this.docStorePath = path.join(__dirname, '../../brain/doc_store.json');
        this.embeddings = EmbeddingService.getInstance();
        
        // Create the index
        this.index = new hnswlib.HierarchicalNSW('cosine', this.dimension);
    }

    /**
     * Get singleton instance of VectorStore
     * @returns VectorStore instance
     */
    public static getInstance(): VectorStore {
        if (!VectorStore.instance) {
            VectorStore.instance = new VectorStore();
        }
        return VectorStore.instance;
    }

    /**
     * Initialize the vector database
     */
    public async initialize(): Promise<void> {
        if (this.isInitialized) return;
        
        try {
            // Check if index file exists
            if (fs.existsSync(this.indexFilePath) && fs.existsSync(this.docStorePath)) {
                // Load existing index
                this.index.readIndex(this.indexFilePath);
                const docStoreData = JSON.parse(fs.readFileSync(this.docStorePath, 'utf-8'));
                
                // Reconstruct the documents map
                this.documents = new Map();
                Object.entries(docStoreData).forEach(([key, value]) => {
                    this.documents.set(parseInt(key), value as Document);
                });
                
                log.info('Vector index loaded from disk', { 
                    documentCount: this.documents.size,
                    indexPath: this.indexFilePath 
                });
            } else {
                // Initialize new index
                this.index.initIndex(this.maxElements);
                log.info('New vector index initialized', { maxElements: this.maxElements });
            }
            
            this.isInitialized = true;
        } catch (error) {
            log.error('Error initializing vector store', { error });
            // If loading fails, initialize a new index
            this.index.initIndex(this.maxElements);
            this.documents = new Map();
            this.isInitialized = true;
        }
    }

    /**
     * Add documents to the vector store
     * @param documents Array of documents to add
     */
    public async addDocuments(documents: Document[]): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // Get embeddings for all documents
            const texts = documents.map(doc => doc.text);
            const embeddings = await this.embeddings.embedDocuments(texts);
            
            // Add documents to index
            for (let i = 0; i < documents.length; i++) {
                const currentIndex = this.index.getCurrentCount();
                this.index.addPoint(embeddings[i], currentIndex);
                this.documents.set(currentIndex, documents[i]);
            }
            
            // Save the updated index
            await this.saveIndex();
            
            log.info('Documents added to vector store', { count: documents.length });
        } catch (error) {
            log.error('Error adding documents to vector store', { error });
            throw new Error('Failed to add documents to vector store');
        }
    }

    /**
     * Search for similar documents
     * @param query Query text
     * @param k Number of results to return
     * @returns Array of search results
     */
    public async similaritySearch(query: string, k: number = 4): Promise<SearchResult[]> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const embedding = await this.embeddings.embedText(query);
            const currentCount = this.index.getCurrentCount();
            
            // If no documents in the index, return empty array
            if (currentCount === 0) {
                return [];
            }
            
            // Ensure k doesn't exceed the number of documents
            const limit = Math.min(k, currentCount);
            
            // Search the index
            const result = this.index.searchKnn(embedding, limit);
            
            // Map results to SearchResult objects
            return result.neighbors.map((docIndex, i) => {
                const document = this.documents.get(docIndex);
                if (!document) {
                    throw new Error(`Document with index ${docIndex} not found`);
                }
                
                return {
                    document,
                    score: result.distances[i]
                };
            });
        } catch (error) {
            log.error('Error searching vector store', { error, query });
            return [];
        }
    }

    /**
     * Delete a document from the vector store
     * @param documentId ID of document to delete
     */
    public async deleteDocument(documentId: string): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Find the index of the document
        let indexToDelete: number | null = null;
        for (const [index, doc] of this.documents.entries()) {
            if (doc.id === documentId) {
                indexToDelete = index;
                break;
            }
        }

        if (indexToDelete !== null) {
            // Remove from documents map
            this.documents.delete(indexToDelete);
            
            // We need to rebuild the index since hnswlib doesn't support deletion
            await this.rebuildIndex();
            
            log.info('Document deleted from vector store', { documentId });
        } else {
            log.warn('Document not found for deletion', { documentId });
        }
    }

    /**
     * Clear all documents from the vector store
     * @returns Promise that resolves when the index is cleared
     */
    public async clearIndex(): Promise<void> {
        try {
            // Re-initialize the index
            this.index = new hnswlib.HierarchicalNSW('cosine', this.dimension);
            this.index.initIndex(this.maxElements);
            this.documents = new Map();
            
            // Delete the index files if they exist
            if (fs.existsSync(this.indexFilePath)) {
                fs.unlinkSync(this.indexFilePath);
            }
            
            if (fs.existsSync(this.docStorePath)) {
                fs.unlinkSync(this.docStorePath);
            }
            
            log.info('Vector index cleared');
            
            // Save an empty index
            await this.saveIndex();
        } catch (error) {
            log.error('Error clearing vector index', { error });
            throw new Error('Failed to clear vector index');
        }
    }

    /**
     * Save the index to disk
     */
    private async saveIndex(): Promise<void> {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.indexFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            // Save the index
            this.index.writeIndex(this.indexFilePath);
            
            // Save the document store
            const docStoreObj: Record<number, Document> = {};
            this.documents.forEach((doc, index) => {
                docStoreObj[index] = doc;
            });
            
            fs.writeFileSync(this.docStorePath, JSON.stringify(docStoreObj));
            
            log.info('Vector index saved to disk', { 
                documentCount: this.documents.size,
                indexPath: this.indexFilePath 
            });
        } catch (error) {
            log.error('Error saving vector index', { error });
            throw new Error('Failed to save vector index');
        }
    }

    /**
     * Rebuild the index from scratch (used after deletions)
     */
    private async rebuildIndex(): Promise<void> {
        try {
            // Get all documents
            const docs = Array.from(this.documents.values());
            
            // Recreate the index
            this.index = new hnswlib.HierarchicalNSW('cosine', this.dimension);
            this.index.initIndex(this.maxElements);
            this.documents = new Map();
            
            // Re-add all documents
            if (docs.length > 0) {
                await this.addDocuments(docs);
            } else {
                // If no documents, just save an empty index
                await this.saveIndex();
            }
            
            log.info('Vector index rebuilt', { documentCount: docs.length });
        } catch (error) {
            log.error('Error rebuilding vector index', { error });
            throw new Error('Failed to rebuild vector index');
        }
    }
}
