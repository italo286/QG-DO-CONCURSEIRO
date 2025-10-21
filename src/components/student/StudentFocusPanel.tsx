import React from 'react';
import { Course, StudentProgress } from '../../types';
import { Card, CountdownTimer } from '../ui';

export const StudentFocusPanel: React.FC<{
    enrolledCourses: Course[];
    studentProgress: StudentProgress;
}> = ({ enrolledCourses, studentProgress }) => {
    const coursesWithTarget = enrolledCourses.filter(c => 
        c.editalInfo && studentProgress.targetCargoByCourse?.[c.id]
    );

    if (coursesWithTarget.length === 0) return null;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4">Painel de Foco</h2>
            {coursesWithTarget.map(course => {
                const targetCargoName = studentProgress.targetCargoByCourse![course.id];
                const cargoInfo = course.editalInfo!.cargosEVagas.find(c => c.cargo === targetCargoName);
                const testDate = course.editalInfo!.dataProva;

                return (
                    <Card key={course.id} className="p-6 bg-gradient-to-br from-gray-800 to-gray-900 border-cyan-500/30">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                            <div className="md:col-span-2">
                                <p className="text-sm text-cyan-400">{course.name}</p>
                                <h3 className="text-2xl font-bold text-white mt-1">{targetCargoName}</h3>
                                <div className="flex space-x-6 mt-2 text-gray-300">
                                    <span><strong>Vagas:</strong> {cargoInfo?.vagas || 'N/A'}</span>
                                    <span><strong>Salário:</strong> {course.editalInfo!.remuneracao}</span>
                                </div>
                            </div>
                            <div className="md:col-span-1">
                                {testDate && new Date(testDate) > new Date() ? (
                                    <CountdownTimer targetDate={testDate} />
                                ) : (
                                    <p className="text-center text-lg font-bold text-red-400">Prova Realizada</p>
                                )}
                            </div>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
};