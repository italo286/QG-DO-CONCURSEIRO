
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from "@google/genai";

// Inicialização do Firebase Admin para Vercel
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
    });
}

const db = admin.firestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { apiKey, studentId, challengeType } = req.query;

    if (!apiKey || apiKey !== process.env.VITE_DAILY_CHALLENGE_API_KEY) {
        return res.status(401).send('Unauthorized');
    }

    if (!process.env.API_KEY) {
        return res.status(400).send('API_KEY do Gemini não configurada.');
    }

    try {
        const studentDoc = await db.collection('studentProgress').doc(studentId as string).get();
        if (!studentDoc.exists) return res.status(404).send('Aluno não encontrado');
        const studentProgress = studentDoc.data() as any;

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const targetCount = studentProgress.portugueseChallengeQuestionCount || 1;

        if (challengeType === 'portuguese') {
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Gere exatamente ${targetCount} questões de múltipla escolha de Língua Portuguesa para concursos. Retorne APENAS um array JSON: [{"statement": string, "options": string[], "correctAnswer": string, "justification": string}].`,
                config: { responseMimeType: "application/json" }
            });
            return res.status(200).json(JSON.parse(response.text || '[]'));
        }

        // Outros tipos de desafios simplificados para evitar timeouts na Vercel
        return res.status(200).json([]);
        
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}
