/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { FastifyInstance } from 'fastify';
import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuid } from 'uuid';
import { log } from '../log';
import { LlmApiMode, LlmClients, llmGetModel } from '../llm';
import { dbCreateOrUpdate } from '../db/db';
import { CallSession, CallTranscript } from './callModels';
import { Timestamp } from 'firebase-admin/firestore';
import { utlNewId } from '../utl/utl';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';

// WebSocket clients mapped by userId
const clients: Map<string, WebSocket> = new Map();
// Active call sessions mapped by userId
const activeCalls: Map<string, {
    sessionId: string,
    startTime: Date,
    transcript: Array<{ role: 'user' | 'assistant', content: string }>,
    timerId?: NodeJS.Timeout
}> = new Map();

// System prompt for the AI therapist during voice calls
const VOICE_SYSTEM_PROMPT = `You are ReflectAI, an empathetic and qualified AI therapist with academic credentials in Clinical Psychology. You are having a voice conversation with the user.

Keep your responses concise, conversational, and natural for speech - typically 1-2 short sentences per response. Be direct and focused in your therapeutic approach.

THERAPEUTIC FRAMEWORKS:
- Cognitive Behavioral Therapy Tools (CBT): Help users identify and challenge negative thought patterns
- Dialectical Behavior Therapy (DBT): Focus on emotional regulation and mindfulness
- Solution-Focused Brief Therapy: Emphasize progress and solutions rather than problems
- Motivational Interviewing: Guide users toward positive behavioral change
- Person-Centered Therapy: Show unconditional positive regard and empathic understanding

RESPONSE GUIDELINES FOR VOICE:
- Speak naturally as if in conversation
- Use short, simple sentences that flow well in speech
- Show empathy in your tone and word choice
- Ask occasional questions to keep the conversation going
- Remember this is a real-time conversation, not text chat

IMPORTANT:
- Never prescribe medication or make medical diagnoses
- Maintain confidentiality and respect privacy
- For users in crisis, briefly provide appropriate resources
- Keep the conversation flowing naturally

Remember you are in a voice conversation limited to 30 seconds total. Be concise but helpful.`;

/**
 * Initialize WebSocket server for voice call functionality
 * @param fastifyServer - The Fastify server instance
 */
export function callWebsocketInit(fastifyServer: FastifyInstance): void {
    // Create WebSocket server
    const wss = new WebSocketServer({
        server: fastifyServer.server,
        path: '/reflect/api/call/ws'
    });

    // Handle WebSocket connections
    wss.on('connection', (ws: WebSocket, request) => {
        const userId = request.url?.split('?userId=')[1];

        if (!userId) {
            log.warn('WebSocket connection attempt without userId');
            ws.close(1008, 'User ID is required');
            return;
        }

        log.info('WebSocket connection established', { userId });
        clients.set(userId, ws);

        // Handle incoming messages (audio chunks from client)
        ws.on('message', async (message: Buffer) => {
            try {
                log.info('Received WebSocket message', { 
                    messageLength: message.length,
                    messageType: typeof message,
                    messagePreview: message.toString().substring(0, 100)
                });
                
                const msgData = JSON.parse(message.toString());
                
                log.info('Parsed WebSocket message', { 
                    type: msgData.type,
                    userId: msgData.userId || userId, // Use either the message userId or the connection userId
                    hasData: !!msgData
                });
                
                // Handle different message types
                switch (msgData.type) {
                    case 'start-call':
                        log.info('Processing start-call message', { userId });
                        await handleStartCall(userId, ws);
                        break;

                    case 'audio-chunk':
                        await handleAudioChunk(userId, msgData.audio, ws);
                        break;

                    case 'end-call':
                        await handleEndCall(userId, ws);
                        break;

                    case 'transcript':
                        await handleUserTranscript(userId, msgData.text, ws);
                        break;

                    default:
                        log.warn('Unknown message type received', { type: msgData.type });
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Unknown message type'
                        }));
                }
            } catch (error) {
                log.error('Error handling WebSocket message', { error, userId });
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Error processing message'
                }));
            }
        });

        // Handle client disconnection
        ws.on('close', async () => {
            log.info('WebSocket connection closed', { userId });

            // Clean up any active call
            if (activeCalls.has(userId)) {
                await handleEndCall(userId, ws);
            }

            clients.delete(userId);
        });

        // Handle errors
        ws.on('error', (error) => {
            log.error('WebSocket error', { error, userId });
            clients.delete(userId);
        });
    });

    log.info('Voice call WebSocket server initialized');
}

