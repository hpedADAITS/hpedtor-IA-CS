import blessed from 'blessed';
import 'dotenv/config.js';
import fs from 'fs';
import path from 'path';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234';

// ANSI color codes
const COLORS = {
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    white: '\x1b[37m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    bold: '\x1b[1m',
};

// Game settings
const MAX_ROUNDS = 10;

// Game state
let gameState = {
    score: {
        player: 0,
        machine: 0,
    },
    history: {
        player: [],
        machine: [],
    },
    round: 0,
};

// Valid moves in Spanish
const VALID_MOVES = ['piedra', 'papel', 'tijeras'];

// Map user input variations to valid moves
const MOVE_ALIASES = {
    // Spanish
    piedra: 'piedra',
    p: 'piedra',
    stone: 'piedra',
    rock: 'piedra',

    papel: 'papel',
    pa: 'papel',
    paper: 'papel',

    tijeras: 'tijeras',
    t: 'tijeras',
    scissors: 'scissors',
    tijera: 'tijeras',
};

// Normalize user input to valid move
function normalizeMove(input) {
    const lower = input.toLowerCase().trim();
    return MOVE_ALIASES[lower] || null;
}

const WINS = {
    piedra: 'tijeras',
    papel: 'piedra',
    tijeras: 'papel',
};

let selectedProvider = null;
let screen = null;
let logBox = null;
let inputBox = null;
let roundBox = null;
let roundInfoText = `Round: 0/${MAX_ROUNDS}  |  Score: 0-0`;

/**
 * Initialize blessed screen
 */
function initScreen() {
    screen = blessed.screen({
        smartCSR: true,
        mouse: true,
        title: 'Piedra, Papel o Tijeras',
    });

    screen.key(['escape', 'q', 'C-c'], () => {
        return process.exit(0);
    });

    // Title box
    blessed.box({
        parent: screen,
        top: 0,
        left: 0,
        width: '100%',
        height: 3,
        content: `${COLORS.bold}${COLORS.cyan}  PIEDRA, PAPEL O TIJERAS - Análisis Predictivo${COLORS.reset}`,
        border: 'line',
        align: 'center',
        valign: 'middle',
        style: {
            border: {
                fg: 'cyan',
            },
        },
    });

    // Round counter box
    roundBox = blessed.box({
        parent: screen,
        top: 3,
        left: 0,
        width: '100%',
        height: 2,
        content: `Round: 0/${MAX_ROUNDS}  |  Score: 0-0`,
        border: 'line',
        align: 'center',
        valign: 'middle',
        style: {
            fg: 'magenta',
            border: {
                fg: 'magenta',
            },
        },
    });

    // Log box
    logBox = blessed.box({
        parent: screen,
        top: 5,
        left: 0,
        width: '100%',
        height: screen.height - 8,
        border: 'line',
        content: '',
        style: {
            border: {
                fg: 'green',
            },
        },
        scrollable: true,
        alwaysScroll: true,
        mouse: true,
        keys: true,
    });

    // Input box
    inputBox = blessed.textbox({
        parent: screen,
        bottom: 0,
        left: 0,
        width: '100%',
        height: 3,
        name: 'input',
        border: 'line',
        label: ' Entrada (Escribe tu jugada y presiona ENTER) ',
        style: {
            border: {
                fg: 'yellow',
            },
            focus: {
                border: {
                    fg: 'cyan',
                },
            },
        },
        mouse: true,
        keys: true,
        vi: false,
    });

    inputBox.focus();
    screen.render();
}

/**
 * Log message to screen
 */
function log(msg) {
    const current = logBox.getContent();
    logBox.setContent(current + msg + '\n');
    logBox.scroll(logBox.getScroll() + 1);
    screen.render();
}

/**
 * Clear log
 */
function clearLog() {
    logBox.setContent('');
    screen.render();
}

/**
 * Update round counter display
 */
function updateRoundDisplay() {
    roundInfoText = `Round: ${gameState.round}/${MAX_ROUNDS}  |  Score: ${gameState.score.player}-${gameState.score.machine}`;
    roundBox.setContent(roundInfoText);
    roundBox.style.border = { fg: 'magenta' };

    // Force complete screen refresh and reallocation
    try {
        screen.realloc();
    } catch (e) {
        // realloc might not exist, continue
    }
    screen.render();
}

/**
 * Calculate round result
 */
function calculateRoundResult(playerMove, machineMove) {
    if (playerMove === machineMove) return 'tie';
    return WINS[playerMove] === machineMove ? 'win' : 'loss';
}

/**
 * Analyze player pattern
 */
function analyzePlayerPattern(playerHistory) {
    if (playerHistory.length === 0) {
        return {
            prediction: 'piedra',
            predictability: 0,
        };
    }

    const counts = {
        piedra: 0,
        papel: 0,
        tijeras: 0,
    };

    playerHistory.forEach((move) => {
        counts[move]++;
    });

    const mostCommon = Object.keys(counts).reduce((a, b) =>
        counts[a] > counts[b] ? a : b,
    );

    const predictability = (counts[mostCommon] / playerHistory.length) * 100;

    let sequencePattern = null;
    if (playerHistory.length >= 3) {
        const recentMoves = playerHistory.slice(-3);
        sequencePattern = recentMoves.every((m) => m === recentMoves[0])
            ? recentMoves[0]
            : null;
    }

    const prediction = sequencePattern || mostCommon;

    return {
        prediction,
        predictability: Math.round(predictability * 10) / 10,
    };
}

/**
 * Get counter move
 */
function getCounterMove(move) {
    const counters = {
        piedra: 'papel',
        papel: 'tijeras',
        tijeras: 'piedra',
    };
    return counters[move];
}

/**
 * Generate machine response (async - calls API)
 */
async function generateMachineResponse(gameState) {
    const { history } = gameState;
    const analysis = analyzePlayerPattern(history.player);

    let nextMove = null;

    try {
        // Get move from selected provider
        if (selectedProvider === 'openrouter') {
            const prompt = `You are playing Rock-Paper-Scissors. The player's move history is: ${history.player.join(
                ', ',
            )}. Make your next move. Respond with ONLY one word: piedra, papel, or tijeras.`;
            const response = await callOpenRouter(prompt);
            const cleanMove = response.toLowerCase().trim();
            nextMove = VALID_MOVES.includes(cleanMove)
                ? cleanMove
                : getCounterMove(analysis.prediction);
        } else if (selectedProvider === 'lmstudio') {
            const prompt = `You are playing Rock-Paper-Scissors. The player's move history is: ${history.player.join(
                ', ',
            )}. Make your next move. Respond with ONLY one word: piedra, papel, or tijeras.`;
            const response = await callLMStudio(prompt);
            let move = null;
            try {
                const parsed = JSON.parse(response);
                move = parsed.move;
            } catch {
                move = response.toLowerCase().trim();
            }
            nextMove = VALID_MOVES.includes(move)
                ? move
                : getCounterMove(analysis.prediction);
        }
    } catch (err) {
        // Fallback to local counter strategy on API error
        nextMove = getCounterMove(analysis.prediction);
    }

    return {
        nextMove,
        analysis: {
            predictability_percentage: analysis.predictability,
            player_next_move_prediction: analysis.prediction,
        },
    };
}

/**
 * Generate final analysis (with ANSI colors for UI display)
 */
function generateFinalAnalysis(gameState) {
    const { history, score } = gameState;
    const playerMoves = history.player;

    if (playerMoves.length === 0) {
        return 'No moves to analyze.';
    }

    const counts = {
        piedra: 0,
        papel: 0,
        tijeras: 0,
    };

    playerMoves.forEach((move) => {
        counts[move]++;
    });

    const mostCommon = Object.keys(counts).reduce((a, b) =>
        counts[a] > counts[b] ? a : b,
    );
    const predictability = (counts[mostCommon] / playerMoves.length) * 100;

    const deviations = playerMoves.filter((m) => m !== mostCommon).length;
    const deviationPercentage = (deviations / playerMoves.length) * 100;

    return `${COLORS.green}=== ANÁLISIS FINAL DEL JUEGO ===${COLORS.reset}
Puntuación Final: ${COLORS.cyan}Jugador ${score.player}${COLORS.reset} - ${
        COLORS.magenta
    }Máquina ${score.machine}${COLORS.reset}
Movimientos Totales: ${playerMoves.length}

${COLORS.bold}PATRÓN PRINCIPAL DETECTADO:${COLORS.reset}
  "${COLORS.yellow}${mostCommon}${COLORS.reset}" (${
        counts[mostCommon]
    } veces, ${Math.round(predictability * 10) / 10}%)

${COLORS.bold}DISTRIBUCIÓN DE MOVIMIENTOS:${COLORS.reset}
  ${COLORS.yellow}Piedra${COLORS.reset}: ${counts.piedra} (${
        Math.round((counts.piedra / playerMoves.length) * 1000) / 10
    }%)
  ${COLORS.blue}Papel${COLORS.reset}: ${counts.papel} (${
        Math.round((counts.papel / playerMoves.length) * 1000) / 10
    }%)
  ${COLORS.magenta}Tijeras${COLORS.reset}: ${counts.tijeras} (${
        Math.round((counts.tijeras / playerMoves.length) * 1000) / 10
    }%)

${COLORS.bold}DESVIACIONES CLAVE:${COLORS.reset}
  ${deviations} movimientos (${Math.round(deviationPercentage * 10) / 10}%)

${COLORS.green}PREDICTIBILIDAD FINAL: ${Math.round(predictability * 10) / 10}%${
        COLORS.reset
    }`;
}

/**
 * Generate plain text analysis (no ANSI colors - for JSON responses)
 */
function generatePlainTextAnalysis(gameState) {
    const { history, score } = gameState;
    const playerMoves = history.player;

    if (playerMoves.length === 0) {
        return 'No moves to analyze.';
    }

    const counts = {
        piedra: 0,
        papel: 0,
        tijeras: 0,
    };

    playerMoves.forEach((move) => {
        counts[move]++;
    });

    const mostCommon = Object.keys(counts).reduce((a, b) =>
        counts[a] > counts[b] ? a : b,
    );
    const predictability = (counts[mostCommon] / playerMoves.length) * 100;

    const deviations = playerMoves.filter((m) => m !== mostCommon).length;
    const deviationPercentage = (deviations / playerMoves.length) * 100;

    return `=== ANÁLISIS FINAL DEL JUEGO ===
Puntuación Final: Jugador ${score.player} - Máquina ${score.machine}
Movimientos Totales: ${playerMoves.length}

PATRÓN PRINCIPAL DETECTADO:
  "${mostCommon}" (${counts[mostCommon]} veces, ${Math.round(predictability * 10) / 10}%)

DISTRIBUCIÓN DE MOVIMIENTOS:
  Piedra: ${counts.piedra} (${Math.round((counts.piedra / playerMoves.length) * 1000) / 10}%)
  Papel: ${counts.papel} (${Math.round((counts.papel / playerMoves.length) * 1000) / 10}%)
  Tijeras: ${counts.tijeras} (${Math.round((counts.tijeras / playerMoves.length) * 1000) / 10}%)

DESVIACIONES CLAVE:
  ${deviations} movimientos (${Math.round(deviationPercentage * 10) / 10}%)

PREDICTIBILIDAD FINAL: ${Math.round(predictability * 10) / 10}%`;
}

/**
 * Save analysis to disk
 */
function saveAnalysisToDisk(analysis) {
    try {
        // Create Plays directory if it doesn't exist
        const playsDir = path.join(process.cwd(), 'Plays');
        if (!fs.existsSync(playsDir)) {
            fs.mkdirSync(playsDir, { recursive: true });
        }

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = path.join(playsDir, `analysis_${timestamp}.txt`);

        // Write analysis to file
        fs.writeFileSync(filename, analysis, 'utf-8');
        return filename;
    } catch (err) {
        console.error('Error saving analysis to disk:', err);
        return null;
    }
}

/**
 * Provider selection menu
 */
async function selectProvider() {
    return new Promise((resolve) => {
        const list = blessed.list({
            parent: screen,
            mouse: true,
            keys: true,
            vi: true,
            style: {
                selected: {
                    bg: 'blue',
                    fg: 'white',
                    bold: true,
                },
                item: {
                    fg: 'white',
                },
            },
            width: 40,
            height: 10,
            top: 'center',
            left: 'center',
            border: 'line',
            label: ' Seleccionar Proveedor ',
            items: ['OpenRouter (En línea)', 'LM Studio (Local)'],
        });

        list.on('select', (item, index) => {
            selectedProvider = index === 0 ? 'openrouter' : 'lmstudio';
            list.destroy();
            screen.render();

            // Transfer focus to input box after list is destroyed
            setTimeout(() => {
                inputBox.focus();
                screen.render();
                resolve(selectedProvider);
            }, 50);
        });

        list.focus();
        screen.render();
    });
}

/**
 * Call OpenRouter API
 */
async function callOpenRouter(message) {
    if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY no está configurada en el archivo .env');
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'openrouter/polaris-alpha',
            messages: [{ role: 'user', content: message }],
        }),
    });

    const data = await res.json();
    if (data.error) {
        throw new Error(data.error.message || JSON.stringify(data.error));
    }
    return data.choices[0]?.message?.content || '';
}

