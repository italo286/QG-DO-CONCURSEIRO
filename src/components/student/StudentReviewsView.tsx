import React, { useState, useMemo, useEffect } from 'react';
import { StudentProgress, Question, ReviewSession, Flashcard, Subject, Course, SubTopic } from '../../types';
import { Card, Button, Spinner, Modal } from '../ui';
import { GeminiIcon, CycleIcon, FlashcardIcon, ChevronDownIcon, AdjustmentsHorizontalIcon } from '../Icons';
import { FlashcardPlayer } from './FlashcardPlayer';
import * as GeminiService from '../../services/geminiService';
import { getLocalDateISOString } from '../../utils';

type IncorrectQuestionWithContext = Question & {
    subjectId: string;
    subjectName: string;
    topicId: string;
    topicName: string;
};

// Helper component for number inputs to allow continuous typing
const SettingsNumberInput: React.FC<{
    value: number | undefined;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    id: string;
}> = ({ value, onChange, min, max, id }) => {
    // Use a string for local state to allow empty input
    const [localValue, setLocalValue] = useState<string>(value?.toString() ?? '');

    useEffect(() => {
        // Update local state if the prop changes from outside
        setLocalValue(value?.toString() ?? '');
    }, [value]);

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        let num = parseInt(e.target.value, 10);
        
        if (isNaN(num)) {
            num = min ?? 1;
        }
        
        if (max && num > max) num = max;
        if (min && num < min) num = min;

        if (num !== value) {
             onChange(num);
        }
        setLocalValue(num.toString());
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
    };

    return (
        <input
            type="number"
            id={id}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            min={min}
            max={max}
            className="mt-1 block w-24 bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white"
        />
    );
};

