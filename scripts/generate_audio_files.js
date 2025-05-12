require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Create audio directory if it doesn't exist
const audioDir = path.join(__dirname, '../artworks/audio');
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
}

// Load artwork data
const artworkData = require('../artworks/content/index.json');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY // Make sure to set this environment variable
});

// Voice configuration using OpenAI voices
const voices = {
    en: 'onyx',    // Clear, professional English voice
    de: 'onyx'  // Female voice that can handle German well
};

async function generateAudioFile(text, outputPath, voice) {
    try {
        const mp3 = await openai.audio.speech.create({
            model: 'gpt-4o-mini-tts',
            voice: voice,
            input: text,
            instruction: "Lies den folgenden Text so, als wärst du die Stimme eines professionellen Audioguides in einer Kunstausstellung. Sprich ruhig, klar und mit einem leicht kontemplativen, respektvollen Ton. Lass Raum für Gedanken, vermeide übermäßige Dramatik, aber betone wichtige Wendepunkte oder Begriffe leicht. Ziel ist es, die Zuhörer:innen in die Atmosphäre des Kunstwerks eintauchen zu lassen, ohne zu überfordern oder zu langweilen.",
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
        const text = `${artwork.title[lang]}. ${artwork.description[lang]}`;
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