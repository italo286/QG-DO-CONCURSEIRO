
import React from 'react';
import { StudentProgress, Subject, Topic, SubTopic, Course } from '../../../types';
import { ChevronDownIcon, DocumentTextIcon, ClipboardCheckIcon, GameControllerIcon, FlashcardIcon, TagIcon, ChartLineIcon, VideoCameraIcon } from '../../Icons';
import { Button } from '../../ui';

type Frequency = 'alta' | 'media' | 'baixa' | 'nenhuma';

interface SubjectViewProps {
    subject: Subject;
    studentProgress: StudentProgress;
    onTopicSelect: (topic: Topic | SubTopic, parentTopic?: Topic) => void;
    course: Course;
}

const MaterialSummary: React.FC<{ content: Topic | SubTopic }> = ({ content }) => {
    const calculateTotal = (getter: (item: Topic | SubTopic) => any[] | undefined) => {
        let total = (getter(content) as any[])?.length || 0;
        if ('subtopics' in content && content.subtopics) { // Check if it's a Topic
            total += content.subtopics.reduce((sum, subtopic) => sum + ((getter(subtopic) as any[])?.length || 0), 0);
        }
        return total;
    };

    const summaryItems = [
        { label: 'PDFs da Aula', icon: DocumentTextIcon, count: calculateTotal(c => c.fullPdfs) },
        { label: 'PDFs de Resumo', icon: DocumentTextIcon, count: calculateTotal(c => c.summaryPdfs) },
        { label: 'PDFs de Raio X', icon: ChartLineIcon, count: calculateTotal(c => c.raioXPdfs) },
        { label: 'Vídeos', icon: VideoCameraIcon, count: calculateTotal(c => c.videoUrls) },
        { label: 'Questões de Conteúdo', icon: ClipboardCheckIcon, count: calculateTotal(c => c.questions) },
        { label: 'Questões (TEC)', icon: ClipboardCheckIcon, count: calculateTotal(c => c.tecQuestions) },
        { label: 'Jogos', icon: GameControllerIcon, count: calculateTotal(c => c.miniGames) },
        { label: 'Flashcards', icon: FlashcardIcon, count: calculateTotal(c => c.flashcards) },
        { label: 'Glossário', icon: TagIcon, count: calculateTotal(c => c.glossary) },
    ].filter(item => item.count > 0);

    if (summaryItems.length === 0) {
        return null;
    }

    return (
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2">
            {summaryItems.map(item => (
                <div key={item.label} className="flex items-center space-x-1.5 text-gray-400" title={item.label}>
                    <item.icon className="h-4 w-4" />
                    <span className="text-xs font-mono font-semibold">{item.count}</span>
                    <span className="sr-only">{item.label}</span>
                </div>
            ))}
        </div>
    );
};


export const SubjectView: React.FC<SubjectViewProps> = ({ subject, studentProgress, onTopicSelect, course }) => {
    const subjectProgressData = studentProgress?.progressByTopic[subject.id];
    const courseDiscipline = course.disciplines.find(d => d.subjectId === subject.id);
    const topicFrequencies = courseDiscipline?.topicFrequencies || {};
    
    const frequencyColors: { [key in Frequency]?: string } = {
        'alta': '#ef4444',  // red-500
        'media': '#f97316', // orange-500
        'baixa': '#3b82f6', // blue-500
    };
    
    const frequencyTitles: { [key in Frequency]?: string } = {
        'alta': 'Alta Frequência em Provas',
        'media': 'Média Frequência em Provas',
        'baixa': 'Baixa Frequência em Provas',
    };

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <div 
                    className="w-4 h-8 rounded"
                    style={{ backgroundColor: subject.color || 'transparent' }}
                ></div>
                {subject.name}
            </h2>
            <p className="text-gray-400">{subject.description}</p>
            <ul className="space-y-3">
                {subject.topics.map(topic => {
                    const topicProgress = subjectProgressData?.[topic.id];
                    const score = topicProgress?.score !== undefined ? `${Math.round(topicProgress.score * 100)}%` : 'N/A';
                    const frequency = topicFrequencies[topic.id] as Frequency;
                    const topicStyle = {
                        borderLeftColor: topic.color || frequencyColors[frequency] || 'transparent'
                    };

                    return (
                        <li key={topic.id}>
                            <details className="bg-gray-800 rounded-lg border border-gray-700/50 border-l-4" style={topicStyle} title={frequencyTitles[frequency]}>
                                <summary className="p-4 cursor-pointer list-none">
                                    <div className="flex justify-between items-center">
                                        <div className="flex-grow min-w-0">
                                            <h3 className="font-semibold text-lg text-cyan-400 flex items-center">
                                                {topic.name}
                                            </h3>
                                            <MaterialSummary content={topic} />
                                        </div>
                                        <div className="flex items-center space-x-4 flex-shrink-0 ml-4">
                                            <span className="text-sm text-gray-400">Score: {score}</span>
                                            <Button 
                                                onClick={(e) => { e.preventDefault(); onTopicSelect(topic); }} 
                                                className="text-sm py-1 px-3"
                                                style={topic.color ? { backgroundColor: topic.color } : undefined}
                                            >
                                                Estudar
                                            </Button>
                                            <ChevronDownIcon className="h-5 w-5 transition-transform details-open:rotate-180" />
                                        </div>
                                    </div>
                                </summary>
                                <div className="border-t border-gray-700 px-4 pb-4">
                                    {topic.subtopics.length > 0 ? (
                                        <ul className="space-y-2 pt-3">
                                            {topic.subtopics.map(subtopic => {
                                                const subtopicProgress = subjectProgressData?.[subtopic.id];
                                                const subtopicScore = subtopicProgress?.score !== undefined ? `${Math.round(subtopicProgress.score * 100)}%` : 'N/A';
                                                const subtopicFrequency = topicFrequencies[subtopic.id] as Frequency;
                                                const subtopicStyle = {
                                                    borderLeftColor: subtopic.color || frequencyColors[subtopicFrequency] || 'transparent'
                                                };

                                                return (
                                                     <li key={subtopic.id} className="p-2 pl-4 bg-gray-700/50 rounded-md border-l-4" style={subtopicStyle} title={frequencyTitles[subtopicFrequency]}>
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex-grow min-w-0">
                                                                <span className="text-sm text-gray-300 flex items-center">{subtopic.name}</span>
                                                                <MaterialSummary content={subtopic} />
                                                            </div>
                                                            <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                                                                <span className="text-xs text-gray-400">Score: {subtopicScore}</span>
                                                                <Button 
                                                                    onClick={() => onTopicSelect(subtopic, topic)} 
                                                                    className="text-xs py-1 px-2"
                                                                    style={subtopic.color ? { backgroundColor: subtopic.color } : undefined}
                                                                >
                                                                    Estudar
                                                                </Button>
                                                            </div>
                                                        </div>
                                                     </li>
                                                )
                                            })}
                                        </ul>
                                    ) : <p className="text-sm text-gray-500 pt-3">Nenhum subtópico.</p>}
                                </div>
                            </details>
                        </li>
                    )
                })}
            </ul>
        </div>
    );
};
