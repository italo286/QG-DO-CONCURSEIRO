
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, StudentProgress } from '../../types';
import { calculateLevel, getLevelTitle, LEVEL_XP_REQUIREMENT } from '../../gamification';
import { UserCircleIcon, ChevronDownIcon, FireIcon } from '../Icons';
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
    const levelTitle = getLevelTitle(level).toUpperCase();
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
        if (acc < 50) return { text: 'text-rose-500', stroke: '#f43f5e', shadow: 'shadow-[0_0_15px_rgba(244,63,94,0.3)]', label: 'CRÍTICO' };
        if (acc < 75) return { text: 'text-amber-400', stroke: '#fbbf24', shadow: 'shadow-[0_0_15px_rgba(251,191,36,0.3)]', label: 'ESTÁVEL' };
        return { text: 'text-cyan-400', stroke: '#22d3ee', shadow: 'shadow-[0_0_20px_rgba(34,211,238,0.4)]', label: 'ELITE' };
    };

    const accTheme = getAccuracyTheme(globalAccuracy);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(event.target as Node)) setIsNavOpen(false);
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
        return isFem ? 'CONCURSEIRA' : 'CONCURSEIRO';
    };

    return (
        <header className="sticky top-0 z-50 w-full bg-[#020617] border-b border-white/5 shadow-[0_15px_50px_-15px_rgba(0,0,0,0.8)] h-24">
            <div className="w-full h-full px-0 flex items-center justify-between">
                
                {/* 1. LOGO + DIVISOR (ENCOSTADO NA ESQUERDA) */}
                <div className="flex items-center h-full">
                    <div className="px-4">
                        <button onClick={onGoHome} className="hover:scale-105 active:scale-95 transition-all duration-300">
                            <img src="https://i.ibb.co/FbmLfsBw/Google-AI-Studio-2025-08-10-T15-45-10.png" alt="Logo" className="h-12 lg:h-14 w-auto rounded-lg" />
                        </button>
                    </div>
                    <div className="h-12 w-[1px] bg-white/10"></div>
                </div>

                {/* 2. TÍTULO DO SITE */}
                <div className="flex-shrink-0">
                    <span className="text-2xl md:text-3xl lg:text-4xl font-black text-white uppercase tracking-tighter leading-none drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
                        QG DO CONCURSEIRO
                    </span>
                </div>

                {/* 3. HUD DE NÍVEL */}
                <div className="flex-shrink-0">
                    <button onClick={() => onSetView('performance')} className="flex items-center gap-4 hover:bg-white/5 p-2 rounded-2xl transition-all group">
                        <div className="relative h-12 w-12 lg:h-14 lg:w-14">
                            <div className="absolute -top-1.5 -right-1.5 z-20 bg-orange-600 rounded-full p-1 shadow-[0_0_12px_rgba(234,88,12,0.8)]">
                                <FireIcon className="h-3 w-3 text-white animate-pulse" />
                            </div>
                            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                                <circle cx="18" cy="18" r="16" fill="none" stroke="#06b6d4" strokeWidth="4" strokeDasharray="100 100" strokeDashoffset={100 - progressPercent} strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-[16px] font-black text-white leading-none">{level}</span>
                                <span className="text-[7px] font-black text-cyan-500/80 uppercase tracking-tighter">LVL</span>
                            </div>
                        </div>
                        <div className="hidden sm:flex flex-col text-left leading-none">
                            <span className="text-[14px] lg:text-[16px] font-black text-white uppercase italic tracking-tighter group-hover:text-cyan-400 transition-colors">{levelTitle}</span>
                            <span className="text-[10px] font-black text-cyan-400/60 uppercase tracking-widest mt-1">+{nextLevelXp} XP</span>
                        </div>
                    </button>
                </div>

                {/* 4. HUD DE ACERTO */}
                <div className="flex-shrink-0">
                    <button onClick={() => onSetView('performance')} className="flex items-center gap-4 hover:bg-white/5 p-2 rounded-2xl transition-all group">
                        <div className={`relative h-11 w-11 lg:h-13 lg:w-13 ${accTheme.shadow} rounded-full`}>
                            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                                <circle cx="18" cy="18" r="16" fill="none" stroke={accTheme.stroke} strokeWidth="3" strokeDasharray="100 100" strokeDashoffset={100 - globalAccuracy} strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className={`text-[12px] font-black ${accTheme.text}`}>{Math.round(globalAccuracy)}%</span>
                            </div>
                        </div>
                        <div className="hidden sm:flex flex-col text-left leading-none">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] mb-1">ACERTO EM QUESTÕES</span>
                            <span className={`text-[13px] font-black uppercase italic ${accTheme.text} tracking-tight`}>{accTheme.label}</span>
                        </div>
                    </button>
                </div>

                {/* 5. HUD RELÓGIO E SESSÃO (PÍLULA) */}
                <div className="flex-shrink-0 hidden lg:flex items-center h-12 bg-black/50 rounded-full border border-white/10 px-8 gap-8 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                    <div className="flex flex-col items-center">
                        <span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.25em] mb-1">HORA</span>
                        <span className="text-[15px] font-mono font-bold text-white">
                            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <div className="w-[1px] h-6 bg-white/10"></div>
                    <div className="flex flex-col items-center">
                        <span className="text-[8px] font-black text-cyan-500 uppercase tracking-[0.25em] mb-1">SESSÃO</span>
                        <span className="text-[15px] font-mono font-bold text-cyan-400">
                            {formatTime(studySeconds)}
                        </span>
                    </div>
                </div>

                {/* 6. PERFIL USUÁRIO */}
                <div ref={navRef} className="flex-shrink-0 relative mr-4">
                    <button 
                        onClick={() => setIsNavOpen(prev => !prev)} 
                        className={`flex items-center gap-4 p-2 pr-6 rounded-full bg-gray-800/30 border border-white/5 hover:border-cyan-500/30 transition-all ${isNavOpen ? 'ring-2 ring-cyan-500/20 bg-gray-800 shadow-2xl scale-105' : ''}`}
                    >
                        <div className="relative">
                            <div className="h-10 w-10 lg:h-11 lg:w-11 rounded-full overflow-hidden border-2 border-cyan-500/30 shadow-xl">
                                {user.avatarUrl ? (
                                    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <UserCircleIcon className="h-full w-full text-gray-700 p-1" />
                                )}
                            </div>
                            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#020617] shadow-lg"></div>
                        </div>
                        <div className="hidden sm:flex flex-col text-left">
                            <span className="text-[13px] font-black text-white uppercase truncate max-w-[110px] leading-none tracking-tight">{user.name || user.username}</span>
                            <span className="text-[9px] font-black text-cyan-500 uppercase tracking-[0.2em] leading-none mt-1.5">
                                {getUserSublabel()}
                            </span>
                        </div>
                        <ChevronDownIcon className={`h-5 w-5 text-gray-600 transition-transform ${isNavOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isNavOpen && (
                        <div className="absolute right-0 mt-4 w-64 bg-[#020617] border border-white/10 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,1)] z-50 overflow-hidden backdrop-blur-2xl animate-fade-in">
                            <div className="p-4 bg-white/5 border-b border-white/5">
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.25em]">Central do Aluno</p>
                            </div>
                            <div className="py-2">
                                {navigationItems.map(item => (
                                    <button 
                                        key={item.view} 
                                        onClick={() => { onSetView(item.view); setIsNavOpen(false); }} 
                                        className={`w-full text-left px-5 py-3.5 text-[11px] font-black uppercase tracking-widest transition-all ${view === item.view ? 'bg-cyan-500/10 text-cyan-400 border-l-4 border-cyan-500' : 'text-gray-400 hover:bg-white/5'}`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                            <div className="p-4 border-t border-white/5 bg-black/30">
                                <button onClick={onLogout} className="w-full text-center py-3 text-[10px] font-black uppercase text-rose-500 hover:bg-rose-500/10 rounded-2xl border border-rose-500/20 transition-all">Encerrar Sessão</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* LINHA FINAL VERTICAL (ENCOSTADA NA DIREITA) */}
                <div className="flex-shrink-0 h-14 w-[1px] bg-white/20"></div>
            </div>
        </header>
    );
};