// Moved outside the main component to prevent re-creation on every render, fixing the scroll jump issue.
const SettingsContent: React.FC<{
    challengeType: 'review' | 'glossary',
    localSettings: Partial<StudentProgress>,
    enrolledSubjects: Subject[],
    studentProgress: StudentProgress,
    allQuestionsWithContext: IncorrectQuestionWithContext[],
    handleLocalSettingsChange: (field: keyof StudentProgress, value: any) => void,
    handleLocalTopicSelectionChange: (topicId: string, subjectId: string, isChecked: boolean, challengeType: 'review' | 'glossary') => void,
    handleLocalSubjectSelectionChange: (subjectId: string, isChecked: boolean, challengeType: 'review' | 'glossary') => void,
}> = ({ challengeType, localSettings, enrolledSubjects, studentProgress, allQuestionsWithContext, handleLocalSettingsChange, handleLocalTopicSelectionChange, handleLocalSubjectSelectionChange }) => {
    const modeKey = challengeType === 'review' ? 'dailyReviewMode' : 'glossaryChallengeMode';
    const topicIdsKey = challengeType === 'review' ? 'advancedReviewTopicIds' : 'advancedGlossaryTopicIds';

    const availableQuestionsCount = useMemo(() => {
        if (challengeType !== 'review' || localSettings.dailyReviewMode !== 'advanced') {
            return null;
        }

        const {
            advancedReviewSubjectIds: subjectIds,
            advancedReviewTopicIds: topicIds,
            advancedReviewQuestionType: questionType = 'incorrect',
        } = localSettings;

        if (!subjectIds || subjectIds.length === 0) {
            return 0;
        }

        let filteredQuestions = allQuestionsWithContext;

        const subjectIdSet = new Set(subjectIds);
        filteredQuestions = filteredQuestions.filter(q => subjectIdSet.has(q.subjectId));

        if (topicIds && topicIds.length > 0) {
            const topicIdSet = new Set(topicIds);
            filteredQuestions = filteredQuestions.filter(q => topicIdSet.has(q.topicId));
        }

        if (questionType === 'mixed') {
            return filteredQuestions.length;
        }

        const attemptedIds = new Set<string>();
        const correctIds = new Set<string>();

        Object.values(studentProgress.progressByTopic).forEach(subject => {
            Object.values(subject).forEach(topic => {
                topic.lastAttempt.forEach(attempt => {
                    attemptedIds.add(attempt.questionId);
                    if (attempt.isCorrect) {
                        correctIds.add(attempt.questionId);
                    }
                });
            });
        });
        studentProgress.reviewSessions.forEach(session => {
            (session.attempts || []).forEach(attempt => {
                attemptedIds.add(attempt.questionId);
                if (attempt.isCorrect) {
                    correctIds.add(attempt.questionId);
                }
            });
        });

        const incorrectIds = new Set<string>();
        attemptedIds.forEach(id => {
            if (!correctIds.has(id)) {
                incorrectIds.add(id);
            }
        });

        switch (questionType) {
            case 'unanswered':
                return filteredQuestions.filter(q => !attemptedIds.has(q.id)).length;
            case 'incorrect':
                return filteredQuestions.filter(q => incorrectIds.has(q.id)).length;
            case 'correct':
                return filteredQuestions.filter(q => correctIds.has(q.id)).length;
            default:
                return 0;
        }
    }, [localSettings, allQuestionsWithContext, studentProgress, challengeType]);

    const availableGlossaryTermsCount = useMemo(() => {
        if (challengeType !== 'glossary' || localSettings.glossaryChallengeMode !== 'advanced') {
            return null;
        }
    
        const {
            advancedGlossarySubjectIds: subjectIds,
            advancedGlossaryTopicIds: topicIds,
        } = localSettings;
    
        if (!subjectIds || subjectIds.length === 0) {
            return 0;
        }
    
        const allGlossaryTermsWithContext = enrolledSubjects.flatMap(subject =>
            (subject.topics || []).flatMap(topic => [
                ...(topic.glossary || []).map(term => ({ ...term, subjectId: subject.id, topicId: topic.id })),
                ...(topic.subtopics || []).flatMap(subtopic =>
                    (subtopic.glossary || []).map(term => ({ ...term, subjectId: subject.id, topicId: subtopic.id }))
                )
            ])
        );
        
        let filteredTerms = allGlossaryTermsWithContext;
    
        const subjectIdSet = new Set(subjectIds);
        filteredTerms = filteredTerms.filter(term => subjectIdSet.has(term.subjectId));
    
        if (topicIds && topicIds.length > 0) {
            const topicIdSet = new Set(topicIds);
            filteredTerms = filteredTerms.filter(term => topicIdSet.has(term.topicId));
        }
        
        const uniqueTerms = Array.from(new Map(filteredTerms.map(item => [item.term, item])).values());
    
        return uniqueTerms.length;
    
    }, [localSettings, enrolledSubjects, challengeType]);

    const handleClearSelection = () => {
        if (challengeType === 'review') {
            handleLocalSettingsChange('advancedReviewSubjectIds', []);
            handleLocalSettingsChange('advancedReviewTopicIds', []);
        } else { // 'glossary'
            handleLocalSettingsChange('advancedGlossarySubjectIds', []);
            handleLocalSettingsChange('advancedGlossaryTopicIds', []);
        }
    };


    return (
         <div className="space-y-6">
             <fieldset className="flex flex-col sm:flex-row gap-4">
                <legend className="text-base font-medium text-gray-200 mb-2 w-full">Modo do Desafio</legend>
                <div>
                    <input
                        type="radio" id={`${challengeType}-mode-standard`} name={`${challengeType}-mode`} value="standard"
                        checked={localSettings[modeKey] === 'standard' || !localSettings[modeKey]}
                        onChange={(e) => handleLocalSettingsChange(modeKey, e.target.value)} className="sr-only peer"
                    />
                    <label htmlFor={`${challengeType}-mode-standard`} className="block p-4 rounded-lg border-2 cursor-pointer peer-checked:border-cyan-500 peer-checked:bg-cyan-900/50 border-gray-700 bg-gray-800 transition-all">
                        <p className="font-bold">Padrão</p>
                        <p className="text-sm text-gray-400">Seleção automática de todo o conteúdo.</p>
                    </label>
                </div>
                <div>
                    <input
                        type="radio" id={`${challengeType}-mode-advanced`} name={`${challengeType}-mode`} value="advanced"
                        checked={localSettings[modeKey] === 'advanced'}
                        onChange={(e) => handleLocalSettingsChange(modeKey, e.target.value)} className="sr-only peer"
                    />
                    <label htmlFor={`${challengeType}-mode-advanced`} className="block p-4 rounded-lg border-2 cursor-pointer peer-checked:border-cyan-500 peer-checked:bg-cyan-900/50 border-gray-700 bg-gray-800 transition-all">
                        <p className="font-bold">Avançado</p>
                        <p className="text-sm text-gray-400">Personalize os detalhes do desafio.</p>
                    </label>
                </div>
            </fieldset>
            
            {localSettings[modeKey] === 'advanced' && (
                <div className="animate-fade-in space-y-6">
                    {(challengeType === 'review' || challengeType === 'glossary') && (
                         <div className="grid grid-cols-2 gap-4">
                            {challengeType === 'review' ? (
                                <>
                                <div>
                                    <label htmlFor="timer-duration" className="block text-sm font-medium text-gray-300">Duração do Timer</label>
                                    <select
                                        id="timer-duration"
                                        value={localSettings.advancedReviewTimerDuration || 300}
                                        onChange={(e) => handleLocalSettingsChange('advancedReviewTimerDuration', e.target.value === 'unlimited' ? 'unlimited' : parseInt(e.target.value, 10))}
                                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white"
                                    >
                                        <option value={300}>5 minutos</option>
                                        <option value={600}>10 minutos</option>
                                        <option value={900}>15 minutos</option>
                                        <option value="unlimited">Desativado</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="max-attempts" className="block text-sm font-medium text-gray-300">Nº de Tentativas</label>
                                    <select
                                        id="max-attempts"
                                        value={localSettings.advancedReviewMaxAttempts || 1}
                                        onChange={(e) => handleLocalSettingsChange('advancedReviewMaxAttempts', e.target.value === 'unlimited' ? 'unlimited' : parseInt(e.target.value, 10))}
                                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white"
                                    >
                                        <option value={1}>1 Tentativa</option>
                                        <option value={3}>3 Tentativas</option>
                                        <option value={5}>5 Tentativas</option>
                                        <option value="unlimited">Ilimitadas</option>
                                    </select>
                                </div>
                                </>
                            ) : (
                                <>
                                <div>
                                    <label htmlFor="glossary-timer-duration" className="block text-sm font-medium text-gray-300">Duração do Timer</label>
                                    <select
                                        id="glossary-timer-duration"
                                        value={localSettings.glossaryChallengeTimerDuration || 300}
                                        onChange={(e) => handleLocalSettingsChange('glossaryChallengeTimerDuration', e.target.value === 'unlimited' ? 'unlimited' : parseInt(e.target.value, 10))}
                                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white"
                                    >
                                        <option value={180}>3 minutos</option>
                                        <option value={300}>5 minutos</option>
                                        <option value={600}>10 minutos</option>
                                        <option value="unlimited">Desativado</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="glossary-max-attempts" className="block text-sm font-medium text-gray-300">Nº de Tentativas</label>
                                    <select
                                        id="glossary-max-attempts"
                                        value={localSettings.glossaryChallengeMaxAttempts || 1}
                                        onChange={(e) => handleLocalSettingsChange('glossaryChallengeMaxAttempts', e.target.value === 'unlimited' ? 'unlimited' : parseInt(e.target.value, 10))}
                                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white"
                                    >
                                        <option value={1}>1 Tentativa</option>
                                        <option value={3}>3 Tentativas</option>
                                        <option value={5}>5 Tentativas</option>
                                        <option value="unlimited">Ilimitadas</option>
                                    </select>
                                </div>
                                </>
                            )}
                        </div>
                    )}
                    {challengeType === 'review' && (
                        <fieldset>
                            <legend className="text-sm font-medium text-gray-300 mb-2">Tipo de Questões a Revisar</legend>
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                                {['incorrect', 'correct', 'unanswered', 'mixed'].map(type => (
                                    <label key={type} className="flex items-center space-x-2">
                                        <input type="radio" name="questionType" value={type} checked={(localSettings.advancedReviewQuestionType || 'incorrect') === type} onChange={(e) => handleLocalSettingsChange('advancedReviewQuestionType', e.target.value)} className="h-4 w-4 text-cyan-600 bg-gray-700 border-gray-600 focus:ring-cyan-500"/>
                                        <span className="text-sm">{ { incorrect: 'Erradas', correct: 'Certas', unanswered: 'Não Respondidas', mixed: 'Misto' }[type] }</span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                    )}

                    {challengeType === 'review' && availableQuestionsCount !== null && (
                        <div className="p-3 bg-gray-900/50 rounded-lg text-center border border-gray-700">
                            <p className="font-bold text-cyan-400 text-2xl animate-fade-in">{availableQuestionsCount}</p>
                            <p className="text-sm text-gray-400">questões disponíveis com esta configuração.</p>
                        </div>
                    )}

                    {challengeType === 'glossary' && availableGlossaryTermsCount !== null && (
                        <div className="p-3 bg-gray-900/50 rounded-lg text-center border border-gray-700">
                            <p className="font-bold text-cyan-400 text-2xl animate-fade-in">{availableGlossaryTermsCount}</p>
                            <p className="text-sm text-gray-400">termos disponíveis com esta configuração.</p>
                        </div>
                    )}

                    {challengeType === 'review' ? (
                        <div>
                            <label htmlFor="question-count-review" className="block text-sm font-medium text-gray-300">Nº de Questões por Disciplina</label>
                            <SettingsNumberInput
                                id="question-count-review"
                                value={localSettings.advancedReviewQuestionCount}
                                onChange={(num) => handleLocalSettingsChange('advancedReviewQuestionCount', num)}
                                min={1}
                                max={20}
                            />
                        </div>
                    ) : (
                         <div>
                            <label htmlFor="question-count-glossary" className="block text-sm font-medium text-gray-300">Nº de Termos no Desafio</label>
                            <SettingsNumberInput
                                id="question-count-glossary"
                                value={localSettings.glossaryChallengeQuestionCount}
                                onChange={(num) => handleLocalSettingsChange('glossaryChallengeQuestionCount', num)}
                                min={3}
                                max={Math.min(15, availableGlossaryTermsCount ?? 15)}
                            />
                        </div>
                    )}

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold text-gray-200">Disciplinas e Tópicos para o Desafio</h4>
                            <button
                                type="button"
                                onClick={handleClearSelection}
                                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded hover:bg-cyan-900/50"
                            >
                                Limpar Seleção
                            </button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 border border-gray-700 rounded-lg p-2">
                            {enrolledSubjects.map(subject => {
                                const allContentIds = (subject.topics || []).flatMap(t => [t.id, ...(t.subtopics || []).map(st => st.id)]);
                                const selectedTopicIds = new Set(localSettings[topicIdsKey] || []);
                                const includedCount = allContentIds.filter(id => selectedTopicIds.has(id)).length;
                                const isAllSelected = includedCount > 0 && includedCount === allContentIds.length;
                                const isIndeterminate = includedCount > 0 && !isAllSelected;

                                return (
                                    <details key={subject.id} className="bg-gray-800/50 rounded-md">
                                        <summary className="flex items-center p-2 cursor-pointer list-none gap-3">
                                            <input type="checkbox" checked={isAllSelected} ref={el => { if(el) el.indeterminate = isIndeterminate; }} onChange={(e) => handleLocalSubjectSelectionChange(subject.id, e.target.checked, challengeType)} className="h-5 w-5 rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-600"/>
                                            <span className="text-sm font-medium flex-grow">{subject.name}</span>
                                            <ChevronDownIcon className="h-4 w-4 transition-transform details-open:rotate-180" />
                                        </summary>
                                        <div className="pt-2 pl-8 space-y-1">
                                            {(subject.topics || []).map(topic => (
                                                <React.Fragment key={topic.id}>
                                                    <label className="flex items-center space-x-2 p-1 text-sm cursor-pointer"><input type="checkbox" checked={selectedTopicIds.has(topic.id)} onChange={(e) => handleLocalTopicSelectionChange(topic.id, subject.id, e.target.checked, challengeType)} className="h-4 w-4" /><span>{topic.name}</span></label>
                                                    {(topic.subtopics || []).map((subtopic: SubTopic) => (<label key={subtopic.id} className="flex items-center space-x-2 p-1 pl-4 text-xs cursor-pointer"><input type="checkbox" checked={selectedTopicIds.has(subtopic.id)} onChange={(e) => handleLocalTopicSelectionChange(subtopic.id, subject.id, e.target.checked, challengeType)} className="h-4 w-4"/><span>{subtopic.name}</span></label>))}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </details>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


export const StudentReviewsView: React.FC<{
    studentProgress: StudentProgress;
    allSubjects: Subject[];
    enrolledCourses: Course[];
    onStartReview: (session: ReviewSession) => void;
    onGenerateSmartReview: () => void;
    onGenerateSrsReview: (questions: Question[]) => void;
    onGenerateSmartFlashcards: (questions: Question[]) => Promise<void>;
    onFlashcardReview: (flashcardId: string, performance: 'good' | 'bad') => void;
    allQuestions: Question[];
    incorrectQuestions: IncorrectQuestionWithContext[];
    isGenerating: boolean;
    srsFlashcardsDue: Flashcard[];
    onUpdateStudentProgress: (newProgress: StudentProgress, fromState?: StudentProgress | null) => void;
}> = ({ studentProgress, allSubjects, enrolledCourses, onStartReview, onGenerateSmartReview, onGenerateSrsReview, onGenerateSmartFlashcards, onFlashcardReview, allQuestions, incorrectQuestions, isGenerating, srsFlashcardsDue, onUpdateStudentProgress }) => {

    const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
    const [isFlashcardPlayerOpen, setIsFlashcardPlayerOpen] = useState(false);
    const [filterSubject, setFilterSubject] = useState('');
    const [filterTopic, setFilterTopic] = useState('');
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [settingsTab, setSettingsTab] = useState<'review' | 'glossary' | 'portuguese'>('review');
    const [localSettings, setLocalSettings] = useState<Partial<StudentProgress>>({});
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    const allQuestionsWithContext = useMemo(() => {
        return allSubjects.flatMap(subject => 
            (subject.topics || []).flatMap(topic => 
                [
                    ...(topic.questions || []).map(q => ({...q, subjectId: subject.id, topicId: topic.id, topicName: topic.name, subjectName: subject.name})),
                    ...(topic.tecQuestions || []).map(q => ({...q, subjectId: subject.id, topicId: topic.id, topicName: topic.name, subjectName: subject.name})),
                    ...(topic.subtopics || []).flatMap(st => [
                        ...(st.questions || []).map(q => ({...q, subjectId: subject.id, topicId: st.id, topicName: `${topic.name} / ${st.name}`, subjectName: subject.name})),
                        ...(st.tecQuestions || []).map(q => ({...q, subjectId: subject.id, topicId: st.id, topicName: `${topic.name} / ${st.name}`, subjectName: subject.name})),
                    ])
                ]
            )
        );
    }, [allSubjects]);

    useEffect(() => {
        if (isSettingsModalOpen) {
            // Initialize with defaults to prevent sending 'undefined' to Firestore
            setLocalSettings({
                dailyReviewMode: studentProgress.dailyReviewMode ?? 'standard',
                advancedReviewSubjectIds: studentProgress.advancedReviewSubjectIds ?? [],
                advancedReviewTopicIds: studentProgress.advancedReviewTopicIds ?? [],
                advancedReviewQuestionType: studentProgress.advancedReviewQuestionType ?? 'incorrect',
                advancedReviewQuestionCount: studentProgress.advancedReviewQuestionCount ?? 5,
                advancedReviewTimerDuration: studentProgress.advancedReviewTimerDuration ?? 300,
                advancedReviewMaxAttempts: studentProgress.advancedReviewMaxAttempts ?? 1,
                
                glossaryChallengeMode: studentProgress.glossaryChallengeMode ?? 'standard',
                advancedGlossarySubjectIds: studentProgress.advancedGlossarySubjectIds ?? [],
                advancedGlossaryTopicIds: studentProgress.advancedGlossaryTopicIds ?? [],
                glossaryChallengeQuestionCount: studentProgress.glossaryChallengeQuestionCount ?? 5,
                glossaryChallengeTimerDuration: studentProgress.glossaryChallengeTimerDuration ?? 300,
                glossaryChallengeMaxAttempts: studentProgress.glossaryChallengeMaxAttempts ?? 1,
                
                portugueseChallengeQuestionCount: studentProgress.portugueseChallengeQuestionCount ?? 1,
                portugueseChallengeTimerDuration: studentProgress.portugueseChallengeTimerDuration ?? 300,
                portugueseChallengeMaxAttempts: studentProgress.portugueseChallengeMaxAttempts ?? 1,
            });
        }
    }, [isSettingsModalOpen, studentProgress]);

    const enrolledSubjects = useMemo(() => {
        const subjectIdsInCourses = new Set(enrolledCourses.flatMap(c => c.disciplines.map(d => d.subjectId)));
        return allSubjects.filter(s => subjectIdsInCourses.has(s.id));
    }, [enrolledCourses, allSubjects]);
    
    const handleLocalSettingsChange = (field: keyof StudentProgress, value: any) => {
        setLocalSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleLocalTopicSelectionChange = (
        topicId: string, 
        subjectId: string, 
        isChecked: boolean, 
        challengeType: 'review' | 'glossary'
    ) => {
        setLocalSettings(prev => {
            const topicIdsKey = challengeType === 'review' ? 'advancedReviewTopicIds' : 'advancedGlossaryTopicIds';
            const subjectIdsKey = challengeType === 'review' ? 'advancedReviewSubjectIds' : 'advancedGlossarySubjectIds';
            
            const currentSelectedTopicIds = prev[topicIdsKey] || [];
            const newSelectedTopicIds = isChecked
                ? [...currentSelectedTopicIds, topicId]
                : currentSelectedTopicIds.filter(id => id !== topicId);
            
            const currentSelectedSubjectIds = prev[subjectIdsKey] || [];
            const newSelectedSubjectIds = new Set(currentSelectedSubjectIds);
            if (isChecked) {
                newSelectedSubjectIds.add(subjectId);
            }

            return {
                ...prev,
                [topicIdsKey]: newSelectedTopicIds,
                [subjectIdsKey]: Array.from(newSelectedSubjectIds),
            };
        });
    };

    const handleLocalSubjectSelectionChange = (
        subjectId: string, 
        isChecked: boolean, 
        challengeType: 'review' | 'glossary'
    ) => {
        const subject = enrolledSubjects.find(s => s.id === subjectId);
        if (!subject) return;

        setLocalSettings(prev => {
            const topicIdsKey = challengeType === 'review' ? 'advancedReviewTopicIds' : 'advancedGlossaryTopicIds';
            const subjectIdsKey = challengeType === 'review' ? 'advancedReviewSubjectIds' : 'advancedGlossarySubjectIds';

            const allContentIds = (subject.topics || []).flatMap(t => [t.id, ...(t.subtopics || []).map(st => st.id)]);
            const currentSelectedTopicIds = prev[topicIdsKey] || [];
            
            const newSelectedTopicIds = isChecked
                ? [...new Set([...currentSelectedTopicIds, ...allContentIds])]
                : currentSelectedTopicIds.filter(id => !allContentIds.includes(id));
            
            const currentSelectedSubjectIds = prev[subjectIdsKey] || [];
            const newSelectedSubjectIds = isChecked
                ? [...new Set([...currentSelectedSubjectIds, subjectId])]
                : currentSelectedSubjectIds.filter(id => id !== subjectId);

            return {
                ...prev,
                [topicIdsKey]: newSelectedTopicIds,
                [subjectIdsKey]: newSelectedSubjectIds,
            };
        });
    };

    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        let newProgress = { ...studentProgress, ...localSettings };

        // Check if portugueseChallengeQuestionCount has changed and needs an immediate update
        const oldPrtCount = studentProgress.portugueseChallengeQuestionCount || 1;
        const newPrtCount = localSettings.portugueseChallengeQuestionCount || 1;
        const todayISO = getLocalDateISOString(new Date());

        if (newPrtCount > oldPrtCount && newProgress.portugueseChallenge?.date === todayISO) {
            const currentChallenge = newProgress.portugueseChallenge;
            const currentQuestionCount = currentChallenge.items.length;

            if (newPrtCount > currentQuestionCount) {
                const questionsToAdd = newPrtCount - currentQuestionCount;
                try {
                    const newQuestions = await GeminiService.generatePortugueseChallenge(questionsToAdd);
                    const newQuestionsWithIds = newQuestions.map((q, i) => ({ ...q, id: `port-challenge-${todayISO}-add-${currentQuestionCount + i}` }));
                    
                    currentChallenge.items.push(...newQuestionsWithIds);

                    // If the challenge was completed, un-complete it so the user can answer the new questions
                    if (currentChallenge.isCompleted) {
                        currentChallenge.isCompleted = false;
                    }
                    
                    newProgress = { ...newProgress, portugueseChallenge: { ...currentChallenge } };
                } catch (e) {
                    console.error("Failed to add questions to Portuguese challenge:", e);
                }
            }
        }
        
        onUpdateStudentProgress(newProgress, studentProgress);
        setIsSavingSettings(false);
        setIsSettingsModalOpen(false);
    };

    const filteredIncorrectQuestions = useMemo(() => {
        if (!filterSubject) return incorrectQuestions;
        const bySubject = incorrectQuestions.filter(q => q.subjectId === filterSubject);
        if (!filterTopic) return bySubject;
        return bySubject.filter(q => q.topicId === filterTopic || q.topicId.startsWith(`${filterTopic}-`));
    }, [incorrectQuestions, filterSubject, filterTopic]);

    const topicsForSelectedSubject = useMemo(() => {
        if (!filterSubject) return [];
        const subject = allSubjects.find(s => s.id === filterSubject);
        if (!subject) return [];
        return (subject.topics || []).flatMap(t => [{id: t.id, name: t.name}, ...(t.subtopics || []).map(st => ({id: st.id, name: `${t.name} / ${st.name}`}))]);
    }, [filterSubject, allSubjects]);
    
    const handleGenerateFlashcards = async () => {
        setIsGeneratingFlashcards(true);
        await onGenerateSmartFlashcards(filteredIncorrectQuestions);
        setIsGeneratingFlashcards(false);
    }
    
    const srsQuestionsDue = React.useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        const dueIds = Object.entries(studentProgress.srsData || {})
            .filter(([, data]: [string, { nextReviewDate: string }]) => data.nextReviewDate <= today)
            .map(([id]) => id);
        return allQuestions.filter(q => dueIds.includes(q.id));
    }, [studentProgress.srsData, allQuestions]);
    
    const manualReviews = (studentProgress.reviewSessions || []).filter(r => r.type === 'manual' && !r.isCompleted);

    return (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 grid grid-cols-1 gap-8">
                <Card className="p-6 bg-gradient-to-br from-teal-900 to-green-900 flex flex-col justify-between">
                     <div className="flex justify-between items-start w-full">
                        <div className="text-center flex-grow">
                            <CycleIcon className="h-12 w-12 mx-auto mb-3" />
                            <h3 className="text-2xl font-bold text-white">Sua Revisão Diária</h3>
                            <p className="text-gray-300 my-3">Fortaleça sua memória com a repetição espaçada. Revise os itens agendados para hoje.</p>
                        </div>
                        <button 
                            onClick={() => setIsSettingsModalOpen(true)}
                            className="p-2 rounded-full hover:bg-white/20 transition-colors flex-shrink-0"
                            aria-label="Configurações das Revisões"
                        >
                            <AdjustmentsHorizontalIcon className="h-6 w-6 text-gray-300"/>
                        </button>
                     </div>
                     <div className="flex justify-center gap-4 mt-4">
                        <Button onClick={() => onGenerateSrsReview(srsQuestionsDue)} disabled={srsQuestionsDue.length === 0} className="bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600 flex-1">
                            Revisar {srsQuestionsDue.length} Questões
                        </Button>
                        <Button onClick={() => setIsFlashcardPlayerOpen(true)} disabled={srsFlashcardsDue.length === 0} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 flex-1">
                            Revisar {srsFlashcardsDue.length} Flashcards
                        </Button>
                     </div>
                </Card>

                <Card className="p-6 text-center bg-gradient-to-br from-purple-900 to-indigo-900 flex flex-col justify-between">
                     <div>
                        <GeminiIcon className="h-12 w-12 mx-auto mb-3" />
                        <h3 className="text-2xl font-bold text-white">Revisão Inteligente</h3>
                        <p className="text-gray-300 my-3">Deixe a IA criar uma lista de revisão focada nos seus pontos fracos e erros recentes.</p>
                     </div>
                     <Button onClick={onGenerateSmartReview} disabled={isGenerating} className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-500">
                         {isGenerating ? <Spinner /> : 'Gerar Revisão Inteligente'}
                     </Button>
                </Card>

                <Card className="p-6 text-center bg-gradient-to-br from-pink-900 to-rose-900 flex flex-col justify-between">
                     <div>
                        <FlashcardIcon className="h-12 w-12 mx-auto mb-3" />
                        <h3 className="text-2xl font-bold text-white">Flashcards Inteligentes</h3>
                        <p className="text-gray-300 my-3">Crie flashcards com IA a partir dos seus erros em tópicos específicos.</p>
                     </div>
                     <div className='flex justify-center gap-4 flex-col'>
                        <div className="flex gap-2">
                             <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setFilterTopic(''); }} className="flex-1 bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500">
                                <option value="">Todas as Disciplinas</option>
                                {allSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                             <select value={filterTopic} onChange={e => setFilterTopic(e.target.value)} disabled={!filterSubject} className="flex-1 bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50">
                                <option value="">Todos os Tópicos</option>
                                {topicsForSelectedSubject.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <Button onClick={handleGenerateFlashcards} disabled={isGeneratingFlashcards || filteredIncorrectQuestions.length === 0} className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600">
                             {isGeneratingFlashcards ? <Spinner /> : <><GeminiIcon className="h-4 w-4 mr-2"/> Gerar dos Erros ({filteredIncorrectQuestions.length})</>}
                        </Button>
                     </div>
                </Card>
            </div>
             <div className="lg:col-span-1">
                <Card className="p-6 h-full">
                     <h3 className="text-2xl font-bold text-white mb-4">Revisões Manuais</h3>
                     <p className="text-gray-400 mb-6">Listas de revisão criadas pelos seus professores.</p>
                     <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {manualReviews.map(review => (
                             <div key={review.id} className="p-4 bg-gray-700/50 rounded-lg flex justify-between items-center">
                                 <div>
                                     <p className="font-semibold text-gray-200">{review.name}</p>
                                     <p className="text-xs text-gray-400">{review.questions.length} questões</p>
                                 </div>
                                 <Button onClick={() => onStartReview(review)} className="py-2 px-4 text-sm">Iniciar</Button>
                             </div>
                        ))}
                        {manualReviews.length === 0 && (
                            <div className="text-center text-gray-500 py-8">
                                <p>Nenhuma revisão manual pendente.</p>
                            </div>
                        )}
                     </div>
                </Card>
            </div>
        </div>
        <Modal isOpen={isFlashcardPlayerOpen} onClose={() => setIsFlashcardPlayerOpen(false)} title="Revisão de Flashcards" size="2xl">
            <div className="h-[60vh]">
                <FlashcardPlayer flashcards={srsFlashcardsDue} onReview={onFlashcardReview} />
            </div>
        </Modal>

        <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Configurações dos Desafios" size="3xl">
            <div className="flex border-b border-gray-700 mb-4" role="tablist">
                <button onClick={() => setSettingsTab('review')} className={`flex-1 py-2 text-sm font-medium ${settingsTab === 'review' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}>Desafio da Revisão</button>
                <button onClick={() => setSettingsTab('glossary')} className={`flex-1 py-2 text-sm font-medium ${settingsTab === 'glossary' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}>Desafio do Glossário</button>
                <button onClick={() => setSettingsTab('portuguese')} className={`flex-1 py-2 text-sm font-medium ${settingsTab === 'portuguese' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}>Desafio de Português</button>
            </div>
            {settingsTab === 'review' && <SettingsContent challengeType="review" localSettings={localSettings} enrolledSubjects={enrolledSubjects} handleLocalSettingsChange={handleLocalSettingsChange} handleLocalTopicSelectionChange={handleLocalTopicSelectionChange} handleLocalSubjectSelectionChange={handleLocalSubjectSelectionChange} studentProgress={studentProgress} allQuestionsWithContext={allQuestionsWithContext} />}
            {settingsTab === 'glossary' && <SettingsContent challengeType="glossary" localSettings={localSettings} enrolledSubjects={enrolledSubjects} handleLocalSettingsChange={handleLocalSettingsChange} handleLocalTopicSelectionChange={handleLocalTopicSelectionChange} handleLocalSubjectSelectionChange={handleLocalSubjectSelectionChange} studentProgress={studentProgress} allQuestionsWithContext={allQuestionsWithContext} />}
            {settingsTab === 'portuguese' && (
                 <div className="space-y-6 animate-fade-in">
                    <h3 className="text-lg font-semibold text-white">Configurar Desafio de Português</h3>
                    <div>
                        <label htmlFor="portuguese-question-count" className="block text-sm font-medium text-gray-300">Número de Questões por Desafio</label>
                        <SettingsNumberInput
                            id="portuguese-question-count"
                            value={localSettings.portugueseChallengeQuestionCount}
                            onChange={(num) => handleLocalSettingsChange('portugueseChallengeQuestionCount', num)}
                            min={1}
                            max={10}
                        />
                        <p className="text-xs text-gray-400 mt-1">Escolha entre 1 e 10 questões.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="portuguese-timer-duration" className="block text-sm font-medium text-gray-300">Duração do Timer</label>
                            <select
                                id="portuguese-timer-duration"
                                value={localSettings.portugueseChallengeTimerDuration || 300}
                                onChange={(e) => handleLocalSettingsChange('portugueseChallengeTimerDuration', e.target.value === 'unlimited' ? 'unlimited' : parseInt(e.target.value, 10))}
                                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white"
                            >
                                <option value={180}>3 minutos</option>
                                <option value={300}>5 minutos</option>
                                <option value={600}>10 minutos</option>
                                <option value="unlimited">Desativado</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="portuguese-max-attempts" className="block text-sm font-medium text-gray-300">Nº de Tentativas</label>
                            <select
                                id="portuguese-max-attempts"
                                value={localSettings.portugueseChallengeMaxAttempts || 1}
                                onChange={(e) => handleLocalSettingsChange('portugueseChallengeMaxAttempts', e.target.value === 'unlimited' ? 'unlimited' : parseInt(e.target.value, 10))}
                                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white"
                            >
                                <option value={1}>1 Tentativa</option>
                                <option value={3}>3 Tentativas</option>
                                <option value={5}>5 Tentativas</option>
                                <option value="unlimited">Ilimitadas</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}
            <div className="mt-6 pt-4 border-t border-gray-700 flex justify-end">
                <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
                    {isSavingSettings ? <Spinner /> : 'Salvar Configurações'}
                </Button>
            </div>
        </Modal>
        </>
    );
};