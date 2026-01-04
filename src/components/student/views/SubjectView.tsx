
import React, { useState } from 'react';
import { StudentProgress, Subject, Topic, SubTopic, Course } from '../../../types';
import { 
    BookOpenIcon,
    ChevronDownIcon, DocumentTextIcon, ClipboardCheckIcon, GameControllerIcon, 
    FlashcardIcon, TagIcon, ChartLineIcon, VideoCameraIcon, CheckCircleIcon,
    SparklesIcon, SubjectIcon
} from '../../Icons';
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
        if ('subtopics' in content && content.subtopics) {
            total += content.subtopics.reduce((sum, subtopic) => sum + ((getter(subtopic) as any[])?.length || 0), 0);
        }
        return total;
    };

    const summaryItems = [
        { label: 'PDFs', icon: DocumentTextIcon, count: calculateTotal(c => c.fullPdfs) },
        { label: 'Resumos', icon: TagIcon, count: calculateTotal(c => c.summaryPdfs) },
        { label: 'Vídeos', icon: VideoCameraIcon, count: calculateTotal(c => c.videoUrls) },
        { label: 'Questões', icon: ClipboardCheckIcon, count: calculateTotal(c => c.questions) + calculateTotal(c => c.tecQuestions || []) },
    ].filter(item => item.count > 0);

    return (
        <div className="flex items-center flex-wrap gap-3 mt-3">
            {summaryItems.map(item => (
                <div key={item.label} className="flex items-center space-x-1.5 bg-gray-900/40 px-2 py-1 rounded-lg border border-gray-700/30" title={item.label}>
                    <item.icon className="h-3 w-3 text-gray-500" />
                    <span className="text-[10px] font-black text-gray-400">{item.count}</span>
                </div>
            ))}
        </div>
    );
};