/**
 * Handle start call request from client
 * @param userId - User ID
 * @param ws - WebSocket connection
 */
async function handleStartCall(userId: string, ws: WebSocket): Promise<void> {
    try {
        // Check if user already has an active call
        if (activeCalls.has(userId)) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'You already have an active call'
            }));
            return;
        }

        // Create a new call session
        const sessionId = utlNewId('call');
        const startTime = new Date();
        const timestamp = Timestamp.fromDate(startTime);

        // Create call session in the database - only include required fields
        const callSessionData = {
            _id: sessionId,
            userId,
            startTime: timestamp,
            duration: 0,
            status: 'active' as const,
            updatedAt: timestamp
        };
        
        log.info('Creating call session', { sessionId, userId });
        
        try {
            await dbCreateOrUpdate(CallSession, sessionId, callSessionData);
            log.info('Call session created successfully', { sessionId });
        } catch (dbError) {
            log.error('Database error creating call session', { 
                error: dbError instanceof Error ? dbError.message : String(dbError),
                sessionId,
                userId
            });
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to create call session in database'
            }));
            return;
        }

        // Store active call data
        activeCalls.set(userId, {
            sessionId,
            startTime,
            transcript: []
        });

        // Set 30-second timer for the call
        const timerId = setTimeout(async () => {
            if (activeCalls.has(userId)) {
                await handleEndCall(userId, ws);
                ws.send(JSON.stringify({
                    type: 'call-timeout',
                    message: 'Call ended due to 30-second time limit'
                }));
            }
        }, 30000); // 30 seconds

        // Update active call with timer ID
        activeCalls.set(userId, {
            ...activeCalls.get(userId)!,
            timerId
        });

        // Send confirmation to client
        ws.send(JSON.stringify({
            type: 'call-started',
            sessionId,
            message: 'Call started successfully',
            maxDuration: 30 // 30 seconds
        }));

        // Send initial greeting from AI
        const greeting = "Hello, I'm your ReflectAI therapist. How can I help you today?";

        // Save AI greeting to transcript
        await saveTranscript(sessionId, userId, greeting, 'assistant');

        // Add to in-memory transcript
        if (activeCalls.has(userId)) {
            const callData = activeCalls.get(userId)!;
            callData.transcript.push({
                role: 'assistant',
                content: greeting
            });
            activeCalls.set(userId, callData);
        }

        // Send greeting to client
        ws.send(JSON.stringify({
            type: 'ai-response',
            text: greeting
        }));

        log.info('Call started', { userId, sessionId });
    } catch (error) {
        log.error('Error starting call', { error, userId });
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to start call'
        }));
    }
}

/**
 * Handle audio chunk from client
 * @param userId - User ID
 * @param audioData - Audio data (base64 encoded)
 * @param ws - WebSocket connection
 */
async function handleAudioChunk(userId: string, audioData: string, ws: WebSocket): Promise<void> {
    // This function would process audio chunks if we were handling audio conversion ourselves
    // Since we're using the model that already supports voice-to-voice, we'll mainly
    // rely on the transcript handling function instead

    // In a real implementation, we might:
    // 1. Buffer audio chunks
    // 2. Convert audio to text using a speech-to-text service
    // 3. Process the text with the AI model
    // 4. Convert the AI response to audio
    // 5. Send the audio back to the client

    // For now, we'll just log the receipt of audio data
    log.debug('Received audio chunk', { userId, dataLength: audioData.length });
}

/**
 * Handle user transcript from client
 * @param userId - User ID
 * @param text - User's transcribed text
 * @param ws - WebSocket connection
 */
