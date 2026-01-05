
import React, { useState } from 'react';
import { User } from '../../types';
import * as FirebaseService from '../../services/firebaseService';
import { Modal, Button, Spinner } from '../ui';
import { UserCircleIcon } from '../Icons';

const AVATAR_URLS = [
  "https://cdn-icons-png.flaticon.com/512/2371/2371611.png",
  "https://cdn-icons-png.flaticon.com/512/3751/3751422.png",
  "https://cdn-icons-png.flaticon.com/512/1838/1838649.png",
  "https://cdn-icons-png.flaticon.com/512/1818/1818405.png",
  "https://cdn-icons-png.flaticon.com/512/9113/9113210.png",
  "https://cdn-icons-png.flaticon.com/512/1867/1867540.png",
  "https://cdn-icons-png.flaticon.com/512/1864/1864469.png",
  "https://cdn-icons-png.flaticon.com/512/4481/4481369.png",
  "https://cdn-icons-png.flaticon.com/512/1998/1998747.png",
  "https://cdn-icons-png.flaticon.com/512/1864/1864473.png",
  "https://cdn-icons-png.flaticon.com/512/1864/1864521.png",
  "https://cdn-icons-png.flaticon.com/512/1447/1447876.png",
  "https://cdn-icons-png.flaticon.com/512/1864/1864472.png",
  "https://cdn-icons-png.flaticon.com/512/826/826944.png",
  "https://cdn-icons-png.flaticon.com/512/4202/4202837.png",
  "https://cdn-icons-png.flaticon.com/512/4202/4202833.png",
  "https://cdn-icons-png.flaticon.com/512/4202/4202850.png",
  "https://cdn-icons-png.flaticon.com/512/4202/4202845.png",
  "https://cdn-icons-png.flaticon.com/512/921/921097.png",
  "https://cdn-icons-png.flaticon.com/512/4202/4202848.png",
  "https://cdn-icons-png.flaticon.com/512/4202/4202835.png",
  "https://cdn-icons-png.flaticon.com/512/921/921124.png",
];


export const EditProfileModal: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    user: User,
    onSave: (updatedUser: User) => void
}> = ({ isOpen, onClose, user, onSave }) => {
    const [name, setName] = useState(user.name || '');
    const [gender, setGender] = useState<'masculine' | 'feminine'>(user.gender || 'masculine');
    const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(user.avatarUrl || '');
    const [isLoading, setIsLoading] = useState(false);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        let updatedUser = { ...user, name, avatarUrl: selectedAvatarUrl, gender };

        await FirebaseService.updateUserProfile(user.id, { name: updatedUser.name, avatarUrl: updatedUser.avatarUrl, gender: updatedUser.gender });
        onSave(updatedUser);
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Perfil">
            <form onSubmit={handleSubmit} className="space-y-6">
                 <div>
                    <label htmlFor="profile-name" className="block text-sm font-medium text-gray-300 mb-1">Nome de Exibição</label>
                    <input id="profile-name" type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-cyan-500 focus:border-cyan-500" />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Gênero</label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="gender" 
                                value="masculine" 
                                checked={gender === 'masculine'} 
                                onChange={() => setGender('masculine')}
                                className="w-4 h-4 text-cyan-600 bg-gray-700 border-gray-600 focus:ring-cyan-500"
                            />
                            <span className="text-sm text-gray-200">Masculino (Concurseiro)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="gender" 
                                value="feminine" 
                                checked={gender === 'feminine'} 
                                onChange={() => setGender('feminine')}
                                className="w-4 h-4 text-cyan-600 bg-gray-700 border-gray-600 focus:ring-cyan-500"
                            />
                            <span className="text-sm text-gray-200">Feminino (Concurseira)</span>
                        </label>
                    </div>
                </div>

                <div>
                     <label className="block text-sm font-medium text-gray-300 mb-2">Escolha seu Avatar</label>
                     <div className="mt-2 flex items-center space-x-4">
                         {selectedAvatarUrl ? (
                             <img src={selectedAvatarUrl} alt="Avatar selecionado" className="h-20 w-20 rounded-full object-cover border-2 border-cyan-500" />
                         ) : (
                             <UserCircleIcon className="h-20 w-20 text-gray-500" aria-hidden="true"/>
                         )}
                         <div className="grid grid-cols-6 gap-2 flex-grow max-h-48 overflow-y-auto p-2 bg-gray-900/50 rounded-lg">
                             {AVATAR_URLS.map(url => (
                                 <button key={url} type="button" onClick={() => setSelectedAvatarUrl(url)} className={`rounded-full transition-all duration-200 ${selectedAvatarUrl === url ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-cyan-400 scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}>
                                     <img src={url} alt="Opção de avatar" className="h-10 w-10 md:h-12 md:w-12 rounded-full object-cover"/>
                                 </button>
                             ))}
                         </div>
                     </div>
                 </div>
                <div className="pt-4 flex justify-end">
                    <Button type="submit" disabled={isLoading}>
                        {isLoading ? <Spinner /> : 'Salvar Alterações'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
