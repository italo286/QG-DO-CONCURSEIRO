
import React, { useState, useRef, useEffect } from 'react';
import { User, StudentProgress } from '../../types';
import { calculateLevel, getLevelTitle, LEVEL_XP_REQUIREMENT } from '../../gamification';
import { LogoutIcon, PencilIcon, UserCircleIcon, ChevronDownIcon, CycleIcon } from '../Icons';
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
    
    // --- Lógica do Relógio e Temporizador de Estudo ---
    const [currentTime, setCurrentTime] = useState(new Date());
    const [studySeconds, setStudySeconds] = useState(0);

    useEffect(() => {
        // Inicializar cronômetro do localStorage
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
            const now = new Date();
            setCurrentTime(now);
            
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
    // ------------------------------------------------

    const level = calculateLevel(studentProgress.xp);
    const levelTitle = getLevelTitle(level);
    const levelProgress = (studentProgress.xp % LEVEL_XP_REQUIREMENT) / LEVEL_XP_REQUIREMENT * 100;

    const navigationItems = [
        { label: 'Início', view: 'dashboard' as const },
        { label: 'Revisões', view: 'reviews' as const },
        { label: 'Prática', view: 'practice_area' as const },
        { label: 'Cronograma', view: 'schedule' as const },
        { label: 'Jogos', view: 'games' as const },
        { label: 'Desempenho', view: 'performance' as const },
    ];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(event.target as Node)) {
                setIsNavOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const getHeaderText = () => {
        switch (view) {
            case 'dashboard': return 'Painel do Aluno';
            case 'topic': return selectedTopicName || 'Tópico';
            case 'subject': return 'Disciplina';
            case 'course': return selectedCourseName || 'Curso';
            case 'reviews': return 'Minhas Revisões';
            case 'schedule': return 'Meu Cronograma';
            case 'games': return 'Meus Jogos';
            case 'performance': return 'Meu Desempenho';
            case 'review_quiz': return 'Sessão de Revisão';
            case 'daily_challenge_quiz': return 'Desafio Diário';
            case 'daily_challenge_results': return 'Resultados do Desafio';
            case 'practice_area': return 'Área de Prática';
            case 'custom_quiz_player': return 'Quiz Personalizado';
            case 'simulado_player': return 'Simulado';
            default: return 'QG do Concurseiro';
        }
    };

    return (
        <header className="flex flex-col mb-6 md:mb-8 gap-4">
            <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-4 flex-grow min-w-0">
                    <button onClick={onGoHome} aria-label="Voltar para o painel inicial" className="hover:scale-105 transition-transform">
                        <img src="https://i.ibb.co/FbmLfsBw/Google-AI-Studio-2025-08-10-T15-45-10.png" alt="Logo QG do concurseiro" className="h-12 w-17 rounded-md flex-shrink-0" />
                    </button>
                    <div className="flex-grow min-w-0">
                        <h1 className="text-2xl md:text-3xl font-black text-white truncate uppercase tracking-tighter">{getHeaderText()}</h1>
                        <div className="w-full mt-2 max-w-md">
                            <div className="flex justify-between text-[10px] font-black uppercase text-gray-500 mb-1 tracking-widest">
                                <span>Nível {level} • {levelTitle}</span>
                                <span className="text-cyan-400">{studentProgress.xp % LEVEL_XP_REQUIREMENT} / {LEVEL_XP_REQUIREMENT} XP</span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-2 border border-gray-700/50 overflow-hidden">
                                <div className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full shadow-[0_0_10px_rgba(6,182,212,0.4)] transition-all duration-1000" style={{ width: `${levelProgress}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="hidden md:flex items-center gap-6 px-6 py-2 bg-gray-800/40 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
                    {/* Relógio Digital */}
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Hora Atual</span>
                        <span className="text-lg font-mono font-bold text-white leading-none">
                            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    </div>
                    <div className="w-px h-8 bg-gray-700"></div>
                    {/* Cronômetro de Estudo */}
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black text-cyan-500/70 uppercase tracking-[0.2em] flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></div>
                            Tempo Ativo
                        </span>
                        <span className="text-lg font-mono font-bold text-cyan-400 leading-none">
                            {formatTime(studySeconds)}
                        </span>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <div ref={navRef} className="relative">
                        <button onClick={() => setIsNavOpen(prev => !prev)} className="flex items-center space-x-2 px-4 py-2 text-sm font-bold uppercase tracking-widest rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-all">
                            <span>Menu</span>
                            <ChevronDownIcon className={`h-4 w-4 transition-transform ${isNavOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isNavOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                                {navigationItems.map(item => (
                                    <button
                                        key={item.view}
                                        onClick={() => { onSetView(item.view); setIsNavOpen(false); }}
                                        className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${view === item.view ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="w-px h-6 bg-gray-700" aria-hidden="true"></div>
                    <button onClick={onOpenProfile} className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-800 transition-colors">
                        {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover border-2 border-gray-700" />
                        ) : (
                            <UserCircleIcon className="h-10 w-10 text-gray-500" />
                        )}
                        <PencilIcon className="h-4 w-4 text-gray-500" />
                    </button>
                    <button onClick={onLogout} className="text-gray-500 hover:text-red-400 transition-colors" title="Sair do Sistema">
                        <LogoutIcon className="h-6 w-6" />
                    </button>
                </div>
            </div>

            {/* Mobile Study Stats (Apenas visível em telas pequenas) */}
            <div className="flex md:hidden justify-around items-center p-3 bg-gray-800/40 rounded-xl border border-gray-700/50">
                <div className="text-center">
                    <p className="text-[8px] font-black text-gray-500 uppercase">Brasília</p>
                    <p className="text-sm font-mono font-bold">{currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="text-center">
                    <p className="text-[8px] font-black text-cyan-500 uppercase">Tempo Ativo</p>
                    <p className="text-sm font-mono font-bold text-cyan-400">{formatTime(studySeconds)}</p>
                </div>
            </div>
        </header>
    );
};
