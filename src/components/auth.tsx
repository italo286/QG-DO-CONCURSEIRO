
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
            await FirebaseService.createUserProfile(user!.uid, email, name, role);
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
        <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
            <main>
                <Card className="w-full max-w-md p-8 bg-gray-800/80 backdrop-blur-xl border-white/5 shadow-2xl">
                    <div className="text-center mb-10">
                        <img src="https://i.ibb.co/FbmLfsBw/Google-AI-Studio-2025-08-10-T15-45-10.png" alt="Logo" className="mx-auto h-20 w-auto rounded-xl shadow-lg mb-4" />
                        <h1 className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">QG DO <span className="text-cyan-400">CONCURSEIRO</span></h1>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mt-2">Plataforma de Alta Performance</p>
                    </div>
                    
                    <div className="flex border-b border-gray-700 mb-8" role="tablist" aria-label="Formulário de acesso">
                        <button 
                            onClick={() => setIsLoginView(true)} 
                            className={`w-1/2 py-3 text-xs font-black uppercase tracking-widest ${isLoginView ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-500 hover:text-white'}`}
                            role="tab"
                            aria-selected={isLoginView}
                            aria-controls="login-panel"
                            id="login-tab"
                        >
                            Entrar
                        </button>
                        <button 
                            onClick={() => setIsLoginView(false)} 
                            className={`w-1/2 py-3 text-xs font-black uppercase tracking-widest ${!isLoginView ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-500 hover:text-white'}`}
                            role="tab"
                            aria-selected={!isLoginView}
                            aria-controls="register-panel"
                            id="register-tab"
                        >
                            Cadastrar
                        </button>
                    </div>
                    
                    {isLoginView ? (
                        <div id="login-panel" role="tabpanel" aria-labelledby="login-tab" className="animate-fade-in">
                            <LoginForm />
                        </div>
                    ) : (
                         <div id="register-panel" role="tabpanel" aria-labelledby="register-tab" className="animate-fade-in">
                            <RegisterForm />
                        </div>
                    )}
                </Card>
            </main>
        </div>
    );
};
