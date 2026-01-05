
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
        (studentProgress.reviewChallenge?.sessionAttempts || []).forEach(attempt => {
            totalAnswered++;
            if (attempt.isCorrect) totalCorrect++;
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

    const getUserSublabel = () => {
        const isFem = user.gender === 'feminine';
        if (user.role === 'professor') {
            return isFem ? 'Professora' : 'Professor';
        }
        return isFem ? 'Concurseira' : 'Concurseiro';
    };

    return (
        <header className="sticky top-0 z-50 w-full bg-[#020617] border-b border-white/5 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.5)] h-20">
            <div className="max-w-[1920px] mx-auto h-full px-4 lg:px-6 flex items-center justify-start gap-3 lg:gap-5">
                
                {/* 1. LADO ESQUERDO: BRANDING + NOME DO APP (ESPAÇO MÍNIMO) */}
                <div className="flex items-center gap-3 lg:gap-4 flex-shrink-0 min-w-0">
                    <button onClick={onGoHome} className="hover:scale-105 active:scale-95 transition-all duration-300 flex-shrink-0">
                        <img src="https://i.ibb.co/FbmLfsBw/Google-AI-Studio-2025-08-10-T15-45-10.png" alt="Logo" className="h-10 w-auto rounded-lg" />
                    </button>
                    <div className="hidden lg:block h-10 w-[1px] bg-white/10 flex-shrink-0"></div>
                    <div className="min-w-0">
                        <span className="text-xl md:text-2xl xl:text-3xl font-black text-white uppercase tracking-tighter leading-none truncate drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                            QG do concurseiro
                        </span>
                    </div>
                </div>

                {/* 2. CENTRO: HUD DE PERFORMANCE (AGRUPADO AO TÍTULO) */}
                <div className="hidden md:flex items-center gap-3 lg:gap-6 flex-shrink-0">
                    {/* LEVEL HUD */}
                    <button 
                        onClick={() => onSetView('performance')}
                        className="flex items-center gap-2 hover:bg-white/5 p-1 rounded-2xl transition-all group"
                        title="Ver nível e XP"
                    >
                        <div className="relative h-12 w-12 flex-shrink-0">
                            {streak > 0 && (
                                <div className="absolute -top-1 -right-1 z-20 bg-orange-500 rounded-full p-1 shadow-[0_0_10px_rgba(249,115,22,0.6)]">
                                    <FireIcon className="h-2.5 w-2.5 text-white" />
                                </div>
                            )}
                            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />
                                <circle cx="18" cy="18" r="16" fill="none" stroke="#06b6d4" strokeWidth="4" strokeDasharray="100 100" strokeDashoffset={100 - progressPercent} strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-[14px] font-black text-white leading-none">{level}</span>
                                <span className="text-[6px] font-black text-cyan-500/60">LVL</span>
                            </div>
                        </div>
                        <div className="hidden lg:flex flex-col text-left">
                            <span className="text-[11px] font-black text-white uppercase italic leading-none group-hover:text-cyan-400 transition-colors">{levelTitle}</span>
                            <span className="text-[8px] font-black text-cyan-400/70 uppercase tracking-widest mt-1">+{nextLevelXp} XP P/ UP</span>
                        </div>
                    </button>

                    {/* ACCURACY HUD */}
                    <button 
                        onClick={() => onSetView('performance')}
                        className="flex items-center gap-2 hover:bg-white/5 p-1 rounded-2xl transition-all group"
                        title="Ver acerto em questões"
                    >
                        <div className={`relative h-11 w-11 ${accTheme.shadow} rounded-full transition-all group-hover:scale-105 flex-shrink-0`}>
                            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3" />
                                <circle cx="18" cy="18" r="16" fill="none" stroke={accTheme.stroke} strokeWidth="3" strokeDasharray="100 100" strokeDashoffset={100 - globalAccuracy} strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className={`text-[10px] font-black ${accTheme.text}`}>{Math.round(globalAccuracy)}%</span>
                            </div>
                        </div>
                        <div className="hidden xl:flex flex-col text-left">
                            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">ACERTO EM QUESTÕES</span>
                            <span className={`text-[10px] font-black uppercase italic leading-none mt-0.5 ${accTheme.text}`}>{accTheme.label}</span>
                        </div>
                    </button>
                </div>

                {/* ESPAÇADOR FLEXÍVEL - EMPURRA O RELÓGIO E PERFIL PARA A EXTREMIDADE DIREITA */}
                <div className="flex-grow"></div>

                {/* 3. LADO DIREITO: TEMPO + PERFIL */}
                <div className="flex items-center gap-3 lg:gap-4 flex-shrink-0">
                    {/* RELÓGIO (MD+) */}
                    <div className="hidden md:flex items-center h-10 bg-black/40 rounded-full border border-white/5 p-1 px-4 gap-4">
                        <div className="flex flex-col items-center">
                            <span className="text-[6px] font-black text-gray-500 uppercase tracking-widest">HORA</span>
                            <span className="text-[12px] font-mono font-bold text-white">
                                {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div className="w-[1px] h-5 bg-white/10"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-[6px] font-black text-cyan-500 uppercase tracking-widest">SESSÃO</span>
                            <span className="text-[12px] font-mono font-bold text-cyan-400">
                                {formatTime(studySeconds)}
                            </span>
                        </div>
                    </div>

                    {/* MENU USUÁRIO */}
                    <div ref={navRef} className="relative">
                        <button 
                            onClick={() => setIsNavOpen(prev => !prev)} 
                            className={`flex items-center gap-2 p-1 pr-3 rounded-full bg-gray-800/40 border border-white/10 hover:border-cyan-500/30 transition-all ${isNavOpen ? 'ring-2 ring-cyan-500/20 bg-gray-800 shadow-lg' : ''}`}
                        >
                            <div className="relative">
                                <div className="h-9 w-9 rounded-full overflow-hidden border-2 border-cyan-500/20 shadow-inner">
                                    {user.avatarUrl ? (
                                        <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <UserCircleIcon className="h-full w-full text-gray-600 p-1" />
                                    )}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#020617]"></div>
                            </div>
                            <div className="hidden sm:flex flex-col text-left">
                                <span className="text-[11px] font-black text-white uppercase truncate max-w-[90px] leading-tight">{user.name || user.username}</span>
                                <span className="text-[8px] font-bold text-cyan-500 uppercase tracking-widest leading-none mt-0.5">
                                    {getUserSublabel()}
                                </span>
                            </div>
                            <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform ${isNavOpen ? 'rotate-180 text-cyan-400' : ''}`} />
                        </button>

                        {isNavOpen && (
                            <div className="absolute right-0 mt-3 w-60 bg-[#020617] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-fade-in">
                                <div className="p-4 bg-white/5 border-b border-white/5">
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Menu de Navegação</p>
                                </div>
                                <div className="py-2">
                                    {navigationItems.map(item => (
                                        <button 
                                            key={item.view} 
                                            onClick={() => { onSetView(item.view); setIsNavOpen(false); }} 
                                            className={`w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${view === item.view ? 'bg-cyan-500/10 text-cyan-400 border-l-4 border-cyan-500' : 'text-gray-400 hover:bg-white/5'}`}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="p-3 border-t border-white/5 bg-black/20">
                                    <button onClick={onLogout} className="w-full text-center py-2.5 text-[9px] font-black uppercase text-rose-500 hover:bg-rose-500/10 rounded-xl border border-rose-500/20 transition-all">Desconectar da Base</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};
