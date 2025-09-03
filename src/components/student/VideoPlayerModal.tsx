import React from 'react';
import { VideoFile } from '../../types';
import { convertMediaUrlToEmbed } from '../../utils';
import { Modal } from '../ui';

export const VideoPlayerModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    video: VideoFile | null;
}> = ({ isOpen, onClose, video }) => {
    if (!isOpen || !video) return null;

    const embedUrl = convertMediaUrlToEmbed(video.url);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={video.name} size="3xl">
            <div className="aspect-video bg-black rounded-lg">
                <iframe
                    src={embedUrl}
                    title={video.name}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                ></iframe>
            </div>
        </Modal>
    );
};
