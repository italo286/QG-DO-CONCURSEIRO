
import React from 'react';
import { StudentProgress, Subject } from '../../types';
import { StudentPerformanceDetails } from './StudentPerformanceDetails';


export const StudentPerformanceDashboard: React.FC<{
    studentProgress: StudentProgress;
    subjects: Subject[];
}> = ({ studentProgress, subjects }) => {

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold">Meu Desempenho</h2>
            <p className="text-gray-400">Acompanhe sua evolução, pontos fortes e fracos.</p>
            <StudentPerformanceDetails studentProgress={studentProgress} subjects={subjects} />
        </div>
    );
};
