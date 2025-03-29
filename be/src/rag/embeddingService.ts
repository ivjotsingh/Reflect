/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { OpenAIEmbeddings } from '@langchain/openai';
import { log } from '../log/log';
import { conf } from '../conf/conf';

/**
 * Service for generating embeddings using OpenAI's embedding models
 */
export class EmbeddingService {
    private static instance: EmbeddingService;
    private embeddings: OpenAIEmbeddings;

    private constructor() {
        this.embeddings = new OpenAIEmbeddings({
            openAIApiKey: conf.env.credentials.openAIAPIKey,
            modelName: 'text-embedding-3-small', // Using OpenAI's embedding model
            dimensions: 1536, // Default embedding dimensions
        });
    }

    /**
     * Get singleton instance of EmbeddingService
     * @returns EmbeddingService instance
     */
    public static getInstance(): EmbeddingService {
        if (!EmbeddingService.instance) {
            EmbeddingService.instance = new EmbeddingService();
        }
        return EmbeddingService.instance;
    }

    /**
     * Generate embeddings for a single text
     * @param text Text to embed
     * @returns Vector embedding as number array
     */
    public async embedText(text: string): Promise<number[]> {
        try {
            return await this.embeddings.embedQuery(text);
        } catch (error) {
            log.error('Error generating embedding', { error });
            throw new Error('Failed to generate embedding');
        }
    }

    /**
     * Generate embeddings for multiple texts
     * @param texts Array of texts to embed
     * @returns Array of vector embeddings
     */
    public async embedDocuments(texts: string[]): Promise<number[][]> {
        try {
            return await this.embeddings.embedDocuments(texts);
        } catch (error) {
            log.error('Error generating document embeddings', { error });
            throw new Error('Failed to generate document embeddings');
        }
    }
}
