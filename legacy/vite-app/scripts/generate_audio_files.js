require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Create audio directory if it doesn't exist
const audioDir = path.join(__dirname, '../public/artworks/audio');
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
}

// Load artwork data
const artworkData = require('../public/artworks/content/index.json');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY // Make sure to set this environment variable
});

// Voice configuration using OpenAI voices
const voices = {
    en: 'coral',
    de: 'coral'
};

async function generateAudioFile(text, outputPath, voice) {
    try {
        const mp3 = await openai.audio.speech.create({
            model: 'gpt-4o-mini-tts',
            voice: voice,
            input: text,
            instruction: "Voice Affect: Warm, introspective, and subtly expressive; convey presence and quiet intensity.\n\nTone: Calm and thoughtful, with a gentle sense of reverence — as if guiding the listener through a space filled with meaning.\n\nPacing: Measured and steady, with slight variations to mirror the rhythm of reflection and movement within the artworks.\n\nEmotion: Emotionally resonant but never sentimental — allow a hint of wonder, curiosity, or vulnerability where appropriate.\n\nEmphasis: Highlight philosophical contrasts and key metaphors (\"fragility and flow,\" \"silenced or liberated,\" \"movement frozen in form\") to deepen listener engagement.\n\nPronunciation: Clear and precise, with naturally flowing articulation. Avoid stiffness; let the language breathe.\n\nPauses: Use deliberate pauses after interpretive insights or at shifts in tone to give listeners space for contemplation.",
        });

        // Convert the response to buffer and save it
        const buffer = Buffer.from(await mp3.arrayBuffer());
        fs.writeFileSync(outputPath, buffer);
        
        console.log(`Generated: ${path.basename(outputPath)}`);
    } catch (error) {
        console.error(`Error generating ${outputPath}:`, error.message);
    }
}

async function generateAudioForArtwork(artwork) {
    const languages = ['en', 'de'];
    
    for (const lang of languages) {
        const outputPath = path.join(audioDir, `${artwork.id}-${lang}.mp3`);
        const text = `${artwork.description[lang]}`;
        await generateAudioFile(text, outputPath, voices[lang]);
        
        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

async function generateAllAudio() {
    if (!process.env.OPENAI_API_KEY) {
        console.error('Error: OPENAI_API_KEY environment variable is not set');
        process.exit(1);
    }

    console.log('Starting audio generation using OpenAI TTS...');
    
    // Process artworks sequentially
    for (const artwork of Object.values(artworkData)) {
        console.log(`\nProcessing artwork ${artwork.id}...`);
        await generateAudioForArtwork(artwork);
    }
    
    console.log('\nAll audio files have been generated!');
}

// Run the generation
generateAllAudio().catch(console.error); 