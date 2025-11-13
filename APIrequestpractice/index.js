import readline from 'readline';
import 'dotenv/config.js';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const APIKEY = process.env.OPENROUTER_API_KEY;

if (!APIKEY) {
    console.error('Error: set OPENROUTER_API_KEY en fichero .env');
    process.exit(1);
}

const question = (q) => new Promise((r) => rl.question(q, r));

async function chat(message) {
    try {
        const res = await fetch(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${APIKEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'openrouter/polaris-alpha',
                    messages: [{ role: 'user', content: message }],
                }),
            },
        );

        const data = await res.json();
        if (data.error) {
            console.error('Error de API:', data.error.message || data.error);
        } else if (data.choices?.[0]?.message?.content) {
            console.log('\n' + data.choices[0].message.content + '\n');
        } else {
            console.log(
                'Error: Formato de respuesta inesperado',
                data.error.message || data.error,
            );
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

async function main() {
    while (true) {
        const input = await question('Mensaje: ');
        if (input.toLowerCase() === 'q') {
            rl.close();
            break;
        }
        await chat(input.trim());
    }
}

main();
