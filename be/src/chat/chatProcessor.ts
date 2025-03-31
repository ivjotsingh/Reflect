/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { AIMessage, BaseMessage, BaseMessageChunk, HumanMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { Runnable } from '@langchain/core/runnables';
import { LlmApiMode, LlmClients, llmGetModel } from '../llm';
import { ChatMessage } from './chatModels';
import { db, dbCreateOrUpdate, dbTimestamp } from '../db/db';
import { log } from '../log/log';
import { chatMemory } from './chatMemory';
import { Timestamp } from 'firebase-admin/firestore';
import { utlNewId } from '../utl/utl';
import { RagService } from '../rag/ragService';

// System prompt for the AI therapist
const SYSTEM_PROMPT = `You are ReflectAI, an empathetic and qualified AI therapist with academic credentials in Clinical Psychology. You provide concise, helpful responses to users seeking mental health guidance.

Keep your responses brief but impactful - typically 2-3 short paragraphs maximum. Be direct and focused in your therapeutic approach.

THERAPEUTIC FRAMEWORKS:
- Cognitive Behavioral Therapy Tools (CBT): Help users identify and challenge negative thought patterns
- Dialectical Behavior Therapy (DBT): Focus on emotional regulation and mindfulness
- Solution-Focused Brief Therapy: Emphasize progress and solutions rather than problems
- Motivational Interviewing: Guide users toward positive behavioral change
- Person-Centered Therapy: Show unconditional positive regard and empathic understanding

RESPONSE STRUCTURE:
1. Brief acknowledgment of the user's feelings/situation (1 sentence)
2. Therapeutic insight or reframing of their challenge (1-2 sentences)
3. Practical suggestion or technique they can apply (1-2 sentences)
4. One thoughtful question to continue the conversation (when appropriate)

Guidelines:
- Show empathy while being concise and to the point
- Ask one thoughtful question per response when appropriate
- Use evidence-based therapeutic techniques in a straightforward manner
- Never prescribe medication or make medical diagnoses
- Maintain confidentiality and respect privacy
- For users in crisis, briefly provide appropriate resources

IMPORTANT RESPONSE FORMAT:
\n\nIMPORTANT: Your response must be in valid JSON format without any additional text. The JSON should be directly parseable by JavaScript's JSON.parse() function."
Your responses MUST be structured as valid JSON with a single field named "message" that contains your complete therapeutic response as plain text.

DO NOT include any nested objects or additional fields in your response. Your entire therapeutic message should be a simple string in the message field.

CRITICAL FORMATTING INSTRUCTIONS:
1. Do not include any blank lines or excessive spaces in your response
2. Ensure your response is clean, properly formatted JSON without any extra text
3. Avoid adding any markdown, comments, or non-JSON elements

Remember to prioritize brevity while still providing supportive guidance.`;

/**
 * User context management - tracks themes and concerns across the session
 */
interface UserContext {
    primaryConcerns: string[];
    emotionalState: string;
    therapyGoals: string[];
    lastSessionSummary?: string;
    sessionThemes: string[];
}

// In-memory cache of user contexts (in production, should be stored in database)
const userContextCache: Record<string, UserContext> = {};

/**
 * Gets response from AI using LangChain, system prompt, and memory
 * @param userId User Name
 * @param message User's message
 * @returns AI response content
 */
export async function chatGetResponse(userId: string, message: string): Promise<string> {
    try {
        // Initialize chat memory
        const memory = await chatMemory(userId);

        // Add the user message to memory - for user messages, content and message are the same
        const humanPromptInput = new HumanMessage(message);
        await memory.addMessage(humanPromptInput);

        // Get history from memory
        const chatHistory = await memory.getMessages();

        // Initialize or update user context
        if (!userContextCache[userId]) {
            userContextCache[userId] = {
                primaryConcerns: [],
                emotionalState: "unknown",
                therapyGoals: [],
                sessionThemes: []
            };
        }

        // Update context based on current message
        await updateUserContext(userId, message, chatHistory);

        // Get the LLM model and create the chain
        const llmMode = LlmApiMode.GPT_4O_MINI_JSON;

        // Create a context prompt with user-specific information
        const contextPrompt = await generateContextPrompt(userId, message);

        // Create the prompt template with system prompt, context, and chat history
        const promptTemplate = ChatPromptTemplate.fromMessages([
            ['system', SYSTEM_PROMPT],
            ['system', contextPrompt],
            new MessagesPlaceholder('chat_history'),
        ]);

        // Get the LLM model and create the chain
        const llm = llmGetModel(LlmClients.REFLECT, llmMode) as Runnable<any, BaseMessageChunk>;
        const chain = promptTemplate.pipe(llm);

        // Generate response
        const result = await chain.invoke({
            chat_history: chatHistory
        });

        // Extract the raw response (will be stored in content field)
        let rawResponse = result.content.toString();

        // Clean up excessive blank lines and spaces
        rawResponse = rawResponse.replace(/(\n\s*){3,}/g, '\n\n').trim();

        // Default to raw response for message field
        let finalResponse = rawResponse;

        try {
            // Parse any JSON in the response
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonObj = JSON.parse(jsonMatch[0]);

                // Handle the therapy-specific response structure from JSON mode
                if (jsonObj.message) {
                    // If the message is itself an object with a nested message field (the complex structure)
                    if (typeof jsonObj.message === 'object' && jsonObj.message !== null) {
                        // Extract just the plain text message field if it exists
                        if (jsonObj.message.message && typeof jsonObj.message.message === 'string') {
                            finalResponse = jsonObj.message.message;
                        }
                    } else if (typeof jsonObj.message === 'string') {
                        // Direct message string
                        finalResponse = jsonObj.message;
                    }
                } else if (jsonObj.response) {
                    finalResponse = jsonObj.response;
                } else if (jsonObj.content) {
                    finalResponse = jsonObj.content;
                } else if (jsonObj.reply) {
                    finalResponse = jsonObj.reply;
                } else {
                    // If we can't find expected fields, use the first string value
                    for (const key of Object.keys(jsonObj)) {
                        const value = jsonObj[key];
                        // If we find a field named 'message' that's a string, use it
                        if (key === 'message' && typeof value === 'string') {
                            finalResponse = value;
                            break;
                        }
                        // Otherwise, take the first string value we find
                        if (typeof value === 'string') {
                            finalResponse = value;
                            break;
                        }
                    }
                }
            }
        } catch (parseError) {
            log.warn('Failed to parse JSON response, using raw content', { userId, parseError });
            // Fallback to the raw content if JSON parsing fails
        }

        // Create a custom message document
        const chatId = utlNewId('chat');
        const timestamp = Timestamp.now();

        // For AI response, store raw JSON in content and parsed message in message field
        await dbCreateOrUpdate(
            ChatMessage,
            chatId,
            {
                chatId,                  // Add chatId field
                sessionId: userId,
                userId,
                role: 'assistant' as const,  // Use const assertion to fix type error
                content: rawResponse,     // Store raw JSON here
                message: finalResponse,   // Store human-readable message here
                timestamp: timestamp,
                updatedAt: timestamp      // Add updatedAt field
            },
            userId  // Use userId as parentId (session ID)
        );

        return finalResponse;
    } catch (error) {
        log.error('Error in chatGetResponse', { userId, error });
        throw new Error('Failed to get AI response: ' + (error as Error).message);
    }
}

