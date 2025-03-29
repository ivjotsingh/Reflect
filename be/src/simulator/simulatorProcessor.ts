/*
 * ReflectAI - Life Simulator Controller
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { log } from '../log';
import { llmGetModel } from '../llm/llm';
import { LlmApiMode, LlmClients } from '../llm/llmConstants';
import { db, dbCreateOrUpdate, dbGetById } from '../db/db';
import { Timestamp } from 'firebase-admin/firestore';
import { utlNewId } from '../utl/utl';
import {
  StoryChoice,
  StoryScenario,
  StorySession,
  StoryScenarioDocument,
  StoryInsights
} from './simulatorModels';
import { chatMemory } from '../chat/chatMemory';

// Default emotional profile for fallback scenarios
const DEFAULT_EMOTIONAL_PROFILE: Record<string, number> = {
  'Neutral': 3,
  'Curious': 2,
  'Hopeful': 2,
  'Reflective': 1
};

// Request and param types
export interface GenerateStoryRequest {
  Body: {
    dilemma: string;
    userId: string;
  }
}

export interface MakeChoiceRequest {
  Body: {
    sessionId: string;
    choiceId: string;
  }
}

export interface GetInsightsRequest {
  Params: {
    sessionId: string;
  }
}

/**
 * Generate an emotional profile based on a user's chat history
 * @param userId The user ID
 * @returns A record of emotions and their intensity levels
 */
export async function generateEmotionalProfile(userId: string): Promise<Record<string, number>> {
  try {
    // Get user's chat history
    const memory = await chatMemory(userId);
    const messages = await memory.getMessages();

    if (messages.length === 0) {
      log.info('No chat history found for user', { userId });
      return { ...DEFAULT_EMOTIONAL_PROFILE };
    }

    // Convert messages to format suitable for LLM analysis
    const chatHistory = messages.map(msg => ({
      role: msg._getType() === 'human' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Get the LLM model
    const model = llmGetModel(LlmClients.REFLECT, LlmApiMode.OPENAI_JSON);

    // Create prompt for emotional profile analysis
    const analysisPrompt = [
      {
        role: 'system',
        content: `You are an emotional intelligence expert analyzing a user's chat history with a therapy AI.
        Based on their messages, identify the primary emotions they're experiencing and their intensity.
        
        Return a JSON object with emotion names as keys and intensity values (1-5) as values.
        Include 4-6 relevant emotions.
        
        Example format:
        {
          "Anxious": 4,
          "Hopeful": 2,
          "Frustrated": 3,
          "Curious": 3,
          "Determined": 2
        }
        
        Important instructions:
        1. Provide only clean JSON without any extra text, comments, or markdown formatting
        2. Do not include any blank lines or extra spaces in your response
        3. Focus on emotions that would be relevant for simulator scenarios`
      },
      {
        role: 'user',
        content: `Analyze these recent user messages and generate an emotional profile:
        
        ${JSON.stringify(chatHistory.slice(-10))}`
      }
    ];

    // Generate the emotional profile
    const response = await model.invoke(analysisPrompt);

    let emotionalProfile: Record<string, number>;
    try {
      // Since we're now using ChatOpenAI consistently, we can safely access content
      const content = response.content.toString();

      // Clean up excessive blank lines and spaces that could interfere with JSON parsing
      const cleanedContent = content.replace(/(\n\s*){3,}/g, '\n\n').trim();

      emotionalProfile = JSON.parse(cleanedContent);

      // Validate the profile has proper format
      if (Object.keys(emotionalProfile).length === 0) {
        throw new Error('Empty emotional profile generated');
      }

      // Ensure values are numbers between 1-5
      for (const [emotion, intensity] of Object.entries(emotionalProfile)) {
        if (typeof intensity !== 'number' || intensity < 1 || intensity > 5) {
          emotionalProfile[emotion] = Math.max(1, Math.min(5, parseInt(intensity.toString()) || 3));
        }
      }

    } catch (error) {
      log.error('Failed to parse emotional profile response', { error, content: response.content.toString() });
      // Return the default profile
      return { ...DEFAULT_EMOTIONAL_PROFILE };
    }

    return emotionalProfile;
  } catch (error) {
    log.error('Error generating emotional profile', { error, userId });
    return { ...DEFAULT_EMOTIONAL_PROFILE };
  }
}
