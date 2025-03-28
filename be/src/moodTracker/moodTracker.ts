/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

import { Timestamp } from 'firebase-admin/firestore';
import { db, dbCreateOrUpdate, dbGetByFields } from '../db/db';
import { log } from '../log/log';
import { UserMood, MoodType, MoodResponse } from './moodTrackerModels';

/**
 * Save a mood entry for a user
 * @param userId The user ID
 * @param mood The mood value (Great, Good, Okay, Down, Stressed, Angry)
 * @returns The saved mood entry
 */
export async function saveMood(userId: string, mood: string): Promise<MoodResponse> {
  try {
    // Validate mood type
    if (!isValidMoodType(mood)) {
      throw new Error(`Invalid mood type: ${mood}`);
    }

    const timestamp = Timestamp.now();
    const todayDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    // Create or update mood for the current day
    const userMood = new UserMood({
      userId,
      mood: mood as MoodType,
      timestamp,
      date: todayDate
    });

    // The document ID is userId_date (see UserMood._documentId())
    const docId = userMood._documentId();
    await dbCreateOrUpdate(UserMood, docId, userMood);

    return userMood.toResponse();
  } catch (error) {
    log.error('Error saving mood', { error, userId, mood });
    throw error;
  }
}

/**
 * Get the mood history for a user (last 5 entries)
 * @param userId The user ID
 * @returns Array of mood entries
 */
export async function getMoodHistory(userId: string): Promise<MoodResponse[]> {
  try {
    // Query for the user's mood entries, ordered by timestamp descending, limited to 5
    const moodEntries = await dbGetByFields(
      null,
      UserMood,
      { userId },
      5, // Limit to 5 entries
      [{ field: 'timestamp', direction: 'desc' }]
    );

    // Convert to response format
    return moodEntries.map(entry => entry.toResponse());
  } catch (error) {
    log.error('Error getting mood history', { error, userId });
    throw error;
  }
}

/**
 * Validate if the provided mood is a valid MoodType
 * @param mood The mood to validate
 * @returns True if valid, false otherwise
 */
function isValidMoodType(mood: string): boolean {
  const validMoods: MoodType[] = ['Great', 'Good', 'Okay', 'Down', 'Stressed', 'Angry'];
  return validMoods.includes(mood as MoodType);
}
