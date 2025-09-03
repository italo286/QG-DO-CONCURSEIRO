import React, { useState, useId } from 'react';
import { auth } from '../firebaseConfig';
import * as FirebaseService from '../services/firebaseService';
import { UserRole } from '../types';
import { Button, Card } from './ui';
import { ArrowRightIcon } from './Icons';
import { Spinner } from './ui';

const LoginForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const errorId = useId();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await auth.signInWithEmailAndPassword(email, password);
            // onAuthStateChanged in App.tsx will handle the rest
        } catch (err: any) {
            setError('Email ou senha inválidos.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label htmlFor="email-login" className="block text-sm font-medium text-gray-300">Email</label>
                <input id="email-login" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" aria-describedby={error ? errorId : undefined} />
            </div>
            <div>
                <label htmlFor="password-login" className="block text-sm font-medium text-gray-300">Senha</label>
                <input id="password-login" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" aria-describedby={error ? errorId : undefined} />
            </div>
            {error && <p id={errorId} className="text-red-400 text-sm" role="alert">{error}</p>}
            <div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <Spinner /> : (
                        <>
                            Entrar
                            <ArrowRightIcon className="ml-2 h-5 w-5" aria-hidden="true"/>
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
};

const RegisterForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRole>('aluno');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const errorId = useId();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            setIsLoading(false);
            return;
        }

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Create user profile in Firestore
            await FirebaseService.createUserProfile(user!.uid, email, name, role);

            // onAuthStateChanged in App.tsx will handle the rest
        } catch (err: any) {
            if (err.code === 'auth/email-already-in-use') {
                setError('Este email já está em uso.');
            } else {
                setError('Ocorreu um erro ao criar a conta.');
            }
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label htmlFor="name-register" className="block text-sm font-medium text-gray-300">Nome Completo</label>
                <input id="name-register" type="text" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" />
            </div>
             <div>
                <label htmlFor="email-register" className="block text-sm font-medium text-gray-300">Email</label>
                <input id="email-register" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" aria-describedby={error ? errorId : undefined} />
            </div>
            <div>
                <label htmlFor="password-register" className="block text-sm font-medium text-gray-300">Senha</label>
                <input id="password-register" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" />
            </div>
            <div>
                <label htmlFor="role-register" className="block text-sm font-medium text-gray-300">Eu sou</label>
                <select id="role-register" value={role} onChange={e => setRole(e.target.value as UserRole)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500">
                    <option value="aluno">Aluno</option>
                    <option value="professor">Professor</option>
                </select>
            </div>
            {error && <p id={errorId} className="text-red-400 text-sm" role="alert">{error}</p>}
            <div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                     {isLoading ? <Spinner /> : 'Cadastrar'}
                </Button>
            </div>
        </form>
    );
};

export const LoginPage: React.FC = () => {
    const [isLoginView, setIsLoginView] = useState(true);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <main>
                <Card className="w-full max-w-md p-8">
                     <div className="text-center mb-8">
                        <img src="https://i.ibb.co/FbmLfsBw/Google-AI-Studio-2025-08-10-T15-45-10.png" alt="Logo QG do concurseiro" className="mx-auto h-24 w-auto rounded-md shadow-lg" />
                    </div>
                    
                    <div className="flex border-b border-gray-700 mb-6" role="tablist" aria-label="Formulário de acesso">
                        <button 
                            onClick={() => setIsLoginView(true)} 
                            className={`w-1/2 py-3 text-sm font-medium ${isLoginView ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}
                            role="tab"
                            aria-selected={isLoginView}
                            aria-controls="login-panel"
                            id="login-tab"
                        >
                            Entrar
                        </button>
                        <button 
                            onClick={() => setIsLoginView(false)} 
                            className={`w-1/2 py-3 text-sm font-medium ${!isLoginView ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}
                            role="tab"
                            aria-selected={!isLoginView}
                            aria-controls="register-panel"
                            id="register-tab"
                        >
                            Cadastrar
                        </button>
                    </div>
                    
                    {isLoginView ? (
                        <div id="login-panel" role="tabpanel" aria-labelledby="login-tab">
                            <LoginForm />
                        </div>
                    ) : (
                         <div id="register-panel" role="tabpanel" aria-labelledby="register-tab">
                            <RegisterForm />
                        </div>
                    )}
                </Card>
            </main>
        </div>
    );
};