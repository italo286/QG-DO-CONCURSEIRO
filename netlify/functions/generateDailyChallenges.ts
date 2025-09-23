import { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
    // Este é o log de diagnóstico. Se ele aparecer, a função foi invocada.
    console.log("[DIAGNOSTIC] Handler started. This confirms the function is being executed.");

    try {
        const secretKey = process.env.DAILY_CHALLENGE_API_KEY;
        const apiKey = event.queryStringParameters?.apiKey;

        if (!secretKey) {
            console.error("[DIAGNOSTIC] FATAL: DAILY_CHALLENGE_API_KEY is not set in the Netlify environment.");
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: "Server configuration error: Missing secret key." }),
            };
        }

        if (apiKey !== secretKey) {
            console.warn("[DIAGNOSTIC] Unauthorized trigger attempt. Incorrect API key received.");
            return { 
                statusCode: 401, 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: "Unauthorized: Invalid API Key" }) 
            };
        }
        
        console.log("[DIAGNOSTIC] API Key validation successful. Function will now return a success message.");

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "Diagnostic test successful. The function endpoint is working correctly." }),
        };

    } catch (error: any) {
        console.error("[DIAGNOSTIC] UNEXPECTED FATAL ERROR in handler", {
            message: error.message,
            stack: error.stack,
        });
        return { 
            statusCode: 500, 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: `An unexpected internal server error occurred.`,
            }),
        };
    }
};