export const SubjectView: React.FC<SubjectViewProps> = ({ subject, studentProgress, onTopicSelect, course }) => {
    const [openTopics, setOpenTopics] = useState<{[key: string]: boolean}>({});
    
    const subjectProgressData = studentProgress?.progressByTopic[subject.id];
    const courseDiscipline = course.disciplines.find(d => d.subjectId === subject.id);
    const topicFrequencies = courseDiscipline?.topicFrequencies || {};
    
    const getFrequencyConfig = (freq: Frequency) => {
        switch(freq) {
            case 'alta': return { label: 'ALTA INCIDÊNCIA', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' };
            case 'media': return { label: 'MÉDIA INCIDÊNCIA', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' };
            case 'baixa': return { label: 'BAIXA INCIDÊNCIA', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' };
            default: return null;
        }
    };

    const hasContent = (topic: Topic) => {
        return (topic.fullPdfs?.length || 0) > 0 || 
               (topic.videoUrls?.length || 0) > 0 || 
               (topic.questions?.length || 0) > 0 || 
               (topic.tecQuestions?.length || 0) > 0 ||
               (topic.mindMapUrl);
    };

    const handleTopicAction = (e: React.MouseEvent, topic: Topic) => {
        e.preventDefault();
        if (hasContent(topic)) {
            onTopicSelect(topic);
        } else {
            setOpenTopics(prev => ({ ...prev, [topic.id]: !prev[topic.id] }));
        }
    };

    const renderProgressBar = (score: number) => (
        <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div 
                className={`h-full transition-all ${score >= 0.7 ? 'bg-green-500' : score >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${score * 100}%` }}
            ></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header Disciplina */}
            <div className="bg-gray-800/40 rounded-3xl p-6 border border-gray-700/50 flex items-center gap-6">
                <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl flex-shrink-0"
                    style={{ backgroundColor: subject.color || '#4B5563', boxShadow: `0 8px 25px ${subject.color || '#4B5563'}40` }}
                >
                    <SubjectIcon subjectName={subject.name} className="h-8 w-8 filter drop-shadow-md" />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase">{subject.name}</h2>
                    <p className="text-sm text-gray-400 mt-1 max-w-2xl">{subject.description}</p>
                </div>
            </div>

            <ul className="space-y-4">
                {subject.topics.map(topic => {
                    const topicProgress = subjectProgressData?.[topic.id];
                    const score = topicProgress?.score || 0;
                    const isCompleted = topicProgress?.completed;
                    const freqConfig = getFrequencyConfig(topicFrequencies[topic.id] as Frequency);
                    const isOpen = openTopics[topic.id];
                    const contentAvailable = hasContent(topic);

                    return (
                        <li key={topic.id} className="group">
                            <details 
                                className="bg-gray-800/30 rounded-2xl border border-gray-700/50 group-hover:border-cyan-500/30 transition-all duration-300"
                                open={isOpen}
                                onToggle={(e) => setOpenTopics(prev => ({ ...prev, [topic.id]: (e.target as HTMLDetailsElement).open }))}
                            >
                                <summary className="p-5 cursor-pointer list-none">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex-grow min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                {isCompleted && <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0" />}
                                                <h3 className={`font-black text-lg tracking-tight uppercase transition-colors ${isCompleted ? 'text-gray-400' : 'text-white group-hover:text-cyan-400'}`}>
                                                    {topic.name}
                                                </h3>
                                                {freqConfig && (
                                                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-black border ${freqConfig.bg} ${freqConfig.color} ${freqConfig.border} hidden sm:inline`}>
                                                        {freqConfig.label}
                                                    </span>
                                                )}
                                            </div>
                                            <MaterialSummary content={topic} />
                                        </div>
                                        
                                        <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-gray-700/50 pt-3 md:pt-0">
                                            <div className="flex flex-col items-center md:items-end">
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Performance</span>
                                                <div className="flex items-center gap-3">
                                                    {renderProgressBar(score)}
                                                    <span className={`text-xs font-black font-mono ${score >= 0.7 ? 'text-green-400' : 'text-gray-400'}`}>
                                                        {Math.round(score * 100)}%
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <Button 
                                                onClick={(e) => handleTopicAction(e, topic)} 
                                                className={`text-xs font-black py-2.5 px-6 uppercase tracking-widest shadow-lg shadow-black/20 transition-all active:scale-95 ${!contentAvailable ? 'bg-gray-700 hover:bg-gray-600 border-gray-600' : ''}`}
                                            >
                                                {contentAvailable ? 'Estudar' : 'Ver Subtópicos'}
                                            </Button>
                                            
                                            <ChevronDownIcon className={`h-5 w-5 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>
                                </summary>

                                <div className="border-t border-gray-700/30 bg-gray-900/20 p-5 rounded-b-2xl">
                                    {topic.subtopics.length > 0 ? (
                                        <div className="space-y-3 pl-4 border-l-2 border-gray-800">
                                            {topic.subtopics.map(subtopic => {
                                                const stProgress = subjectProgressData?.[subtopic.id];
                                                const stScore = stProgress?.score || 0;
                                                const stIsCompleted = stProgress?.completed;
                                                const stFreq = getFrequencyConfig(topicFrequencies[subtopic.id] as Frequency);

                                                return (
                                                     <div key={subtopic.id} className="relative group/sub">
                                                        <div className="flex items-center justify-between bg-gray-800/40 p-4 rounded-xl border border-transparent hover:border-gray-700 transition-all">
                                                            <div className="flex-grow">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    {stIsCompleted && <CheckCircleIcon className="h-3 w-3 text-green-500" />}
                                                                    <span className={`text-sm font-bold tracking-tight uppercase ${stIsCompleted ? 'text-gray-500' : 'text-gray-200'}`}>
                                                                        {subtopic.name}
                                                                    </span>
                                                                    {stFreq && <span className={`text-[7px] font-black ${stFreq.color} opacity-70`}>● {stFreq.label}</span>}
                                                                </div>
                                                                <MaterialSummary content={subtopic} />
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <div className="hidden sm:flex flex-col items-end opacity-60">
                                                                    {renderProgressBar(stScore)}
                                                                </div>
                                                                <button 
                                                                    onClick={() => onTopicSelect(subtopic, topic)}
                                                                    className="px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500 hover:text-white font-black text-[10px] uppercase tracking-widest transition-all"
                                                                >
                                                                    Estudar
                                                                </button>
                                                            </div>
                                                        </div>
                                                     </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <p className="text-xs text-gray-600 font-bold uppercase italic tracking-widest">Foco total no tópico principal</p>
                                        </div>
                                    )}
                                </div>
                            </details>
                        </li>
                    )
                })}
            </ul>
        </div>
    );
};
