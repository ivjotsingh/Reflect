/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { ChatOpenAI, ChatOpenAICallOptions } from '@langchain/openai';
import { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import { BaseMessageChunk } from '@langchain/core/messages';
import { conf } from '../conf';
import { LlmApiMode, LlmClients } from './llmConstants';
import { Runnable } from '@langchain/core/runnables';
import { log } from '../log';

// Will be initialized during llmInit
export let llmOpenAiModels: Record<
    LlmClients,
    Record<
        LlmApiMode,
        Runnable<BaseLanguageModelInput, BaseMessageChunk, ChatOpenAICallOptions>
        | null
    >
> = {
    [LlmClients.REFLECT]: {
        [LlmApiMode.OPENAI_JSON]: null,
        [LlmApiMode.GPT_4O_JSON]: null,
        [LlmApiMode.REALTIME_VOICE]: null,
    }
};

export async function llmInit() {
    await llmInitOpenAiModels();
    log.info('LLM module initialized successfully');
}

async function llmInitOpenAiModels() {
    try {
        // Standard GPT model with JSON output format
        const reflectOpenAINormalMode = new ChatOpenAI({
            modelName: 'gpt-4o-mini-2024-07-18',
            maxTokens: 800,
            openAIApiKey: conf.env.credentials.openAIAPIKey,
            temperature: 0.3, // Lower temperature for more consistent therapy responses
            verbose: true,
        });

        const reflectOpenAIJsonMode = reflectOpenAINormalMode.bind({
            response_format: {
                type: 'json_object',
            }
        });
        llmOpenAiModels[LlmClients.REFLECT][LlmApiMode.OPENAI_JSON] = reflectOpenAIJsonMode;

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
        });

        llmOpenAiModels[LlmClients.REFLECT][LlmApiMode.REALTIME_VOICE] = reflectRealtimeVoice;

        log.info('OpenAI models initialized successfully');
    } catch (err) {
        log.error('Failed to initialize OpenAI models', { err });
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
