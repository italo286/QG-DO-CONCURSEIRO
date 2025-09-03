import React, { useState } from 'react';
import { Course, Subject } from '../../types';
import * as GeminiService from '../../services/geminiService';
import { Modal, Button, Spinner } from '../ui';
import { GeminiIcon } from '../Icons';

interface AiFrequencyAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    course: Course;
    allSubjects: Subject[];
    onSaveFrequencies: (frequencyMap: { [id: string]: 'alta' | 'media' | 'baixa' | 'nenhuma' }) => void;
}

export const AiFrequencyAnalysisModal: React.FC<AiFrequencyAnalysisModalProps> = ({ isOpen, onClose, course, allSubjects, onSaveFrequencies }) => {
    const [analysisText, setAnalysisText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAnalyze = async () => {
        if (!analysisText.trim()) {
            setError('Por favor, cole o texto da análise de frequência.');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const courseSubjectIds = new Set(course.disciplines.map(d => d.subjectId));
            const relevantSubjects = allSubjects.filter(s => courseSubjectIds.has(s.id));
            
            const topicsForAnalysis = relevantSubjects.flatMap(s => 
                s.topics.flatMap(t => [
                    { id: t.id, name: t.name },
                    ...t.subtopics.map(st => ({ id: st.id, name: `${t.name} / ${st.name}` }))
                ])
            );

            if (topicsForAnalysis.length === 0) {
                setError('O curso não possui tópicos para analisar. Adicione disciplinas e tópicos primeiro.');
                setIsLoading(false);
                return;
            }

            const frequencyMap = await GeminiService.analyzeTopicFrequencies(analysisText, topicsForAnalysis);
            onSaveFrequencies(frequencyMap);
            onClose();

        } catch (e: any) {
            setError(e.message || 'Ocorreu um erro ao analisar o texto.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Analisar Frequência com IA" size="2xl">
            <div className="space-y-4">
                <p className="text-gray-400">
                    Cole o texto de um relatório ou PDF com as estatísticas de incidência dos tópicos em provas. A IA irá ler o conteúdo e atribuir a frequência para cada tópico do seu curso.
                </p>
                <textarea
                    value={analysisText}
                    onChange={(e) => setAnalysisText(e.target.value)}
                    rows={10}
                    placeholder="Cole o texto aqui..."
                    className="block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500"
                    disabled={isLoading}
                />
                <div className="text-center">
                    <Button onClick={handleAnalyze} disabled={isLoading || !analysisText.trim()}>
                        {isLoading ? <Spinner /> : <><GeminiIcon className="h-5 w-5 mr-2" /> Analisar e Aplicar</>}
                    </Button>
                </div>
                {error && <p className="text-red-400 text-sm text-center" role="alert">{error}</p>}
            </div>
        </Modal>
    );
};