/**
 * Analyzes user message and chat history to update user context
 * @param userId User Name 
 * @param message Current message
 * @param chatHistory Chat history
 */
async function updateUserContext(userId: string, message: string, chatHistory: BaseMessage[]): Promise<void> {
    try {
        const context = userContextCache[userId];

        // Simple keyword-based analysis for emotions
        const emotionKeywords = {
            "anxious": ["anxiety", "anxious", "nervous", "worry", "stressed"],
            "depressed": ["depressed", "sad", "down", "hopeless", "unmotivated"],
            "angry": ["angry", "frustrated", "mad", "irritated", "annoyed"],
            "happy": ["happy", "joy", "excited", "pleased", "content"],
            "confused": ["confused", "uncertain", "unsure", "don't know"]
        };

        let detectedEmotions: string[] = [];

        // Check for emotion keywords in the current message
        Object.entries(emotionKeywords).forEach(([emotion, keywords]) => {
            if (keywords.some(keyword => message.toLowerCase().includes(keyword))) {
                detectedEmotions.push(emotion);
            }
        });

        if (detectedEmotions.length > 0) {
            context.emotionalState = detectedEmotions[0]; // Use first detected emotion
        }

        // Extract potential concerns (simple implementation)
        const concernPhrases = ["worried about", "concerned about", "struggle with", "problem with", "issue with"];
        concernPhrases.forEach(phrase => {
            const regex = new RegExp(`${phrase} ([^.!?]+)`, 'i');
            const match = message.match(regex);
            if (match && match[1]) {
                const concern = match[1].trim();
                if (!context.primaryConcerns.includes(concern)) {
                    context.primaryConcerns.push(concern);
                    // Keep only the 3 most recent concerns
                    if (context.primaryConcerns.length > 3) {
                        context.primaryConcerns.shift();
                    }
                }
            }
        });

        // Extract therapy goals
        const goalPhrases = ["want to", "goal is", "trying to", "would like to", "hope to"];
        goalPhrases.forEach(phrase => {
            const regex = new RegExp(`${phrase} ([^.!?]+)`, 'i');
            const match = message.match(regex);
            if (match && match[1]) {
                const goal = match[1].trim();
                if (!context.therapyGoals.includes(goal)) {
                    context.therapyGoals.push(goal);
                    // Keep only the 3 most recent goals
                    if (context.therapyGoals.length > 3) {
                        context.therapyGoals.shift();
                    }
                }
            }
        });

        // Update session themes
        const commonThemes = ["work", "family", "relationship", "health", "anxiety",
            "depression", "stress", "sleep", "motivation", "confidence"];

        commonThemes.forEach(theme => {
            if (message.toLowerCase().includes(theme) && !context.sessionThemes.includes(theme)) {
                context.sessionThemes.push(theme);
            }
        });
    } catch (error) {
        log.error('Error updating user context', { userId, error });
        // If context update fails, we can continue without it
    }
}

