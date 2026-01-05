
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, StudentProgress } from '../../types';
import { calculateLevel, getLevelTitle, LEVEL_XP_REQUIREMENT } from '../../gamification';
import { UserCircleIcon, ChevronDownIcon, Cog6ToothIcon, FireIcon } from '../Icons';
import { getBrasiliaDate, getLocalDateISOString } from '../../utils';

type ViewType = 'dashboard' | 'course' | 'subject' | 'topic' | 'schedule' | 'performance' | 'reviews' | 'settings' | 'review_quiz' | 'games' | 'daily_challenge_quiz' | 'daily_challenge_results' | 'practice_area' | 'custom_quiz_player' | 'simulado_player';

const navigationItems: { label: string; view: ViewType }[] = [
    { label: 'Painel Inicial', view: 'dashboard' },
    { label: 'Cronograma', view: 'schedule' },
    { label: 'Meu Desempenho', view: 'performance' },
    { label: 'Revisões', view: 'reviews' },
    { label: 'Área de Prática', view: 'practice_area' },
    { label: 'Configurações de Perfil', view: 'settings' },
];

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

    const getAccuracyTheme = (acc: number) => {
        if (acc < 50) return { text: 'text-rose-500', stroke: '#f43f5e', shadow: 'shadow-[0_0_12px_rgba(244,63,94,0.4)]', label: 'Crítico' };
        if (acc < 75) return { text: 'text-amber-400', stroke: '#fbbf24', shadow: 'shadow-[0_0_12px_rgba(251,191,36,0.4)]', label: 'Estável' };
        return { text: 'text-cyan-400', stroke: '#22d3ee', shadow: 'shadow-[0_0_15px_rgba(34,211,238,0.5)]', label: 'Elite' };
    };

    const accTheme = getAccuracyTheme(globalAccuracy);

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
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const todayStr = getLocalDateISOString(getBrasiliaDate());
        const savedDate = localStorage.getItem('study_timer_date');
        const savedSeconds = localStorage.getItem('study_timer_seconds');

        if (savedDate === todayStr && savedSeconds) {
            setStudySeconds(parseInt(savedSeconds, 10));
        } else {
            localStorage.setItem('study_timer_date', todayStr);
            setStudySeconds(0);
        }

        const timer = setInterval(() => {
            setStudySeconds(prev => {
                const next = prev + 1;
                localStorage.setItem('study_timer_seconds', next.toString());
                return next;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const formatTime = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Função aprimorada para retornar Título e Código de Setor
    const getPageContext = (): { title: string; code: string } => {
        switch (view) {
            case 'dashboard': 
                return { title: 'Início', code: '01' };
            case 'daily_challenge_quiz':
                const challengeName = activeChallengeType === 'portuguese' ? 'Português' : 
                                    activeChallengeType === 'glossary' ? 'Glossário' : 
                                    activeChallengeType === 'review' ? 'Revisão' : 'Desafio';
                return { title: `Missão: ${challengeName}`, code: '03' };
            case 'daily_challenge_results':
                return { title: 'Resultados', code: '03' };
            case 'course':
                return { title: selectedCourseName || 'Curso', code: '02' };
            case 'subject':
                return { title: selectedSubjectName || 'Disciplina', code: '02' };
            case 'topic':
                return { title: selectedTopicName || 'Estudo', code: '02' };
            case 'schedule':
                return { title: 'Agenda', code: '05' };
            case 'performance':
                return { title: 'Meu Score', code: '04' };
            case 'reviews':
                return { title: 'Revisões', code: '06' };
            case 'practice_area':
                return { title: 'Prática', code: '07' };
            case 'settings':
                return { title: 'Configurações', code: '08' };
            default:
                return { title: 'QG', code: '00' };
        }
    };

    const pageContext = getPageContext();

    return (
        <header className="sticky top-0 z-50 w-full bg-[#020617] border-b border-white/5 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.5)]">
            <div className="max-w-[1920px] mx-auto h-20 px-4 lg:px-8 flex items-center justify-between gap-4">
                
                {/* 1. BRANDING E LOCALIZAÇÃO DINÂMICA */}
                <div className="flex items-center gap-6 flex-shrink-0 min-w-0">
                    <button onClick={onGoHome} className="hover:scale-105 active:scale-95 transition-all duration-300 flex-shrink-0">
                        <img src="https://i.ibb.co/FbmLfsBw/Google-AI-Studio-2025-08-10-T15-45-10.png" alt="Logo" className="h-10 w-auto rounded-lg shadow-2xl" />
                    </button>
                    <div className="hidden xl:block h-8 w-[1px] bg-white/10 flex-shrink-0"></div>
                    <div className="hidden lg:block min-w-0">
                        <h1 className="text-2xl font-black text-white uppercase tracking-tighter leading-none italic flex items-center gap-3">
                            <span className="text-cyan-500 font-mono text-sm not-italic opacity-40 flex-shrink-0">
                                {pageContext.code}
                            </span>
                            <span className="truncate max-w-[200px] xl:max-w-[350px] drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                                {pageContext.title}
                            </span>
                        </h1>
                    </div>
                </div>

                {/* 2. HUD CENTRAL (CLICÁVEL PARA DETALHES) */}
                <button 
                    onClick={() => onSetView('performance')}
                    className="flex items-center gap-8 xl:gap-16 flex-grow justify-center hover:bg-white/5 py-1 px-4 rounded-2xl transition-all group"
                    title="Clique para ver seu desempenho detalhado"
                >
                    {/* LEVEL CORE (XP) */}
                    <div className="flex items-center gap-4">
                        <div className="relative h-14 w-14 flex-shrink-0">
                            {streak > 0 && (
                                <div className="absolute -top-1 -right-1 z-20 bg-orange-500 rounded-full p-1 shadow-[0_0_15px_rgba(249,115,22,0.6)] animate-pulse border border-[#020617]">
                                    <FireIcon className="h-3 w-3 text-white" />
                                </div>
                            )}
                            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />
                                <circle 
                                    cx="18" cy="18" r="16" fill="none" 
                                    stroke="#06b6d4" 
                                    strokeWidth="4" 
                                    strokeDasharray="100 100" 
                                    strokeDashoffset={100 - progressPercent}
                                    strokeLinecap="round"
                                    className="transition-all duration-1000 ease-out"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-lg font-black text-white leading-none tracking-tighter">{level}</span>
                                <span className="text-[7px] font-black text-cyan-500/60 uppercase">LVL</span>
                            </div>
                            <div className="absolute inset-0 rounded-full bg-cyan-500/5 group-hover:bg-cyan-500/15 transition-colors shadow-inner"></div>
                        </div>
                        
                        <div className="hidden sm:flex flex-col text-left">
                            <span className="text-[8px] font-black text-cyan-500/50 uppercase tracking-[0.2em] mb-0.5">Progresso de Nível</span>
                            <span className="text-sm font-black text-white uppercase tracking-tighter italic leading-none group-hover:text-cyan-400 transition-colors">{levelTitle}</span>
                            <div className="mt-1.5 flex items-center gap-2">
                                <span className="text-[8px] font-black text-cyan-400 uppercase tracking-widest">+{nextLevelXp} XP P/ UP</span>
                            </div>
                        </div>
                    </div>

                    {/* ACCURACY RADAR (QUESTÕES) */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                        <div className={`relative h-12 w-12 ${accTheme.shadow} rounded-full transition-all duration-500 group-hover:scale-105`}>
                            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3" />
                                <circle 
                                    cx="18" cy="18" r="16" fill="none" 
                                    stroke={accTheme.stroke} 
                                    strokeWidth="3" 
                                    strokeDasharray="100 100" 
                                    strokeDashoffset={100 - globalAccuracy}
                                    strokeLinecap="round"
                                    className="transition-all duration-1000 ease-out"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className={`text-[10px] font-black italic ${accTheme.text}`}>
                                    {Math.round(globalAccuracy)}%
                                </span>
                            </div>
                        </div>
                        <div className="hidden md:flex flex-col text-right">
                            <span className="text-[8px] font-black text-gray-600 uppercase tracking-[0.2em] mb-0.5">Acerto em Questões</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest italic leading-none ${accTheme.text}`}>
                                {accTheme.label}
                            </span>
                        </div>
                    </div>
                </button>

                {/* 3. TIME & PROFILE */}
                <div className="flex items-center gap-4 xl:gap-8 flex-shrink-0">
                    <div className="hidden xl:flex items-center h-10 bg-black/40 rounded-full border border-white/5 p-1">
                        <div className="px-4 flex flex-col items-center border-r border-white/5">
                            <span className="text-[7px] font-black text-gray-500 uppercase tracking-[0.2em]">Relógio</span>
                            <span className="text-xs font-mono font-black text-white">
                                {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div className="px-4 flex flex-col items-center">
                            <span className="text-[7px] font-black text-cyan-500 uppercase tracking-[0.2em]">Sessão</span>
                            <span className="text-xs font-mono font-black text-cyan-400">
                                {formatTime(studySeconds)}
                            </span>
                        </div>
                    </div>

                    <div ref={navRef} className="relative">
                        <button 
                            onClick={() => setIsNavOpen(prev => !prev)} 
                            className={`flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full bg-gray-800/40 border border-white/10 hover:bg-gray-800/60 hover:border-cyan-500/30 transition-all group shadow-lg ${isNavOpen ? 'ring-2 ring-cyan-500/20 bg-gray-800' : ''}`}
                        >
                            <div className="relative">
                                <div className="h-9 w-9 md:h-10 md:w-10 rounded-full overflow-hidden border-2 border-cyan-500/20 shadow-xl transition-transform group-hover:scale-105">
                                    {user.avatarUrl ? (
                                        <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <UserCircleIcon className="h-full w-full text-gray-600 p-1" />
                                    )}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#020617] shadow-sm"></div>
                            </div>
                            <div className="hidden sm:flex flex-col text-left">
                                <span className="text-[11px] font-black text-white uppercase tracking-tight leading-none truncate max-w-[90px]">
                                    {user.name || user.username}
                                </span>
                                <span className="text-[8px] font-bold text-cyan-500 uppercase tracking-widest mt-1 opacity-70">
                                    {user.gender === 'feminine' ? 'Concurseira' : 'Concurseiro'}
                                </span>
                            </div>
                            <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform duration-300 ${isNavOpen ? 'rotate-180 text-cyan-400' : ''}`} />
                        </button>

                        {isNavOpen && (
                            <div className="absolute right-0 mt-4 w-60 bg-[#020617] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-50 overflow-hidden animate-fade-in backdrop-blur-xl">
                                <div className="p-4 bg-white/5 border-b border-white/5">
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Navegação QG</p>
                                </div>
                                <div className="py-2">
                                    {navigationItems.map(item => (
                                        <button 
                                            key={item.view} 
                                            onClick={() => { onSetView(item.view); setIsNavOpen(false); }} 
                                            className={`w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-3 ${view === item.view ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-500' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                        >
                                            {item.view === 'settings' && <Cog6ToothIcon className="h-4 w-4" />}
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="p-2 border-t border-white/5 bg-black/20">
                                    <button onClick={onLogout} className="w-full text-center py-2 text-[9px] font-black uppercase tracking-[0.2em] text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors italic">Desconectar do Sistema</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};
