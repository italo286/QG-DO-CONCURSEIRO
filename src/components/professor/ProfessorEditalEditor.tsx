import React, { useState, useEffect } from 'react';
import { Course, EditalInfo } from '../../types';
import * as GeminiService from '../../services/geminiService';
import { fileToBase64 } from '../../utils';
import { Modal, Button, Spinner } from '../ui';
import { GeminiIcon, PlusIcon, TrashIcon } from '../Icons';

interface ProfessorEditalEditorProps {
    isOpen: boolean;
    onClose: () => void;
    course: Course;
    onSave: (course: Course) => void;
}

export const ProfessorEditalEditor: React.FC<ProfessorEditalEditorProps> = ({ isOpen, onClose, course, onSave }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [editalInfo, setEditalInfo] = useState<EditalInfo | undefined>(course.editalInfo);

    useEffect(() => {
        if (isOpen) {
            setEditalInfo(course.editalInfo);
            setFile(null);
            setError('');
        }
    }, [isOpen, course.editalInfo]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };
    
    const handleAnalyze = async () => {
        if (!file) return;
        setIsLoading(true);
        setError('');
        try {
            const base64 = await fileToBase64(file);
            const info = await GeminiService.analyzeEditalFromPdf(base64);
            setEditalInfo(info);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSaveChanges = () => {
        onSave({ ...course, editalInfo: editalInfo });
        onClose();
    };

    // --- Form Handlers ---
    const handleFieldChange = (field: keyof Omit<EditalInfo, 'cargosEVagas' | 'distribuicaoQuestoes'>, value: string | number) => {
        setEditalInfo(prev => prev ? { ...prev, [field]: value } : undefined);
    };

    const handleCargoChange = (index: number, field: 'cargo' | 'vagas' | 'cadastroReserva', value: string) => {
        if (!editalInfo) return;
        const newCargos = [...editalInfo.cargosEVagas];
        newCargos[index] = { ...newCargos[index], [field]: value };
        setEditalInfo({ ...editalInfo, cargosEVagas: newCargos });
    };

    const addCargo = () => {
        if (!editalInfo) return;
        const newCargos = [...editalInfo.cargosEVagas, { cargo: '', vagas: '', cadastroReserva: '' }];
        setEditalInfo({ ...editalInfo, cargosEVagas: newCargos });
    };

    const removeCargo = (index: number) => {
        if (!editalInfo) return;
        const newCargos = editalInfo.cargosEVagas.filter((_, i) => i !== index);
        setEditalInfo({ ...editalInfo, cargosEVagas: newCargos });
    };

    const handleDistribuicaoChange = (index: number, field: 'disciplina' | 'quantidade', value: string | number) => {
        if (!editalInfo) return;
        const newDist = [...editalInfo.distribuicaoQuestoes];
        newDist[index] = { ...newDist[index], [field]: value };
        setEditalInfo({ ...editalInfo, distribuicaoQuestoes: newDist });
    };

    const addDistribuicao = () => {
        if (!editalInfo) return;
        const newDist = [...editalInfo.distribuicaoQuestoes, { disciplina: '', quantidade: 0 }];
        setEditalInfo({ ...editalInfo, distribuicaoQuestoes: newDist });
    };

    const removeDistribuicao = (index: number) => {
        if (!editalInfo) return;
        const newDist = editalInfo.distribuicaoQuestoes.filter((_, i) => i !== index);
        setEditalInfo({ ...editalInfo, distribuicaoQuestoes: newDist });
    };


    const renderForm = () => {
        if (!editalInfo) return null;
        return (
            <div className="border-t border-gray-700 pt-4 mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <h3 className="text-lg font-semibold text-white">Edite as Informações do Edital</h3>
                
                {/* Cargos e Vagas */}
                <div className="space-y-2 p-3 bg-gray-900/50 rounded-lg">
                    <h4 className="font-semibold text-gray-300">Cargos e Vagas</h4>
                    {editalInfo.cargosEVagas.map((cargo, index) => (
                        <div key={index} className="grid grid-cols-3 gap-2 items-center">
                            <input type="text" value={cargo.cargo} onChange={e => handleCargoChange(index, 'cargo', e.target.value)} placeholder="Cargo" className="col-span-3 md:col-span-1 bg-gray-700 rounded p-1 text-sm" />
                            <input type="text" value={cargo.vagas} onChange={e => handleCargoChange(index, 'vagas', e.target.value)} placeholder="Vagas" className="bg-gray-700 rounded p-1 text-sm" />
                            <div className="flex items-center">
                                <input type="text" value={cargo.cadastroReserva || ''} onChange={e => handleCargoChange(index, 'cadastroReserva', e.target.value)} placeholder="CR" className="bg-gray-700 rounded p-1 text-sm flex-grow" />
                                <button onClick={() => removeCargo(index)} className="p-1 text-red-500 hover:text-red-400"><TrashIcon className="h-4 w-4"/></button>
                            </div>
                        </div>
                    ))}
                    <Button onClick={addCargo} type="button" className="text-xs py-1 px-2"><PlusIcon className="h-3 w-3 mr-1"/> Adicionar Cargo</Button>
                </div>
                
                {/* Outros campos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium">Banca Organizadora</label>
                        <input type="text" value={editalInfo.bancaOrganizadora} onChange={e => handleFieldChange('bancaOrganizadora', e.target.value)} className="w-full bg-gray-700 rounded p-2 text-sm mt-1" />
                    </div>
                     <div>
                        <label className="text-sm font-medium">Data da Prova</label>
                        <input type="date" value={editalInfo.dataProva} onChange={e => handleFieldChange('dataProva', e.target.value)} className="w-full bg-gray-700 rounded p-2 text-sm mt-1" />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Remuneração</label>
                        <input type="text" value={editalInfo.remuneracao} onChange={e => handleFieldChange('remuneracao', e.target.value)} className="w-full bg-gray-700 rounded p-2 text-sm mt-1" />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Total de Questões</label>
                        <input type="number" value={editalInfo.totalQuestoes} onChange={e => handleFieldChange('totalQuestoes', Number(e.target.value))} className="w-full bg-gray-700 rounded p-2 text-sm mt-1" />
                    </div>
                     <div className="md:col-span-2">
                        <label className="text-sm font-medium">Requisitos de Escolaridade</label>
                        <textarea value={editalInfo.requisitosEscolaridade} onChange={e => handleFieldChange('requisitosEscolaridade', e.target.value)} rows={2} className="w-full bg-gray-700 rounded p-2 text-sm mt-1"></textarea>
                    </div>
                     <div className="md:col-span-2">
                        <label className="text-sm font-medium">Formato da Prova</label>
                        <textarea value={editalInfo.formatoProva} onChange={e => handleFieldChange('formatoProva', e.target.value)} rows={2} className="w-full bg-gray-700 rounded p-2 text-sm mt-1"></textarea>
                    </div>
                </div>

                {/* Distribuição de Questões */}
                <div className="space-y-2 p-3 bg-gray-900/50 rounded-lg">
                    <h4 className="font-semibold text-gray-300">Distribuição de Questões</h4>
                    {editalInfo.distribuicaoQuestoes.map((dist, index) => (
                        <div key={index} className="grid grid-cols-2 gap-2 items-center">
                            <input type="text" value={dist.disciplina} onChange={e => handleDistribuicaoChange(index, 'disciplina', e.target.value)} placeholder="Disciplina" className="bg-gray-700 rounded p-1 text-sm" />
                            <div className="flex items-center">
                                <input type="number" value={dist.quantidade} onChange={e => handleDistribuicaoChange(index, 'quantidade', Number(e.target.value))} placeholder="Qtd" className="bg-gray-700 rounded p-1 text-sm flex-grow" />
                                <button onClick={() => removeDistribuicao(index)} className="p-1 text-red-500 hover:text-red-400"><TrashIcon className="h-4 w-4"/></button>
                            </div>
                        </div>
                    ))}
                    <Button onClick={addDistribuicao} type="button" className="text-xs py-1 px-2"><PlusIcon className="h-3 w-3 mr-1"/> Adicionar Disciplina</Button>
                </div>

            </div>
        );
    }
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Análise e Edição do Edital" size="3xl">
            <div className="space-y-4">
                <p className="text-gray-400">Faça o upload do edital em PDF. A IA irá extrair as informações mais importantes, que você poderá editar em seguida.</p>
                <div className="flex items-center space-x-4">
                    <label className="cursor-pointer bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md">
                        <span>Selecionar PDF do Edital</span>
                        <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
                    </label>
                    {file && <span className="text-gray-300 truncate">{file.name}</span>}
                </div>
                 <div className="text-center">
                    <Button onClick={handleAnalyze} disabled={isLoading || !file}>
                        {isLoading ? <Spinner /> : <><GeminiIcon className="h-5 w-5 mr-2" /> Analisar</>}
                    </Button>
                </div>
                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                
                {renderForm()}

                <div className="pt-4 flex justify-end">
                    <Button onClick={handleSaveChanges} disabled={!editalInfo}>
                        Salvar Informações do Edital
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
