import React, { useState, useEffect, useRef } from 'react';
import { Course, User } from '../../types';
import { Card, Button } from '../ui';
import { CubeIcon } from '../Icons';

// Alfabeto do jogo Adedonha/Stop! (sem K, W, Y)
// prettier-ignore
const ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'X', 'Z'];

export const ProfessorAdedonhaManager: React.FC<{ courses: Course[]; allStudents: User[] }> = ({ courses, allStudents }) => {
    const [gameState, setGameState] = useState<'setup' | 'playing' | 'finished'>('setup');
    const [selectedCourseId, setSelectedCourseId] = useState<string>('');
    const [categories, setCategories] = useState<string>('Nome, Cor, Animal, Fruta, Carro, CEP (Cidade, Estado, País)');
    const [duration, setDuration] = useState(60);
    const [timeLeft, setTimeLeft] = useState(60);
    const [drawnLetter, setDrawnLetter] = useState('');
    
    const timerRef = useRef<number | null>(null);

    // Correção do bug: Se o curso selecionado for excluído, redefine o estado do jogo.
    useEffect(() => {
        if (selectedCourseId && !courses.some(c => c.id === selectedCourseId)) {
            setSelectedCourseId('');
            setGameState('setup');
        }
    }, [courses, selectedCourseId]);

    useEffect(() => {
        if (gameState === 'playing' && timeLeft > 0) {
            timerRef.current = window.setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
        } else if (timeLeft === 0 && gameState === 'playing') {
            setGameState('finished');
        }
        return () => {
            if (timerRef.current) window.clearTimeout(timerRef.current);
        };
    }, [gameState, timeLeft]);

    const handleStartGame = () => {
        if (!selectedCourseId) {
            alert('Por favor, selecione uma turma.');
            return;
        }
        const letter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
        setDrawnLetter(letter);
        setTimeLeft(duration);
        setGameState('playing');
    };

    const handleStopGame = () => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        setGameState('finished');
    };

    const handleReset = () => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        setGameState('setup');
        setDrawnLetter('');
    };

    const selectedCourse = courses.find(c => c.id === selectedCourseId);
    const participants = selectedCourse ? allStudents.filter(s => selectedCourse.enrolledStudentIds.includes(s.id)) : [];
    const categoryList = categories.split(',').map(c => c.trim()).filter(Boolean);

    if (gameState === 'setup') {
        return (
            <Card className="p-6 max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <CubeIcon className="h-7 w-7 text-cyan-400" />
                    Iniciar Jogo de Adedonha
                </h2>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="course-select" className="block text-sm font-medium text-gray-300">Turma</label>
                        <select
                            id="course-select"
                            value={selectedCourseId}
                            onChange={e => setSelectedCourseId(e.target.value)}
                            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"
                        >
                            <option value="" disabled>Selecione uma turma</option>
                            {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="categories-input" className="block text-sm font-medium text-gray-300">Categorias (separadas por vírgula)</label>
                        <textarea
                            id="categories-input"
                            value={categories}
                            onChange={e => setCategories(e.target.value)}
                            rows={3}
                            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"
                        />
                    </div>
                    <div>
                        <label htmlFor="duration-input" className="block text-sm font-medium text-gray-300">Duração (segundos)</label>
                        <input
                            id="duration-input"
                            type="number"
                            value={duration}
                            onChange={e => setDuration(Number(e.target.value))}
                            className="mt-1 block w-32 bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"
                        />
                    </div>
                    <div className="text-center pt-4">
                        <Button onClick={handleStartGame} disabled={!selectedCourseId}>Iniciar Jogo</Button>
                    </div>
                </div>
            </Card>
        );
    }

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <Card className="p-8 text-center flex flex-col items-center justify-center h-full">
                    {gameState === 'finished' && (
                        <div className="mb-8 p-4 bg-red-500/20 border border-red-500/50 rounded-lg animate-fade-in">
                            <h3 className="text-4xl font-bold text-red-400">TEMPO ESGOTADO!</h3>
                        </div>
                    )}
                    <p className="text-gray-400 text-2xl">Letra Sorteada</p>
                    <p className="text-9xl font-extrabold text-cyan-400 my-4">{drawnLetter}</p>
                    <div className="my-8">
                        <p className="text-gray-400 text-2xl">Tempo Restante</p>
                        <p className="text-7xl font-bold text-white">{formatTime(timeLeft)}</p>
                    </div>
                    <div className="flex gap-4">
                        {gameState === 'playing' && <Button onClick={handleStopGame} className="bg-red-600 hover:bg-red-700">Parar Jogo</Button>}
                        <Button onClick={handleReset} className="bg-gray-600 hover:bg-gray-500">Novo Jogo</Button>
                    </div>
                </Card>
            </div>
            <div className="lg:col-span-1">
                <Card className="p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Categorias</h3>
                    <ul className="space-y-2 text-lg">
                        {categoryList.map((cat, index) => <li key={index} className="p-2 bg-gray-700/50 rounded-md">{cat}</li>)}
                    </ul>
                    <h3 className="text-xl font-bold text-white mt-6 mb-4">Participantes ({participants.length})</h3>
                    <ul className="space-y-2 text-sm max-h-60 overflow-y-auto pr-2">
                        {participants.map(student => <li key={student.id} className="p-2 bg-gray-700/50 rounded-md">{student.name}</li>)}
                    </ul>
                </Card>
            </div>
        </div>
    );
};
