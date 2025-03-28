import { FastifyRequest, FastifyReply } from "fastify";
import { Timestamp } from "firebase-admin/firestore";
import { dbGetById, db, dbCreateOrUpdate } from "../db";
import { llmGetModel, LlmClients, LlmApiMode } from "../llm";
import { log } from "../log";
import { utlNewId } from "../utl/utl";
import { StorySession, StoryInsights, StoryScenarioDocument } from "./simulatorModels";

// Request type for story insights
interface GetStoryInsightsRequest {
    Body: {
        sessionId: string;
        userId: string;
    }
}

/**
 * Get therapeutic insights based on user's story choices
 */
export const simulatorGenerateStoryInsights = async (
    request: FastifyRequest<GetStoryInsightsRequest>,
    reply: FastifyReply
) => {
    return reply.status(200).send(
        {
            "primaryEmotionalResponse": "Hopeful",
            "insightSummary": "The user is primarily driven by hope and excitement for new opportunities, but also experiences significant stress related to leaving their familiar environment.",
            "detailedAnalysis": "The user's journey reflects a strong desire for growth and new experiences, as evidenced by their choice to accept the job offer. The repeated emotional responses of hope and encouragement indicate a positive outlook on change, suggesting resilience and an eagerness to embrace new challenges. However, the equal presence of stress highlights an internal conflict regarding the impact of this decision on their relationships and sense of belonging. This duality suggests that while the user is motivated by ambition, they are also deeply connected to their family and the comfort of their current life, which creates a complex emotional landscape.",
            "strengthsShown": [
                "Resilience in the face of change",
                "A strong sense of hope and optimism",
                "Willingness to embrace new opportunities"
            ],
            "growthOpportunities": [
                "Developing strategies to maintain connections with family",
                "Managing stress related to significant life changes",
                "Exploring personal values around career versus family"
            ],
            "reflectionQuestions": [
                "How can I effectively stay connected with my family after the move?",
                "What specific aspects of my current life will I miss the most?",
                "What are my long-term goals, and how does this job align with them?"
            ]
        }
    );

    // try {
    //     const { sessionId } = request.body;

    //     if (!sessionId) {
    //         return reply.status(400).send({ error: 'Session ID is required' });
    //     }

    //     // Get the session
    //     const session = await dbGetById(null, StorySession, sessionId);
    //     if (!session) {
    //         return reply.status(404).send({ error: 'Session not found' });
    //     }

    //     // Check if we already have insights for this session
    //     const existingInsights = await db.collection(StoryInsights._collection(sessionId)).limit(1).get();
    //     if (!existingInsights.empty) {
    //         const insightDoc = existingInsights.docs[0].data() as StoryInsights;
    //         return reply.status(200).send(insightDoc.toResponse());
    //     }

    //     // Build narrative from path
    //     let narrative = '';
    //     for (let i = 0; i < session.path.length; i++) {
    //         const scenarioId = session.path[i];
    //         const scenario = await dbGetById(null, StoryScenarioDocument, scenarioId, sessionId);

    //         if (!scenario) continue;

    //         narrative += `\n\nScenario ${i + 1}: ${scenario.content}`;

    //         // Add the choice made if this isn't the last scenario
    //         const nextScenarioIndex = i + 1;
    //         if (nextScenarioIndex < session.path.length) {
    //             const nextScenarioId = session.path[nextScenarioIndex];
    //             // Find which choice led to the next scenario
    //             const choiceMade = scenario.choices?.find(choice => choice.nextScenarioId === nextScenarioId);
    //             if (choiceMade) {
    //                 narrative += `\nChoice made: ${choiceMade.text} (Emotional response: ${choiceMade.emotionalResponse})`;
    //             }
    //         }
    //     }

    //     // Format the emotional profile
    //     const emotionalChoices = Object.entries(session.emotionalProfile)
    //         .map(([emotion, count]) => `${emotion}: ${count} time(s)`)
    //         .join(', ');

    //     // Generate insights
    //     const model = llmGetModel(LlmClients.REFLECT, LlmApiMode.OPENAI_JSON);

    //     const messages = [
    //         {
    //             role: 'system',
    //             content: `You are an expert therapist for ReflectAI's therapeutic simulator platform.
    //       Analyze the user's choices in the interactive story and provide therapeutic insights.
    //       Consider the emotional patterns and decision-making processes shown through their choices.
    //       Format your response as a JSON object with the following structure:
    //       {
    //         "primaryEmotionalResponse": "Brief description of the user's dominant emotional tendency",
    //         "insightSummary": "A concise summary of the key insight",
    //         "detailedAnalysis": "A more detailed analysis of the user's emotional patterns",
    //         "strengthsShown": ["Strength 1", "Strength 2", "Strength 3"],
    //         "growthOpportunities": ["Growth area 1", "Growth area 2", "Growth area 3"],
    //         "reflectionQuestions": ["Question 1?", "Question 2?", "Question 3?"]
    //       }`
    //         },
    //         {
    //             role: 'user',
    //             content: `Analyze this user's story journey about the dilemma: "${session.dilemma}"\n\nStory narrative: ${narrative}\n\nEmotional choices made: ${emotionalChoices}`
    //         }
    //     ];

    //     // Generate the insights
    //     const response = await model.invoke(messages);

    //     let insightsData;
    //     try {
    //         // Handle the response content which might be a string or complex object
    //         const content = typeof response.content === 'string'
    //             ? response.content
    //             : JSON.stringify(response.content);

    //         insightsData = JSON.parse(content);
    //     } catch (error) {
    //         log.error('Failed to parse insights response', { error, content: response.content });
    //         return reply.status(500).send({ error: 'Failed to generate insights' });
    //     }

    //     // Create and save insights
    //     const insightId = utlNewId('insight');
    //     const timestamp = Timestamp.now();

    //     const insights = new StoryInsights({
    //         insightId,
    //         sessionId,
    //         primaryEmotionalResponse: insightsData.primaryEmotionalResponse,
    //         insightSummary: insightsData.insightSummary,
    //         detailedAnalysis: insightsData.detailedAnalysis,
    //         strengthsShown: insightsData.strengthsShown,
    //         growthOpportunities: insightsData.growthOpportunities,
    //         reflectionQuestions: insightsData.reflectionQuestions,
    //         createdAt: timestamp
    //     });

    //     await dbCreateOrUpdate(StoryInsights, insightId, insights, sessionId);

    //     // Return the insights
    //     return reply.status(200).send(insights.toResponse());
    // } catch (error) {
    //     log.error('Error generating story insights', { error });
    //     return reply.status(500).send({ error: 'Failed to generate insights' });
    // }
};