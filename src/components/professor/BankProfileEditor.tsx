import React, { useState, useEffect } from 'react';
import { BankProfilePdf } from '../../types';
import { TrashIcon, PlusIcon } from '../Icons';

type BankProfileItemProps = {
    item: BankProfilePdf;
    index: number;
    onUpdate: (index: number, field: 'bankName' | 'url', value: string) => void;
    onRemove: (index: number) => void;
};

const BankProfileItem: React.FC<BankProfileItemProps> = ({ item, index, onUpdate, onRemove }) => {
    const [localBankName, setLocalBankName] = useState(item.bankName || '');
    const [localUrl, setLocalUrl] = useState(item.url || '');

    useEffect(() => {
        setLocalBankName(item.bankName || '');
        setLocalUrl(item.url || '');
    }, [item]);

    const handleBankNameBlur = () => {
        if (item.bankName !== localBankName) {
            onUpdate(index, 'bankName', localBankName);
        }
    };
    
    const handleUrlBlur = () => {
        if (item.url !== localUrl) {
            onUpdate(index, 'url', localUrl);
        }
    };

    return (
        <li className="p-3 bg-gray-700 rounded-md space-y-2">
            <input
                type="text"
                value={localBankName}
                onChange={(e) => setLocalBankName(e.target.value)}
                onBlur={handleBankNameBlur}
                placeholder="Nome da Banca (Ex: FGV)"
                className="w-full bg-gray-600 border border-gray-500 rounded-md py-1 px-2 text-white font-semibold"
            />
            <div className="flex items-center space-x-2">
                <input
                    type="url"
                    value={localUrl}
                    onChange={(e) => setLocalUrl(e.target.value)}
                    onBlur={handleUrlBlur}
                    placeholder="URL do PDF de Análise da Banca"
                    className="w-full bg-gray-600 border border-gray-500 rounded-md py-1 px-2 text-white"
                />
                <button onClick={() => onRemove(index)} className="p-1 text-red-500 hover:text-red-400 flex-shrink-0">
                    <TrashIcon className="h-5 w-5"/>
                </button>
            </div>
        </li>
    );
};

export const BankProfileEditor: React.FC<{
    bankProfilePdfs: BankProfilePdf[];
    onUpdatePdfs: (pdfs: BankProfilePdf[]) => void;
}> = ({ bankProfilePdfs, onUpdatePdfs }) => {
    
    const handleAdd = () => {
        const newItem: BankProfilePdf = { id: `bank-${Date.now()}`, bankName: '', url: '' };
        onUpdatePdfs([...(bankProfilePdfs || []), newItem]);
    };

    const handleUpdate = (index: number, field: 'bankName' | 'url', value: string) => {
        const newPdfs = [...(bankProfilePdfs || [])];
        newPdfs[index] = { ...newPdfs[index], [field]: value };
        onUpdatePdfs(newPdfs);
    };

    const handleRemove = (index: number) => {
        const newPdfs = (bankProfilePdfs || []).filter((_, i) => i !== index);
        onUpdatePdfs(newPdfs);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h4 className="font-semibold text-gray-300">Análise de Perfil da Banca</h4>
                <button onClick={handleAdd} className="text-cyan-400 hover:underline text-sm flex items-center gap-1">
                    <PlusIcon className="h-4 w-4" /> Adicionar Banca
                </button>
            </div>
            <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {(bankProfilePdfs || []).map((pdf, index) => (
                    <BankProfileItem
                        key={pdf.id || index}
                        item={pdf}
                        index={index}
                        onUpdate={handleUpdate}
                        onRemove={handleRemove}
                    />
                ))}
                {(!bankProfilePdfs || bankProfilePdfs.length === 0) && <p className="text-center text-sm text-gray-500 py-2">Nenhum PDF de análise de banca adicionado.</p>}
            </ul>
        </div>
    );
};