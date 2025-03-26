/*
 * ReflectAI - Interactive Storytelling Controller
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
  StoryNode, 
  StorySession, 
  StoryNodeDocument, 
  StoryInsights 
} from './storytellingModels';

// Request and param types
export interface GenerateStoryRequest {
  Body: {
    dilemma?: string;
    emotionalProfile?: Record<string, number>;
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
 * Generate a new interactive story based on user input
 */
export const generateStory = async (
  request: FastifyRequest<GenerateStoryRequest>,
  reply: FastifyReply
) => {
  try {
    const { dilemma, emotionalProfile } = request.body;
    
    if (!dilemma && !emotionalProfile) {
      return reply.status(400).send({ error: 'Either dilemma or emotional profile must be provided' });
    }

    const sessionId = utlNewId('story');
    
    // Use GPT-4o for generating rich, nuanced stories
    const model = llmGetModel(LlmClients.REFLECT, LlmApiMode.GPT_4O_JSON);
    
    // Create prompt for story generation
    const messages = [
      {
        role: 'system',
        content: `You are an AI storyteller for ReflectAI's therapeutic interactive storytelling platform. 
        Create an emotional and engaging interactive story based on the provided dilemma.
        Your story should help users navigate emotional situations and gain insights about their responses.
        Include a title and a first story node with 3-4 choices that reflect different emotional responses.
        For each choice, provide an emotional label (e.g., "Anxious", "Confident", "Empathetic").
        Format your response as a JSON object with the following structure:
        {
          "title": "Story Title",
          "firstNode": {
            "content": "Story introduction text...",
            "imagePrompt": "Brief description for image generation",
            "choices": [
              { "text": "Choice text", "emotionalResponse": "Emotion" },
              { "text": "Choice text", "emotionalResponse": "Emotion" },
              { "text": "Choice text", "emotionalResponse": "Emotion" }
            ]
          }
        }`
      },
      {
        role: 'user',
        content: `Create an interactive story for this dilemma: ${dilemma || 'Generate a common life dilemma'}`
      }
    ];

    // Generate the initial story
    const response = await model.invoke(messages);
    
    let storyData;
    try {
      // Handle the response content which might be a string or complex object
      const content = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);
        
      storyData = JSON.parse(content);
    } catch (error) {
      log.error('Failed to parse story generation response', { error, content: response.content });
      return reply.status(500).send({ error: 'Failed to generate story' });
    }

    // Create the first node with a unique ID
    const firstNodeId = utlNewId('node');
    const choices = storyData.firstNode.choices.map((choice: any) => ({
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
      currentNodeId: firstNodeId,
      path: [firstNodeId],
      emotionalProfile: {},
      createdAt: timestamp,
      lastActive: timestamp
    });
    
    await dbCreateOrUpdate(StorySession, sessionId, newSession);

    // Create the first node in the database
    const firstNode = new StoryNodeDocument({
      nodeId: firstNodeId,
      sessionId,
      content: storyData.firstNode.content,
      imagePrompt: storyData.firstNode.imagePrompt,
      choices,
      createdAt: timestamp
    });
    
    await dbCreateOrUpdate(StoryNodeDocument, firstNodeId, firstNode, sessionId);

    // Return the initial story
    return reply.status(200).send({
      sessionId,
      title: storyData.title,
      currentNode: firstNode.toStoryNode()
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

    // Get the current node
    const currentNode = await dbGetById(null, StoryNodeDocument, session.currentNodeId, sessionId);
    if (!currentNode) {
      return reply.status(404).send({ error: 'Current node not found' });
    }

    // Find the selected choice
    const selectedChoice = currentNode.choices?.find(choice => choice.id === choiceId);
    if (!selectedChoice) {
      return reply.status(404).send({ error: 'Choice not found' });
    }

    // Update emotional profile
    const emotion = selectedChoice.emotionalResponse;
    session.emotionalProfile[emotion] = (session.emotionalProfile[emotion] || 0) + 1;
    session.lastActive = Timestamp.now();

    // If the choice already has a next node, use it
    if (selectedChoice.nextNodeId) {
      const nextNode = await dbGetById(null, StoryNodeDocument, selectedChoice.nextNodeId, sessionId);
      if (nextNode) {
        session.currentNodeId = selectedChoice.nextNodeId;
        session.path.push(selectedChoice.nextNodeId);
        
        // Update the session
        await dbCreateOrUpdate(StorySession, sessionId, session);
        
        return reply.status(200).send({
          nextNode: nextNode.toStoryNode(),
          emotionalProfile: session.emotionalProfile
        });
      }
    }

    // Otherwise, generate the next node
    const model = llmGetModel(LlmClients.REFLECT, LlmApiMode.GPT_4O_JSON);
    
    const messages = [
      {
        role: 'system',
        content: `You are an AI storyteller for ReflectAI's therapeutic interactive storytelling platform.
        Continue the interactive story based on the user's choice.
        The story is about the following dilemma: ${session.dilemma}
        The user has chosen a response that reflects a "${selectedChoice.emotionalResponse}" emotional state.
        Create the next story node with 3-4 new choices that reflect different emotional responses,
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
        If this should be an ending node, use:
        {
          "content": "Conclusion of the story...",
          "imagePrompt": "Brief description for image generation",
          "isEnding": true,
          "feedback": "Brief feedback on the path chosen"
        }`
      },
      {
        role: 'user',
        content: `The story so far: ${currentNode.content}\n\nThe user chose: ${selectedChoice.text} (${selectedChoice.emotionalResponse})`
      }
    ];

    // Generate the next node
    const response = await model.invoke(messages);
    
    let nextNodeData;
    try {
      // Handle the response content which might be a string or complex object
      const content = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);
        
      nextNodeData = JSON.parse(content);
    } catch (error) {
      log.error('Failed to parse next node response', { error, content: response.content });
      return reply.status(500).send({ error: 'Failed to generate next node' });
    }

    // Create the next node
    const nextNodeId = utlNewId('node');
    const timestamp = Timestamp.now();
    
    let choices: StoryChoice[] = [];
    if (!nextNodeData.isEnding && nextNodeData.choices) {
      choices = nextNodeData.choices.map((choice: { text: string, emotionalResponse: string }) => ({
        id: utlNewId('choice'),
        text: choice.text,
        emotionalResponse: choice.emotionalResponse
      }));
    }

    const nextNode = new StoryNodeDocument({
      nodeId: nextNodeId,
      sessionId,
      content: nextNodeData.content,
      imagePrompt: nextNodeData.imagePrompt,
      choices,
      isEnding: nextNodeData.isEnding || false,
      feedback: nextNodeData.feedback,
      createdAt: timestamp
    });
    
    // Save the next node
    await dbCreateOrUpdate(StoryNodeDocument, nextNodeId, nextNode, sessionId);

    // Update the session
    selectedChoice.nextNodeId = nextNodeId;
    session.currentNodeId = nextNodeId;
    session.path.push(nextNodeId);
    session.completed = nextNodeData.isEnding || false;
    
    await dbCreateOrUpdate(StorySession, sessionId, session);

    // Update the current node with the next node reference
    await dbCreateOrUpdate(StoryNodeDocument, currentNode.nodeId, currentNode, sessionId);

    // Return the next node
    return reply.status(200).send({
      nextNode: nextNode.toStoryNode(),
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
      const nodeId = session.path[i];
      const node = await dbGetById(null, StoryNodeDocument, nodeId, sessionId);
      
      if (!node) continue;
      
      narrative += `\n\nNode ${i+1}: ${node.content}`;
      
      // Add the choice made if this isn't the last node
      const nextNodeIndex = i + 1;
      if (nextNodeIndex < session.path.length) {
        const nextNodeId = session.path[nextNodeIndex];
        // Find which choice led to the next node
        const choiceMade = node.choices?.find(choice => choice.nextNodeId === nextNodeId);
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
        content: `You are an expert therapist for ReflectAI's therapeutic storytelling platform.
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
