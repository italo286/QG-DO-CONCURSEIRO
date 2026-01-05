
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, StudentProgress } from '../../types';
import { calculateLevel, getLevelTitle, LEVEL_XP_REQUIREMENT } from '../../gamification';
import { UserCircleIcon, ChevronDownIcon, FireIcon, AcademicCapIcon } from '../Icons';
import { getBrasiliaDate, getLocalDateISOString } from '../../utils';

// Tipagem flexível para suportar ambos os dashboards
type ViewType = string;

interface StudentHeaderProps {
    user: User;
    studentProgress?: StudentProgress; // Opcional para o professor
    view: ViewType;
    isProfessorView?: boolean;
    onSetView: (view: any) => void;
    onLogout: () => void;
    onGoHome: () => void;
}

export const StudentHeader: React.FC<StudentHeaderProps> = ({
    user,
    studentProgress,
    view,
    isProfessorView = false,
    onSetView,
    onLogout,
    onGoHome,
}) => {
    const [isNavOpen, setIsNavOpen] = useState(false);
    const navRef = useRef<HTMLDivElement>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [studySeconds, setStudySeconds] = useState(0);

    // Itens de navegação baseados no papel
    const navigationItems = useMemo(() => {
        if (isProfessorView) {
            return [
                { label: 'Meus Cursos', view: 'courses' },
                { label: 'Disciplinas', view: 'subjects' },
                { label: 'Revisões', view: 'reviews' },
                { label: 'Planejamento', view: 'scheduler' },
                { label: 'Desempenho da Turma', view: 'performance' },
                { label: 'Diagnóstico IA', view: 'diagnostics' },
            ];
        }
        return [
            { label: 'Painel Inicial', view: 'dashboard' },
            { label: 'Cronograma', view: 'schedule' },
            { label: 'Meu Desempenho', view: 'performance' },
            { label: 'Revisões', view: 'reviews' },
            { label: 'Área de Prática', view: 'practice_area' },
            { label: 'Configurações', view: 'settings' },
        ];
    }, [isProfessorView]);

    // Cálculos de Gamificação (Apenas se for aluno)
    const level = studentProgress ? calculateLevel(studentProgress.xp) : 0;
    const levelTitle = studentProgress ? getLevelTitle(level).toUpperCase() : '';
    const xpCurrentLevel = studentProgress ? studentProgress.xp % LEVEL_XP_REQUIREMENT : 0;
    const progressPercent = (xpCurrentLevel / LEVEL_XP_REQUIREMENT) * 100;
    const nextLevelXp = LEVEL_XP_REQUIREMENT - xpCurrentLevel;

    const globalAccuracy = useMemo(() => {
        if (!studentProgress) return 0;
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

    // Lógica unificada para sub-rótulo de perfil respeitando gênero e cargo
    const getUserSublabel = () => {
        const isFem = user.gender === 'feminine';
        if (user.role === 'professor') {
            return isFem ? 'PROFESSORA' : 'PROFESSOR';
        }
        return isFem ? 'CONCURSEIRA' : 'CONCURSEIRO';
    };

    return (
        <header className="sticky top-0 z-50 w-full bg-[#020617] border-b border-white/5 shadow-[0_15px_50px_-15px_rgba(0,0,0,0.8)] h-24">
            <div className="w-full h-full px-6 sm:px-12 md:px-16 lg:px-24 flex items-center justify-between gap-4">
                
                {/* 1. LOGO + DIVISOR */}
                <div className="flex items-center gap-3 lg:gap-6 flex-shrink-0">
                    <button onClick={onGoHome} className="hover:scale-105 active:scale-95 transition-all duration-300">
                        <img src="https://i.ibb.co/FbmLfsBw/Google-AI-Studio-2025-08-10-T15-45-10.png" alt="Logo" className="h-10 lg:h-13 w-auto rounded-lg" />
                    </button>
                    <div className="h-12 w-[1px] bg-white/10 hidden xs:block"></div>
                </div>

                {/* 2. TÍTULO */}
                <div className="flex-shrink-0 hidden sm:block">
                    <span className="text-lg md:text-xl lg:text-3xl font-black text-white uppercase tracking-tighter leading-none drop-shadow-2xl">
                        QG DO CONCURSEIRO
                    </span>
                </div>

                {/* 3. ELEMENTOS DE PERFORMANCE OU IDENTIFICADOR */}
                {!isProfessorView ? (
                    <>
                        <div className="flex-shrink-0">
                            <button onClick={() => onSetView('performance')} className="flex items-center gap-2 lg:gap-4 hover:bg-white/5 p-1.5 lg:p-2 rounded-2xl transition-all group">
                                <div className="relative h-10 w-10 lg:h-14 lg:w-14">
                                    <div className="absolute -top-1 -right-1 z-20 bg-orange-600 rounded-full p-0.5 lg:p-1 shadow-lg">
                                        <FireIcon className="h-2.5 lg:h-3.5 w-2.5 lg:w-3.5 text-white animate-pulse" />
                                    </div>
                                    <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                                        <circle cx="18" cy="18" r="16" fill="none" stroke="#06b6d4" strokeWidth="4" strokeDasharray="100 100" strokeDashoffset={100 - progressPercent} strokeLinecap="round" />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                                        <span className="text-[12px] lg:text-[16px] font-black text-white">{level}</span>
                                        <span className="text-[5px] lg:text-[7px] font-black text-cyan-500/80 uppercase">LVL</span>
                                    </div>
                                </div>
                                <div className="hidden lg:flex flex-col text-left leading-none">
                                    <span className="text-[12px] lg:text-[15px] font-black text-white uppercase italic tracking-tighter group-hover:text-cyan-400 transition-colors">{levelTitle}</span>
                                    <span className="text-[9px] font-black text-cyan-400/60 uppercase tracking-widest mt-1">+{nextLevelXp} XP</span>
                                </div>
                            </button>
                        </div>

                        <div className="flex-shrink-0 hidden md:block">
                            <button onClick={() => onSetView('performance')} className="flex items-center gap-2 lg:gap-4 hover:bg-white/5 p-1.5 lg:p-2 rounded-2xl transition-all group text-left">
                                <div className={`relative h-10 w-10 lg:h-12 lg:w-12 ${accTheme.shadow} rounded-full`}>
                                    <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                                        <circle cx="18" cy="18" r="16" fill="none" stroke={accTheme.stroke} strokeWidth="3" strokeDasharray="100 100" strokeDashoffset={100 - globalAccuracy} strokeLinecap="round" />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className={`text-[10px] lg:text-[12px] font-black ${accTheme.text}`}>{Math.round(globalAccuracy)}%</span>
                                    </div>
                                </div>
                                <div className="flex flex-col leading-none">
                                    <span className="text-[8px] lg:text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">ACERTO EM QUESTÕES</span>
                                    <span className={`text-[11px] lg:text-[13px] font-black uppercase italic ${accTheme.text}`}>{accTheme.label}</span>
                                </div>
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex-shrink-0 flex items-center gap-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 px-6 py-3 rounded-2xl border border-cyan-500/20 shadow-xl">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                            <AcademicCapIcon className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[14px] lg:text-[18px] font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 uppercase tracking-tighter italic">PAINEL DO PROFESSOR</span>
                            <span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.3em]">CENTRAL DE COMANDO</span>
                        </div>
                    </div>
                )}

                {/* 4. HUD RELÓGIO PÍLULA */}
                <div className="flex-shrink-0 hidden lg:flex items-center h-12 bg-black/50 rounded-full border border-white/10 px-6 xl:px-10 gap-6 xl:gap-10 shadow-inner">
                    <div className="flex flex-col items-center">
                        <span className="text-[7px] xl:text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mb-0.5">HORA</span>
                        <span className="text-[13px] xl:text-[15px] font-mono font-bold text-white">
                            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <div className="w-[1px] h-6 bg-white/10"></div>
                    <div className="flex flex-col items-center">
                        <span className="text-[7px] xl:text-[8px] font-black text-cyan-500 uppercase tracking-[0.2em] mb-0.5">{isProfessorView ? 'ONLINE' : 'SESSÃO'}</span>
                        <span className="text-[13px] xl:text-[15px] font-mono font-bold text-cyan-400">
                            {formatTime(studySeconds)}
                        </span>
                    </div>
                </div>

                {/* 5. PERFIL USUÁRIO (NOME E SUB-RÓTULO AO LADO DO AVATAR) */}
                <div ref={navRef} className="flex-shrink-0 relative flex items-center gap-3">
                    <button 
                        onClick={() => setIsNavOpen(prev => !prev)} 
                        className={`flex items-center gap-2 lg:gap-4 p-1 lg:p-1.5 pr-3 lg:pr-6 rounded-full bg-gray-800/30 border border-white/10 hover:border-cyan-500/30 transition-all ${isNavOpen ? 'ring-2 ring-cyan-500/20 bg-gray-800 shadow-xl' : ''}`}
                    >
                        <div className="relative">
                            <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-full overflow-hidden border-2 border-cyan-500/20">
                                {user.avatarUrl ? (
                                    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <UserCircleIcon className="h-full w-full text-gray-700 p-1" />
                                )}
                            </div>
                            <div className="absolute bottom-0 right-0 w-2.5 lg:w-3 h-2.5 lg:h-3 bg-green-500 rounded-full border-2 border-[#020617]"></div>
                        </div>
                        <div className="hidden xs:flex flex-col text-left">
                            <span className="text-[10px] lg:text-[13px] font-black text-white uppercase truncate max-w-[70px] lg:max-w-[100px] leading-tight tracking-tight">
                                {user.name || user.username}
                            </span>
                            <span className="text-[7px] lg:text-[8px] font-black text-cyan-500 uppercase tracking-widest leading-none mt-1">
                                {getUserSublabel()}
                            </span>
                        </div>
                        <ChevronDownIcon className={`h-4 w-4 text-gray-600 transition-transform ${isNavOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <div className="h-12 w-[1px] bg-white/20 hidden sm:block"></div>

                    {isNavOpen && (
                        <div className="absolute right-0 top-full mt-4 w-64 bg-[#020617] border border-white/10 rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,1)] z-50 overflow-hidden backdrop-blur-2xl animate-fade-in">
                            <div className="p-4 bg-white/5 border-b border-white/5">
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Navegação do {isProfessorView ? 'Professor' : 'Aluno'}</p>
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
                            <div className="p-4 border-t border-white/5 bg-black/20">
                                <button onClick={onLogout} className="w-full text-center py-2.5 text-[9px] font-black uppercase text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all">Sair do Sistema</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};
