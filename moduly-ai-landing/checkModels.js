import dotenv from "dotenv";

dotenv.config();

async function run() {
  const key = process.env.GEMINI_API_KEY1;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  const data = await response.json();

  if (data.models) {
    const supportedModels = data.models.filter(m =>
      m.supportedGenerationMethods?.includes('generateContent') &&
      (m.name.includes('flash') || m.name.includes('pro'))
    );

    console.log('\n=== Models with generateContent support ===\n');
    supportedModels.forEach(m => {
      console.log(`Name: ${m.name}`);
      console.log(`  Version: ${m.version}`);
      console.log(`  Input modalities: ${m.inputModalities}`);
      console.log(`  Output modalities: ${m.outputModalities}`);
      console.log(`  Context window: ${m.contextWindowSize}`);
      console.log(`  Generation methods: ${m.supportedGenerationMethods}`);
      console.log('---');
    });
  } else {
    console.log(data);
  }
}

run();