async function handleUserTranscript(userId: string, text: string, ws: WebSocket): Promise<void> {
    try {
        // Check if user has an active call
        if (!activeCalls.has(userId)) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'No active call found'
            }));
            return;
        }

        const callData = activeCalls.get(userId)!;
        const { sessionId, transcript } = callData;

        // Save user message to transcript
        await saveTranscript(sessionId, userId, text, 'user');

        // Add to in-memory transcript
        transcript.push({
            role: 'user',
            content: text
        });

        log.info('User transcript received', { userId, text });

        // Process with AI and get response
        const aiResponse = await processAIResponse(userId, transcript);

        // Save AI response to transcript
        await saveTranscript(sessionId, userId, aiResponse, 'assistant');

        // Add to in-memory transcript
        transcript.push({
            role: 'assistant',
            content: aiResponse
        });

        // Update active call data
        activeCalls.set(userId, {
            ...callData,
            transcript
        });

        // Send AI response to client
        ws.send(JSON.stringify({
            type: 'ai-response',
            text: aiResponse
        }));

        log.info('AI response sent', { userId, aiResponse });
    } catch (error) {
        log.error('Error processing user transcript', { error, userId });
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to process your message'
        }));
    }
}

/**
 * Handle end call request from client
 * @param userId - User ID
 * @param ws - WebSocket connection
 */
async function handleEndCall(userId: string, ws: WebSocket): Promise<void> {
    try {
        // Check if user has an active call
        if (!activeCalls.has(userId)) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'No active call found'
            }));
            return;
        }

        const callData = activeCalls.get(userId)!;
        const { sessionId, startTime, timerId } = callData;

        // Clear the timer if it exists
        if (timerId) {
            clearTimeout(timerId);
        }

        // Calculate call duration
        const endTime = new Date();
        const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000); // in seconds

        // Update call session in the database
        await dbCreateOrUpdate(CallSession, sessionId, {
            _id: sessionId,
            userId,
            startTime: Timestamp.fromDate(startTime),
            endTime: Timestamp.fromDate(endTime),
            duration,
            status: 'completed',
            updatedAt: Timestamp.fromDate(new Date())
        });

        // Remove from active calls
        activeCalls.delete(userId);

        // Send confirmation to client
        ws.send(JSON.stringify({
            type: 'call-ended',
            sessionId,
            duration,
            message: 'Call ended successfully'
        }));

        log.info('Call ended', { userId, sessionId, duration });
    } catch (error) {
        log.error('Error ending call', { error, userId });
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to end call properly'
        }));

        // Remove from active calls anyway to prevent stuck calls
        activeCalls.delete(userId);
    }
}

/**
 * Process AI response based on conversation history
 * @param userId - User ID
 * @param transcript - Conversation transcript
 * @returns AI response text
 */
async function processAIResponse(
    userId: string,
    transcript: Array<{ role: 'user' | 'assistant', content: string }>
): Promise<string> {
    try {
        // Convert transcript to LangChain messages
        const messages = transcript.map(entry => {
            if (entry.role === 'user') {
                return new HumanMessage(entry.content);
            } else {
                return new AIMessage(entry.content);
            }
        });

        // Create the prompt template with system prompt and chat history
        const promptTemplate = ChatPromptTemplate.fromMessages([
            ['system', VOICE_SYSTEM_PROMPT],
            new MessagesPlaceholder('chat_history'),
        ]);

        // Get the voice model
        const llm = llmGetModel(LlmClients.REFLECT, LlmApiMode.REALTIME_VOICE);

        // Create the chain and generate response
        const chain = promptTemplate.pipe(llm);

        // Generate response
        const result = await chain.invoke({
            chat_history: messages
        });

        // Extract the response content
        return result.content.toString();
    } catch (error) {
        log.error('Error generating AI response', { error, userId });
        return "I'm sorry, I'm having trouble processing that right now. Could you try again?";
    }
}

/**
 * Save transcript entry to the database
 * @param sessionId - Call session ID
 * @param userId - User ID
 * @param content - Message content
 * @param role - Message role (user or assistant)
 */
async function saveTranscript(
    sessionId: string,
    userId: string,
    content: string,
    role: 'user' | 'assistant'
): Promise<void> {
    try {
        const transcriptId = utlNewId('trans');
        const timestamp = Timestamp.now();

        const transcript = new CallTranscript({
            transcriptId,
            sessionId,
            userId,
            content,
            role,
            timestamp
        });

        await dbCreateOrUpdate(CallTranscript, transcriptId, transcript, sessionId);

        log.debug('Transcript saved', { sessionId, role });
    } catch (error) {
        log.error('Error saving transcript', { error, sessionId, userId });
    }
}
