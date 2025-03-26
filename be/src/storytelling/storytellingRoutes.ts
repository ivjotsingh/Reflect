/*
 * ReflectAI - Interactive Storytelling Module
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { FastifyInstance } from 'fastify';
import { log } from '../log';
import { generateStory, makeChoice, getStoryInsights } from './storytellingController';

// Storytelling routes plugin
export function storytellingRouter(fastify: FastifyInstance, _: any, done: () => void) {
  // Route to generate a new interactive story
  fastify.post('/storytelling/story/generate', generateStory);

  // Route to make a choice in the story
  fastify.post('/storytelling/story/choice', makeChoice);

  // Route to get therapeutic insights based on story choices
  fastify.get('/storytelling/story/insights/:sessionId', getStoryInsights);

  log.info('Storytelling routes initialized');
  done();
}
