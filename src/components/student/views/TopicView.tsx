import React, { useState, useEffect, useRef } from 'react';
import { 
    Subject, Topic, SubTopic, PdfFile, StudentProgress, MiniGame, QuestionAttempt, VideoFile, BankProfilePdf
} from '../../../types';
import { convertMediaUrlToEmbed } from '../../../utils';
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
    // Single View State
    const [activeTopicTab, setActiveTopicTab] = useState('');
    const [activeFullPdf, setActiveFullPdf] = useState<PdfFile | null>(null);
    const [activeSummaryPdf, setActiveSummaryPdf] = useState<PdfFile | null>(null);
    const [activeRaioXPdf, setActiveRaioXPdf] = useState<PdfFile | null>(null);
    const [activeVideo, setActiveVideo] = useState<VideoFile | null>(null);
    const [activeBankPdf, setActiveBankPdf] = useState<BankProfilePdf | null>(null);
    const notesEditorRef = useRef<HTMLDivElement>(null);

    
    // Split View State
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
        { value: 'pdf', label: 'Aula', icon: DocumentTextIcon, count: (currentContent.fullPdfs || []).length },
        { value: 'summary', label: 'Resumo', icon: LightBulbIcon, count: (currentContent.summaryPdfs || []).length },
        { value: 'raiox', label: 'Raio X', icon: ChartLineIcon, count: (currentContent.raioXPdfs || []).length },
        { value: 'videos', label: 'Vídeos', icon: VideoCameraIcon, count: (currentContent.videoUrls || []).length },
        { value: 'mindMap', label: 'Mapa Mental', icon: BrainIcon, count: currentContent.mindMapUrl ? 1 : 0 },
        { value: 'bankProfile', label: 'Perfil da Banca', icon: BriefcaseIcon, count: (currentContent.bankProfilePdfs || []).length },
        { value: 'quiz', label: 'Questões (Conteúdo)', icon: ClipboardCheckIcon, count: (currentContent.questions || []).length },
        { value: 'tec_questions_quiz', label: 'Questões Extraídas', icon: ClipboardCheckIcon, count: (currentContent.tecQuestions || []).length },
        { value: 'tec_caderno', label: 'Caderno TEC', icon: ClipboardListIcon, count: currentContent.tecUrl ? 1 : 0 },
        { value: 'glossary', label: 'Glossário', icon: TagIcon, count: (currentContent.glossary || []).length },
        { value: 'flashcards', label: 'Flashcards', icon: FlashcardIcon, count: (currentContent.flashcards || []).length },
        { value: 'games', label: 'Jogos', icon: GameControllerIcon, count: (currentContent.miniGames || []).length },
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
                if ((currentContent.fullPdfs || []).length === 1) {
                    return (
                        <div className={pdfContainerClass}>
                            <div className="flex-grow min-h-0 w-full aspect-[4/5]">
                                <PdfViewer file={currentContent.fullPdfs![0]} />
                            </div>
                        </div>
                    );
                }
                if ((currentContent.fullPdfs || []).length > 1) {
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
                                        {(currentContent.fullPdfs || []).map((pdf, i) => (
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
                return (
                    <div className={pdfContainerClass}>
                        <div className="p-4 flex-grow flex items-center justify-center text-gray-400">
                            <p>Nenhum PDF de aula disponível.</p>
                        </div>
                    </div>
                );
            }
            case 'summary': {
                const summaryContainerClass = 'h-full flex flex-col';
                if ((currentContent.summaryPdfs || []).length === 1) {
                    return (
                        <div className={summaryContainerClass}>
                            <div className="flex-grow min-h-0 w-full aspect-[4/5]">
                                <PdfViewer file={currentContent.summaryPdfs![0]} />
                            </div>
                        </div>
                    );
                }
                if ((currentContent.summaryPdfs || []).length > 1) {
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
                                        {(currentContent.summaryPdfs || []).map((pdf, i) => (
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
                return (
                    <div className={summaryContainerClass}>
                        <div className="p-4 flex-grow flex items-center justify-center text-gray-400">
                            <p>Nenhum PDF de resumo disponível.</p>
                        </div>
                    </div>
                );
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
                        );
                    }
                }
                return (
                    <div className={containerClass}>
                        <div className="p-4 flex-grow flex items-center justify-center text-gray-400">
                            <p>Nenhum PDF de Raio X disponível.</p>
                        </div>
                    </div>
                );
            }
            case 'videos':
                if (activeVideo) {
                    return (
                        <div className="p-4 space-y-4 max-h-full overflow-y-auto">
                            <button onClick={() => setActiveVideo(null)} className="text-cyan-400 hover:text-cyan-300 flex items-center text-sm mb-2">
                                <ArrowRightIcon className="h-4 w-4 mr-2 transform rotate-180" />
                                Voltar para a lista de vídeos
                            </button>
                            <h3 className="text-xl font-bold">{activeVideo.name}</h3>
                            <div className="aspect-video">
                                <iframe 
                                    src={convertMediaUrlToEmbed(activeVideo.url)} 
                                    title={activeVideo.name}
                                    frameBorder="0" 
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowFullScreen
                                    className="w-full h-full rounded-lg"
                                ></iframe>
                            </div>
                        </div>
                    );
                }
                return (
                    <div className="p-4 space-y-4">
                        <h3 className="text-xl font-bold">Vídeos da Aula</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(currentContent.videoUrls || []).map((video) => (
                                <Card key={video.url} onClick={() => setActiveVideo(video)} className="p-4 flex items-center justify-between hover:bg-gray-700 cursor-pointer">
                                    <div className="flex items-center space-x-3">
                                        <VideoCameraIcon className="h-6 w-6 text-cyan-400 flex-shrink-0" />
                                        <span className="truncate">{video.name}</span>
                                    </div>
                                    <ArrowRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0"/>
                                </Card>
                            ))}
                        </div>
                    </div>
                );
            case 'quiz':
                const attempts = studentProgress?.progressByTopic[selectedSubject!.id]?.[currentContent.id]?.lastAttempt || [];
                return <QuizView 
                    questions={currentContent.questions || []} 
                    initialAttempts={attempts} 
                    onSaveAttempt={(attempt) => saveQuizProgress(selectedSubject!.id, currentContent.id, attempt)}
                    onComplete={(attempts) => handleTopicQuizComplete(selectedSubject!.id, currentContent.id, attempts)}
                    onBack={() => {}} 
                    quizTitle={`Questões de Conteúdo: ${currentContent.name}`}
                    subjectName={selectedSubject.name}
                    onAddBonusXp={onAddBonusXp}
                    onReportQuestion={(question, reason) => onReportQuestion(selectedSubject.id, currentContent.id, question.id, false, reason)}
                />;
            case 'tec_questions_quiz':
                const tecQuizId = `${currentContent.id}-tec`;
                const tecAttempts = studentProgress?.progressByTopic[selectedSubject!.id]?.[tecQuizId]?.lastAttempt || [];
                return <QuizView
                    questions={currentContent.tecQuestions || []}
                    initialAttempts={tecAttempts}
                    onSaveAttempt={(attempt) => saveQuizProgress(selectedSubject!.id, tecQuizId, attempt)}
                    onComplete={(attempts) => handleTopicQuizComplete(selectedSubject!.id, tecQuizId, attempts)}
                    onBack={() => {}}
                    quizTitle={`Questões Extraídas: ${currentContent.name}`}
                    subjectName={selectedSubject.name}
                    hideBackButtonOnResults={true}
                    onAddBonusXp={onAddBonusXp}
                    onReportQuestion={(question, reason) => onReportQuestion(selectedSubject.id, currentContent.id, question.id, true, reason)}
                />;
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
                        {(currentContent.miniGames || []).map(game => (
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
                            <div className="flex-grow min-h-0 w-full aspect-[4/5]"><PdfViewer file={{ id: activeBankPdf.id, fileName: `Análise - ${activeBankPdf.bankName}`, url: activeBankPdf.url }} /></div>
                        </div>
                    );
                }
                return (
                    <div className="p-4 space-y-4">
                        <h3 className="text-xl font-bold">Análise de Perfil da Banca</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(currentContent.bankProfilePdfs || []).map((pdf) => (
                                <Card key={pdf.id} onClick={() => setActiveBankPdf(pdf)} className="p-4 flex items-center justify-between hover:bg-gray-700 cursor-pointer">
                                    <div className="flex items-center space-x-3">
                                        <BriefcaseIcon className="h-6 w-6 text-cyan-400 flex-shrink-0" />
                                        <span className="truncate font-semibold">{pdf.bankName}</span>
                                    </div>
                                    <ArrowRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0"/>
                                </Card>
                            ))}
                        </div>
                    </div>
                );
            default:
                return <div className="flex items-center justify-center h-full">Selecione uma aba.</div>;
        }
    };
    
    const renderTopicPanel = (
        side: 'left' | 'right',
        tabValue: string,
    ) => {
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
        
        const renderPanelContent = () => {
            switch (tabValue) {
                case 'pdf': {
                    if ((currentContent.fullPdfs || []).length === 1) {
                        return (
                            <div className="flex flex-col h-full">
                                <div className={containerClass}><PdfViewer file={currentContent.fullPdfs![0]} /></div>
                            </div>
                        );
                    }
                    if ((currentContent.fullPdfs || []).length > 1) {
                        if (activePdf) {
                            return (
                                <div className="flex flex-col h-full">
                                    <div className="p-1 flex-shrink-0"><button onClick={() => setActivePdf(null)} className="text-cyan-400 hover:text-cyan-300 flex items-center text-xs"><ArrowRightIcon className="h-3 w-3 mr-1 transform rotate-180"/>Voltar</button></div>
                                    <div className={containerClass}><PdfViewer file={activePdf} /></div>
                                </div>
                            );
                        } else {
                            return (
                                <div className="p-2 space-y-2">
                                    <h3 className="text-lg font-bold">Aulas em PDF</h3>
                                    {(currentContent.fullPdfs || []).map((pdf, i) => (
                                        <Card key={i} onClick={() => setActivePdf(pdf)} className="p-2 flex items-center justify-between hover:bg-gray-700 cursor-pointer">
                                            <DocumentTextIcon className="h-5 w-5 text-cyan-400 flex-shrink-0" />
                                            <span className="truncate text-sm mx-2 flex-grow">{pdf.fileName}</span>
                                            <ArrowRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0"/>
                                        </Card>
                                    ))}
                                </div>
                            );
                        }
                    }
                    return (<div className="p-2"><p className="text-sm text-gray-400">Nenhum PDF.</p></div>);
                }
                case 'summary': {
                    if ((currentContent.summaryPdfs || []).length === 1) {
                        return (
                             <div className="flex flex-col h-full">
                                <div className={containerClass}><PdfViewer file={currentContent.summaryPdfs![0]} /></div>
                            </div>
                        );
                    }
                    if ((currentContent.summaryPdfs || []).length > 1) {
                        if (activeSummaryPdf) {
                             return (
                                <div className="flex flex-col h-full">
                                    <div className="p-1 flex-shrink-0"><button onClick={() => setActiveSummaryPdf(null)} className="text-cyan-400 hover:text-cyan-300 flex items-center text-xs"><ArrowRightIcon className="h-3 w-3 mr-1 transform rotate-180"/>Voltar</button></div>
                                    <div className={containerClass}><PdfViewer file={activeSummaryPdf} /></div>
                                </div>
                            );
                        } else {
                            return (
                                <div className="p-2 space-y-2">
                                    <h3 className="text-lg font-bold">Resumos em PDF</h3>
                                    {(currentContent.summaryPdfs || []).map((pdf, i) => (
                                        <Card key={i} onClick={() => setActiveSummaryPdf(pdf)} className="p-2 flex items-center justify-between hover:bg-gray-700 cursor-pointer">
                                            <DocumentTextIcon className="h-5 w-5 text-cyan-400 flex-shrink-0" />
                                            <span className="truncate text-sm mx-2 flex-grow">{pdf.fileName}</span>
                                            <ArrowRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0"/>
                                        </Card>
                                    ))}
                                </div>
                            );
                        }
                    }
                    return (<div className="p-2"><p className="text-sm text-gray-400">Nenhum resumo.</p></div>);
                }
                case 'raiox': {
                    if ((currentContent.raioXPdfs || []).length === 1) {
                        return (
                            <div className="flex flex-col h-full">
                                <div className={containerClass}><PdfViewer file={currentContent.raioXPdfs![0]} /></div>
                            </div>
                        );
                    }
                    if ((currentContent.raioXPdfs || []).length > 1) {
                        if (activeRaioXPdf) {
                            return (
                                <div className="flex flex-col h-full">
                                    <div className="p-1 flex-shrink-0"><button onClick={() => setActiveRaioXPdf(null)} className="text-cyan-400 hover:text-cyan-300 flex items-center text-xs"><ArrowRightIcon className="h-3 w-3 mr-1 transform rotate-180"/>Voltar</button></div>
                                    <div className={containerClass}><PdfViewer file={activeRaioXPdf} /></div>
                                </div>
                            );
                        } else {
                            return (
                                <div className="p-2 space-y-2">
                                    <h3 className="text-lg font-bold">PDFs de Raio X</h3>
                                    {(currentContent.raioXPdfs || []).map((pdf, i) => (
                                        <Card key={i} onClick={() => setActiveRaioXPdf(pdf)} className="p-2 flex items-center justify-between hover:bg-gray-700 cursor-pointer">
                                            <ChartLineIcon className="h-5 w-5 text-cyan-400 flex-shrink-0" />
                                            <span className="truncate text-sm mx-2 flex-grow">{pdf.fileName}</span>
                                            <ArrowRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0"/>
                                        </Card>
                                    ))}
                                </div>
                            );
                        }
                    }
                    return (<div className="p-2"><p className="text-sm text-gray-400">Nenhum Raio X.</p></div>);
                }
                case 'notes':
                    const noteContent = studentProgress?.notesByTopic[currentContent.id] || '';
                    return <div className={containerClass}><NotesEditor ref={notesEditorRef} initialContent={noteContent} onSave={(content) => onNoteSave(currentContent.id, content)} isReadOnly={isPreview} /></div>;
                case 'quiz':
                    const attempts = studentProgress?.progressByTopic[selectedSubject!.id]?.[currentContent.id]?.lastAttempt || [];
                    return <QuizView 
                        questions={currentContent.questions || []} 
                        initialAttempts={attempts} 
                        onSaveAttempt={(attempt) => saveQuizProgress(selectedSubject!.id, currentContent.id, attempt)}
                        onComplete={(attempts) => handleTopicQuizComplete(selectedSubject!.id, currentContent.id, attempts)}
                        onBack={() => {}}
                        quizTitle="Questões (Conteúdo)"
                        subjectName={selectedSubject.name}
                        onAddBonusXp={onAddBonusXp}
                        onReportQuestion={(question, reason) => onReportQuestion(selectedSubject.id, currentContent.id, question.id, false, reason)}
                    />;
                case 'tec_questions_quiz':
                    const tecQuizId = `${currentContent.id}-tec`;
                    const tecAttempts = studentProgress?.progressByTopic[selectedSubject!.id]?.[tecQuizId]?.lastAttempt || [];
                    return <QuizView
                        questions={currentContent.tecQuestions || []}
                        initialAttempts={tecAttempts}
                        onSaveAttempt={(attempt) => saveQuizProgress(selectedSubject!.id, tecQuizId, attempt)}
                        onComplete={(attempts) => handleTopicQuizComplete(selectedSubject!.id, tecQuizId, attempts)}
                        onBack={() => {}}
                        quizTitle="Questões Extraídas"
                        subjectName={selectedSubject.name}
                        onAddBonusXp={onAddBonusXp}
                        onReportQuestion={(question, reason) => onReportQuestion(selectedSubject.id, currentContent.id, question.id, true, reason)}
                    />;
                case 'videos': {
                    if (activeVideo) {
                        return (
                            <div className="p-2 space-y-2 h-full flex flex-col">
                                <button onClick={() => setActiveVideo(null)} className="flex-shrink-0 text-cyan-400 hover:text-cyan-300 flex items-center text-xs mb-1">
                                    <ArrowRightIcon className="h-3 w-3 mr-1 transform rotate-180" />
                                    Voltar
                                </button>
                                <h4 className="font-bold text-sm truncate flex-shrink-0">{activeVideo.name}</h4>
                                <div className="aspect-video flex-grow min-h-0">
                                    <iframe 
                                        src={convertMediaUrlToEmbed(activeVideo.url)} 
                                        title={activeVideo.name}
                                        frameBorder="0" 
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                        allowFullScreen
                                        className="w-full h-full rounded-md"
                                    ></iframe>
                                </div>
                            </div>
                        );
                    }
                    return (
                        <div className="p-2 space-y-2">
                             <h3 className="text-lg font-bold">Vídeos</h3>
                            {(currentContent.videoUrls || []).map((video) => (
                                <Button key={video.url} onClick={() => setActiveVideo(video)} className="w-full text-sm py-2 justify-start">
                                    <VideoCameraIcon className="h-4 w-4 mr-2" />
                                    <span className="truncate">{video.name}</span>
                                </Button>
                            ))}
                             {(currentContent.videoUrls || []).length === 0 && <p className="text-xs text-gray-500 text-center pt-2">Nenhum vídeo.</p>}
                        </div>
                    );
                }
                case 'tec_caderno':
                    return (
                        <div className="p-4 flex flex-col items-center justify-center h-full text-center">
                            <h3 className="text-lg font-bold">Caderno de Questões</h3>
                            <p className="text-gray-400 my-2 text-sm">Pratique com questões no site do TEC Concursos.</p>
                            <Button onClick={() => window.open(currentContent.tecUrl, '_blank', 'noopener,noreferrer')} className="text-sm py-2">
                                Abrir TEC <ArrowRightIcon className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    );
                case 'games':
                    return (
                        <div className="p-2 grid grid-cols-1 gap-2">
                            {(currentContent.miniGames || []).map(game => (
                                <button key={game.id} onClick={() => onPlayGame(game, currentContent.id)} className="p-2 bg-gray-700 hover:bg-cyan-600 rounded-lg transition-colors text-left">
                                <GameControllerIcon className="h-6 w-6 mb-1 text-cyan-400" />
                                <p className="font-bold text-sm">{game.name}</p>
                            </button>
                            ))}
                        </div>
                    );
                case 'flashcards':
                    return <FlashcardPlayer flashcards={currentContent.flashcards || []} />;
                case 'glossary':
                    return (
                        <div className="p-4 space-y-2">
                            <h3 className="text-lg font-bold">Glossário</h3>
                            <div className="divide-y divide-gray-700 max-h-full overflow-y-auto">
                                {(currentContent.glossary || []).map((item, index) => (
                                    <div key={index} className="py-2">
                                        <p className="font-bold text-cyan-400 text-sm">{item.term}</p>
                                        <p className="text-gray-300 mt-1 text-sm">{item.definition}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                case 'medals':
                     return <TopicMedalDisplay studentProgress={studentProgress} content={currentContent} />;
                case 'mindMap':
                    return (
                        <div className="p-2 flex items-center justify-center h-full">
                            {currentContent.mindMapUrl ? (
                                <img src={currentContent.mindMapUrl} alt={`Mapa mental para ${currentContent.name}`} className="max-w-full max-h-full object-contain rounded-lg" />
                            ) : (
                                <p className="text-sm text-gray-500">Nenhum mapa mental.</p>
                            )}
                        </div>
                    );
                case 'bankProfile':
                    if (activeBankPdf) {
                        return (
                            <div className="flex flex-col h-full">
                                <div className="p-1 flex-shrink-0"><button onClick={() => setActiveBankPdf(null)} className="text-cyan-400 hover:text-cyan-300 flex items-center text-xs"><ArrowRightIcon className="h-3 w-3 mr-1 transform rotate-180"/>Voltar</button></div>
                                <div className="flex-grow min-h-0 w-full aspect-[4/5]"><PdfViewer file={{ id: activeBankPdf.id, fileName: `Análise - ${activeBankPdf.bankName}`, url: activeBankPdf.url }} /></div>
                            </div>
                        );
                    }
                    return (
                        <div className="p-2 space-y-2">
                            <h3 className="text-lg font-bold">Análise de Banca</h3>
                             {(currentContent.bankProfilePdfs || []).map((pdf) => (
                                <Card key={pdf.id} onClick={() => setActiveBankPdf(pdf)} className="p-2 flex items-center justify-between hover:bg-gray-700 cursor-pointer">
                                    <div className="flex items-center space-x-2">
                                        <BriefcaseIcon className="h-5 w-5 text-cyan-400 flex-shrink-0" />
                                        <span className="truncate text-sm font-semibold">{pdf.bankName}</span>
                                    </div>
                                    <ArrowRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0"/>
                                </Card>
                            ))}
                        </div>
                    );
                default:
                    return <div className="p-2"><p className="text-sm text-gray-400">Selecione uma aba.</p></div>;
            }
        };

        return <div className="h-full overflow-y-auto">{renderPanelContent()}</div>;
    }

    const availableTabs = [
        { value: 'pdf', label: 'Aula', count: (currentContent.fullPdfs || []).length },
        { value: 'summary', label: 'Resumo', count: (currentContent.summaryPdfs || []).length },
        { value: 'raiox', label: 'Raio X', count: (currentContent.raioXPdfs || []).length },
        { value: 'videos', label: 'Vídeos', count: (currentContent.videoUrls || []).length },
        { value: 'mindMap', label: 'Mapa Mental', count: currentContent.mindMapUrl ? 1 : 0 },
        { value: 'bankProfile', label: 'Banca', count: (currentContent.bankProfilePdfs || []).length },
        { value: 'quiz', label: 'Questões', count: (currentContent.questions || []).length },
        { value: 'tec_questions_quiz', label: 'TEC', count: (currentContent.tecQuestions || []).length },
        { value: 'tec_caderno', label: 'Caderno', count: currentContent.tecUrl ? 1 : 0 },
        { value: 'glossary', label: 'Glossário', count: (currentContent.glossary || []).length },
        { value: 'flashcards', label: 'Flashcards', count: (currentContent.flashcards || []).length },
        { value: 'games', label: 'Jogos', count: (currentContent.miniGames || []).length },
        { value: 'medals', label: 'Medalhas', count: 1 },
        { value: 'notes', label: 'Anotações', count: 1 },
    ].filter(tab => tab.count > 0);

    // ... The rest of the component ...
    return (
        <div className="space-y-4">
            {/* ... rest of the JSX ... */}
        </div>
    );
};