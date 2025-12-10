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
import Calendar from './Calendar';
import Analytics from './Analytics';

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
                <Route path="calendar" element={<Calendar />} />
                <Route path="analytics" element={<Analytics />} />
            </Routes>
        </DashboardLayout>
    );
}
