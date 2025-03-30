/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { VectorStore } from './vectorStore';
import { DocumentLoader } from './documentLoader';
import { log } from '../log/log';
import * as path from 'path';

/**
 * Service for Retrieval-Augmented Generation (RAG)
 */
export class RagService {
    private static instance: RagService;
    private vectorStore: VectorStore;
    private brainPath: string;
    private isInitialized: boolean = false;

    private constructor() {
        this.vectorStore = VectorStore.getInstance();
        this.brainPath = path.join(__dirname, '../../brain');
    }

    /**
     * Get singleton instance of RagService
     * @returns RagService instance
     */
    public static getInstance(): RagService {
        if (!RagService.instance) {
            RagService.instance = new RagService();
        }
        return RagService.instance;
    }

    /**
     * Initialize the RAG service
     */
    public async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // Initialize the vector store
            await this.vectorStore.initialize();

            // Load documents if the vector store is empty
            await this.loadBrainDocuments();

            this.isInitialized = true;
            log.info('RAG service initialized');
        } catch (error) {
            log.error('Error initializing RAG service', { error });
            throw new Error('Failed to initialize RAG service');
        }
    }

    /**
     * Load documents from the brain directory
     */
    private async loadBrainDocuments(): Promise<void> {
        try {
            // Check if documents are already loaded by performing a sample query
            const testResults = await this.vectorStore.similaritySearch("mind", 1);

            // If we already have documents indexed, skip loading
            if (testResults.length > 0) {
                log.info('Documents already loaded in vector store, skipping load');
                return;
            }

            // Load all documents from the brain directory
            const documents = await DocumentLoader.loadFromDirectory(this.brainPath);

            if (documents.length > 0) {
                // Add documents to the vector store
                await this.vectorStore.addDocuments(documents);
                log.info('Brain documents loaded into vector store', { count: documents.length });
            } else {
                log.warn('No brain documents found to load');
            }
        } catch (error) {
            log.error('Error loading brain documents', { error });
        }
    }

    /**
     * Generate context relevant to a query
     * @param query User's query or message
     * @param k Number of relevant documents to retrieve
     * @returns Context from relevant documents
     */
    public async generateRelevantContext(query: string, k: number = 3): Promise<string> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // Search for similar documents
            const results = await this.vectorStore.similaritySearch(query, k);


            if (results.length === 0) {
                return '';
            }

            // Construct context from relevant documents
            let context = "RELEVANT CONTEXT:\n";

            results.forEach((result, i) => {
                const { document, score } = result;
                const source = document.metadata?.fileName || 'unknown source';

                // Only add if relevance score is good (lower is better for cosine)
                if (score < 0.5) {
                    context += `[${i + 1}] From ${source}: ${document.text.substring(0, 500)}...\n\n`;
                }
            });

            context += "Use the above information to provide more informed and contextually relevant responses. " +
                "However, do not explicitly mention that you are using this information or cite these sources " +
                "unless directly asked about reference materials.";

            return context;
        } catch (error) {
            log.error('Error generating relevant context', { error, query });
            return '';
        }
    }

    /**
     * Clear all documents from the vector store
     * @returns Promise that resolves when the vector store is cleared
     */
    public async clearVectorStore(): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            await this.vectorStore.clearIndex();
            log.info('Vector store cleared via RAG service');
        } catch (error) {
            log.error('Error clearing vector store via RAG service', { error });
            throw new Error('Failed to clear vector store');
        }
    }
}
