import { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
    // Este é o log mais importante. Se ele não aparecer, a função não está sendo invocada.
    console.log("--- generateDailyChallenges function handler started ---");

    try {
        const secretKey = process.env.DAILY_CHALLENGE_API_KEY;
        const apiKey = event.queryStringParameters?.apiKey;

        console.log(`Received trigger request. Validating API key...`);

        if (!secretKey) {
            console.error("FATAL: DAILY_CHALLENGE_API_KEY is not set in the Netlify environment.");
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: "Server configuration error: Missing secret key." }),
            };
        }

        if (apiKey !== secretKey) {
            console.warn("Unauthorized trigger attempt. Incorrect API key received.");
            return { 
                statusCode: 401, 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: "Unauthorized: Invalid API Key" }) 
            };
        }
        
        console.log("API Key validation successful. Function will now return a success message.");

        // Para este teste, apenas retornamos sucesso para confirmar que o endpoint funciona.
        
        console.log("--- generateDailyChallenges function handler finished successfully. ---");

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "Test successful. The function endpoint is working correctly." }),
        };

    } catch (error: any) {
        console.error("--- UNEXPECTED FATAL ERROR in handler ---", error.message, error.stack);
        return { 
            statusCode: 500, 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: `An unexpected internal server error occurred: ${error.message}`,
            }),
        };
    }
};
