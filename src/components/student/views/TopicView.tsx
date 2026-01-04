
import React, { useState, useEffect, useRef } from 'react';
import { 
    Subject, Topic, SubTopic, PdfFile, StudentProgress, MiniGame, QuestionAttempt, VideoFile, BankProfilePdf
} from '../../../types';
import { convertMediaUrlToEmbed, getMediaThumbnail } from '../../../utils';
import { Card, Button } from '../../ui';
import { 
    DocumentTextIcon, LightBulbIcon, VideoCameraIcon,
    FlashcardIcon, GameControllerIcon, ClipboardListIcon, SplitScreenIcon, GeminiIcon,
    XCircleIcon, ChevronDoubleLeftIcon, ArrowRightIcon, TrophyIcon, TagIcon, ClipboardCheckIcon,
    BrainIcon, BriefcaseIcon, ChartLineIcon
} from '../../Icons';
import { QuizView } from '../QuizView';
import { NotesEditor } from '../NotesEditor';
import { PdfViewer } from '../PdfViewer';
import { FlashcardPlayer } from '../FlashcardPlayer';
import { TopicMedalDisplay } from '../TopicMedalDisplay';

interface TopicViewProps {
    selectedSubject: Subject;
    selectedTopic: Topic;
    selectedSubtopic: SubTopic | null;
    studentProgress: StudentProgress;
    isPreview?: boolean;
    isSplitView: boolean;
    isSidebarCollapsed: boolean;
    onNoteSave: (contentId: string, content: string) => void;
    saveQuizProgress: (subjectId: string, topicId: string, attempt: QuestionAttempt) => void;
    handleTopicQuizComplete: (subjectId: string, topicId: string, attempts: QuestionAttempt[]) => void;
    onPlayGame: (game: MiniGame, topicId: string) => void;
    onToggleSplitView: () => void;
    onSetIsSidebarCollapsed: (collapsed: boolean) => void;
    onOpenChatModal: () => void;
    onAddBonusXp: (amount: number, message: string) => void;
    onReportQuestion: (subjectId: string, topicId: string, questionId: string, isTec: boolean, reason: string) => void;
}

