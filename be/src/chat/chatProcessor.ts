/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { BaseMessage, BaseMessageChunk } from '@langchain/core/messages';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { LlmApiMode, LlmClients, llmGetModel } from '../llm';
import { ChatMessage } from './chatModels';
import { log } from '../log/log';
import { EventEmitter } from 'events';
import { chatMemory } from './chatMemory';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../db/db';

// System prompt for the AI therapist
const SYSTEM_PROMPT = `You are ReflectAI, an empathetic and professional AI therapist. 
Your goal is to provide supportive, insightful responses to users seeking mental health guidance.

Guidelines:
- Respond with empathy and understanding
- Ask thoughtful questions to better understand the user's situation
- Offer perspective and gentle guidance when appropriate
- Never prescribe medication or make medical diagnoses
- Maintain a warm, professional tone
- Focus on evidence-based therapeutic approaches
- Respect user privacy and confidentiality
- If a user is in crisis or mentions self-harm, encourage them to seek immediate professional help

Remember that your role is to provide support, not replace professional mental health treatment.`;

// Create an event emitter for streaming responses
export const chatResponseEmitter = new EventEmitter();

/**
 * Process a user message and generate an AI response
 * @param sessionId The chat session ID
 * @param messages Array of chat messages in the conversation
 * @returns The AI response message
 */
export async function chatProcessMessage(sessionId: string, messages: ChatMessage[]): Promise<string> {
    try {
        // Get chat memory for LangChain message history
        const memory = await chatMemory(sessionId, sessionId);
        
        // Get history from memory
        const chatHistory = await memory.getMessages();
        
        // Find the last user message to process
        const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
        if (!lastUserMessage) {
            throw new Error('No user message found');
        }
        
        // Create a human message from the most recent user message
        const humanMessage = new HumanMessage(lastUserMessage.content);
        
        // Add the message to memory
        await memory.addMessage(humanMessage);

        // Get the LLM model
        const llm = llmGetModel(LlmClients.REFLECT, LlmApiMode.GPT_4O_JSON) as Runnable<any, BaseMessageChunk>;

        // Create the prompt template
        const promptTemplate = ChatPromptTemplate.fromMessages([
            ['system', SYSTEM_PROMPT],
            new MessagesPlaceholder('chat_history'),
        ]);

        // Create the chain
        const chain = promptTemplate.pipe(llm);

        // Variable to collect the streaming response
        let fullResponse = '';
        
        // Generate response with streaming
        const result = await chain.invoke({ 
            chat_history: chatHistory 
        }, {
            callbacks: [{
                handleLLMNewToken(token: string) {
                    fullResponse += token;
                    // Emit event with the new token, session ID, and full response so far
                    chatResponseEmitter.emit('token', {
                        sessionId,
                        token,
                        fullResponse
                    });
                }
            }]
        } as RunnableConfig);

        const finalResponse = result.content.toString();
        
        // Add AI response to memory
        await memory.addMessage(new AIMessage(finalResponse));
        
        // Emit completion event
        chatResponseEmitter.emit('complete', {
            sessionId,
            response: finalResponse
        });

        return finalResponse;
    } catch (error) {
        log.error('Error processing chat message', { sessionId, error });
        throw new Error('Failed to process message: ' + (error as Error).message);
    }
}

/**
 * Gets response from AI using LangChain, system prompt, and memory
 * @param userId User ID
 * @param message User's message
 * @returns AI response content
 */
export async function chatGetResponse(userId: string, message: string): Promise<string> {
    try {
        // Initialize chat memory
        const memory = await chatMemory(userId, userId);
        
        // Add the user message to memory
        const humanPromptInput = new HumanMessage(message);
        await memory.addMessage(humanPromptInput);
        
        // Get history from memory
        const chatHistory = await memory.getMessages();
        
        // Get the LLM model
        const llm = llmGetModel(LlmClients.REFLECT, LlmApiMode.GPT_4O_JSON) as Runnable<any, BaseMessageChunk>;
        
        // Create the prompt template with system prompt and chat history
        const promptTemplate = ChatPromptTemplate.fromMessages([
            ['system', SYSTEM_PROMPT],
            new MessagesPlaceholder('chat_history'),
        ]);
        
        // Create the chain
        const chain = promptTemplate.pipe(llm);
        
        // Variable to collect the streaming response
        let fullResponse = '';
        
        // Generate response with streaming
        const result = await chain.invoke({ 
            chat_history: chatHistory 
        }, {
            callbacks: [{
                handleLLMNewToken(token: string) {
                    fullResponse += token;
                    // Emit event with the new token, session ID, and full response so far
                    chatResponseEmitter.emit('token', {
                        sessionId: userId,
                        token,
                        fullResponse
                    });
                }
            }]
        } as RunnableConfig);
        
        const finalResponse = result.content.toString();
        
        // Add AI response to memory
        await memory.addMessage(new AIMessage(finalResponse));
        
        // Emit completion event
        chatResponseEmitter.emit('complete', {
            sessionId: userId,
            response: finalResponse
        });
        
        return finalResponse;
    } catch (error) {
        log.error('Error in chatGetResponse', { userId, error });
        throw new Error('Failed to get AI response: ' + (error as Error).message);
    }
}

/**
 * Saves an AI response message to the database
 * @param userId User ID
 * @param content Message content
 * @returns ChatMessage object that was saved
 */
export async function chatSaveAIResponse(userId: string, content: string): Promise<ChatMessage> {
    try {
        // Create AI message
        const aiMessage = new ChatMessage({
            sessionId: userId,
            content: content,
            role: 'assistant',
            userId,
            timestamp: Timestamp.now()
        });
        
        // Save message to database
        const aiMessageRef = db.collection(ChatMessage._collection(userId)).doc(aiMessage._documentId());
        await aiMessageRef.set(JSON.parse(JSON.stringify(aiMessage)));
        
        log.info('AI response saved', { userId });
        return aiMessage;
    } catch (error) {
        log.error('Error saving AI response', { userId, error });
        throw new Error('Failed to save AI response: ' + (error as Error).message);
    }
}

/**
 * Calculates an approximate token count for the message history
 * @param content The text content
 * @returns Approximate token count
 */
export function chatCalculateTokens(content: string): number {
    // A simple approximation: average of 4 characters per token
    return Math.ceil(content.length / 4);
}

/**
 * Limits the chat history to a reasonable token count
 * @param messages The full message history
 * @param maxTokens Maximum number of tokens to allow (default: 4000)
 * @returns Trimmed message history
 */
export function chatLimitMessageHistory(messages: ChatMessage[], maxTokens: number = 4000): ChatMessage[] {
    // Start with the most recent messages and work backwards
    const reversedMessages = [...messages].reverse();
    const result: ChatMessage[] = [];
    let totalTokens = 0;
    
    for (const message of reversedMessages) {
        const messageTokens = chatCalculateTokens(message.content);
        
        // If adding this message would exceed the limit, stop
        if (totalTokens + messageTokens > maxTokens) {
            break;
        }
        
        // Add message to result and update token count
        result.unshift(message); // Add to beginning to maintain chronological order
        totalTokens += messageTokens;
    }
    
    return result;
}