/**
 * Call LM Studio API
 */
async function callLMStudio(message) {
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
 * Main game loop
 */
async function gameLoop() {
    initScreen();

    log(`${COLORS.cyan}Inicializando juego...${COLORS.reset}`);
    log(`${COLORS.yellow}Verificando proveedores disponibles...${COLORS.reset}`);
    log('');

    await selectProvider();

    clearLog();

    log(`${COLORS.green}Proveedor seleccionado: ${selectedProvider}${COLORS.reset}`);
    log('');
    log(`${COLORS.cyan}¡Juego iniciado!${COLORS.reset}`);
    log(
        `${COLORS.yellow}Ingresa tu jugada: piedra, papel o tijeras${COLORS.reset}`,
    );
    log(`${COLORS.white}Escribe "finish" para terminar el juego${COLORS.reset}`);
    log(
        `${COLORS.blue}Presiona ENTER para enfocarte en el campo de entrada y comenzar a jugar${COLORS.reset}`,
    );
    log('');

    // Set up input handler
    const handleInput = async (data) => {
        const rawInput = (data || '').trim().toLowerCase();
        inputBox.clearValue();
        inputBox.focus();
        screen.render();

        // Prevent empty input
        if (!rawInput || rawInput.length === 0) {
            log(`${COLORS.yellow}Por favor, ingresa una jugada.${COLORS.reset}`);
            setTimeout(() => {
                inputBox.focus();
                screen.render();
            }, 100);
            return;
        }

        log(`${COLORS.white}> ${rawInput}${COLORS.reset}`);

        // Check for JSON finish command
        let isFinish = false;
        try {
            const parsed = JSON.parse(rawInput);
            if (parsed.finish === true) {
                isFinish = true;
            }
        } catch {
            // Not JSON, check for plain "finish"
            if (rawInput === 'finish') {
                isFinish = true;
            }
        }

        if (isFinish) {
            const analysis = generatePlainTextAnalysis(gameState);
            const savedPath = saveAnalysisToDisk(analysis);
            log(analysis);
            log('');
            if (savedPath) {
                log(
                    `${COLORS.green}Análisis guardado en: ${savedPath}${COLORS.reset}`,
                );
            }
            log(
                `${COLORS.yellow}Juego finalizado. Presiona Q o Ctrl-C para salir.${COLORS.reset}`,
            );
            setTimeout(() => {
                inputBox.focus();
                screen.render();
            }, 100);
            return;
        }

        // Normalize user input to valid move
        let input = normalizeMove(rawInput);

        // If not recognized and LM Studio is selected, ask AI to interpret
        if (!input && selectedProvider === 'lmstudio') {
            try {
                log(
                    `${COLORS.yellow}Pidiendo a la IA que interprete: "${rawInput}"...${COLORS.reset}`,
                );
                const prompt = `El usuario ingresó "${rawInput}" en un juego de Piedra, Papel o Tijeras. Las ÚNICAS jugadas válidas son: piedra, papel o tijeras.
Si "${rawInput}" podría significar una de estas jugadas, responde SOLO con esa jugada.
Si "${rawInput}" es completamente inválida y no significa ninguna de las jugadas válidas, responde SOLO con la palabra: inválido`;

                // Create abort controller with timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                try {
                    // Send POST request to LM Studio API
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

                    // Check if AI says it's invalid
                    if (aiResponse === 'inválido') {
                        log(
                            `${COLORS.red}Diagnóstico de IA: "${rawInput}" no es una jugada válida.${COLORS.reset}`,
                        );
                        // Continue to show error below
                    } else {
                        const aiSuggestion = normalizeMove(aiResponse);
                        if (aiSuggestion) {
                            input = aiSuggestion;
                            log(
                                `${COLORS.green}La IA interpretó "${rawInput}" como: ${input}${COLORS.reset}`,
                            );
                        }
                    }
                } catch (fetchErr) {
                    clearTimeout(timeoutId);
                    if (fetchErr.name === 'AbortError') {
                        log(
                            `${COLORS.yellow}Tiempo de espera agotado. LM Studio no respondió en tiempo.${COLORS.reset}`,
                        );
                    } else {
                        log(
                            `${COLORS.yellow}No se pudo conectar con la IA. Verifica que LM Studio esté ejecutándose en ${LM_STUDIO_URL}${COLORS.reset}`,
                        );
                    }
                }
            } catch (err) {
                log(
                    `${COLORS.yellow}Error al procesar tu entrada: ${err.message}${COLORS.reset}`,
                );
            }

            // Restore focus after AI interpretation attempt
            setTimeout(() => {
                inputBox.focus();
                screen.render();
                updateRoundDisplay();
            }, 100);
        }

        if (!input) {
            log(
                `${COLORS.red}Jugada inválida. Intenta: piedra, papel, tijeras, rock, paper, scissors, p, pa o t${COLORS.reset}`,
            );
            // Restore focus on invalid input
            setTimeout(() => {
                inputBox.focus();
                screen.render();
            }, 100);
            return;
        }

        // Check if max rounds reached
        if (gameState.round >= MAX_ROUNDS) {
            log(
                `${COLORS.red}¡Se alcanzó el máximo de rondas (${MAX_ROUNDS})! Juego terminado.${COLORS.reset}`,
            );
            const analysis = generateFinalAnalysis(gameState);
            const plainAnalysis = generatePlainTextAnalysis(gameState);
            const savedPath = saveAnalysisToDisk(plainAnalysis);
            log(analysis);
            log('');
            if (savedPath) {
                log(
                    `${COLORS.green}Análisis guardado en: ${savedPath}${COLORS.reset}`,
                );
            }
            log(`${COLORS.yellow}Presiona Q o Ctrl-C para salir.${COLORS.reset}`);
            setTimeout(() => {
                inputBox.focus();
                screen.render();
            }, 100);
            return;
        }

        try {
            const response = await generateMachineResponse(gameState);
            const machineMove = response.nextMove;
            const result = calculateRoundResult(input, machineMove);

            // Increment round counter
            gameState.round++;

            if (result === 'win') {
                gameState.score.player++;
            } else if (result === 'loss') {
                gameState.score.machine++;
            }

            gameState.history.player.push(input);
            gameState.history.machine.push(machineMove);

            const resultColor =
                result === 'win'
                    ? COLORS.green
                    : result === 'loss'
                    ? COLORS.red
                    : COLORS.yellow;

            log(`${COLORS.cyan}[${roundInfoText}]${COLORS.reset}`);
            log(
                `${COLORS.white}Tú: ${COLORS.cyan}${input}${COLORS.white} vs Máquina: ${COLORS.magenta}${machineMove}${COLORS.reset}`,
            );
            log(`${resultColor}Resultado: ${result.toUpperCase()}${COLORS.reset}`);
            log(
                `${COLORS.blue}Predicción: ${response.analysis.player_next_move_prediction}${COLORS.reset}`,
            );
            log(
                `${COLORS.blue}Precisión: ${response.analysis.predictability_percentage}%${COLORS.reset}`,
            );
            log(
                `${COLORS.cyan}Puntuación: ${gameState.score.player} - ${gameState.score.machine}${COLORS.reset}`,
            );
            log('');

            // Update round display and redraw UI
            updateRoundDisplay();

            // Force full screen redraw and restore focus
            setTimeout(() => {
                try {
                    screen.realloc();
                } catch (e) {
                    // continue
                }
                screen.render();
                inputBox.focus();
            }, 100);
        } catch (err) {
            log(`${COLORS.red}Error: ${err.message}${COLORS.reset}`);
            setTimeout(() => {
                screen.render();
                inputBox.focus();
            }, 100);
        }
    };

    inputBox.on('submit', handleInput);
}

gameLoop().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