export const TopicView: React.FC<TopicViewProps> = ({
    selectedSubject,
    selectedTopic,
    selectedSubtopic,
    studentProgress,
    isPreview,
    isSplitView,
    isSidebarCollapsed,
    onNoteSave,
    saveQuizProgress,
    handleTopicQuizComplete,
    onPlayGame,
    onToggleSplitView,
    onSetIsSidebarCollapsed,
    onOpenChatModal,
    onAddBonusXp,
    onReportQuestion
}) => {
    const [activeTopicTab, setActiveTopicTab] = useState('');
    const [activeFullPdf, setActiveFullPdf] = useState<PdfFile | null>(null);
    const [activeSummaryPdf, setActiveSummaryPdf] = useState<PdfFile | null>(null);
    const [activeRaioXPdf, setActiveRaioXPdf] = useState<PdfFile | null>(null);
    const [activeVideo, setActiveVideo] = useState<VideoFile | null>(null);
    const [activeBankPdf, setActiveBankPdf] = useState<BankProfilePdf | null>(null);
    const notesEditorRef = useRef<HTMLDivElement>(null);

    const [splitLeftTab, setSplitLeftTab] = useState('pdf');
    const [splitRightTab, setSplitRightTab] = useState('notes');
    const [splitLeftActivePdf, setSplitLeftActivePdf] = useState<PdfFile | null>(null);
    const [splitLeftActiveSummaryPdf, setSplitLeftActiveSummaryPdf] = useState<PdfFile | null>(null);
    const [splitLeftActiveRaioXPdf, setSplitLeftActiveRaioXPdf] = useState<PdfFile | null>(null);
    const [splitRightActivePdf, setSplitRightActivePdf] = useState<PdfFile | null>(null);
    const [splitRightActiveSummaryPdf, setSplitRightActiveSummaryPdf] = useState<PdfFile | null>(null);
    const [splitRightActiveRaioXPdf, setSplitRightActiveRaioXPdf] = useState<PdfFile | null>(null);
    const [splitLeftActiveVideo, setSplitLeftActiveVideo] = useState<VideoFile | null>(null);
    const [splitRightActiveVideo, setSplitRightActiveVideo] = useState<VideoFile | null>(null);
    const [splitLeftActiveBankPdf, setSplitLeftActiveBankPdf] = useState<BankProfilePdf | null>(null);
    const [splitRightActiveBankPdf, setSplitRightActiveBankPdf] = useState<BankProfilePdf | null>(null);

    const currentContent = selectedSubtopic || selectedTopic;
    const parentTopic = selectedTopic;

    const tabs = [
        { value: 'pdf', label: 'Aula', icon: DocumentTextIcon, count: currentContent.fullPdfs?.length },
        { value: 'summary', label: 'Resumo', icon: LightBulbIcon, count: currentContent.summaryPdfs?.length },
        { value: 'raiox', label: 'Raio X', icon: ChartLineIcon, count: currentContent.raioXPdfs?.length },
        { value: 'videos', label: 'Vídeos', icon: VideoCameraIcon, count: currentContent.videoUrls?.length },
        { value: 'mindMap', label: 'Mapa Mental', icon: BrainIcon, count: currentContent.mindMapUrl ? 1 : 0 },
        { value: 'bankProfile', label: 'Perfil da Banca', icon: BriefcaseIcon, count: currentContent.bankProfilePdfs?.length },
        { value: 'quiz', label: 'Questões (Conteúdo)', icon: ClipboardCheckIcon, count: currentContent.questions?.length },
        { value: 'tec_questions_quiz', label: 'Questões Extraídas', icon: ClipboardCheckIcon, count: currentContent.tecQuestions?.length },
        { value: 'tec_caderno', label: 'Caderno TEC', icon: ClipboardListIcon, count: currentContent.tecUrl ? 1 : 0 },
        { value: 'glossary', label: 'Glossário', icon: TagIcon, count: currentContent.glossary?.length },
        { value: 'flashcards', label: 'Flashcards', icon: FlashcardIcon, count: currentContent.flashcards?.length },
        { value: 'games', label: 'Jogos', icon: GameControllerIcon, count: currentContent.miniGames?.length },
        { value: 'medals', label: 'Medalhas', icon: TrophyIcon, count: 1 },
        { value: 'notes', label: 'Anotações', icon: ClipboardListIcon, count: 1 },
    ].filter(tab => (tab.count || 0) > 0);

    useEffect(() => {
        if (!isSplitView) {
            const availableTabs = tabs.map(t => t.value);
            if (availableTabs.length > 0 && !availableTabs.includes(activeTopicTab)) {
                setActiveTopicTab(availableTabs[0]);
            }
        }
    }, [isSplitView, currentContent, activeTopicTab, tabs]);
    
    useEffect(() => {
        setActiveFullPdf(null);
        setActiveSummaryPdf(null);
        setActiveRaioXPdf(null);
        setActiveVideo(null);
        setActiveBankPdf(null);
        setSplitLeftActivePdf(null);
        setSplitLeftActiveSummaryPdf(null);
        setSplitLeftActiveRaioXPdf(null);
        setSplitRightActivePdf(null);
        setSplitRightActiveSummaryPdf(null);
        setSplitRightActiveRaioXPdf(null);
        setSplitLeftActiveVideo(null);
        setSplitRightActiveVideo(null);
        setSplitLeftActiveBankPdf(null);
        setSplitRightActiveBankPdf(null);
    }, [currentContent]);

    const renderTopicTabContent = (tabValue: string) => {
        switch(tabValue) {
            case 'pdf': {
                const pdfContainerClass = 'h-full flex flex-col';
                if (currentContent.fullPdfs?.length === 1) {
                    return (
                        <div className={pdfContainerClass}>
                            <div className="flex-grow min-h-0 w-full aspect-[4/5]">
                                <PdfViewer file={currentContent.fullPdfs[0]} />
                            </div>
                        </div>
                    );
                }
                if (currentContent.fullPdfs?.length > 1) {
                    if (activeFullPdf) {
                        return (
                            <div className={pdfContainerClass}>
                                <div className="p-2 flex-shrink-0">
                                    <button onClick={() => setActiveFullPdf(null)} className="text-cyan-400 hover:text-cyan-300 flex items-center text-sm">
                                        <ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180" />
                                        Voltar para a lista de PDFs
                                    </button>
                                </div>
                                <div className="flex-grow min-h-0 w-full aspect-[4/5]">
                                    <PdfViewer file={activeFullPdf} />
                                </div>
                            </div>
                        );
                    } else {
                        return (
                            <div className={pdfContainerClass}>
                                <div className="p-4 space-y-4">
                                    <h3 className="text-xl font-bold">Aulas em PDF</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {currentContent.fullPdfs.map((pdf, i) => (
                                            <Card key={i} onClick={() => setActiveFullPdf(pdf)} className="p-4 flex items-center justify-between hover:bg-gray-700 cursor-pointer">
                                                <div className="flex items-center space-x-3">
                                                    <DocumentTextIcon className="h-6 w-6 text-cyan-400 flex-shrink-0" />
                                                    <span className="truncate">{pdf.fileName}</span>
                                                </div>
                                                <ArrowRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0"/>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    }
                }
                return null;
            }
            case 'summary': {
                const summaryContainerClass = 'h-full flex flex-col';
                if (currentContent.summaryPdfs?.length === 1) {
                    return (
                        <div className={summaryContainerClass}>
                            <div className="flex-grow min-h-0 w-full aspect-[4/5]">
                                <PdfViewer file={currentContent.summaryPdfs[0]} />
                            </div>
                        </div>
                    );
                }
                if (currentContent.summaryPdfs?.length > 1) {
                    if (activeSummaryPdf) {
                        return (
                            <div className={summaryContainerClass}>
                                <div className="p-2 flex-shrink-0">
                                    <button onClick={() => setActiveSummaryPdf(null)} className="text-cyan-400 hover:text-cyan-300 flex items-center text-sm">
                                        <ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180" />
                                        Voltar para a lista de PDFs
                                    </button>
                                </div>
                                <div className="flex-grow min-h-0 w-full aspect-[4/5]">
                                    <PdfViewer file={activeSummaryPdf} />
                                </div>
                            </div>
                        );
                    } else {
                        return (
                            <div className={summaryContainerClass}>
                                <div className="p-4 space-y-4">
                                    <h3 className="text-xl font-bold">Resumos em PDF</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {currentContent.summaryPdfs.map((pdf, i) => (
                                            <Card key={i} onClick={() => setActiveSummaryPdf(pdf)} className="p-4 flex items-center justify-between hover:bg-gray-700 cursor-pointer">
                                                <div className="flex items-center space-x-3">
                                                    <DocumentTextIcon className="h-6 w-6 text-cyan-400 flex-shrink-0" />
                                                    <span className="truncate">{pdf.fileName}</span>
                                                </div>
                                                <ArrowRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0"/>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    }
                }
                return null;
            }
            case 'raiox': {
                const containerClass = 'h-full flex flex-col';
                if ((currentContent.raioXPdfs || []).length === 1) {
                    return (
                        <div className={containerClass}>
                            <div className="flex-grow min-h-0 w-full aspect-[4/5]">
                                <PdfViewer file={currentContent.raioXPdfs![0]} />
                            </div>
                        </div>
                    );
                }
                if ((currentContent.raioXPdfs || []).length > 1) {
                    if (activeRaioXPdf) {
                        return (
                            <div className={containerClass}>
                                <div className="p-2 flex-shrink-0">
                                    <button onClick={() => setActiveRaioXPdf(null)} className="text-cyan-400 hover:text-cyan-300 flex items-center text-sm">
                                        <ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180" />
                                        Voltar para a lista de PDFs
                                    </button>
                                </div>
                                <div className="flex-grow min-h-0 w-full aspect-[4/5]">
                                    <PdfViewer file={activeRaioXPdf} />
                                </div>
                            </div>
                        );
                    } else {
                        return (
                            <div className={containerClass}>
                                <div className="p-4 space-y-4">
                                    <h3 className="text-xl font-bold">PDFs de Raio X</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {(currentContent.raioXPdfs || []).map((pdf, i) => (
                                            <Card key={i} onClick={() => setActiveRaioXPdf(pdf)} className="p-4 flex items-center justify-between hover:bg-gray-700 cursor-pointer">
                                                <div className="flex items-center space-x-3">
                                                    <ChartLineIcon className="h-6 w-6 text-cyan-400 flex-shrink-0" />
                                                    <span className="truncate">{pdf.fileName}</span>
                                                </div>
                                                <ArrowRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0"/>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    }
                }
                return null;
            }
            case 'videos':
                if (activeVideo) {
                    return (
                        <div className="p-6 space-y-6 max-h-full overflow-y-auto animate-fade-in bg-gray-950 rounded-[2.5rem] border border-gray-700/50 m-4 shadow-2xl">
                            <div className="flex items-center justify-between">
                                <button onClick={() => setActiveVideo(null)} className="text-cyan-400 hover:text-white transition-all flex items-center font-black text-[10px] uppercase tracking-widest bg-gray-800 px-5 py-2.5 rounded-full border border-gray-700 shadow-xl hover:scale-105 active:scale-95">
                                    <ArrowRightIcon className="h-3 w-3 mr-2 transform rotate-180" />
                                    Fechar Cinema
                                </button>
                                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                                    <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></div>
                                    <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">Em Execução</span>
                                </div>
                            </div>
                            
                            <div className="space-y-6">
                                <div className="space-y-1">
                                    <h3 className="text-3xl font-black text-white tracking-tighter uppercase leading-none italic">{activeVideo.name}</h3>
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">{selectedSubject.name} • Protocolo High Performance</p>
                                </div>
                                <div className="relative aspect-video rounded-[2rem] overflow-hidden shadow-[0_0_100px_-20px_rgba(34,211,238,0.3)] border-4 border-gray-800 bg-black">
                                    <iframe 
                                        src={convertMediaUrlToEmbed(activeVideo.url)} 
                                        title={activeVideo.name}
                                        frameBorder="0" 
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                        allowFullScreen
                                        className="w-full h-full"
                                    ></iframe>
                                </div>
                            </div>
                        </div>
                    );
                }
                return (
                    <div className="p-10 space-y-10 animate-fade-in custom-scrollbar">
                        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-2.5 h-10 bg-cyan-500 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.6)]"></div>
                                    <h3 className="text-4xl font-black text-white uppercase tracking-tighter italic leading-none">Galeria de Vídeo</h3>
                                </div>
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-[0.3em] ml-5">Transmissão Direta do QG</p>
                            </div>
                        </header>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
                            {(currentContent.videoUrls || []).map((video, index) => {
                                const thumbnailUrl = getMediaThumbnail(video.url);
                                // Prioriza o nome do subtópico/aula conforme pedido pelo usuário
                                const displayName = (currentContent.videoUrls || []).length > 1 
                                    ? `${currentContent.name} - Parte ${index + 1}`
                                    : currentContent.name;

                                return (
                                    <div 
                                        key={video.url} 
                                        onClick={() => setActiveVideo({...video, name: displayName})} 
                                        className="group relative cursor-pointer"
                                    >
                                        <Card className="!p-0 overflow-hidden bg-gray-900 border-gray-800 hover:border-cyan-500/40 transition-all duration-500 rounded-[2.5rem] shadow-2xl flex flex-col h-full hover:translate-y-[-8px] backdrop-blur-sm">
                                            
                                            {/* Thumbnail Container */}
                                            <div className="relative aspect-video overflow-hidden bg-gray-950">
                                                {thumbnailUrl ? (
                                                    <img src={thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-gray-900 via-gray-800 to-gray-900 relative">
                                                        <div className="relative flex flex-col items-center gap-3">
                                                            <div className="w-16 h-16 rounded-full bg-gray-900/80 flex items-center justify-center border border-gray-700 shadow-2xl group-hover:border-cyan-500/50 transition-colors">
                                                                <VideoCameraIcon className="h-8 w-8 text-gray-700 group-hover:text-cyan-500 transition-colors" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-black/10 opacity-90"></div>
                                                
                                                {/* Play Button Central (Padrão Elite) */}
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 transform scale-50 group-hover:scale-100">
                                                    <div className="w-16 h-16 rounded-full bg-cyan-500 text-white flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.6)]">
                                                        <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M4.516 7.548c.436-1.146 1.943-1.146 2.378 0l3.158 8.271c.436 1.146-.667 2.181-1.66 2.181H2.607c-.993 0-2.096-1.035-1.66-2.181l3.569-8.271z" transform="rotate(90 10 10)" /></svg>
                                                    </div>
                                                </div>

                                                <div className="absolute top-5 left-5">
                                                    <div className="px-3 py-1 rounded-lg bg-gray-950/90 backdrop-blur-md border border-gray-700/50 shadow-lg">
                                                        <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">AULA</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Footer Info Minimalista */}
                                            <div className="p-7 flex-grow flex flex-col justify-center">
                                                <h4 className="text-base font-black text-white group-hover:text-cyan-400 transition-colors leading-tight line-clamp-2 uppercase tracking-tight italic">
                                                    {displayName}
                                                </h4>
                                                
                                                <div className="mt-4 flex items-center justify-between opacity-40 group-hover:opacity-100 transition-opacity">
                                                    <div className="flex gap-1.5">
                                                        {[1,2,3].map(i => <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= 2 ? 'bg-cyan-500' : 'bg-gray-700'}`}></div>)}
                                                    </div>
                                                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">ASSISTIR AGORA</span>
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            case 'quiz': {
                const attempts = studentProgress?.progressByTopic[selectedSubject!.id]?.[currentContent.id]?.lastAttempt || [];
                return <QuizView 
                    questions={currentContent.questions} 
                    initialAttempts={attempts} 
                    onSaveAttempt={(attempt) => saveQuizProgress(selectedSubject!.id, currentContent.id, attempt)}
                    onComplete={(attempts) => handleTopicQuizComplete(selectedSubject!.id, currentContent.id, attempts)}
                    onBack={() => {}} 
                    quizTitle={`Questões de Conteúdo: ${currentContent.name}`}
                    studentProgress={studentProgress}
                />;
            }
            case 'tec_questions_quiz': {
                const tecQuizId = `${currentContent.id}-tec`;
                const tecAttempts = studentProgress?.progressByTopic[selectedSubject!.id]?.[tecQuizId]?.lastAttempt || [];
                return <QuizView
                    questions={currentContent.tecQuestions || []}
                    initialAttempts={tecAttempts}
                    onSaveAttempt={(attempt) => saveQuizProgress(selectedSubject!.id, tecQuizId, attempt)}
                    onComplete={(attempts) => handleTopicQuizComplete(selectedSubject!.id, tecQuizId, attempts)}
                    onBack={() => {}}
                    quizTitle={`Questões Extraídas: ${currentContent.name}`}
                    studentProgress={studentProgress}
                />;
            }
            case 'tec_caderno':
                return (
                    <div className="p-8 flex flex-col items-center justify-center h-full text-center">
                        <img src="https://cdn.tecconcursos.com.br/blog/wp-content/uploads/2020/05/Design-sem-nome.png" alt="TEC Concursos Logo" className="h-12 w-auto mb-4" />
                        <h3 className="text-2xl font-bold">Acesse o Caderno de Questões</h3>
                        <p className="text-gray-400 my-4 max-w-md">Pratique com questões selecionadas pelo seu professor diretamente no site do TEC Concursos para aprimorar seus conhecimentos.</p>
                        <Button onClick={() => window.open(currentContent.tecUrl, '_blank', 'noopener,noreferrer')}>
                            Ir para o Caderno de Questões <ArrowRightIcon className="h-5 w-5 ml-2" />
                        </Button>
                    </div>
                );
            case 'notes':
                const noteContent = studentProgress?.notesByTopic[currentContent.id] || '';
                return <div className="h-[calc(100vh-20rem)]"><NotesEditor ref={notesEditorRef} initialContent={noteContent} onSave={(content) => onNoteSave(currentContent.id, content)} isReadOnly={isPreview} /></div>;
            case 'games':
                return (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {currentContent.miniGames.map(game => (
                                <button key={game.id} onClick={() => onPlayGame(game, currentContent.id)} className="p-4 bg-gray-700 hover:bg-cyan-600 rounded-lg transition-colors text-left">
                                <GameControllerIcon className="h-8 w-8 mb-2 text-cyan-400" />
                                <p className="font-bold">{game.name}</p>
                                <p className="text-sm text-gray-400">Tipo: {game.type}</p>
                            </button>
                        ))}
                    </div>
                );
            case 'flashcards':
                return <FlashcardPlayer flashcards={currentContent.flashcards || []} />;
            case 'glossary':
                return (
                    <div className="p-4 md:p-6 space-y-4">
                        <h3 className="text-2xl font-bold">Glossário do Tópico</h3>
                        <div className="divide-y divide-gray-700">
                            {(currentContent.glossary || []).map((item, index) => (
                                <div key={index} className="py-3">
                                    <p className="font-bold text-cyan-400">{item.term}</p>
                                    <p className="text-gray-300 mt-1">{item.definition}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'medals':
                return <TopicMedalDisplay studentProgress={studentProgress} content={currentContent} />;
            case 'mindMap':
                return (
                    <div className="p-4 flex items-center justify-center h-full">
                        {currentContent.mindMapUrl ? (
                            <img src={currentContent.mindMapUrl} alt={`Mapa mental para ${currentContent.name}`} className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
                        ) : (
                            <p>Nenhum mapa mental disponível.</p>
                        )}
                    </div>
                );
            case 'bankProfile':
                if (activeBankPdf) {
                    return (
                        <div className="h-full flex flex-col">
                            <div className="p-2 flex-shrink-0">
                                <button onClick={() => setActiveBankPdf(null)} className="text-cyan-400 hover:text-cyan-300 flex items-center text-sm">
                                    <ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180" />
                                    Voltar para a lista de bancas
                                </button>
                            </div>
                            <div className="flex-grow min-h-0 w-full aspect-[4/5]">
                                <PdfViewer file={{ id: activeBankPdf.id, fileName: `Análise - ${activeBankPdf.bankName}`, url: activeBankPdf.url }} />
                            </div>
                        </div>
                    );
                }
                return (
                    <div className="p-4 space-y-4">
                        <h3 className="text-xl font-bold">Análise de Perfil da Banca</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(currentContent.bankProfilePdfs || []).map((pdf) => (
                                <Card key={pdf.id} onClick={() => setActiveBankPdf(pdf)} className="p-4 flex items-center justify-between hover:bg-gray-700 cursor-pointer">
                                    <BriefcaseIcon className="h-6 w-6 text-cyan-400 flex-shrink-0" />
                                    <span className="truncate font-semibold">{pdf.bankName}</span>
                                </Card>
                            ))}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };
    
    const renderTopicPanel = (side: 'left' | 'right', tabValue: string) => {
        const activePdf = side === 'left' ? splitLeftActivePdf : splitRightActivePdf;
        const setActivePdf = side === 'left' ? setSplitLeftActivePdf : setSplitRightActivePdf;
        const activeSummaryPdf = side === 'left' ? splitLeftActiveSummaryPdf : splitRightActiveSummaryPdf;
        const setActiveSummaryPdf = side === 'left' ? setSplitLeftActiveSummaryPdf : setSplitRightActiveSummaryPdf;
        const activeRaioXPdf = side === 'left' ? splitLeftActiveRaioXPdf : splitRightActiveRaioXPdf;
        const setActiveRaioXPdf = side === 'left' ? setSplitLeftActiveRaioXPdf : setSplitRightActiveRaioXPdf;
        const activeVideo = side === 'left' ? splitLeftActiveVideo : splitRightActiveVideo;
        const setActiveVideo = side === 'left' ? setSplitLeftActiveVideo : setSplitRightActiveVideo;
        const activeBankPdf = side === 'left' ? splitLeftActiveBankPdf : splitRightActiveBankPdf;
        const setActiveBankPdf = side === 'left' ? setSplitLeftActiveBankPdf : setSplitRightActiveBankPdf;
    
        const containerClass = "aspect-[4/5] w-full";
        
        switch (tabValue) {
            case 'pdf': {
                if (currentContent.fullPdfs?.length === 1) {
                    return <div className={containerClass}><PdfViewer file={currentContent.fullPdfs[0]} /></div>;
                }
                if (currentContent.fullPdfs?.length > 1) {
                    if (activePdf) {
                        return <div className="flex flex-col h-full"><div className="p-1 flex-shrink-0"><button onClick={() => setActivePdf(null)} className="text-cyan-400 hover:text-cyan-300 flex items-center text-xs"><ArrowRightIcon className="h-3 w-3 mr-1 transform rotate-180"/>Voltar</button></div><div className={containerClass}><PdfViewer file={activePdf} /></div></div>;
                    } else {
                        return <div className="p-2 space-y-2"><h3 className="text-lg font-bold">Aulas em PDF</h3>{currentContent.fullPdfs.map((pdf, i) => <Card key={i} onClick={() => setActivePdf(pdf)} className="p-2 flex items-center justify-between hover:bg-gray-700 cursor-pointer"><DocumentTextIcon className="h-5 w-5 text-cyan-400 flex-shrink-0" /><span className="truncate text-sm mx-2 flex-grow">{pdf.fileName}</span><ArrowRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0"/></Card>)}</div>;
                    }
                }
                return null;
            }
            case 'summary': {
                if (currentContent.summaryPdfs?.length === 1) {
                    return <div className={containerClass}><PdfViewer file={currentContent.summaryPdfs[0]} /></div>;
                }
                if (currentContent.summaryPdfs?.length > 1) {
                    if (activeSummaryPdf) {
                         return <div className="flex flex-col h-full"><div className="p-1 flex-shrink-0"><button onClick={() => setActiveSummaryPdf(null)} className="text-cyan-400 hover:text-cyan-300 flex items-center text-xs"><ArrowRightIcon className="h-3 w-3 mr-1 transform rotate-180"/>Voltar</button></div><div className={containerClass}><PdfViewer file={activeSummaryPdf} /></div></div>;
                    } else {
                        return <div className="p-2 space-y-2"><h3 className="text-lg font-bold">Resumos em PDF</h3>{currentContent.summaryPdfs.map((pdf, i) => <Card key={i} onClick={() => setActiveSummaryPdf(pdf)} className="p-2 flex items-center justify-between hover:bg-gray-700 cursor-pointer"><DocumentTextIcon className="h-5 w-5 text-cyan-400 flex-shrink-0" /><span className="truncate text-sm mx-2 flex-grow">{pdf.fileName}</span><ArrowRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0"/></Card>)}</div>;
                    }
                }
                return null;
            }
            case 'raiox': {
                if ((currentContent.raioXPdfs || []).length === 1) {
                    return <div className={containerClass}><PdfViewer file={currentContent.raioXPdfs![0]} /></div>;
                }
                if ((currentContent.raioXPdfs || []).length > 1) {
                    if (activeRaioXPdf) {
                        return <div className="flex flex-col h-full"><div className="p-1 flex-shrink-0"><button onClick={() => setActiveRaioXPdf(null)} className="text-cyan-400 hover:text-cyan-300 flex items-center text-xs"><ArrowRightIcon className="h-3 w-3 mr-1 transform rotate-180"/>Voltar</button></div><div className={containerClass}><PdfViewer file={activeRaioXPdf} /></div></div>;
                    } else {
                        return <div className="p-2 space-y-2"><h3 className="text-lg font-bold">PDFs de Raio X</h3>{(currentContent.raioXPdfs || []).map((pdf, i) => <Card key={i} onClick={() => setActiveRaioXPdf(pdf)} className="p-2 flex items-center justify-between hover:bg-gray-700 cursor-pointer"><ChartLineIcon className="h-5 w-5 text-cyan-400 flex-shrink-0" /><span className="truncate text-sm mx-2 flex-grow">{pdf.fileName}</span><ArrowRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0"/></Card>)}</div>;
                    }
                }
                return null;
            }
            case 'notes':
                const noteContent = studentProgress?.notesByTopic[currentContent.id] || '';
                return <div className={containerClass}><NotesEditor ref={notesEditorRef} initialContent={noteContent} onSave={(content) => onNoteSave(currentContent.id, content)} isReadOnly={isPreview} /></div>;
            case 'quiz': {
                const attempts = studentProgress?.progressByTopic[selectedSubject!.id]?.[currentContent.id]?.lastAttempt || [];
                return <QuizView questions={currentContent.questions} initialAttempts={attempts} onSaveAttempt={(attempt) => saveQuizProgress(selectedSubject!.id, currentContent.id, attempt)} onComplete={(attempts) => handleTopicQuizComplete(selectedSubject!.id, currentContent.id, attempts)} onBack={() => {}} quizTitle="Questões (Conteúdo)" studentProgress={studentProgress} />;
            }
            case 'tec_questions_quiz': {
                const tecQuizId = `${currentContent.id}-tec`;
                const tecAttempts = studentProgress?.progressByTopic[selectedSubject!.id]?.[tecQuizId]?.lastAttempt || [];
                return <QuizView questions={currentContent.tecQuestions || []} initialAttempts={tecAttempts} onSaveAttempt={(attempt) => saveQuizProgress(selectedSubject!.id, tecQuizId, attempt)} onComplete={(attempts) => handleTopicQuizComplete(selectedSubject!.id, tecQuizId, attempts)} onBack={() => {}} quizTitle="Questões Extraídas" studentProgress={studentProgress} />;
            }
            case 'videos': {
                if (activeVideo) {
                    return <div className="p-2 space-y-2 h-full flex flex-col"><button onClick={() => setActiveVideo(null)} className="flex-shrink-0 text-cyan-400 hover:text-cyan-300 flex items-center text-xs mb-1"><ArrowRightIcon className="h-3 w-3 mr-1 transform rotate-180" />Voltar</button><h4 className="font-bold text-sm truncate flex-shrink-0">{activeVideo.name}</h4><div className="aspect-video flex-grow min-h-0"><iframe src={convertMediaUrlToEmbed(activeVideo.url)} title={activeVideo.name} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full rounded-md"></iframe></div></div>;
                }
                return <div className="p-2 space-y-2"><h3 className="text-lg font-bold">Vídeos</h3>{(currentContent.videoUrls || []).map((video) => <Button key={video.url} onClick={() => setActiveVideo(video)} className="w-full text-sm py-2 justify-start"><VideoCameraIcon className="h-4 w-4 mr-2" /><span className="truncate">{video.name}</span></Button>)}{(currentContent.videoUrls || []).length === 0 && <p className="text-xs text-gray-500 text-center pt-2">Nenhum vídeo.</p>}</div>;
            }
            case 'tec_caderno':
                return <div className="p-4 flex flex-col items-center justify-center h-full text-center"><h3 className="text-lg font-bold">Caderno de Questões</h3><p className="text-gray-400 my-2 text-sm">Pratique com questões no site do TEC Concursos.</p><Button onClick={() => window.open(currentContent.tecUrl, '_blank', 'noopener,noreferrer')} className="text-sm py-2">Abrir TEC <ArrowRightIcon className="h-4 w-4 ml-1" /></Button></div>;
            case 'games':
                return <div className="p-2 grid grid-cols-1 gap-2">{currentContent.miniGames.map(game => <button key={game.id} onClick={() => onPlayGame(game, currentContent.id)} className="p-2 bg-gray-700 hover:bg-cyan-600 rounded-lg transition-colors text-left"><GameControllerIcon className="h-6 w-6 mb-1 text-cyan-400" /><p className="font-bold text-sm">{game.name}</p></button>)}</div>;
            case 'flashcards':
                return <FlashcardPlayer flashcards={currentContent.flashcards || []} />;
            case 'glossary':
                return <div className="p-4 space-y-2"><h3 className="text-lg font-bold">Glossário</h3><div className="divide-y divide-gray-700 max-h-full overflow-y-auto">{(currentContent.glossary || []).map((item, index) => <div key={index} className="py-2"><p className="font-bold text-cyan-400 text-sm">{item.term}</p><p className="text-gray-300 mt-1 text-sm">{item.definition}</p></div>)}</div></div>;
            case 'medals':
                 return <TopicMedalDisplay studentProgress={studentProgress} content={currentContent} />;
            case 'mindMap':
                return <div className="p-2 flex items-center justify-center h-full">{currentContent.mindMapUrl ? <img src={currentContent.mindMapUrl} alt="" className="max-w-full max-h-full object-contain rounded-lg" /> : <p className="text-sm text-gray-500">Nenhum mapa mental.</p>}</div>;
            case 'bankProfile':
                if (activeBankPdf) {
                    return <div className="flex flex-col h-full"><div className="p-1 flex-shrink-0"><button onClick={() => setActiveBankPdf(null)} className="text-cyan-400 hover:text-cyan-300 flex items-center text-xs"><ArrowRightIcon className="h-3 w-3 mr-1 transform rotate-180"/>Voltar</button></div><div className={containerClass}><PdfViewer file={{ id: activeBankPdf.id, fileName: `Análise - ${activeBankPdf.bankName}`, url: activeBankPdf.url }} /></div></div>;
                }
                return <div className="p-2 space-y-2"><h3 className="text-lg font-bold">Bancas</h3>{(currentContent.bankProfilePdfs || []).map((pdf) => <Card key={pdf.id} onClick={() => setActiveBankPdf(pdf)} className="p-2 flex items-center justify-between hover:bg-gray-700 cursor-pointer"><BriefcaseIcon className="h-5 w-5 text-cyan-400 flex-shrink-0" /><span className="truncate text-sm mx-2 flex-grow font-semibold">{pdf.bankName}</span><ArrowRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0"/></Card>)}{(currentContent.bankProfilePdfs || []).length === 0 && <p className="text-xs text-gray-500 text-center pt-2">Nenhuma análise de banca.</p>}</div>;
            default:
                return null;
        }
    };

    if(isSplitView) {
        const uniqueTabs = ['notes', 'quiz', 'flashcards', 'tec_questions_quiz'];
        const isTabDisabled = (tabValue: string, otherPanelTab: string) => {
             if (uniqueTabs.includes(tabValue)) {
                return tabValue === otherPanelTab;
            }
            return false;
        };

        return (
            <div className="flex flex-col h-full">
                <div className="flex justify-between items-center flex-shrink-0 mb-4">
                    <div>
                        <h2 className="text-3xl font-bold mb-1">{currentContent.name}</h2>
                        <p className="text-gray-400">{parentTopic.name} / {selectedSubject?.name}</p>
                    </div>
                    <Button onClick={onToggleSplitView} className="text-sm py-2 px-3 bg-red-600 hover:bg-red-500">
                        <XCircleIcon className="h-5 w-5 mr-2" /> Fechar Divisão
                    </Button>
                </div>
                <div className="landscape-hint">
                    Gire o dispositivo para o modo paisagem para melhor visualização.
                </div>
                <div className="flex gap-4 flex-grow">
                    <div className="w-1/2 flex flex-col bg-gray-800 rounded-lg border border-gray-700/50">
                        <div className="flex-shrink-0 border-b border-gray-700">
                            <div className="flex space-x-1 p-1 overflow-x-auto" role="tablist">
                                {tabs.map(tab => (
                                    <button key={tab.value} onClick={() => setSplitLeftTab(tab.value)} className={`flex-shrink-0 p-2 rounded-md text-xs flex items-center gap-1 ${splitLeftTab === tab.value ? 'bg-cyan-600' : 'hover:bg-gray-700'} ${isTabDisabled(tab.value, splitRightTab) ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isTabDisabled(tab.value, splitRightTab)} role="tab" aria-selected={splitLeftTab === tab.value}><tab.icon className="h-4 w-4" /> {tab.label}</button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-grow overflow-y-auto">{renderTopicPanel('left', splitLeftTab)}</div>
                    </div>
                    <div className="w-1/2 flex flex-col bg-gray-800 rounded-lg border border-gray-700/50">
                        <div className="flex-shrink-0 border-b border-gray-700">
                            <div className="flex space-x-1 p-1 overflow-x-auto" role="tablist">
                               {tabs.map(tab => (
                                    <button key={tab.value} onClick={() => setSplitRightTab(tab.value)} className={`flex-shrink-0 p-2 rounded-md text-xs flex items-center gap-1 ${splitRightTab === tab.value ? 'bg-cyan-600' : 'hover:bg-gray-700'} ${isTabDisabled(tab.value, splitLeftTab) ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isTabDisabled(tab.value, splitLeftTab)} role="tab" aria-selected={splitRightTab === tab.value}><tab.icon className="h-4 w-4" /> {tab.label}</button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-grow overflow-y-auto">{renderTopicPanel('right', splitRightTab)}</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Card className="h-full flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0 flex-wrap gap-2">
                <div>
                    <h2 className="text-3xl font-bold mb-1">{currentContent.name}</h2>
                    <p className="text-gray-400">{parentTopic.name} / {selectedSubject?.name}</p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button onClick={onToggleSplitView} className="text-sm py-2 px-3">
                        <SplitScreenIcon className="h-5 w-5 mr-2" /> Dividir Tela
                    </Button>
                    <Button onClick={onOpenChatModal} className="text-sm py-2 px-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-500">
                        <GeminiIcon className="h-5 w-5 mr-2"/> Assistente IA
                    </Button>
                </div>
            </div>
            <div className="flex flex-grow min-h-0">
                <nav className={`relative flex flex-col border-r border-gray-700 transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
                    <div className="flex-grow p-4 space-y-1 overflow-y-auto">
                        {tabs.map(tab => (
                            <button
                                key={tab.value}
                                onClick={() => setActiveTopicTab(tab.value)}
                                className={`w-full p-3 rounded-lg flex items-center text-sm transition-colors ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'} ${activeTopicTab === tab.value ? 'bg-cyan-600 text-white font-semibold' : 'hover:bg-gray-700/50 text-gray-300'}`}
                                title={isSidebarCollapsed ? tab.label : undefined}
                                aria-label={tab.label}
                            >
                                <tab.icon className="h-5 w-5 flex-shrink-0" />
                                {!isSidebarCollapsed && <span className="truncate">{tab.label}</span>}
                            </button>
                        ))}
                    </div>
                    <div className="flex-shrink-0 p-2 border-t border-gray-700">
                        <button
                            onClick={() => onSetIsSidebarCollapsed(!isSidebarCollapsed)}
                            className="w-full flex items-center justify-center p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white"
                            aria-label={isSidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
                        >
                            <ChevronDoubleLeftIcon className={`h-5 w-5 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                </nav>
                <div className="flex-grow min-h-0 overflow-y-auto">
                   {renderTopicTabContent(activeTopicTab)}
                </div>
            </div>
        </Card>
    );
};
