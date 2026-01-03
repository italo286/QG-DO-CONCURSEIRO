
import React, { useState, useEffect, useMemo } from 'react';
import * as FirebaseService from '../../services/firebaseService';
import { User, StudentProgress } from '../../types';
import { Card, Button, Spinner, Modal } from '../ui';
import { ChartBarIcon, TrashIcon, ExclamationTriangleIcon, CheckCircleIcon, CycleIcon } from '../Icons';

interface GenLog {
    id: string;
    studentId: string;
    challengeType: string;
    status: 'success' | 'error' | 'started';
    message: string;
    timestamp: any;
    metadata?: any;
    errorDetails?: string;
}

export const ProfessorDiagnosticTool: React.FC<{ students: User[] }> = ({ students }) => {
    const [logs, setLogs] = useState<GenLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<GenLog | null>(null);

    useEffect(() => {
        const unsub = FirebaseService.listenToGenerationLogs(100, setLogs);
        setIsLoading(false);
        return () => unsub();
    }, []);

    const stats = useMemo(() => {
        const total = logs.length;
        const errors = logs.filter(l => l.status === 'error').length;
        const successes = logs.filter(l => l.status === 'success').length;
        return { total, errors, successes, rate: total > 0 ? (successes / total * 100).toFixed(1) : 0 };
    }, [logs]);

    const getStudentName = (id: string) => students.find(s => s.id === id)?.name || students.find(s => s.id === id)?.username || id;

    const handleClearLogs = async () => {
        if (window.confirm("Deseja limpar todo o histórico de logs de diagnóstico?")) {
            await FirebaseService.clearAllLogs();
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4 border-l-4 border-cyan-500">
                    <p className="text-xs font-bold text-gray-500 uppercase">Total de Eventos</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                </Card>
                <Card className="p-4 border-l-4 border-green-500">
                    <p className="text-xs font-bold text-gray-500 uppercase">Sucessos</p>
                    <p className="text-2xl font-bold text-green-400">{stats.successes}</p>
                </Card>
                <Card className="p-4 border-l-4 border-red-500">
                    <p className="text-xs font-bold text-gray-500 uppercase">Falhas</p>
                    <p className="text-2xl font-bold text-red-400">{stats.errors}</p>
                </Card>
                <Card className="p-4 border-l-4 border-amber-500">
                    <p className="text-xs font-bold text-gray-500 uppercase">Taxa de Sucesso</p>
                    <p className="text-2xl font-bold">{stats.rate}%</p>
                </Card>
            </div>

            <Card className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <ChartBarIcon className="h-6 w-6 text-cyan-400" />
                        Histórico de Telemetria (Últimos 100)
                    </h3>
                    <Button onClick={handleClearLogs} className="bg-red-900/30 text-red-400 hover:bg-red-900/50 border-red-900/50 py-1 text-xs">
                        Limpar Logs
                    </Button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-900/50 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                            <tr>
                                <th className="p-3 border-b border-gray-700">Data/Hora</th>
                                <th className="p-3 border-b border-gray-700">Aluno</th>
                                <th className="p-3 border-b border-gray-700">Desafio</th>
                                <th className="p-3 border-b border-gray-700">Status</th>
                                <th className="p-3 border-b border-gray-700">Mensagem</th>
                                <th className="p-3 border-b border-gray-700 text-center">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {isLoading ? (
                                <tr><td colSpan={6} className="p-8 text-center"><Spinner /></td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Nenhum evento registrado ainda.</td></tr>
                            ) : logs.map(log => (
                                <tr key={log.id} className="hover:bg-gray-700/30 transition-colors border-b border-gray-800/50">
                                    <td className="p-3 text-xs text-gray-400 font-mono">
                                        {log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleString('pt-BR') : 'Agora'}
                                    </td>
                                    <td className="p-3 font-semibold">{getStudentName(log.studentId)}</td>
                                    <td className="p-3 uppercase text-[10px]"><span className="bg-gray-700 px-2 py-0.5 rounded">{log.challengeType}</span></td>
                                    <td className="p-3">
                                        {log.status === 'success' && <span className="text-green-400 flex items-center gap-1"><CheckCircleIcon className="h-4 w-4"/> OK</span>}
                                        {log.status === 'error' && <span className="text-red-400 flex items-center gap-1"><ExclamationTriangleIcon className="h-4 w-4"/> ERRO</span>}
                                        {log.status === 'started' && <span className="text-cyan-400 flex items-center gap-1"><CycleIcon className="h-4 w-4 animate-spin"/> INICIO</span>}
                                    </td>
                                    <td className="p-3 text-gray-300 truncate max-w-xs">{log.message}</td>
                                    <td className="p-3 text-center">
                                        <button onClick={() => setSelectedLog(log)} className="text-cyan-400 hover:underline font-bold text-xs">DETALHES</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} title="Detalhes do Diagnóstico" size="2xl">
                {selectedLog && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="p-3 bg-gray-900 rounded-lg">
                                <p className="text-gray-500 font-bold uppercase text-[10px]">Aluno</p>
                                <p className="text-white">{getStudentName(selectedLog.studentId)}</p>
                            </div>
                            <div className="p-3 bg-gray-900 rounded-lg">
                                <p className="text-gray-500 font-bold uppercase text-[10px]">Tipo de Operação</p>
                                <p className="text-white uppercase">{selectedLog.challengeType}</p>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-900 rounded-lg">
                            <p className="text-gray-500 font-bold uppercase text-[10px] mb-2">Mensagem do Evento</p>
                            <p className={selectedLog.status === 'error' ? 'text-red-400 font-semibold' : 'text-gray-200'}>
                                {selectedLog.message}
                            </p>
                        </div>

                        {selectedLog.metadata && (
                            <div className="p-4 bg-gray-900 rounded-lg">
                                <p className="text-gray-500 font-bold uppercase text-[10px] mb-2">Metadados Técnicos</p>
                                <pre className="text-[10px] text-cyan-300 font-mono overflow-x-auto bg-black/50 p-2 rounded">
                                    {JSON.stringify(selectedLog.metadata, null, 2)}
                                </pre>
                            </div>
                        )}

                        {selectedLog.errorDetails && (
                            <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg">
                                <p className="text-red-500 font-bold uppercase text-[10px] mb-2">Stack Trace / Erro Interno</p>
                                <pre className="text-[10px] text-red-300 font-mono overflow-x-auto bg-black/30 p-2 rounded">
                                    {selectedLog.errorDetails}
                                </pre>
                            </div>
                        )}

                        <div className="flex justify-end">
                            <Button onClick={() => setSelectedLog(null)}>Fechar</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