/**
 * Generates a personalized context prompt based on user's history
 * @param userId User Name
 * @param message Current message
 * @returns Context prompt string
 */
async function generateContextPrompt(userId: string, message?: string): Promise<string> {
    try {
        const context = userContextCache[userId];
        if (!context) return "";

        let contextPrompt = "USER CONTEXT:\n";

        // Add emotional state if known
        if (context.emotionalState && context.emotionalState !== "unknown") {
            contextPrompt += `The user appears to be feeling ${context.emotionalState}. `;
        }

        // Add primary concerns if available
        if (context.primaryConcerns.length > 0) {
            contextPrompt += `Their primary concerns include: ${context.primaryConcerns.join(", ")}. `;
        }

        // Add therapy goals if available
        if (context.therapyGoals.length > 0) {
            contextPrompt += `Their therapy goals include: ${context.therapyGoals.join(", ")}. `;
        }

        // Add session themes if available
        if (context.sessionThemes.length > 0) {
            contextPrompt += `Common themes in their discussions: ${context.sessionThemes.join(", ")}. `;
        }

        contextPrompt += "\nUse this context to provide more personalized and relevant therapeutic guidance, but do not explicitly reference this information in your response.";

        // Get relevant information from the RAG system if a message is provided
        if (message) {
            // Use the RAG service to retrieve contextually relevant information
            const ragService = RagService.getInstance();

            // Initialize the RAG service if not already initialized - this is async but we'll await it later
            const ragPromise = (async () => {
                try {
                    await ragService.initialize();
                    const relevantContext = await ragService.generateRelevantContext(message);
                    console.log("Relevant context:", relevantContext);

                    // Add RAG context if available
                    if (relevantContext) {
                        contextPrompt += "\n\n" + relevantContext;
                    }

                    return contextPrompt;
                } catch (error) {
                    log.error('Error retrieving RAG context', { userId, error });
                    return contextPrompt; // Return the user context without RAG if there's an error
                }
            })();

            // Since we need to return a string immediately but the RAG operation is async,
            // we'll return a promise that will resolve to the full context string
            return await ragPromise;
        }

        return contextPrompt;
    } catch (error) {
        log.error('Error generating context prompt', { userId, error });
        return ""; // Return empty string if context generation fails
    }
}

