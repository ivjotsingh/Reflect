import { FastifyRequest, FastifyReply } from "fastify";
import { Timestamp } from "firebase-admin/firestore";
import { dbCreateOrUpdate } from "../db";
import { llmGetModel, LlmClients, LlmApiMode } from "../llm";
import { utlNewId } from "../utl/utl";
import { StorySession, StoryScenarioDocument } from "./simulatorModels";
import { GenerateStoryRequest, generateEmotionalProfile } from "./simulatorProcessor";
import { log } from "../log";

/**
 * Generate a new interactive story based on user input
 */
export const generateStorySimulation = async (
    request: FastifyRequest<GenerateStoryRequest>,
    reply: FastifyReply
) => {
    return reply.status(200).send(
        {
            "sessionId": "story-KEmLHuCHmSVb0X9A5n9wZ",
            "title": "The Crossroads of Career and Family",
            "currentScenario": {
                "id": "scenario-Ft8BsxMhfJEZkJV21rQ4a",
                "content": "You stand at a pivotal moment in your life. A prestigious company has offered you a higher-paying position, but it requires moving to a new city far from your family and friends. You feel the weight of this decision pressing down on you. On one hand, the financial stability could provide a better future, but on the other, leaving your loved ones behind feels daunting. As you ponder your options, you can almost hear the echoes of your family's laughter and the comfort of your familiar surroundings. What will you choose?",
                "imagePrompt": "A person standing at a crossroads, contemplating two paths, one leading to a city skyline and the other to a cozy home.",
                "choices": [
                    {
                        "id": "choice-oGAfk2DHXtoDqH0YRoIsw",
                        "text": "Accept the job offer and embrace the new adventure.",
                        "emotionalResponse": "Hopeful"
                    },
                    {
                        "id": "choice-iYe4m15wZR1bbmavTlZ2I",
                        "text": "Decline the offer and prioritize staying close to family.",
                        "emotionalResponse": "Stressed"
                    },
                    {
                        "id": "choice-C4t8aEUebOLklGsWE1BAa",
                        "text": "Ask for more time to think it over and weigh the pros and cons.",
                        "emotionalResponse": "Curious"
                    },
                    {
                        "id": "choice-XxQyJLLb19JaVfcqYhayl",
                        "text": "Discuss the opportunity with family to get their perspective.",
                        "emotionalResponse": "Empathetic"
                    }
                ],
                "isEnding": false,
                "feedback": ""
            }
        }
    );
    // try {
    //     const { dilemma, userId } = request.body;

    //     // Check if we have either a dilemma or userId
    //     if (!dilemma || !userId) {
    //         return reply.status(400).send({
    //             error: 'Dilemma and userId must be provided'
    //         });
    //     }

    //     log.info('Generating emotional profile from chat history', { userId });
    //     const userEmotionalProfile = await generateEmotionalProfile(userId);

    //     const sessionId = utlNewId('story');

    //     // Use GPT-4o for generating rich, nuanced stories
    //     const model = llmGetModel(LlmClients.REFLECT, LlmApiMode.OPENAI_JSON);

    //     // Create prompt for story generation
    //     const storyPrompt = [
    //         {
    //             role: 'system',
    //             content: `You are an AI storyteller for ReflectAI's therapeutic interactive simulator platform. 
    //       Create an emotional and engaging interactive story based on the provided dilemma.
    //       Your story should help users navigate emotional situations and gain insights about their responses.
    //       Include a title and a first story scenario with 3-4 choices that reflect different emotional responses.
    //       For each choice, provide an emotional label (e.g., "Anxious", "Confident", "Empathetic").

    //       Format your response as a JSON object with the following structure:
    //       {
    //         "title": "Story Title",
    //         "firstScenario": {
    //           "content": "Story introduction text...",
    //           "imagePrompt": "Brief description for image generation",
    //           "choices": [
    //             { "text": "Choice text", "emotionalResponse": "Emotion" },
    //             { "text": "Choice text", "emotionalResponse": "Emotion" },
    //             { "text": "Choice text", "emotionalResponse": "Emotion" }
    //           ]
    //         }
    //       }

    //       Important instructions:
    //       1. Provide only clean JSON without any extra text, comments, or markdown formatting
    //       2. Do not include any blank lines or extra spaces in your response
    //       3. Make sure your response is valid JSON that can be parsed without errors`
    //         }
    //     ];

    //     // Add emotional profile context if available
    //     if (userEmotionalProfile && Object.keys(userEmotionalProfile).length > 0) {
    //         const emotionalContext = {
    //             role: 'system',
    //             content: `The user's current emotional profile is: ${JSON.stringify(userEmotionalProfile)}

    //       Create a story that resonates with these emotions and offers choices that would be meaningful for someone
    //       experiencing these feelings. One of the choices should align with their dominant emotion,
    //       while others should offer alternative perspectives or coping mechanisms.`
    //         };

    //         storyPrompt.push(emotionalContext);
    //     }

    //     // Add the user dilemma or request a generated one
    //     storyPrompt.push({
    //         role: 'user',
    //         content: dilemma
    //             ? `Create an interactive story for this dilemma: ${dilemma}`
    //             : `Generate an interactive story about a common life dilemma that would resonate with someone experiencing these emotions: ${JSON.stringify(userEmotionalProfile)}`
    //     });

    //     // Generate the initial story
    //     const response = await model.invoke(storyPrompt);

    //     let storyData;
    //     try {
    //         // Handle the response content which might be a string or complex object
    //         let content = typeof response.content === 'string'
    //             ? response.content
    //             : JSON.stringify(response.content);

    //         // Clean up excessive blank lines and spaces that could interfere with JSON parsing
    //         content = content.replace(/(\n\s*){3,}/g, '\n\n').trim();

    //         storyData = JSON.parse(content);
    //     } catch (error) {
    //         log.error('Failed to parse story generation response', { error, content: response.content });
    //         return reply.status(500).send({ error: 'Failed to generate story' });
    //     }

    //     // Create the first scenario with a unique ID
    //     const firstScenarioId = utlNewId('scenario');
    //     const choices = storyData.firstScenario.choices.map((choice: any) => ({
    //         id: utlNewId('choice'),
    //         text: choice.text,
    //         emotionalResponse: choice.emotionalResponse
    //     }));

    //     // Create a new session in the database
    //     const timestamp = Timestamp.now();
    //     const newSession = new StorySession({
    //         sessionId,
    //         title: storyData.title,
    //         dilemma: dilemma || 'Generated dilemma',
    //         currentScenarioId: firstScenarioId,
    //         path: [firstScenarioId],
    //         emotionalProfile: userEmotionalProfile || {},
    //         createdAt: timestamp,
    //         lastActive: timestamp,
    //         userId: userId || 'anonymous'
    //     });

    //     await dbCreateOrUpdate(StorySession, sessionId, newSession);

    //     // Create the first scenario in the database
    //     const firstScenario = new StoryScenarioDocument({
    //         scenarioId: firstScenarioId,
    //         sessionId,
    //         content: storyData.firstScenario.content,
    //         imagePrompt: storyData.firstScenario.imagePrompt,
    //         choices,
    //         createdAt: timestamp
    //     });

    //     await dbCreateOrUpdate(StoryScenarioDocument, firstScenarioId, firstScenario, sessionId);

    //     // Return the initial story
    //     return reply.status(200).send({
    //         sessionId,
    //         title: storyData.title,
    //         currentScenario: firstScenario.toStoryScenario()
    //     });
    // } catch (error) {
    //     log.error('Error generating story', { error });
    //     return reply.status(500).send({ error: 'Failed to generate story' });
    // }
};