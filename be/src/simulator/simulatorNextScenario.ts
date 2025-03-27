import { FastifyRequest, FastifyReply } from "fastify";
import { Timestamp } from "firebase-admin/firestore";
import { dbGetById, dbCreateOrUpdate } from "../db";
import { llmGetModel, LlmClients, LlmApiMode } from "../llm";
import { utlNewId } from "../utl/utl";
import { StorySession, StoryScenarioDocument, StoryChoice } from "./simulatorModels";
import { MakeChoiceRequest } from "./simulatorProcessor";
import { log } from "../log";

/**
 * Process a user's choice in the story
 */
export const generateNextScenario = async (
    request: FastifyRequest<MakeChoiceRequest>,
    reply: FastifyReply
) => {
    return reply.status(200).send(
        {
            "nextScenario": {
                "id": "scenario-Jmy0FvYitR4l74Jpabunh",
                "content": "With a deep breath, you decide to accept the job offer. The excitement of new beginnings fills you with energy as you imagine the possibilities that lie ahead. You inform your current employer, who is supportive of your decision, and you begin to prepare for the big move. As you pack your belongings, you feel a sense of hope and anticipation for the adventure that awaits you in the new city. You think about how this change will not only enhance your career but also allow you to grow personally. However, you also find yourself reflecting on the distance from your family and the comfort of your current life. As the moving date approaches, you are faced with the reality of your decision. How will you stay connected with your loved ones? What will you miss the most? Your heart is filled with hope, but questions linger in your mind.",
                "imagePrompt": "A person packing boxes in their living room, filled with anticipation and hope for a new adventure.",
                "choices": [
                    {
                        "id": "choice-259DjaeRoPFNn5CcVftpI",
                        "text": "Plan regular video calls with family to stay connected.",
                        "emotionalResponse": "Hopeful"
                    },
                    {
                        "id": "choice-OVinLJASOscduZlYUIa1p",
                        "text": "Create a list of all the things you'll miss about home.",
                        "emotionalResponse": "Nostalgic"
                    },
                    {
                        "id": "choice-7J12Ae2JyqsMfkqrA7qzI",
                        "text": "Reach out to new friends in the city to build connections.",
                        "emotionalResponse": "Excited"
                    },
                    {
                        "id": "choice-lq6k9mykZ1ILU3e9COKF4",
                        "text": "Consider postponing the move to spend more time with family.",
                        "emotionalResponse": "Anxious"
                    }
                ],
                "isEnding": false,
                "feedback": ""
            },
            "emotionalProfile": {
                "Encouraged": 4,
                "Stressed": 4,
                "Curious": 2,
                "Hopeful": 4,
                "Relieved": 3
            }
        }
    )
    // try {
    //     const { sessionId, choiceId } = request.body;

    //     // Get the session
    //     const session = await dbGetById(null, StorySession, sessionId);
    //     if (!session) {
    //         return reply.status(404).send({ error: 'Session not found' });
    //     }

    //     // Get the current scenario
    //     const currentScenario = await dbGetById(null, StoryScenarioDocument, session.currentScenarioId, sessionId);
    //     if (!currentScenario) {
    //         return reply.status(404).send({ error: 'Current scenario not found' });
    //     }

    //     // Find the selected choice
    //     const selectedChoice = currentScenario.choices?.find(choice => choice.id === choiceId);
    //     if (!selectedChoice) {
    //         return reply.status(404).send({ error: 'Choice not found' });
    //     }

    //     // Update emotional profile
    //     const emotion = selectedChoice.emotionalResponse;
    //     session.emotionalProfile[emotion] = (session.emotionalProfile[emotion] || 0) + 1;
    //     session.lastActive = Timestamp.now();

    //     // If the choice already has a next scenario, use it
    //     if (selectedChoice.nextScenarioId) {
    //         const nextScenario = await dbGetById(null, StoryScenarioDocument, selectedChoice.nextScenarioId, sessionId);
    //         if (nextScenario) {
    //             session.currentScenarioId = selectedChoice.nextScenarioId;
    //             session.path.push(selectedChoice.nextScenarioId);

    //             // Update the session
    //             await dbCreateOrUpdate(StorySession, sessionId, session);

    //             return reply.status(200).send({
    //                 nextScenario: nextScenario.toStoryScenario(),
    //                 emotionalProfile: session.emotionalProfile
    //             });
    //         }
    //     }

    //     // Otherwise, generate the next scenario
    //     const model = llmGetModel(LlmClients.REFLECT, LlmApiMode.OPENAI_JSON);

    //     const messages = [
    //         {
    //             role: 'system',
    //             content: `You are an AI storyteller for ReflectAI's therapeutic interactive simulator platform.
    //       Continue the interactive story based on the user's choice.
    //       The story is about the following dilemma: ${session.dilemma}
    //       The user has chosen a response that reflects a "${selectedChoice.emotionalResponse}" emotional state.
    //       Create the next story scenario with 3-4 new choices that reflect different emotional responses,
    //       or an ending with feedback if the story should conclude.
    //       Format your response as a JSON object with the following structure:
    //       {
    //         "content": "Next part of the story based on the user's choice...",
    //         "imagePrompt": "Brief description for image generation",
    //         "isEnding": false,
    //         "choices": [
    //           { "text": "Choice text", "emotionalResponse": "Emotion" },
    //           { "text": "Choice text", "emotionalResponse": "Emotion" },
    //           { "text": "Choice text", "emotionalResponse": "Emotion" }
    //         ]
    //       }
    //       If this should be an ending scenario, use:
    //       {
    //         "content": "Conclusion of the story...",
    //         "imagePrompt": "Brief description for image generation",
    //         "isEnding": true,
    //         "feedback": "Brief feedback on the path chosen"
    //       }`
    //         },
    //         {
    //             role: 'user',
    //             content: `The story so far: ${currentScenario.content}\n\nThe user chose: ${selectedChoice.text} (${selectedChoice.emotionalResponse})`
    //         }
    //     ];

    //     // Generate the next scenario
    //     const response = await model.invoke(messages);

    //     let nextScenarioData;
    //     try {
    //         // Handle the response content which might be a string or complex object
    //         const content = typeof response.content === 'string'
    //             ? response.content
    //             : JSON.stringify(response.content);

    //         nextScenarioData = JSON.parse(content);
    //     } catch (error) {
    //         log.error('Failed to parse next scenario response', { error, content: response.content });
    //         return reply.status(500).send({ error: 'Failed to generate next scenario' });
    //     }

    //     // Create the next scenario
    //     const nextScenarioId = utlNewId('scenario');
    //     const timestamp = Timestamp.now();

    //     let choices: StoryChoice[] = [];
    //     if (!nextScenarioData.isEnding && nextScenarioData.choices) {
    //         choices = nextScenarioData.choices.map((choice: { text: string, emotionalResponse: string }) => ({
    //             id: utlNewId('choice'),
    //             text: choice.text,
    //             emotionalResponse: choice.emotionalResponse
    //         }));
    //     }

    //     const nextScenario = new StoryScenarioDocument({
    //         scenarioId: nextScenarioId,
    //         sessionId,
    //         content: nextScenarioData.content,
    //         imagePrompt: nextScenarioData.imagePrompt,
    //         choices,
    //         isEnding: nextScenarioData.isEnding || false,
    //         feedback: nextScenarioData.feedback,
    //         createdAt: timestamp
    //     });

    //     // Save the next scenario
    //     await dbCreateOrUpdate(StoryScenarioDocument, nextScenarioId, nextScenario, sessionId);

    //     // Update the session
    //     selectedChoice.nextScenarioId = nextScenarioId;
    //     session.currentScenarioId = nextScenarioId;
    //     session.path.push(nextScenarioId);
    //     session.completed = nextScenarioData.isEnding || false;

    //     await dbCreateOrUpdate(StorySession, sessionId, session);

    //     // Update the current scenario with the next scenario reference
    //     await dbCreateOrUpdate(StoryScenarioDocument, currentScenario.scenarioId, currentScenario, sessionId);

    //     // Return the next scenario
    //     return reply.status(200).send({
    //         nextScenario: nextScenario.toStoryScenario(),
    //         emotionalProfile: session.emotionalProfile
    //     });
    // } catch (error) {
    //     log.error('Error making choice', { error });
    //     return reply.status(500).send({ error: 'Failed to process choice' });
    // }
};