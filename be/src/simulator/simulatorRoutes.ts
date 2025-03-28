/*
 * ReflectAI - Life Simulator Module
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { FastifyInstance } from 'fastify';
import { log } from '../log';
import { simulatorGenerateStoryInsights } from './simulatorStoryInsights';
import { simulatorGenerateStory } from './simulatorGenerateStory';
import { simulatorGenerateNextScenario } from './simulatorNextScenario';

// Simulator routes plugin
export function simulatorRouter(fastify: FastifyInstance, _: any, done: () => void) {
  // Route to generate a new interactive story
  fastify.post('/simulator/story/generate', simulatorGenerateStory);

  // Route to make a choice in the story
  fastify.post('/simulator/story/choice', simulatorGenerateNextScenario);

  // Route to get therapeutic insights based on story choices
  fastify.post('/simulator/story/insights', simulatorGenerateStoryInsights);

  log.info('Simulator routes initialized');
  done();
}
