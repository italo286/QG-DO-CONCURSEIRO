
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, StudentProgress } from '../../types';
import { calculateLevel, getLevelTitle, LEVEL_XP_REQUIREMENT } from '../../gamification';
import { UserCircleIcon, ChevronDownIcon, Cog6ToothIcon, FireIcon } from '../Icons';
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
    const streak = studentProgress.dailyChallengeStreak?.current || 0;

    // Cálculo da Precisão Global
    const globalAccuracy = useMemo(() => {
        let totalCorrect = 0;
        let totalAnswered = 0;
        Object.values(studentProgress.progressByTopic || {}).forEach(subject => {
            Object.values(subject).forEach(topic => {
                (topic.lastAttempt || []).forEach(attempt => {
                    totalAnswered++;
                    if (attempt.isCorrect) totalCorrect++;
                });
            });
        });
        (studentProgress.reviewSessions || []).forEach(session => {
            (session.attempts || []).forEach(attempt => {
                totalAnswered++;
                if (attempt.isCorrect) totalCorrect++;
            });
        });
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
        if (acc < 50) return '#f43f5e';
        if (acc < 75) return '#fbbf24';
        return '#22d3ee';
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
            <div className="max-w-[1920px] mx-auto h-20 px-4 md:px-6 flex items-center justify-between gap-4">
                
                {/* 1. LOGO E TÍTULO */}
                <div className="flex items-center gap-4 flex-shrink-0">
                    <button onClick={onGoHome} className="hover:scale-105 transition-transform flex-shrink-0">
                        <img src="https://i.ibb.co/FbmLfsBw/Google-AI-Studio-2025-08-10-T15-45-10.png" alt="Logo" className="h-10 md:h-12 w-auto rounded-md" />
                    </button>
                    <div className="hidden lg:block min-w-0">
                        <h1 className="text-xl font-black text-white uppercase tracking-tighter leading-none truncate max-w-[140px] xl:max-w-xs italic">
                            {getViewTitle()}
                        </h1>
                    </div>
                </div>

                {/* 2. CORE DE PERFORMANCE (NÍVEL CIRCULAR + ACURÁCIA) */}
                <div className="flex items-center gap-6 md:gap-10 flex-grow justify-center max-w-2xl">
                    
                    {/* WIDGET NÍVEL CIRCULAR (CORE) */}
                    <div className="flex items-center gap-4 group">
                        <div className="relative h-14 w-14 flex-shrink-0">
                            {/* Ofensiva Badge (Criatividade) */}
                            {streak > 0 && (
                                <div className="absolute -top-1 -right-1 z-20 bg-orange-500 rounded-full p-1 shadow-lg animate-pulse border border-gray-900">
                                    <FireIcon className="h-3 w-3 text-white" />
                                </div>
                            )}
                            
                            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                                <circle 
                                    cx="18" cy="18" r="16" fill="none" 
                                    stroke="#06b6d4" 
                                    strokeWidth="3" 
                                    strokeDasharray="100 100" 
                                    strokeDashoffset={100 - progressPercent}
                                    strokeLinecap="round"
                                    className="transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-lg font-black text-white leading-none">{level}</span>
                                <span className="text-[6px] font-black text-cyan-500 uppercase tracking-tighter">LVL</span>
                            </div>
                            {/* Glow pulse effect */}
                            <div className="absolute inset-0 rounded-full bg-cyan-500/10 animate-pulse -z-10"></div>
                        </div>
                        
                        <div className="hidden xs:flex flex-col">
                            <span className="text-[7px] font-black text-cyan-500 uppercase tracking-[0.2em] leading-none mb-0.5">Patente Atual</span>
                            <span className="text-xs font-black text-white uppercase tracking-tighter italic leading-none truncate mb-1.5">{levelTitle}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{studentProgress.xp} XP TOTAL</span>
                                <div className="h-1 w-1 rounded-full bg-gray-700"></div>
                                <span className="text-[8px] font-black text-cyan-400 uppercase tracking-widest">+{nextLevelXp} PARA UP</span>
                            </div>
                        </div>
                    </div>

                    {/* ACURÁCIA (RADAR) */}
                    <div className="flex items-center gap-4 flex-shrink-0 group cursor-help" title="Sua taxa de acerto global">
                        <div className="relative h-12 w-12">
                            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2.5" />
                                <circle 
                                    cx="18" cy="18" r="16" fill="none" 
                                    stroke={getAccuracyStroke(globalAccuracy)} 
                                    strokeWidth="2.5" 
                                    strokeDasharray="100 100" 
                                    strokeDashoffset={100 - globalAccuracy}
                                    strokeLinecap="round"
                                    className="transition-all duration-1000 ease-out"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className={`text-[10px] font-black italic ${getAccuracyColor(globalAccuracy)}`}>
                                    {Math.round(globalAccuracy)}%
                                </span>
                            </div>
                        </div>
                        <div className="hidden sm:flex flex-col">
                            <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest leading-none mb-0.5 text-right">Precisão</span>
                            <span className={`text-[10px] font-black uppercase tracking-tighter italic leading-none text-right ${getAccuracyColor(globalAccuracy)}`}>
                                {globalAccuracy >= 85 ? 'Elite' : globalAccuracy >= 70 ? 'Pro' : globalAccuracy >= 50 ? 'Estável' : 'Alerta'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. RELÓGIO E SESSÃO */}
                <div className="hidden xl:flex items-center h-11 bg-black/40 rounded-2xl border border-white/5 divide-x divide-white/5 flex-shrink-0 px-1">
                    <div className="px-4 flex flex-col items-center justify-center">
                        <span className="text-[7px] font-black text-gray-600 uppercase tracking-widest mb-0.5">Relógio</span>
                        <span className="text-xs font-mono font-black text-white leading-none">
                            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <div className="px-4 flex flex-col items-center justify-center">
                        <span className="text-[7px] font-black text-cyan-500/70 uppercase tracking-widest mb-0.5">Sessão</span>
                        <span className="text-xs font-mono font-black text-cyan-400 leading-none">
                            {formatTime(studySeconds)}
                        </span>
                    </div>
                </div>

                {/* 4. USER PILL */}
                <div className="flex items-center flex-shrink-0 ml-2">
                    <div ref={navRef} className="relative">
                        <button 
                            onClick={() => setIsNavOpen(prev => !prev)} 
                            className="flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full bg-gray-800/50 border border-white/10 hover:bg-gray-700/70 transition-all group"
                        >
                            <div className="h-9 w-9 md:h-10 md:w-10 rounded-full overflow-hidden border-2 border-cyan-500/20 shadow-lg flex-shrink-0 transition-transform group-hover:scale-105">
                                {user.avatarUrl ? (
                                    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <UserCircleIcon className="h-full w-full text-gray-600 p-1" />
                                )}
                            </div>
                            <div className="hidden sm:flex flex-col text-left">
                                <span className="text-[10px] md:text-[11px] font-black text-white uppercase tracking-tight leading-none truncate max-w-[100px]">
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
