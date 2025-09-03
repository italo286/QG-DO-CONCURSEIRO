import React, { useState, useEffect } from 'react';
import { Topic, SubTopic, PdfFile, VideoFile } from '../../types';
import { TrashIcon } from '../Icons';

type LinkItemProps = {
    item: PdfFile | VideoFile;
    index: number;
    field: 'fullPdfs' | 'summaryPdfs' | 'raioXPdfs' | 'videoUrls';
    onUpdate: (index: number, subfield: 'name' | 'url' | 'fileName', value: string) => void;
    onRemove: (index: number) => void;
};

const LinkItem: React.FC<LinkItemProps> = ({ item, index, field, onUpdate, onRemove }) => {
    const isVideo = field === 'videoUrls';
    const initialName = isVideo ? (item as VideoFile).name : (item as PdfFile).fileName;
    const [localName, setLocalName] = useState(initialName || '');
    const [localUrl, setLocalUrl] = useState(item.url || '');

    useEffect(() => {
        const name = isVideo ? (item as VideoFile).name : (item as PdfFile).fileName;
        setLocalName(name || '');
        setLocalUrl(item.url || '');
    }, [item, isVideo]);

    const handleNameBlur = () => {
        const nameField = isVideo ? 'name' : 'fileName';
        const currentName = isVideo ? (item as VideoFile).name : (item as PdfFile).fileName;
        if (currentName !== localName) {
            onUpdate(index, nameField, localName);
        }
    };
    
    const handleUrlBlur = () => {
        if (item.url !== localUrl) {
            onUpdate(index, 'url', localUrl);
        }
    };

    return (
        <li className="p-2 bg-gray-700 rounded-md">
            <div className="space-y-1">
                <input
                    type="text"
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                    onBlur={handleNameBlur}
                    placeholder={isVideo ? "Nome do vídeo" : "Nome do PDF"}
                    className="w-full bg-gray-600 border border-gray-500 rounded-md py-1 px-2 text-white text-xs font-semibold"
                />
                <div className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={localUrl}
                        onChange={(e) => setLocalUrl(e.target.value)}
                        onBlur={handleUrlBlur}
                        placeholder={isVideo ? "URL do vídeo" : "URL do PDF"}
                        className="w-full bg-gray-600 border border-gray-500 rounded-md py-1 px-2 text-white text-xs"
                    />
                    <button onClick={() => onRemove(index)} className="p-1 text-red-500 hover:text-red-400 flex-shrink-0"><TrashIcon className="h-4 w-4"/></button>
                </div>
            </div>
        </li>
    );
};

export const ContentLinksEditor: React.FC<{
    content: Topic | SubTopic;
    setContent: React.Dispatch<React.SetStateAction<any>>;
}> = ({ content, setContent }) => {
    
    const handleAddLink = (field: 'fullPdfs' | 'summaryPdfs' | 'raioXPdfs' | 'videoUrls') => {
        setContent((prev: Topic | SubTopic) => {
            if (field === 'videoUrls') {
                const newVideo: VideoFile = { id: `video-${Date.now()}-${Math.random()}`, name: '', url: '' };
                return { ...prev, videoUrls: [...(prev.videoUrls || []), newVideo] };
            } else {
                const newPdf: PdfFile = { id: `pdf-${Date.now()}-${Math.random()}`, url: '', fileName: '' };
                const existingPdfs = (prev as any)[field] || [];
                return { ...prev, [field]: [...existingPdfs, newPdf] };
            }
        });
    };
    
    const handleRemoveLink = (field: 'fullPdfs' | 'summaryPdfs' | 'raioXPdfs' | 'videoUrls', index: number) => {
        setContent((prev: any) => {
            const currentLinks = prev[field] || [];
            const newLinks = [...currentLinks];
            newLinks.splice(index, 1);
            return { ...prev, [field]: newLinks };
        });
    };

    const handleUpdateLink = (field: 'fullPdfs' | 'summaryPdfs' | 'raioXPdfs' | 'videoUrls', index: number, subfield: 'name' | 'url' | 'fileName', value: string) => {
        setContent((prev: any) => {
            const newContent = { ...prev };
            const newArray = [...((newContent as any)[field] as any[])];
            newArray[index] = { ...newArray[index], [subfield]: value };
            (newContent as any)[field] = newArray;
            return newContent;
        });
    };

    const handleTecUrlChange = (value: string) => {
        setContent((prev: any) => ({ ...prev, tecUrl: value }));
    }

    const LinkList: React.FC<{ field: 'fullPdfs' | 'summaryPdfs' | 'raioXPdfs' | 'videoUrls' }> = ({ field }) => {
        const items = (content as any)[field] || [];
        const title = {
            fullPdfs: 'PDFs da Aula Completa',
            summaryPdfs: 'PDFs de Resumo',
            raioXPdfs: 'PDFs de Raio X',
            videoUrls: 'Vídeos da Aula'
        }[field];

        return (
            <div>
                <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-gray-300">{title}</h4>
                    <button onClick={() => handleAddLink(field)} className="text-cyan-400 hover:underline text-sm">+ Adicionar</button>
                </div>
                <ul className="mt-2 space-y-2 text-sm">
                    {items.map((item: PdfFile | VideoFile, index: number) => (
                        <LinkItem
                            key={item.id || index}
                            item={item}
                            index={index}
                            field={field}
                            onUpdate={(idx, subfield, val) => handleUpdateLink(field, idx, subfield as any, val)}
                            onRemove={(idx) => handleRemoveLink(field, idx)}
                        />
                    ))}
                    {items.length === 0 && <p className="text-xs text-gray-500 pl-2">Nenhum link adicionado.</p>}
                </ul>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <LinkList field="fullPdfs" />
            <LinkList field="summaryPdfs" />
            <LinkList field="raioXPdfs" />
            <LinkList field="videoUrls" />
            <div>
                <h4 className="font-semibold text-gray-300">Caderno TEC Concursos (Opcional)</h4>
                <input
                    type="url"
                    placeholder="https://www.tecconcursos.com.br/s/..."
                    value={content.tecUrl || ''}
                    onChange={(e) => handleTecUrlChange(e.target.value)}
                    className="mt-2 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"
                />
            </div>
        </div>
    );
};