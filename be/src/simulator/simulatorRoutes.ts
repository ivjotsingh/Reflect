/*
 * ReflectAI - Life Simulator Module
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { FastifyInstance } from 'fastify';
import { log } from '../log';
import { generateStorySimulation, makeChoice, getStoryInsights } from './simulatorProcessor';

// Simulator routes plugin
export function simulatorRouter(fastify: FastifyInstance, _: any, done: () => void) {
  // Route to generate a new interactive story
  fastify.post('/simulator/story/generate', generateStorySimulation);

  // Route to make a choice in the story
  fastify.post('/simulator/story/choice', makeChoice);

  // Route to get therapeutic insights based on story choices
  fastify.get('/simulator/story/insights/:sessionId', getStoryInsights);

  log.info('Simulator routes initialized');
  done();
}
