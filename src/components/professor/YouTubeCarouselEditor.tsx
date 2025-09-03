import React, { useState, useEffect } from 'react';
import { VideoFile } from '../../types';
import { TrashIcon, PlusIcon } from '../Icons';
import { Card } from '../ui';

const VideoItem: React.FC<{
    video: VideoFile;
    index: number;
    onUpdate: (index: number, field: 'name' | 'url', value: string) => void;
    onRemove: (index: number) => void;
}> = ({ video, index, onUpdate, onRemove }) => {
    const [localName, setLocalName] = useState(video.name || '');
    const [localUrl, setLocalUrl] = useState(video.url || '');

    useEffect(() => {
        setLocalName(video.name || '');
        setLocalUrl(video.url || '');
    }, [video]);

    const handleNameBlur = () => {
        if (video.name !== localName) {
            onUpdate(index, 'name', localName);
        }
    };
    
    const handleUrlBlur = () => {
        if (video.url !== localUrl) {
            onUpdate(index, 'url', localUrl);
        }
    };

    return (
        <div className="p-3 bg-gray-700 rounded-md space-y-2">
            <input
                type="text"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                onBlur={handleNameBlur}
                placeholder="Nome do vídeo"
                className="w-full bg-gray-600 border border-gray-500 rounded-md py-1 px-2 text-white font-semibold"
            />
            <div className="flex items-center space-x-2">
                <input
                    type="url"
                    value={localUrl}
                    onChange={(e) => setLocalUrl(e.target.value)}
                    onBlur={handleUrlBlur}
                    placeholder="URL do vídeo"
                    className="w-full bg-gray-600 border border-gray-500 rounded-md py-1 px-2 text-white"
                />
                <button onClick={() => onRemove(index)} className="p-1 text-red-500 hover:text-red-400 flex-shrink-0">
                    <TrashIcon className="h-5 w-5"/>
                </button>
            </div>
        </div>
    );
};

export const YouTubeCarouselEditor: React.FC<{
    videos: VideoFile[];
    onVideosChange: (videos: VideoFile[]) => void;
}> = ({ videos, onVideosChange }) => {
    
    const handleAddVideo = () => {
        const newVideo: VideoFile = { id: `yt-${Date.now()}`, name: '', url: '' };
        onVideosChange([...(videos || []), newVideo]);
    };

    const handleUpdateVideo = (index: number, field: 'name' | 'url', value: string) => {
        const newVideos = [...(videos || [])];
        newVideos[index] = { ...newVideos[index], [field]: value };
        onVideosChange(newVideos);
    };

    const handleRemoveVideo = (index: number) => {
        const newVideos = (videos || []).filter((_, i) => i !== index);
        onVideosChange(newVideos);
    };

    return (
        <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Carrossel de Vídeos</h3>
                <button onClick={handleAddVideo} className="text-cyan-400 hover:underline text-sm flex items-center gap-1">
                    <PlusIcon className="h-4 w-4" /> Adicionar Vídeo
                </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">Adicione vídeos do YouTube que aparecerão na página inicial dos alunos deste curso.</p>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {(videos || []).map((video, index) => (
                    <VideoItem
                        key={video.id || index}
                        video={video}
                        index={index}
                        onUpdate={handleUpdateVideo}
                        onRemove={handleRemoveVideo}
                    />
                ))}
                {(!videos || videos.length === 0) && <p className="text-center text-gray-500 py-4">Nenhum vídeo adicionado ao carrossel.</p>}
            </div>
        </Card>
    );
};
