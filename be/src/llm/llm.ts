/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { ChatOpenAI, ChatOpenAICallOptions } from '@langchain/openai';
import { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import { BaseMessageChunk, SystemMessage } from '@langchain/core/messages';
import { conf } from '../conf';
import { LlmApiMode, LlmClients } from './llmConstants';
import { Runnable } from '@langchain/core/runnables';
import { log } from '../log';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

// Define a more generic type for different model clients
export type LlmModel = Runnable<BaseLanguageModelInput, BaseMessageChunk>;

// Will be initialized during llmInit
export let llmOpenAiModels: Record<
    LlmClients,
    Record<
        LlmApiMode,
        LlmModel | null
    >
> = {
    [LlmClients.REFLECT]: {
        [LlmApiMode.GPT_4O_MINI_JSON]: null,
        [LlmApiMode.GPT_4O_JSON]: null,
        [LlmApiMode.REALTIME_VOICE]: null,
        [LlmApiMode.GEMINI_JSON]: null,
    }
};

export async function llmInit() {
    await llmInitOpenAiModels();
    log.info('LLM module initialized successfully');
}

async function llmInitOpenAiModels() {
    try {
        // Standard GPT model with JSON output format
        const reflectGpt4oMini = new ChatOpenAI({
            modelName: 'gpt-4o-mini-2024-07-18',
            maxTokens: 800,
            openAIApiKey: conf.env.credentials.openAIAPIKey,
            temperature: 0.3, // Lower temperature for more consistent therapy responses
            presencePenalty: 0.2, // Slight presence penalty for more diverse responses
            frequencyPenalty: 0.3, // Discourage repetitiveness in therapy
            verbose: true,
        });

        const reflectGpt4oMiniJsonMode = reflectGpt4oMini.bind({
            response_format: {
                type: 'json_object',
            }
        });
        llmOpenAiModels[LlmClients.REFLECT][LlmApiMode.GPT_4O_MINI_JSON] = reflectGpt4oMiniJsonMode;

        // GPT-4o model with JSON output format
        const reflectGpt4o = new ChatOpenAI({
            modelName: 'gpt-4o',
            maxTokens: 1000,
            openAIApiKey: conf.env.credentials.openAIAPIKey,
            temperature: 0.3, // Lower temperature for more consistent therapy responses
            verbose: true,
            presencePenalty: 0.2, // Slight presence penalty for more diverse responses
            frequencyPenalty: 0.3, // Discourage repetitiveness in therapy
        });

        const reflectGpt4oJson = reflectGpt4o.bind({
            response_format: {
                type: 'json_object',
            }
        });
        llmOpenAiModels[LlmClients.REFLECT][LlmApiMode.GPT_4O_JSON] = reflectGpt4oJson;

        // Real-time voice model for voice calling feature
        // Using a different model that is compatible with voice applications
        const reflectRealtimeVoice = new ChatOpenAI({
            // modelName: 'gpt-4o-mini-realtime-preview-2024-12-17', // Using a standard chat model instead of the realtime preview
            modelName: 'gpt-4o-mini-2024-07-18', // Using a standard chat model instead of the realtime preview
            maxTokens: 400, // Smaller tokens for faster responses
            openAIApiKey: conf.env.credentials.openAIAPIKey,
            temperature: 0.3, // Lower temperature for more consistent therapy responses
            verbose: true,
            presencePenalty: 0.2, // Slight presence penalty for more diverse responses
            frequencyPenalty: 0.3, // Discourage repetitiveness in therapy
        });

        llmOpenAiModels[LlmClients.REFLECT][LlmApiMode.REALTIME_VOICE] = reflectRealtimeVoice;

        // Initialize Gemini 2.5 Pro model with JSON output format
        const reflectGemini = new ChatGoogleGenerativeAI({
            modelName: 'gemini-2.5-pro-exp-03-25',
            maxOutputTokens: 1000,
            apiKey: conf.env.credentials.googleAIAPIKey,
            temperature: 0.3, // Lower temperature for more consistent therapy responses
            verbose: true,
            // Using string literals for safety settings as the exact enum values 
            // may change in different versions of the library
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_ONLY_HIGH",
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_ONLY_HIGH",
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_ONLY_HIGH",
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_ONLY_HIGH",
                }
            ] as any, // Type assertion to bypass type checking for safety settings
        });

        // Note: For Gemini, JSON mode is handled through the createSystemMessage utility
        llmOpenAiModels[LlmClients.REFLECT][LlmApiMode.GEMINI_JSON] = reflectGemini;

        log.info('OpenAI and Gemini models initialized successfully');
    } catch (err) {
        log.error('Failed to initialize LLM models', { err });
        throw err;
    }
}

// Helper function to get an initialized model
export function llmGetModel(client: LlmClients, mode: LlmApiMode) {
    const model = llmOpenAiModels[client][mode];
    if (!model) {
        throw new Error(`Model not initialized for client ${client} and mode ${mode}`);
    }
    return model;
}
