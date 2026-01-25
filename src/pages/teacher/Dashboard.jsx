import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import Overview from './Overview';
import Classes from './Classes';
import Students from './Students';
import Tasks from './Tasks';
import Gradebook from './Gradebook';
import Exams from './Exams';
import ExamEditor from './ExamEditor';
import ExamResults from './ExamResults';
import CurriculumOverview from './CurriculumOverview';
import CurriculumEditor from './CurriculumEditor';
import CurriculumPrint from './CurriculumPrint';

export default function TeacherDashboard() {
    return (
        <DashboardLayout>
            <Routes>
                <Route index element={<Overview />} />
                <Route path="classes" element={<Classes />} />
                <Route path="students" element={<Students />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="exams" element={<Exams />} />
                <Route path="exams/create" element={<ExamEditor />} />
                <Route path="exams/edit/:id" element={<ExamEditor />} />
                <Route path="exams/results/:id" element={<ExamResults />} />
                <Route path="gradebook" element={<Gradebook />} />
                <Route path="curriculum" element={<CurriculumOverview />} />
                <Route path="curriculum/:id" element={<CurriculumEditor />} />
                <Route path="curriculum/:id/print" element={<CurriculumPrint />} />
            </Routes>
        </DashboardLayout>
    );
}

