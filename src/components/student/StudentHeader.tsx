
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, StudentProgress } from '../../types';
import { calculateLevel, getLevelTitle, LEVEL_XP_REQUIREMENT } from '../../gamification';
import { UserCircleIcon, ChevronDownIcon, Cog6ToothIcon } from '../Icons';
import { getBrasiliaDate, getLocalDateISOString } from '../../utils';

type ViewType = 'dashboard' | 'course' | 'subject' | 'topic' | 'schedule' | 'performance' | 'reviews' | 'settings' | 'review_quiz' | 'games' | 'daily_challenge_quiz' | 'daily_challenge_results' | 'practice_area' | 'custom_quiz_player' | 'simulado_player';

interface StudentHeaderProps {
    user: User;
    studentProgress: StudentProgress;
    view: ViewType;
    selectedTopicName?: string;
    selectedSubjectName?: string;
    selectedCourseName?: string;
    activeChallengeType?: 'review' | 'glossary' | 'portuguese' | null;
    onSetView: (view: ViewType) => void;
    onLogout: () => void;
    onGoHome: () => void;
}

export const StudentHeader: React.FC<StudentHeaderProps> = ({
    user,
    studentProgress,
    view,
    selectedTopicName,
    selectedSubjectName,
    selectedCourseName,
    activeChallengeType,
    onSetView,
    onLogout,
    onGoHome,
}) => {
    const [isNavOpen, setIsNavOpen] = useState(false);
    const navRef = useRef<HTMLDivElement>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [studySeconds, setStudySeconds] = useState(0);

    // Cálculos de Gamificação
    const level = calculateLevel(studentProgress.xp);
    const levelTitle = getLevelTitle(level);
    const xpCurrentLevel = studentProgress.xp % LEVEL_XP_REQUIREMENT;
    const progressPercent = (xpCurrentLevel / LEVEL_XP_REQUIREMENT) * 100;
    const nextLevelXp = LEVEL_XP_REQUIREMENT - xpCurrentLevel;

    // Cálculo da Precisão Global (Média de todos os acertos)
    const globalAccuracy = useMemo(() => {
        let totalCorrect = 0;
        let totalAnswered = 0;

        // 1. Acertos por Tópicos
        Object.values(studentProgress.progressByTopic || {}).forEach(subject => {
            Object.values(subject).forEach(topic => {
                (topic.lastAttempt || []).forEach(attempt => {
                    totalAnswered++;
                    if (attempt.isCorrect) totalCorrect++;
                });
            });
        });

        // 2. Acertos em Sessões de Revisão
        (studentProgress.reviewSessions || []).forEach(session => {
            (session.attempts || []).forEach(attempt => {
                totalAnswered++;
                if (attempt.isCorrect) totalCorrect++;
            });
        });

        // 3. Acertos em Simulados
        (studentProgress.simulados || []).forEach(simulado => {
            (simulado.attempts || []).forEach(attempt => {
                totalAnswered++;
                if (attempt.isCorrect) totalCorrect++;
            });
        });

        return totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 0;
    }, [studentProgress]);

    const getAccuracyColor = (acc: number) => {
        if (acc < 50) return 'text-rose-500';
        if (acc < 75) return 'text-amber-400';
        return 'text-cyan-400';
    };

    const getAccuracyStroke = (acc: number) => {
        if (acc < 50) return '#f43f5e'; // rose-500
        if (acc < 75) return '#fbbf24'; // amber-400
        return '#22d3ee'; // cyan-400
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(event.target as Node)) {
                setIsNavOpen(false);
            }
        };
        if (isNavOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isNavOpen]);

    useEffect(() => {
        const todayStr = getLocalDateISOString(getBrasiliaDate());
        const savedDate = localStorage.getItem('study_timer_date');
        const savedSeconds = localStorage.getItem('study_timer_seconds');

        if (savedDate === todayStr && savedSeconds) {
            setStudySeconds(parseInt(savedSeconds, 10));
        } else {
            localStorage.setItem('study_timer_date', todayStr);
            localStorage.setItem('study_timer_seconds', '0');
            setStudySeconds(0);
        }

        const interval = setInterval(() => {
            setCurrentTime(new Date());
            setStudySeconds(prev => {
                const next = prev + 1;
                localStorage.setItem('study_timer_seconds', next.toString());
                return next;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const formatTime = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const getViewTitle = () => {
        switch (view) {
            case 'dashboard': return 'Início';
            case 'schedule': return 'Cronograma';
            case 'performance': return 'Meu Desempenho';
            case 'reviews': return 'Revisões';
            case 'games': return 'Jogos';
            case 'practice_area': return 'Área de Prática';
            case 'settings': return 'Configurações';
            case 'daily_challenge_quiz':
                if (activeChallengeType === 'portuguese') return 'Português';
                if (activeChallengeType === 'glossary') return 'Glossário';
                if (activeChallengeType === 'review') return 'Revisão Diária';
                return 'Desafio Diário';
            case 'topic': return selectedTopicName || 'Tópico';
            case 'subject': return selectedSubjectName || 'Disciplina';
            case 'course': return selectedCourseName || 'Curso';
            default: return 'Painel';
        }
    };

    const navigationItems = [
        { label: 'Início', view: 'dashboard' as const },
        { label: 'Revisões', view: 'reviews' as const },
        { label: 'Prática', view: 'practice_area' as const },
        { label: 'Cronograma', view: 'schedule' as const },
        { label: 'Desempenho', view: 'performance' as const },
        { label: 'Configurações', view: 'settings' as const },
    ];

    return (
        <header className="sticky top-0 z-50 w-full bg-[#020617] border-b border-white/10 shadow-2xl">
            <div className="max-w-[1920px] mx-auto h-20 px-4 md:px-6 flex items-center justify-between gap-2 md:gap-4">
                
                {/* 1. LOGO E TÍTULO DINÂMICO */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    <button onClick={onGoHome} className="hover:scale-105 transition-transform flex-shrink-0">
                        <img src="https://i.ibb.co/FbmLfsBw/Google-AI-Studio-2025-08-10-T15-45-10.png" alt="Logo" className="h-8 md:h-10 w-auto rounded-md" />
                    </button>
                    <div className="hidden lg:block min-w-0">
                        <h1 className="text-lg font-black text-white uppercase tracking-tighter leading-none truncate max-w-[150px] xl:max-w-xs">
                            {getViewTitle()}
                        </h1>
                    </div>
                </div>

                {/* 2. WIDGET DE NÍVEL E ACURÁCIA */}
                <div className="flex-grow max-w-[300px] md:max-w-xs lg:max-w-lg flex items-center gap-4 md:gap-8 mx-2 md:mx-4">
                    {/* NÍVEL */}
                    <div className="flex items-center gap-3 flex-grow min-w-0">
                        <div className="relative flex-shrink-0">
                            <div className="absolute inset-0 bg-cyan-500/20 blur-lg rounded-full"></div>
                            <div className="relative h-10 w-10 md:h-11 md:w-11 rounded-full border-2 border-cyan-500/40 flex items-center justify-center bg-gray-950 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                                <span className="text-lg md:text-xl font-black text-white">{level}</span>
                            </div>
                        </div>
                        <div className="flex-grow min-w-0 hidden xs:block">
                            <div className="flex flex-col mb-1">
                                <span className="text-[7px] md:text-[8px] font-black text-cyan-500 uppercase tracking-[0.2em] leading-none mb-0.5">Nível</span>
                                <span className="text-xs md:text-sm font-black text-white uppercase tracking-tighter italic leading-none truncate">{levelTitle}</span>
                            </div>
                            <div className="space-y-1">
                                <div className="h-[3px] bg-gray-900 rounded-full overflow-hidden border border-white/5">
                                    <div className="h-full bg-cyan-500 rounded-full shadow-[0_0_8px_cyan] transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }}></div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[6px] md:text-[8px] font-black text-gray-600 uppercase tracking-widest">{studentProgress.xp} XP</span>
                                    <span className="text-[6px] md:text-[8px] font-black text-cyan-400 uppercase tracking-widest">+{nextLevelXp} PARA UP</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ACURÁCIA GLOBAL (WIDGET GRÁFICO) */}
                    <div className="flex items-center gap-3 flex-shrink-0 group cursor-help" title="Sua taxa de acerto global em todas as questões">
                        <div className="relative h-10 w-10 md:h-12 md:w-12">
                            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-800" />
                                <circle 
                                    cx="18" cy="18" r="16" fill="none" 
                                    stroke={getAccuracyStroke(globalAccuracy)} 
                                    strokeWidth="3" 
                                    strokeDasharray="100 100" 
                                    strokeDashoffset={100 - globalAccuracy}
                                    strokeLinecap="round"
                                    className="transition-all duration-1000 ease-out"
                                />
                                {globalAccuracy >= 80 && (
                                    <circle cx="18" cy="18" r="16" fill="none" stroke={getAccuracyStroke(globalAccuracy)} strokeWidth="1" className="animate-ping opacity-20" />
                                )}
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className={`text-[9px] md:text-[10px] font-black italic ${getAccuracyColor(globalAccuracy)}`}>
                                    {Math.round(globalAccuracy)}%
                                </span>
                            </div>
                        </div>
                        <div className="hidden lg:flex flex-col">
                            <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest leading-none mb-0.5">Precisão</span>
                            <span className={`text-[10px] font-black uppercase tracking-tighter italic leading-none ${getAccuracyColor(globalAccuracy)}`}>
                                {globalAccuracy >= 85 ? 'Elite' : globalAccuracy >= 70 ? 'Pro' : globalAccuracy >= 50 ? 'Estável' : 'Alerta'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. RELÓGIO E SESSÃO (DESKTOP/TABLET) */}
                <div className="hidden md:flex items-center h-10 bg-black/40 rounded-xl border border-white/5 divide-x divide-white/5 flex-shrink-0">
                    <div className="px-3 flex flex-col items-center justify-center">
                        <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Relógio</span>
                        <span className="text-xs font-mono font-black text-white leading-none">
                            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <div className="px-3 flex flex-col items-center justify-center">
                        <span className="text-[7px] font-black text-cyan-500 uppercase tracking-widest mb-0.5">Sessão</span>
                        <span className="text-xs font-mono font-black text-cyan-400 leading-none">
                            {formatTime(studySeconds)}
                        </span>
                    </div>
                </div>

                {/* 4. PERFIL UNIFICADO (USER PILL) */}
                <div className="flex items-center flex-shrink-0 ml-2">
                    <div ref={navRef} className="relative">
                        <button 
                            onClick={() => setIsNavOpen(prev => !prev)} 
                            className="flex items-center gap-2 md:gap-3 pl-1.5 pr-3 md:pr-4 py-1.5 rounded-full bg-gray-800/50 border border-white/10 hover:bg-gray-700/70 transition-all group"
                        >
                            <div className="h-8 w-8 md:h-10 md:w-10 rounded-full overflow-hidden border border-white/10 shadow-lg flex-shrink-0">
                                {user.avatarUrl ? (
                                    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <UserCircleIcon className="h-full w-full text-gray-600 p-1" />
                                )}
                            </div>
                            <div className="hidden sm:flex flex-col text-left">
                                <span className="text-[10px] md:text-[11px] font-black text-white uppercase tracking-tight leading-none truncate max-w-[80px] lg:max-w-[120px]">
                                    {user.name || user.username}
                                </span>
                                <span className="text-[7px] font-bold text-cyan-500 uppercase tracking-widest mt-1">
                                    {user.gender === 'feminine' ? 'Concurseira' : 'Concurseiro'}
                                </span>
                            </div>
                            <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform ${isNavOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isNavOpen && (
                            <div className="absolute right-0 mt-3 w-56 bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in ring-1 ring-white/10">
                                {navigationItems.map(item => (
                                    <button 
                                        key={item.view} 
                                        onClick={() => { onSetView(item.view); setIsNavOpen(false); }} 
                                        className={`w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-3 ${view === item.view ? 'bg-cyan-600 text-white' : 'text-gray-500 hover:bg-gray-900 hover:text-white'}`}
                                    >
                                        {item.view === 'settings' && <Cog6ToothIcon className="h-4 w-4" />}
                                        {item.label}
                                    </button>
                                ))}
                                <div className="border-t border-white/5 my-1"></div>
                                <button onClick={onLogout} className="w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-colors">Encerrar Conexão</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};
