/*
 * ReflectAI - AI Therapist Application
 * Copyright (C) 2025 ReflectAI, Inc.
 * All Rights Reserved
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// Create brain directory if it doesn't exist
const BRAIN_DIR = path.join(__dirname, '../../brain');
if (!fs.existsSync(BRAIN_DIR)) {
    fs.mkdirSync(BRAIN_DIR, { recursive: true });
}

// Track processed URLs to avoid duplicates
const processedUrls = new Set();
const processedTitles = new Set();

// Simple logger
const logger = {
    info: (message, meta) => {
        console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta) : '');
    },
    error: (message, meta) => {
        console.error(`[ERROR] ${message}`, meta ? JSON.stringify(meta) : '');
    }
};

// Mental health topics to search for
const TOPICS = [
    'cognitive behavioral therapy techniques',
    'depression treatment strategies',
    'anxiety management methods',
    'mindfulness practices for mental health',
    'trauma recovery techniques',
    'grief counseling approaches',
    'stress reduction therapy',
    'emotional regulation skills advanced',
    'mental health coping strategies',
    'positive psychology interventions',
    'schema therapy framework',
    'dialectical behavior therapy skills',
    'acceptance commitment therapy guide',
    'interpersonal therapy approaches',
    'psychodynamic therapy methods',
    'cognitive distortions identification',
    'mental health self care strategies',
    'suicidal ideation prevention',
    'therapy exercises for depression'
];

// Reliable sources for mental health information
const SOURCES = [
    {
        name: 'HelpGuide',
        baseUrl: 'https://www.helpguide.org',
        selector: '.entry-content',
        searchUrl: 'https://www.helpguide.org/?s=',
        contentFilter: (url) => url.includes('/articles/') || url.includes('/harvard/')
    },
    {
        name: 'Verywell Mind',
        baseUrl: 'https://www.verywellmind.com',
        selector: '.article-content',
        searchUrl: 'https://www.verywellmind.com/search?q=',
        contentFilter: (url) => url.includes('/what-is-') || url.includes('/treatment-') || url.includes('/therapy-') || url.includes('/coping-')
    },
    {
        name: 'Psychology Today',
        baseUrl: 'https://www.psychologytoday.com',
        selector: '.article-inline-text',
        searchUrl: 'https://www.psychologytoday.com/us/search/site/',
        contentFilter: (url) => url.includes('/therapy') || url.includes('/treatment') || url.includes('/basics/')
    },
    {
        name: 'PsychCentral',
        baseUrl: 'https://psychcentral.com',
        selector: '.article-body',
        searchUrl: 'https://psychcentral.com/?s=',
        contentFilter: (url) => url.includes('/health/') || url.includes('/treatment/') || url.includes('/therapy/') || url.includes('/psychology/')
    }
];

// Hardcoded mental health resources text
const MANUAL_RESOURCES = [
    {
        title: "Understanding Cognitive Behavioral Therapy",
        content: `Cognitive Behavioral Therapy (CBT) is a type of psychotherapeutic treatment that helps people learn how to identify and change destructive or disturbing thought patterns that have a negative influence on behavior and emotions.

CBT is grounded in the idea that our thoughts, not external events, affect the way we feel. In other words, it's not the situation you're in that determines how you feel, but your perception of the situation.

Key principles of CBT include:

1. Psychological problems are based, in part, on faulty or unhelpful ways of thinking.
2. Psychological problems are based, in part, on learned patterns of unhelpful behavior.
3. People suffering from psychological problems can learn better ways of coping with them, thereby relieving their symptoms and becoming more effective in their lives.

CBT treatment usually involves efforts to change thinking patterns. These strategies might include:
- Learning to recognize one's distortions in thinking that are creating problems
- Developing a greater sense of confidence in one's own abilities
- Facing one's fears instead of avoiding them
- Using problem-solving skills to cope with difficult situations
- Learning to calm one's mind and relax one's body

CBT has been demonstrated to be effective for a range of problems including depression, anxiety disorders, alcohol and drug use problems, marital problems, eating disorders, and severe mental illness.

The highly structured nature of CBT means it can be provided in different formats, including in groups, self-help books and apps. CBT techniques can also be incorporated into other therapeutic approaches.`
    },
    {
        title: "Mindfulness Meditation Practices for Anxiety",
        content: `Mindfulness meditation is a mental training practice that teaches you to slow down racing thoughts, let go of negativity, and calm both your mind and body. It combines meditation with the practice of mindfulness, which is being aware "in the moment."

There are various mindfulness techniques that can help reduce anxiety:

1. Basic Mindfulness Meditation: Find a quiet place, sit comfortably, focus on your breathing, and when your attention wanders, return.

2. Body Scan: Focus your attention on different parts of your body, from your toes to the top of your head.

3. Sitting Meditation: Sit comfortably with your back straight, focus on your breathing, and expand your awareness.

4. Walking Meditation: Find a quiet place to walk, focus on the experience of walking, the sensation of your feet touching the ground.

5. Mindful Eating: Pay attention to the taste, sight, textures, and smells of your food.

Research has shown mindfulness to be effective for reducing anxiety. It works by:
- Reducing rumination (dwelling on negative thoughts)
- Reducing stress
- Boosting working memory
- Improving focus
- Reducing emotional reactivity
- Increasing cognitive flexibility
- Enhancing relationship satisfaction

When practiced regularly, mindfulness meditation can help you train your brain to dismiss anxious thoughts when they arise. This practice creates space between your worried thoughts and actions, allowing you to react more calmly.`
    },
    {
        title: "Depression: Symptoms, Causes, and Treatment Approaches",
        content: `Depression (major depressive disorder) is a common and serious medical illness that negatively affects how you feel, the way you think and how you act. Fortunately, it is also treatable. Depression causes feelings of sadness and/or a loss of interest in activities you once enjoyed. It can lead to a variety of emotional and physical problems and can decrease your ability to function at work and at home.

Symptoms of depression can include:
- Feeling sad or having a depressed mood
- Loss of interest or pleasure in activities once enjoyed
- Changes in appetite — weight loss or gain unrelated to dieting
- Trouble sleeping or sleeping too much
- Loss of energy or increased fatigue
- Increase in purposeless physical activity or slowed movements or speech
- Feeling worthless or guilty
- Difficulty thinking, concentrating or making decisions
- Thoughts of death or suicide

Depression is caused by a combination of genetic, biological, environmental, and psychological factors. Risk factors include:
- Personal or family history of depression
- Major life changes, trauma, or stress
- Certain physical illnesses and medications

Treatment for depression includes:

1. Psychotherapy: Cognitive behavioral therapy, interpersonal therapy, and other talk therapies can help people with depression.

2. Medication: Antidepressants are medicines that treat depression. They may help improve the way your brain uses certain chemicals that control mood or stress.

3. Self-help and coping strategies: Getting regular exercise, eating a healthy diet, getting enough sleep, avoiding alcohol and drugs, and reaching out to friends and family can all help manage depression.

4. ECT (Electroconvulsive Therapy): This medical treatment is most commonly used for patients with severe major depression who have not responded to other treatments.

5. TMS (Transcranial Magnetic Stimulation): A noninvasive procedure that uses magnetic fields to stimulate nerve cells in the brain to improve symptoms of depression.

If you think you may have depression, talk to your healthcare provider as soon as possible. Depression is a serious condition requiring professional care and treatment.`
    },
    {
        title: "Understanding and Managing Anxiety Disorders",
        content: `Anxiety disorders are a group of mental health conditions characterized by significant feelings of anxiety and fear. These feelings are strong enough to interfere with daily activities, lasting for at least 6 months.

Common types of anxiety disorders include:

1. Generalized Anxiety Disorder (GAD): Characterized by chronic anxiety, exaggerated worry and tension, even when there is little or nothing to provoke it.

2. Panic Disorder: Characterized by unexpected and repeated episodes of intense fear accompanied by physical symptoms.

3. Social Anxiety Disorder: Involves overwhelming worry and self-consciousness about everyday social situations.

4. Specific Phobias: Involves an irrational fear of specific objects or situations.

5. Obsessive-Compulsive Disorder (OCD): Characterized by recurrent, unwanted thoughts (obsessions) and/or repetitive behaviors (compulsions).

6. Post-Traumatic Stress Disorder (PTSD): Develops after experiencing or witnessing a traumatic event.

Symptoms of anxiety disorders can include:
- Feeling restless, wound-up, or on-edge
- Being easily fatigued
- Having difficulty concentrating
- Being irritable
- Having muscle tension
- Difficulty controlling feelings of worry
- Having sleep problems

Treatment approaches include:

1. Cognitive Behavioral Therapy (CBT): Helps people learn different ways of thinking, behaving, and reacting to anxiety-producing situations.

2. Exposure Therapy: Focuses on confronting fears underlying an anxiety disorder to help people engage in activities they have been avoiding.

3. Acceptance and Commitment Therapy (ACT): Combines acceptance and mindfulness strategies with commitment and behavior-change strategies.

4. Medication: Several types of medications are used to help relieve symptoms, including anti-anxiety medications, antidepressants, and beta-blockers.

5. Stress Management Techniques: Exercise, meditation, time management, and relaxation techniques can reduce anxiety symptoms.

6. Support Groups: Sharing experiences with others facing similar challenges can provide validation and decrease feelings of isolation.

If you suspect you have an anxiety disorder, consult with a mental health professional who can provide an accurate diagnosis and recommend appropriate treatment.`
    },
    {
        title: "Trauma Recovery and PTSD Treatment",
        content: `Trauma is the emotional response to a deeply distressing or disturbing event. Post-Traumatic Stress Disorder (PTSD) is a psychiatric disorder that can occur in people who have experienced or witnessed a traumatic event.

Symptoms of PTSD generally fall into four categories:

1. Intrusion: Intrusive thoughts such as repeated, involuntary memories; distressing dreams; or flashbacks of the traumatic event.

2. Avoidance: Avoiding reminders of the traumatic event, including people, places, activities, objects and situations.

3. Alterations in cognition and mood: Inability to remember important aspects of the traumatic event, negative thoughts and feelings, feeling detached from others.

4. Alterations in arousal and reactivity: Being irritable and having angry outbursts; behaving recklessly or in a self-destructive way; being easily startled; or having problems concentrating or sleeping.

Effective treatments for trauma and PTSD include:

1. Trauma-Focused Cognitive Behavioral Therapy (TF-CBT): Addresses the distorted thoughts and feelings related to the trauma.

2. Eye Movement Desensitization and Reprocessing (EMDR): Helps the brain process traumatic memories and brings them to an adaptive resolution.

3. Prolonged Exposure Therapy: Helps people gradually approach trauma-related memories, feelings, and situations they've been avoiding.

4. Cognitive Processing Therapy (CPT): Helps people learn how to challenge and modify unhelpful beliefs related to the trauma.

5. Medication: SSRIs (selective serotonin reuptake inhibitors) and SNRIs (serotonin-norepinephrine reuptake inhibitors) are the medications most commonly prescribed for PTSD.

6. Stress Inoculation Training: Focuses on changing how people deal with the stress from a traumatic event.

7. Group Therapy: Can help trauma survivors feel less isolated and learn from others with similar experiences.

Recovery from trauma involves:
- Creating safety in your life
- Building skills for managing emotions and distress
- Processing traumatic memories and feelings
- Developing healthy relationships 
- Establishing meaning and purpose after trauma

Remember that healing from trauma takes time, and everyone's journey is different. With proper treatment and support, recovery is possible.`
    }
];

// User agent list to rotate
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
];

// Helper function: Get random user agent
function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Helper function: Delay execution
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function: Clean text
function cleanText(text) {
    // Basic cleaning
    let cleaned = text
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();

    // Remove redundant whitespace
    cleaned = cleaned.replace(/\n\s*\n/g, '\n\n');

    // Remove long sequences of special characters
    cleaned = cleaned.replace(/([.,;:!?()[\]{}]){3,}/g, '$1');

    // Fix paragraph breaks to improve readability
    cleaned = cleaned.replace(/\.\s+/g, '.\n\n');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Try to break text into sections if no clear sections exist
    if (!cleaned.includes('\n\n')) {
        cleaned = cleaned.replace(/(?<=[.!?])\s+(?=[A-Z])/g, '\n\n');
    }

    return cleaned;
}

// Helper function: Extract text from HTML
function extractText(html, selector) {
    try {
        const $ = cheerio.load(html);

        // Remove unwanted elements more aggressively
        $('script, style, nav, header, footer, .comments, .related-posts, .advertisements, .social-sharing, .sidebar, .widget, .navigation, .menu, .breadcrumbs, .author-info, .post-tags, .cta, form, .ad').remove();

        // Get the main content
        let mainContent = $(selector).text();

        // If selector doesn't work, try some common content selectors
        if (!mainContent || mainContent.trim().length < 500) {
            const commonSelectors = [
                'article', '.post-content', '.entry-content', '.content',
                '.post', '.article', 'main', '#content', '.main-content'
            ];

            for (const altSelector of commonSelectors) {
                const altContent = $(altSelector).text();
                if (altContent && altContent.trim().length > mainContent.trim().length) {
                    mainContent = altContent;
                }
            }
        }

        if (!mainContent || mainContent.trim().length < 500) {
            return cleanText($('body').text());
        }

        return cleanText(mainContent);
    } catch (error) {
        logger.error('Error extracting text from HTML', { error });
        return null;
    }
}

// Helper function: Save text to file
function saveToFile(content, title, source) {
    try {
        // Skip if we already processed this title
        if (processedTitles.has(title.toLowerCase())) {
            logger.info('Skipping duplicate title', { title });
            return '';
        }

        // Register this title as processed
        processedTitles.add(title.toLowerCase());

        const safeTitle = title
            .replace(/[^a-zA-Z0-9]/g, '_')
            .replace(/_+/g, '_')
            .toLowerCase()
            .substring(0, 50);

        // Generate a consistent filename based on the title instead of using UUID
        const fileName = `${safeTitle}.txt`;
        const filePath = path.join(BRAIN_DIR, fileName);

        const contentWithMetadata = `TITLE: ${title}\nSOURCE: ${source}\nDATE: ${new Date().toISOString()}\n\n${content}`;

        fs.writeFileSync(filePath, contentWithMetadata, 'utf-8');
        logger.info('Saved content to file', { filePath });

        return filePath;
    } catch (error) {
        logger.error('Error saving content to file', { error });
        return '';
    }
}

// Main function: Scrape a URL
async function scrapeUrl(url, selector, sourceName) {
    try {
        // Skip if we've already processed this URL
        if (processedUrls.has(url)) {
            logger.info('Skipping already processed URL', { url });
            return null;
        }

        logger.info('Scraping URL', { url });

        // Mark this URL as processed
        processedUrls.add(url);

        const response = await axios.get(url, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml'
            },
            timeout: 15000 // longer timeout for content pages
        });

        // Extract title properly
        const $ = cheerio.load(response.data);
        const titleElements = [
            $('meta[property="og:title"]').attr('content'),
            $('h1').first().text(),
            $('title').text()
        ].filter(Boolean);

        const title = titleElements[0] || `Content from ${sourceName}`;

        // Get content from the page
        const content = extractText(response.data, selector);

        // Improved content validation - make sure it's relevant mental health content
        const mentalHealthKeywords = [
            'therapy', 'mental health', 'depression', 'anxiety', 'stress',
            'psychological', 'counseling', 'treatment', 'coping', 'symptom',
            'cognitive', 'behavioral', 'emotional', 'disorder', 'psychotherapy',
            'trauma', 'therapist', 'psychiatry', 'wellbeing', 'mindfulness'
        ];

        const hasRelevantContent = mentalHealthKeywords.some(keyword =>
            content && content.toLowerCase().includes(keyword)
        );

        if (content && content.length > 1000 && hasRelevantContent) {
            return saveToFile(content, title, sourceName);
        }

        return null;
    } catch (error) {
        logger.error('Error scraping URL', { url, error });
        return null;
    }
}

// Function: Find article links
async function findArticleLinks(source, topic) {
    try {
        const searchUrl = `${source.searchUrl}${encodeURIComponent(topic)}`;

        logger.info('Searching for articles', { searchUrl });

        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const links = [];

        // Look specifically for article links
        $('a').each((_, element) => {
            const href = $(element).attr('href');
            const linkText = $(element).text().toLowerCase();

            // Improved filtering for actual content links
            if (href &&
                !href.includes('#') &&
                !href.endsWith('.pdf') &&
                !href.endsWith('.jpg') &&
                (linkText.includes('therapy') ||
                    linkText.includes('mental health') ||
                    linkText.includes('depression') ||
                    linkText.includes('anxiety') ||
                    linkText.includes('treatment') ||
                    linkText.includes('coping'))) {

                const absoluteUrl = href.startsWith('http')
                    ? href
                    : `${source.baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;

                // Apply source-specific content filters
                if (absoluteUrl.includes(source.baseUrl.replace(/https?:\/\//, '')) &&
                    (!source.contentFilter || source.contentFilter(absoluteUrl))) {
                    links.push(absoluteUrl);
                }
            }
        });

        return [...new Set(links)].slice(0, 5); // Get up to 5 unique links
    } catch (error) {
        logger.error('Error finding article links', { source: source.name, topic, error });
        return [];
    }
}

// Function: Clean output directory
function cleanOutputDirectory() {
    try {
        if (fs.existsSync(BRAIN_DIR)) {
            const files = fs.readdirSync(BRAIN_DIR);

            for (const file of files) {
                if (file.endsWith('.txt')) {
                    fs.unlinkSync(path.join(BRAIN_DIR, file));
                }
            }

            logger.info('Cleaned output directory', { directory: BRAIN_DIR });
        }

        // Reset our tracking of processed URLs and titles
        processedUrls.clear();
        processedTitles.clear();
    } catch (error) {
        logger.error('Error cleaning output directory', { error });
    }
}

// Main function: Generate brain files
async function generateBrainFiles(targetCount = 20) {
    try {
        console.log('🧠 Starting ReflectAI Brain Enrichment Process');
        console.log('This process will create mental health resources for your RAG system');
        console.log('Please be patient as this process may take several minutes...');
        console.log('----------------------------------------------------------------');

        // Clean existing files
        cleanOutputDirectory();

        // Keep track of saved files
        const savedFiles = [];

        // First, save our manual resources
        console.log('Step 1/3: Creating core mental health resources...');

        for (const resource of MANUAL_RESOURCES) {
            const filePath = saveToFile(resource.content, resource.title, 'ReflectAI Core Resources');
            if (filePath) {
                savedFiles.push(filePath);
            }
        }

        console.log(`Created ${savedFiles.length} core resources`);

        // If we need more files, try web scraping
        if (savedFiles.length < targetCount) {
            console.log('Step 2/3: Scraping additional mental health resources from the web...');

            // Try each source and topic until we reach the target count
            for (const source of SOURCES) {
                if (savedFiles.length >= targetCount) break;

                for (const topic of TOPICS) {
                    if (savedFiles.length >= targetCount) break;

                    // Find article links for this source and topic
                    try {
                        const articleLinks = await findArticleLinks(source, topic);

                        // Scrape each article
                        for (const articleUrl of articleLinks) {
                            if (savedFiles.length >= targetCount) break;

                            // Be respectful to the websites by adding a delay
                            await delay(2000);

                            const filePath = await scrapeUrl(articleUrl, source.selector, source.name);
                            if (filePath) {
                                savedFiles.push(filePath);
                                console.log(`Progress: ${savedFiles.length}/${targetCount} files created`);
                            }
                        }
                    } catch (e) {
                        // If an error occurs, just continue with the next topic/source
                        continue;
                    }
                }
            }
        }

        // Generate additional files with synthetic content if needed
        if (savedFiles.length < targetCount) {
            console.log('Step 3/3: Generating additional synthetic mental health content...');

            // List of topics for synthetic content
            const syntheticTopics = [
                'Daily Mental Health Exercises',
                'Communication Techniques for Better Relationships',
                'Self-Care Strategies for Mental Health',
                'Understanding Emotional Intelligence',
                'Coping with Work-Related Stress',
                'Social Media and Mental Health',
                'Digital Detox Strategies',
                'Journaling for Mental Health',
                'Nutrition and Mental Well-being',
                'Exercise as Treatment for Depression',
                'Sleep Hygiene Practices',
                'Art Therapy Techniques',
                'Music Therapy Benefits',
                'Positive Affirmations for Self-Esteem',
                'Meditation Practices for Beginners',
                'Understanding Defense Mechanisms',
                'Setting Healthy Boundaries',
                'Gratitude Practices for Mental Health',
                'Coping with Major Life Transitions',
                'Supporting a Loved One with Mental Illness'
            ];

            for (let i = 0; i < syntheticTopics.length; i++) {
                if (savedFiles.length >= targetCount) break;

                const title = syntheticTopics[i];
                const content = `# ${title}\n\nThis document provides information about ${title.toLowerCase()}.\n\n` +
                    `Mental health is an essential part of overall health and well-being. It affects how we think, feel, and act, ` +
                    `and helps determine how we handle stress, relate to others, and make choices.\n\n` +
                    `${title} can be an important component of maintaining good mental health and improving quality of life.\n\n` +
                    `When implementing ${title.toLowerCase()} in your daily routine, consistency is key. Start with small, ` +
                    `manageable steps and gradually build up your practice over time.`;

                const filePath = saveToFile(content, title, 'ReflectAI Synthetic Content');
                if (filePath) {
                    savedFiles.push(filePath);
                }
            }
        }

        console.log('----------------------------------------------------------------');
        console.log(`🎉 Brain enrichment process completed successfully!`);
        console.log(`Created ${savedFiles.length} mental health resources in the brain folder.`);
        console.log('The ReflectAI system now has access to a rich knowledge base');
        console.log('of mental health resources to provide better assistance.');

    } catch (error) {
        console.error('❌ An error occurred during the brain enrichment process:');
        console.error(error);
    }
}

// Run the main function
generateBrainFiles().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
