
import React, { useState, useRef, useEffect } from 'react';
import { User, StudentProgress } from '../../types';
import { calculateLevel, getLevelTitle, LEVEL_XP_REQUIREMENT } from '../../gamification';
import { LogoutIcon, UserCircleIcon, ChevronDownIcon } from '../Icons';
import { getBrasiliaDate, getLocalDateISOString } from '../../utils';

type ViewType = 'dashboard' | 'course' | 'subject' | 'topic' | 'schedule' | 'performance' | 'reviews' | 'review_quiz' | 'games' | 'daily_challenge_quiz' | 'daily_challenge_results' | 'practice_area' | 'custom_quiz_player' | 'simulado_player';

interface StudentHeaderProps {
    user: User;
    studentProgress: StudentProgress;
    view: ViewType;
    selectedTopicName?: string;
    selectedCourseName?: string;
    onSetView: (view: ViewType) => void;
    onOpenProfile: () => void;
    onLogout: () => void;
    onGoHome: () => void;
}

export const StudentHeader: React.FC<StudentHeaderProps> = ({
    user,
    studentProgress,
    view,
    selectedTopicName,
    selectedCourseName,
    onSetView,
    onOpenProfile,
    onLogout,
    onGoHome,
}) => {
    const [isNavOpen, setIsNavOpen] = useState(false);
    const navRef = useRef<HTMLDivElement>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [studySeconds, setStudySeconds] = useState(0);

    // Cálculos de Gamificação para o Cabeçalho
    const level = calculateLevel(studentProgress.xp);
    const levelTitle = getLevelTitle(level);
    const xpCurrentLevel = studentProgress.xp % LEVEL_XP_REQUIREMENT;
    const progressPercent = (xpCurrentLevel / LEVEL_XP_REQUIREMENT) * 100;

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

    const navigationItems = [
        { label: 'Início', view: 'dashboard' as const },
        { label: 'Revisões', view: 'reviews' as const },
        { label: 'Prática', view: 'practice_area' as const },
        { label: 'Cronograma', view: 'schedule' as const },
        { label: 'Jogos', view: 'games' as const },
        { label: 'Desempenho', view: 'performance' as const },
    ];

    return (
        <header className="flex flex-col mb-8 gap-6">
            <div className="flex justify-between items-center gap-6">
                
                {/* LOGO E TÍTULO DA VIEW */}
                <div className="flex items-center gap-4 flex-shrink-0">
                    <button onClick={onGoHome} className="hover:scale-105 transition-transform">
                        <img src="https://i.ibb.co/FbmLfsBw/Google-AI-Studio-2025-08-10-T15-45-10.png" alt="Logo" className="h-10 w-15 rounded-md flex-shrink-0" />
                    </button>
                    <div className="hidden sm:block min-w-0">
                        <h1 className="text-xl font-black text-white truncate uppercase tracking-tighter leading-none">
                            {view === 'dashboard' ? 'Painel do Aluno' : (selectedTopicName || selectedCourseName || 'QG')}
                        </h1>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">High Performance Ed.</p>
                    </div>
                </div>

                {/* WIDGET DE NÍVEL HORIZONTAL - CONFORME IMAGEM */}
                <div className="flex-grow max-w-md hidden md:flex items-center gap-4 bg-black/40 border border-white/5 p-3 px-5 rounded-2xl shadow-inner">
                    <div className="relative flex-shrink-0">
                        <div className="absolute inset-0 bg-cyan-500/10 blur-lg rounded-full"></div>
                        <div className="relative h-12 w-12 rounded-full border-2 border-cyan-500/30 flex items-center justify-center bg-gray-900 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                            <span className="text-xl font-black text-white">{level}</span>
                        </div>
                    </div>
                    <div className="flex-grow min-w-0">
                        <div className="flex flex-col mb-1">
                            <span className="text-[8px] font-black text-cyan-500 uppercase tracking-[0.2em]">Nível Atual</span>
                            <span className="text-sm font-black text-white uppercase tracking-tighter italic truncate leading-none">{levelTitle}</span>
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between items-end">
                                <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest leading-none">{studentProgress.xp} XP TOTAL</span>
                                <span className="text-[8px] font-black text-cyan-400 uppercase tracking-widest leading-none">{xpCurrentLevel} / {LEVEL_XP_REQUIREMENT}</span>
                            </div>
                            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden p-[1px] border border-white/5">
                                <div className="h-full bg-cyan-500 rounded-full shadow-[0_0_6px_cyan]" style={{ width: `${progressPercent}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RELÓGIO E TEMPO ATIVO */}
                <div className="hidden lg:flex items-center bg-[#0f172a]/80 rounded-2xl border border-gray-800 shadow-2xl backdrop-blur-xl h-14 overflow-hidden flex-shrink-0">
                    <div className="flex flex-col items-center px-5 border-r border-gray-800 justify-center">
                        <span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mb-0.5">Relógio</span>
                        <span className="text-base font-mono font-black text-white leading-none tracking-wider">
                            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <div className="flex flex-col items-center px-5 justify-center">
                        <span className="text-[8px] font-black text-cyan-500/60 uppercase tracking-[0.2em] mb-0.5 flex items-center gap-1">
                            <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></div>
                            Sessão
                        </span>
                        <span className="text-base font-mono font-black text-cyan-400 leading-none tracking-wider drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
                            {formatTime(studySeconds)}
                        </span>
                    </div>
                </div>

                {/* MENU E PERFIL */}
                <div className="flex items-center space-x-3 flex-shrink-0">
                    <div ref={navRef} className="relative">
                        <button onClick={() => setIsNavOpen(prev => !prev)} className="flex items-center space-x-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-all text-gray-300">
                            <span>Navegar</span>
                            <ChevronDownIcon className={`h-3 w-3 transition-transform ${isNavOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isNavOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                                {navigationItems.map(item => (
                                    <button key={item.view} onClick={() => { onSetView(item.view); setIsNavOpen(false); }} className={`w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${view === item.view ? 'bg-cyan-600 text-white' : 'text-gray-500 hover:bg-gray-800 hover:text-white'}`}>
                                        {item.label}
                                    </button>
                                ))}
                                <div className="border-t border-gray-800 my-1"></div>
                                <button onClick={onLogout} className="w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10">Sair do QG</button>
                            </div>
                        )}
                    </div>
                    <button onClick={onOpenProfile} className="h-10 w-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center hover:border-cyan-500/50 transition-all shadow-lg overflow-hidden group">
                        {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover group-hover:scale-110 transition-transform" /> : <UserCircleIcon className="h-6 w-6 text-gray-500" />}
                    </button>
                </div>
            </div>
        </header>
    );
};
