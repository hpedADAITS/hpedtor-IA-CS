import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234';
const IS_WINDOWS = os.platform() === 'win32';

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

/**
 * Check if a CLI tool is available in PATH
 */
export async function checkCLI(tool) {
  const execAsync = promisify(exec);
  try {
    const cmd = IS_WINDOWS ? `where ${tool}` : `which ${tool}`;
    const shell = IS_WINDOWS ? 'cmd.exe' : '/bin/bash';
    await execAsync(cmd, { shell });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Bootstrap LM Studio to ensure CLI is in PATH
 */
export async function bootstrapLMStudio() {
  const execAsync = promisify(exec);
  try {
    let bootstrapCmd;
    if (IS_WINDOWS) {
      const userProfile = process.env.USERPROFILE;
      bootstrapCmd = `cmd /c "${userProfile}\\.lmstudio\\bin\\lms.exe" bootstrap`;
    } else {
      // Linux and macOS
      const homeDir = process.env.HOME;
      bootstrapCmd = `"${homeDir}/.lmstudio/bin/lms" bootstrap`;
    }
    
    await execAsync(bootstrapCmd, { 
      shell: IS_WINDOWS ? 'cmd.exe' : '/bin/bash',
      timeout: 30000 
    });
  } catch (err) {
    // Bootstrap failure is not fatal, continue anyway
    // LM Studio might already be properly installed
  }
}

/**
 * Check if LM Studio server is running
 */
export async function checkServer() {
  try {
    const response = await fetch('http://localhost:1234/health');
    return response.ok;
  } catch (err) {
    return false;
  }
}

/**
 * Get the currently loaded model
 */
export async function getLoadedModel() {
  try {
    const response = await fetch('http://localhost:1234/model');
    const data = await response.json();
    return data?.name || null;
  } catch (err) {
    return null;
  }
}

/**
 * Start LM Studio server
 */
export async function startServer() {
  const execAsync = promisify(exec);
  try {
    const shell = IS_WINDOWS ? 'cmd.exe' : '/bin/bash';
    execAsync('lms server', { shell }).catch(() => {});
  } catch (err) {
    throw new Error(`Failed to start LM Studio server: ${err.message}`);
  }
}

/**
 * Initialize LM Studio
 */
export async function initializeLMStudio() {
  try {
    console.log(`${colors.green}✓ Starting LM Studio initialization${colors.reset}`);

    // Bootstrap LM Studio to ensure CLI is in PATH
    console.log(`${colors.yellow}Bootstrapping LM Studio...${colors.reset}`);
    await bootstrapLMStudio();
    console.log(`${colors.green}✓ LM Studio bootstrap complete${colors.reset}`);

    const lmsExists = await checkCLI('lms');
    if (!lmsExists) {
      console.error(`${colors.red}✗ LM Studio CLI not found. Please install LM Studio from https://lmstudio.ai${colors.reset}`);
      return `${colors.red}Error: lms CLI not installed${colors.reset}`;
    }

    console.log(`${colors.green}✓ LM Studio CLI found${colors.reset}`);

    const serverRunning = await checkServer();
    if (serverRunning) {
      console.log(`${colors.green}✓ LM Studio server is already running on port 1234${colors.reset}`);

      const models = await getLoadedModel();
      if (models && models !== "null") {
        console.log(`${colors.green}✓ Loaded model: ${models}${colors.reset}`);
      } else {
        console.log(`${colors.yellow}⚠ No model is currently loaded${colors.reset}`);
        console.log(`${colors.yellow}Please load a model in LM Studio before using the chatbot${colors.reset}`);
      }
    } else {
      console.log(`${colors.yellow}LM Studio server not detected on port 1234${colors.reset}`);

      await startServer();

      console.log(`${colors.green}LM Studio server started (PID: ${process.pid})${colors.reset}`);

      let ready = false;
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout: Server did not respond within 30s")), 30000);
      });

      console.log(`${colors.yellow}Waiting for LM Studio server to be ready (this may take up to 30 seconds)...${colors.reset}`);

      const checkInterval = setInterval(async () => {
        try {
          const isReady = await checkServer();
          if (isReady) {
            clearInterval(checkInterval);
            console.log(`${colors.green}✓ LM Studio server is ready!${colors.reset}`);
            
            const models = await getLoadedModel();
            if (models && models !== "null") {
              console.log(`${colors.green}✓ Loaded model: ${models}${colors.reset}`);
            } else {
              console.log(`${colors.yellow}⚠ No model is currently loaded${colors.reset}`);
              console.log(`${colors.yellow}Please load a model in LM Studio before using the chatbot${colors.reset}`);
            }
            ready = true;
          }
        } catch (err) {
        }
      }, 1000);

      try {
        await new Promise((resolve, reject) => {
          const checkReady = setInterval(() => {
            if (ready) {
              clearInterval(checkReady);
              resolve();
            }
          }, 500);
        });
      } catch (error) {
        console.log(`${colors.yellow}WARNING: LM Studio server may not be fully ready, but continuing...${colors.reset}`);
        console.log(`${colors.yellow}If the app fails to connect, run: lms server start${colors.reset}`);
      }
    }

  } catch (err) {
    return `${colors.red}Error during initialization: ${err.message}${colors.reset}`;
  }

  return "LM Studio initialized successfully.";
}

/**
 * Call LM Studio API
 */
export async function callLMStudio(message) {
  const res = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content:
            'You are a Rock-Paper-Scissors AI player. Respond ONLY with valid JSON in this exact format: {"move": "piedra"} or {"move": "papel"} or {"move": "tijeras"}. Output ONLY the JSON, no other text. User will try to respond with a move. Please interpret their choice to one of the three.',
        },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 256,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Error en LM Studio: ${res.status}. Asegúrate de que LM Studio esté ejecutándose en ${LM_STUDIO_URL}`,
    );
  }

  const data = await res.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Interpret user input using LM Studio
 */
export async function interpretWithLMStudio(rawInput) {
  const prompt = `El usuario ingresó "${rawInput}" en un juego de Piedra, Papel o Tijeras. Las ÚNICAS jugadas válidas son: piedra, papel o tijeras.
Si "${rawInput}" podría significar una de estas jugadas, responde SOLO con esa jugada.
Si "${rawInput}" es completamente inválida y no significa ninguna de las jugadas válidas, responde SOLO con la palabra: inválido`;

  // Create abort controller with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(
      `${LM_STUDIO_URL}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content:
                'Eres un validador estricto de jugadas. Responde SOLO con una palabra: piedra, papel, tijeras o inválido.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 20,
        }),
        signal: controller.signal,
      },
    );
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Error en LM Studio API: ${res.status}`);
    }

    const data = await res.json();
    const aiResponse = (data.choices?.[0]?.message?.content || '')
      .toLowerCase()
      .trim();

    return aiResponse;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Check if LM Studio is available
 */
export async function isLMStudioAvailable() {
  try {
    await bootstrapLMStudio();
    return await checkCLI('lms');
  } catch (err) {
    return false;
  }
}
