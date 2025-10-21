import React from 'react';
import { Modal, Spinner } from '../ui';

export const AiHelperModal: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    title: string,
    content: React.ReactNode,
    isLoading: boolean,
}> = ({ isOpen, onClose, title, content, isLoading }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="2xl">
            {isLoading && <div className="flex justify-center p-8"><Spinner /></div>}
            {!isLoading && <div className="max-h-[60vh] overflow-y-auto">{content}</div>}
        </Modal>
    );
};
