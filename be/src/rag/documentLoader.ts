/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import * as fs from 'fs';
import * as path from 'path';
import { Document } from './vectorStore';
import { log } from '../log/log';

/**
 * Service for loading documents from various sources
 */
export class DocumentLoader {
    /**
     * Load text file(s) from a directory
     * @param dirPath Path to directory containing text files
     * @returns Array of loaded documents
     */
    public static async loadFromDirectory(dirPath: string): Promise<Document[]> {
        try {
            // Check if directory exists
            if (!fs.existsSync(dirPath)) {
                log.error('Directory does not exist', { dirPath });
                return [];
            }

            const documents: Document[] = [];
            const files = fs.readdirSync(dirPath);

            for (const file of files) {
                if (file.endsWith('.txt')) {
                    const filePath = path.join(dirPath, file);
                    const document = await this.loadFromFile(filePath);
                    if (document) {
                        if (Array.isArray(document)) {
                            documents.push(...document);
                        } else {
                            documents.push(document);
                        }
                    }
                }
            }

            log.info('Documents loaded from directory', { 
                dirPath, 
                documentCount: documents.length 
            });
            
            return documents;
        } catch (error) {
            log.error('Error loading documents from directory', { dirPath, error });
            throw new Error('Failed to load documents from directory');
        }
    }

    /**
     * Load a single text file
     * @param filePath Path to text file
     * @returns Loaded document or array of chunked documents or null if failed
     */
    public static async loadFromFile(filePath: string): Promise<Document | Document[] | null> {
        try {
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                log.error('File does not exist', { filePath });
                return null;
            }

            const content = fs.readFileSync(filePath, 'utf-8');
            const fileName = path.basename(filePath);

            // Create document
            const document: Document = {
                id: fileName,
                text: content,
                metadata: {
                    source: filePath,
                    fileName,
                    type: 'text',
                }
            };

            // If the document is too large, chunk it
            if (content.length > 4000) {
                return this.chunkDocument(document);
            }

            return document;
        } catch (error) {
            log.error('Error loading document from file', { filePath, error });
            return null;
        }
    }

    /**
     * Break a large document into chunks
     * @param document Document to chunk
     * @param chunkSize Size of each chunk
     * @param overlap Overlap between chunks
     * @returns Array of chunked documents
     */
    private static async chunkDocument(
        document: Document, 
        chunkSize: number = 1000, 
        overlap: number = 200
    ): Promise<Document[]> {
        try {
            const text = document.text;
            const chunks: Document[] = [];
            
            // Simple chunking by character count with overlap
            for (let i = 0; i < text.length; i += chunkSize - overlap) {
                const end = Math.min(i + chunkSize, text.length);
                const chunk = text.substring(i, end);
                
                // Create a new document for the chunk
                chunks.push({
                    id: `${document.id}_chunk_${chunks.length + 1}`,
                    text: chunk,
                    metadata: {
                        ...document.metadata,
                        parentId: document.id,
                        chunkIndex: chunks.length + 1,
                    }
                });
                
                // Break if we've reached the end
                if (end === text.length) break;
            }
            
            log.info('Document chunked', { 
                documentId: document.id, 
                chunkCount: chunks.length 
            });
            
            return chunks;
        } catch (error) {
            log.error('Error chunking document', { documentId: document.id, error });
            // Return the original document if chunking fails
            return [document];
        }
    }
}
