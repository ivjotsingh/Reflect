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
        3. Focus on emotions that would be relevant for storytelling scenarios`
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
      // Handle the response content which might be a string or complex object
      let content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      // Clean up excessive blank lines and spaces that could interfere with JSON parsing
      content = content.replace(/(\n\s*){3,}/g, '\n\n').trim();

      emotionalProfile = JSON.parse(content);

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
      log.error('Failed to parse emotional profile response', { error, content: response.content });
      // Return the default profile
      return { ...DEFAULT_EMOTIONAL_PROFILE };
    }

    return emotionalProfile;
  } catch (error) {
    log.error('Error generating emotional profile', { error, userId });
    return { ...DEFAULT_EMOTIONAL_PROFILE };
  }
}

/**
 * Generate a new interactive story based on user input
 */
export const generateStory = async (
  request: FastifyRequest<GenerateStoryRequest>,
  reply: FastifyReply
) => {
  try {
    const { dilemma, userId } = request.body;

    // Check if we have either a dilemma or userId
    if (!dilemma || !userId) {
      return reply.status(400).send({
        error: 'Dilemma and userId must be provided'
      });
    }

    log.info('Generating emotional profile from chat history', { userId });
    const userEmotionalProfile = await generateEmotionalProfile(userId);

    const sessionId = utlNewId('story');

    // Use GPT-4o for generating rich, nuanced stories
    const model = llmGetModel(LlmClients.REFLECT, LlmApiMode.GPT_4O_JSON);

    // Create prompt for story generation
    const storyPrompt = [
      {
        role: 'system',
        content: `You are an AI storyteller for ReflectAI's therapeutic interactive simulator platform. 
        Create an emotional and engaging interactive story based on the provided dilemma.
        Your story should help users navigate emotional situations and gain insights about their responses.
        Include a title and a first story scenario with 3-4 choices that reflect different emotional responses.
        For each choice, provide an emotional label (e.g., "Anxious", "Confident", "Empathetic").
        
        Format your response as a JSON object with the following structure:
        {
          "title": "Story Title",
          "firstScenario": {
            "content": "Story introduction text...",
            "imagePrompt": "Brief description for image generation",
            "choices": [
              { "text": "Choice text", "emotionalResponse": "Emotion" },
              { "text": "Choice text", "emotionalResponse": "Emotion" },
              { "text": "Choice text", "emotionalResponse": "Emotion" }
            ]
          }
        }
        
        Important instructions:
        1. Provide only clean JSON without any extra text, comments, or markdown formatting
        2. Do not include any blank lines or extra spaces in your response
        3. Make sure your response is valid JSON that can be parsed without errors`
      }
    ];

    // Add emotional profile context if available
    if (userEmotionalProfile && Object.keys(userEmotionalProfile).length > 0) {
      const emotionalContext = {
        role: 'system',
        content: `The user's current emotional profile is: ${JSON.stringify(userEmotionalProfile)}
        
        Create a story that resonates with these emotions and offers choices that would be meaningful for someone
        experiencing these feelings. One of the choices should align with their dominant emotion,
        while others should offer alternative perspectives or coping mechanisms.`
      };

      storyPrompt.push(emotionalContext);
    }

    // Add the user dilemma or request a generated one
    storyPrompt.push({
      role: 'user',
      content: dilemma
        ? `Create an interactive story for this dilemma: ${dilemma}`
        : `Generate an interactive story about a common life dilemma that would resonate with someone experiencing these emotions: ${JSON.stringify(userEmotionalProfile)}`
    });

    // Generate the initial story
    const response = await model.invoke(storyPrompt);

    let storyData;
    try {
      // Handle the response content which might be a string or complex object
      let content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      // Clean up excessive blank lines and spaces that could interfere with JSON parsing
      content = content.replace(/(\n\s*){3,}/g, '\n\n').trim();

      storyData = JSON.parse(content);
    } catch (error) {
      log.error('Failed to parse story generation response', { error, content: response.content });
      return reply.status(500).send({ error: 'Failed to generate story' });
    }

    // Create the first scenario with a unique ID
    const firstScenarioId = utlNewId('scenario');
    const choices = storyData.firstScenario.choices.map((choice: any) => ({
      id: utlNewId('choice'),
      text: choice.text,
      emotionalResponse: choice.emotionalResponse
    }));

    // Create a new session in the database
    const timestamp = Timestamp.now();
    const newSession = new StorySession({
      sessionId,
      title: storyData.title,
      dilemma: dilemma || 'Generated dilemma',
      currentScenarioId: firstScenarioId,
      path: [firstScenarioId],
      emotionalProfile: userEmotionalProfile || {},
      createdAt: timestamp,
      lastActive: timestamp,
      userId: userId || 'anonymous'
    });

    await dbCreateOrUpdate(StorySession, sessionId, newSession);

    // Create the first scenario in the database
    const firstScenario = new StoryScenarioDocument({
      scenarioId: firstScenarioId,
      sessionId,
      content: storyData.firstScenario.content,
      imagePrompt: storyData.firstScenario.imagePrompt,
      choices,
      createdAt: timestamp
    });

    await dbCreateOrUpdate(StoryScenarioDocument, firstScenarioId, firstScenario, sessionId);

    // Return the initial story
    return reply.status(200).send({
      sessionId,
      title: storyData.title,
      currentScenario: firstScenario.toStoryScenario()
    });
  } catch (error) {
    log.error('Error generating story', { error });
    return reply.status(500).send({ error: 'Failed to generate story' });
  }
};

/**
 * Process a user's choice in the story
 */
export const makeChoice = async (
  request: FastifyRequest<MakeChoiceRequest>,
  reply: FastifyReply
) => {
  try {
    const { sessionId, choiceId } = request.body;

    // Get the session
    const session = await dbGetById(null, StorySession, sessionId);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    // Get the current scenario
    const currentScenario = await dbGetById(null, StoryScenarioDocument, session.currentScenarioId, sessionId);
    if (!currentScenario) {
      return reply.status(404).send({ error: 'Current scenario not found' });
    }

    // Find the selected choice
    const selectedChoice = currentScenario.choices?.find(choice => choice.id === choiceId);
    if (!selectedChoice) {
      return reply.status(404).send({ error: 'Choice not found' });
    }

    // Update emotional profile
    const emotion = selectedChoice.emotionalResponse;
    session.emotionalProfile[emotion] = (session.emotionalProfile[emotion] || 0) + 1;
    session.lastActive = Timestamp.now();

    // If the choice already has a next scenario, use it
    if (selectedChoice.nextScenarioId) {
      const nextScenario = await dbGetById(null, StoryScenarioDocument, selectedChoice.nextScenarioId, sessionId);
      if (nextScenario) {
        session.currentScenarioId = selectedChoice.nextScenarioId;
        session.path.push(selectedChoice.nextScenarioId);

        // Update the session
        await dbCreateOrUpdate(StorySession, sessionId, session);

        return reply.status(200).send({
          nextScenario: nextScenario.toStoryScenario(),
          emotionalProfile: session.emotionalProfile
        });
      }
    }

    // Otherwise, generate the next scenario
    const model = llmGetModel(LlmClients.REFLECT, LlmApiMode.GPT_4O_JSON);

    const messages = [
      {
        role: 'system',
        content: `You are an AI storyteller for ReflectAI's therapeutic interactive simulator platform.
        Continue the interactive story based on the user's choice.
        The story is about the following dilemma: ${session.dilemma}
        The user has chosen a response that reflects a "${selectedChoice.emotionalResponse}" emotional state.
        Create the next story scenario with 3-4 new choices that reflect different emotional responses,
        or an ending with feedback if the story should conclude.
        Format your response as a JSON object with the following structure:
        {
          "content": "Next part of the story based on the user's choice...",
          "imagePrompt": "Brief description for image generation",
          "isEnding": false,
          "choices": [
            { "text": "Choice text", "emotionalResponse": "Emotion" },
            { "text": "Choice text", "emotionalResponse": "Emotion" },
            { "text": "Choice text", "emotionalResponse": "Emotion" }
          ]
        }
        If this should be an ending scenario, use:
        {
          "content": "Conclusion of the story...",
          "imagePrompt": "Brief description for image generation",
          "isEnding": true,
          "feedback": "Brief feedback on the path chosen"
        }`
      },
      {
        role: 'user',
        content: `The story so far: ${currentScenario.content}\n\nThe user chose: ${selectedChoice.text} (${selectedChoice.emotionalResponse})`
      }
    ];

    // Generate the next scenario
    const response = await model.invoke(messages);

    let nextScenarioData;
    try {
      // Handle the response content which might be a string or complex object
      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      nextScenarioData = JSON.parse(content);
    } catch (error) {
      log.error('Failed to parse next scenario response', { error, content: response.content });
      return reply.status(500).send({ error: 'Failed to generate next scenario' });
    }

    // Create the next scenario
    const nextScenarioId = utlNewId('scenario');
    const timestamp = Timestamp.now();

    let choices: StoryChoice[] = [];
    if (!nextScenarioData.isEnding && nextScenarioData.choices) {
      choices = nextScenarioData.choices.map((choice: { text: string, emotionalResponse: string }) => ({
        id: utlNewId('choice'),
        text: choice.text,
        emotionalResponse: choice.emotionalResponse
      }));
    }

    const nextScenario = new StoryScenarioDocument({
      scenarioId: nextScenarioId,
      sessionId,
      content: nextScenarioData.content,
      imagePrompt: nextScenarioData.imagePrompt,
      choices,
      isEnding: nextScenarioData.isEnding || false,
      feedback: nextScenarioData.feedback,
      createdAt: timestamp
    });

    // Save the next scenario
    await dbCreateOrUpdate(StoryScenarioDocument, nextScenarioId, nextScenario, sessionId);

    // Update the session
    selectedChoice.nextScenarioId = nextScenarioId;
    session.currentScenarioId = nextScenarioId;
    session.path.push(nextScenarioId);
    session.completed = nextScenarioData.isEnding || false;

    await dbCreateOrUpdate(StorySession, sessionId, session);

    // Update the current scenario with the next scenario reference
    await dbCreateOrUpdate(StoryScenarioDocument, currentScenario.scenarioId, currentScenario, sessionId);

    // Return the next scenario
    return reply.status(200).send({
      nextScenario: nextScenario.toStoryScenario(),
      emotionalProfile: session.emotionalProfile
    });
  } catch (error) {
    log.error('Error making choice', { error });
    return reply.status(500).send({ error: 'Failed to process choice' });
  }
};

/**
 * Get therapeutic insights based on user's story choices
 */
export const getStoryInsights = async (
  request: FastifyRequest<GetInsightsRequest>,
  reply: FastifyReply
) => {
  try {
    const { sessionId } = request.params;

    // Get the session
    const session = await dbGetById(null, StorySession, sessionId);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    // Check if we already have insights for this session
    const existingInsights = await db.collection(StoryInsights._collection(sessionId)).limit(1).get();
    if (!existingInsights.empty) {
      const insightDoc = existingInsights.docs[0].data() as StoryInsights;
      return reply.status(200).send(insightDoc.toResponse());
    }

    // Build narrative from path
    let narrative = '';
    for (let i = 0; i < session.path.length; i++) {
      const scenarioId = session.path[i];
      const scenario = await dbGetById(null, StoryScenarioDocument, scenarioId, sessionId);

      if (!scenario) continue;

      narrative += `\n\nScenario ${i + 1}: ${scenario.content}`;

      // Add the choice made if this isn't the last scenario
      const nextScenarioIndex = i + 1;
      if (nextScenarioIndex < session.path.length) {
        const nextScenarioId = session.path[nextScenarioIndex];
        // Find which choice led to the next scenario
        const choiceMade = scenario.choices?.find(choice => choice.nextScenarioId === nextScenarioId);
        if (choiceMade) {
          narrative += `\nChoice made: ${choiceMade.text} (Emotional response: ${choiceMade.emotionalResponse})`;
        }
      }
    }

    // Format the emotional profile
    const emotionalChoices = Object.entries(session.emotionalProfile)
      .map(([emotion, count]) => `${emotion}: ${count} time(s)`)
      .join(', ');

    // Generate insights
    const model = llmGetModel(LlmClients.REFLECT, LlmApiMode.GPT_4O_JSON);

    const messages = [
      {
        role: 'system',
        content: `You are an expert therapist for ReflectAI's therapeutic simulator platform.
        Analyze the user's choices in the interactive story and provide therapeutic insights.
        Consider the emotional patterns and decision-making processes shown through their choices.
        Format your response as a JSON object with the following structure:
        {
          "primaryEmotionalResponse": "Brief description of the user's dominant emotional tendency",
          "insightSummary": "A concise summary of the key insight",
          "detailedAnalysis": "A more detailed analysis of the user's emotional patterns",
          "strengthsShown": ["Strength 1", "Strength 2", "Strength 3"],
          "growthOpportunities": ["Growth area 1", "Growth area 2", "Growth area 3"],
          "reflectionQuestions": ["Question 1?", "Question 2?", "Question 3?"]
        }`
      },
      {
        role: 'user',
        content: `Analyze this user's story journey about the dilemma: "${session.dilemma}"\n\nStory narrative: ${narrative}\n\nEmotional choices made: ${emotionalChoices}`
      }
    ];

    // Generate the insights
    const response = await model.invoke(messages);

    let insightsData;
    try {
      // Handle the response content which might be a string or complex object
      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      insightsData = JSON.parse(content);
    } catch (error) {
      log.error('Failed to parse insights response', { error, content: response.content });
      return reply.status(500).send({ error: 'Failed to generate insights' });
    }

    // Create and save insights
    const insightId = utlNewId('insight');
    const timestamp = Timestamp.now();

    const insights = new StoryInsights({
      insightId,
      sessionId,
      primaryEmotionalResponse: insightsData.primaryEmotionalResponse,
      insightSummary: insightsData.insightSummary,
      detailedAnalysis: insightsData.detailedAnalysis,
      strengthsShown: insightsData.strengthsShown,
      growthOpportunities: insightsData.growthOpportunities,
      reflectionQuestions: insightsData.reflectionQuestions,
      createdAt: timestamp
    });

    await dbCreateOrUpdate(StoryInsights, insightId, insights, sessionId);

    // Return the insights
    return reply.status(200).send(insights.toResponse());
  } catch (error) {
    log.error('Error generating story insights', { error });
    return reply.status(500).send({ error: 'Failed to generate insights' });
  }
};
