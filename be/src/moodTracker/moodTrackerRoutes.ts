/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { srvAddRoute, srvServer } from '../srv';
import { log } from '../log/log';
import { saveMood, getMoodHistory } from './moodTracker';

interface SaveMoodRequest {
  userId: string;
  mood: string;
}

interface GetMoodHistoryRequest {
  userId: string;
}

// Handler to save a mood entry
async function saveMoodHandler(request: FastifyRequest, reply: FastifyReply): Promise<any> {
  try {
    const { userId, mood } = request.body as SaveMoodRequest;

    if (!userId || !mood) {
      return reply.status(400).send({
        status: 'error',
        message: 'User ID and mood are required'
      });
    }

    const result = await saveMood(userId, mood);

    return reply.status(200).send({
      status: 'success',
      data: result
    });
  } catch (error) {
    log.error('Error in save mood handler', { error });
    return reply.status(500).send({
      status: 'error',
      message: 'Internal server error'
    });
  }
}

// Handler to get mood history
async function getMoodHistoryHandler(request: FastifyRequest, reply: FastifyReply): Promise<any> {
  try {
    const { userId } = request.query as GetMoodHistoryRequest;

    if (!userId) {
      return reply.status(400).send({
        status: 'error',
        message: 'User ID is required'
      });
    }

    const moodHistory = await getMoodHistory(userId);

    return reply.status(200).send({
      status: 'success',
      data: moodHistory
    });
  } catch (error) {
    log.error('Error in get mood history handler', { error });
    return reply.status(500).send({
      status: 'error',
      message: 'Internal server error'
    });
  }
}

// Initialize mood tracker routes
export function moodTrackerRoutesInit(path: string): void {
  // Save mood endpoint
  srvAddRoute('POST', srvServer, `${path}/v1/mood`, saveMoodHandler);

  // Get mood history endpoint
  srvAddRoute('GET', srvServer, `${path}/v1/mood/history`, getMoodHistoryHandler);

  log.info('Mood tracker routes initialized');
}