/**
 * Saves an AI response message to the database
 * @param userId User Name
 * @param content Message content
 * @returns ChatMessage object that was saved
 */
export async function chatSaveAIResponse(userId: string, content: string): Promise<ChatMessage> {
    try {
        // Create a chat message document
        const chatId = utlNewId('chat');
        const timestamp = Timestamp.now();

        // For AI messages, extract the message from the content if it's JSON
        let message = content;

        try {
            // Check if the content is JSON and extract the message field
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonObj = JSON.parse(jsonMatch[0]);

                // Handle the therapy-specific response structure
                if (jsonObj.message) {
                    // If the message is itself an object with a nested message field
                    if (typeof jsonObj.message === 'object' && jsonObj.message !== null) {
                        // Extract just the plain text message field if it exists
                        if (jsonObj.message.message && typeof jsonObj.message.message === 'string') {
                            message = jsonObj.message.message;
                        }
                    } else if (typeof jsonObj.message === 'string') {
                        // Direct message string
                        message = jsonObj.message;
                    }
                }
            }
        } catch (parseError) {
            // Silent fail - just use the raw content if parsing fails
            // No need to log this as it's an expected case sometimes
        }

        // Create the chat message document with both content and message fields
        const chatMessageData = {
            chatId,
            sessionId: userId,
            userId,
            role: 'assistant' as const,  // Use const assertion to fix type error
            content: content,        // Store raw JSON/content here
            message: message,        // Store human-readable message here
            timestamp: timestamp,
            updatedAt: timestamp
        };

        // Save to Firestore
        await dbCreateOrUpdate(
            ChatMessage,
            chatId,
            chatMessageData,
            userId  // Use userId as parentId (session ID)
        );

        // Return the created message
        return new ChatMessage(chatMessageData);
    } catch (error) {
        log.error('Error in chatSaveAIResponse', { userId, error });
        throw new Error('Failed to save AI response: ' + (error as Error).message);
    }
}

/**
 * Calculates an approximate token count for the message history
 * @param content The text content
 * @returns Approximate token count
 */
export function chatCalculateTokens(content: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(content.length / 4);
}

/**
 * Limits the chat history to a reasonable token count
 * @param messages The full message history
 * @param maxTokens Maximum number of tokens to allow (default: 4000)
 * @returns Trimmed message history
 */
export function chatLimitMessageHistory(messages: ChatMessage[], maxTokens: number = 4000): ChatMessage[] {
    // Sort messages by timestamp (oldest first)
    const sortedMessages = [...messages].sort((a, b) =>
        a.timestamp.toMillis() - b.timestamp.toMillis()
    );

    let totalTokens = 0;
    const keptMessages: ChatMessage[] = [];

    // Process from newest to oldest
    for (let i = sortedMessages.length - 1; i >= 0; i--) {
        const message = sortedMessages[i];
        const messageTokens = chatCalculateTokens(message.content);

        // Always keep the most recent message
        if (i === sortedMessages.length - 1 || totalTokens + messageTokens <= maxTokens) {
            keptMessages.unshift(message); // Add to start of array to maintain chronological order
            totalTokens += messageTokens;
        } else {
            break; // Stop once we exceed token limit
        }
    }

    return keptMessages;
}
