/*
 * ReflectAI - Life Simulator Module
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { dbDocument, dbTimestamp } from '../db/db';

// Interface for story choice options
export interface StoryChoice {
  id: string;
  text: string;
  emotionalResponse: string;
  nextScenarioId?: string;
}

// Interface for story scenario content
export interface StoryScenario {
  id: string;
  content: string;
  imagePrompt?: string;
  choices?: StoryChoice[];
  isEnding?: boolean;
  feedback?: string;
}

// Response interfaces
export interface StoryResponse {
  sessionId: string;
  title: string;
  currentScenario: StoryScenario;
}

export interface ChoiceResponse {
  nextScenario: StoryScenario;
  emotionalProfile: Record<string, number>;
}

export interface StoryInsightsResponse {
  primaryEmotionalResponse: string;
  insightSummary: string;
  detailedAnalysis: string;
  strengthsShown: string[];
  growthOpportunities: string[];
  reflectionQuestions: string[];
}

// Database models
export class StorySession extends dbDocument {
  public sessionId: string;
  public userId: string;
  public title: string;
  public dilemma: string;
  public currentScenarioId: string;
  public path: string[];
  public emotionalProfile: Record<string, number>;
  public createdAt: dbTimestamp;
  public lastActive: dbTimestamp;
  public completed: boolean;

  constructor(init: Partial<StorySession>) {
    super(init);
    this.sessionId = init.sessionId || '';
    this.userId = init.userId || 'anonymous';
    this.title = init.title || '';
    this.dilemma = init.dilemma || '';
    this.currentScenarioId = init.currentScenarioId || '';
    this.path = init.path || [];
    this.emotionalProfile = init.emotionalProfile || {};
    this.createdAt = init.createdAt || new Date() as any;
    this.lastActive = init.lastActive || new Date() as any;
    this.completed = init.completed || false;
  }

  static override _collection(): string {
    return 'StorySessions';
  }

  override _documentId(): string {
    return this.sessionId;
  }
}

export class StoryScenarioDocument extends dbDocument {
  public scenarioId: string;
  public sessionId: string;
  public content: string;
  public imagePrompt?: string;
  public choices?: StoryChoice[];
  public isEnding?: boolean;
  public feedback?: string;
  public createdAt: dbTimestamp;

  constructor(init: Partial<StoryScenarioDocument>) {
    super(init);
    this.scenarioId = init.scenarioId || '';
    this.sessionId = init.sessionId || '';
    this.content = init.content || '';
    this.imagePrompt = init.imagePrompt;
    this.choices = init.choices || [];
    this.isEnding = init.isEnding || false;
    this.feedback = init.feedback;
    this.createdAt = init.createdAt || new Date() as any;
  }

  static override _collection(sessionId?: string): string {
    if (sessionId) {
      return `StorySessions/${sessionId}/StoryScenarios`;
    }
    throw new Error('Session ID is required for story scenarios');
  }

  override _documentId(): string {
    return this.scenarioId;
  }

  toStoryScenario(): StoryScenario {
    return {
      id: this.scenarioId,
      content: this.content,
      imagePrompt: this.imagePrompt,
      choices: this.choices,
      isEnding: this.isEnding,
      feedback: this.feedback
    };
  }
}

export class StoryInsights extends dbDocument {
  public insightId: string;
  public sessionId: string;
  public primaryEmotionalResponse: string;
  public insightSummary: string;
  public detailedAnalysis: string;
  public strengthsShown: string[];
  public growthOpportunities: string[];
  public reflectionQuestions: string[];
  public createdAt: dbTimestamp;

  constructor(init: Partial<StoryInsights>) {
    super(init);
    this.insightId = init.insightId || '';
    this.sessionId = init.sessionId || '';
    this.primaryEmotionalResponse = init.primaryEmotionalResponse || '';
    this.insightSummary = init.insightSummary || '';
    this.detailedAnalysis = init.detailedAnalysis || '';
    this.strengthsShown = init.strengthsShown || [];
    this.growthOpportunities = init.growthOpportunities || [];
    this.reflectionQuestions = init.reflectionQuestions || [];
    this.createdAt = init.createdAt || new Date() as any;
  }

  static override _collection(sessionId?: string): string {
    if (sessionId) {
      return `StorySessions/${sessionId}/StoryInsights`;
    }
    throw new Error('Session ID is required for story insights');
  }

  override _documentId(): string {
    return this.insightId;
  }

  toResponse(): StoryInsightsResponse {
    return {
      primaryEmotionalResponse: this.primaryEmotionalResponse,
      insightSummary: this.insightSummary,
      detailedAnalysis: this.detailedAnalysis,
      strengthsShown: this.strengthsShown,
      growthOpportunities: this.growthOpportunities,
      reflectionQuestions: this.reflectionQuestions
    };
  }
}
