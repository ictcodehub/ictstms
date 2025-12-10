import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  BookOpen, 
  CheckCircle, 
  Clock,
  Award,
  Target
} from 'lucide-react';

export default function Analytics() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTasks: 0,
    totalSubmissions: 0,
    totalStudents: 0,
    averageGrade: 0,
    submissionRate: 0,
    onTimeRate: 0,
    classStats: [],
    gradeDistribution: {
      excellent: 0, // 90-100
      good: 0, // 80-89
      average: 0, // 70-79
      below: 0, // < 70
    },
  });

  useEffect(() => {
    fetchAnalytics();
  }, [currentUser]);

  const fetchAnalytics = async () => {
    try {
      // Fetch all tasks by teacher
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('createdBy', '==', currentUser.uid)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch all submissions
      const submissionsQuery = query(collection(db, 'submissions'));
      const submissionsSnapshot = await getDocs(submissionsQuery);
      const allSubmissions = submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter submissions for teacher's tasks
      const taskIds = tasks.map(t => t.id);
      const submissions = allSubmissions.filter(s => taskIds.includes(s.taskId));

      // Fetch students from assigned classes
      const classIds = [...new Set(tasks.flatMap(t => t.assignedClasses || []))];
      const studentsQuery = query(
        collection(db, 'users'),
        where('classId', 'in', classIds.length > 0 ? classIds : ['dummy'])
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Calculate average grade
      const gradedSubmissions = submissions.filter(s => s.grade !== null && s.grade !== undefined);
      const averageGrade = gradedSubmissions.length > 0
        ? gradedSubmissions.reduce((sum, s) => sum + s.grade, 0) / gradedSubmissions.length
        : 0;

      // Calculate submission rate
      const totalExpectedSubmissions = tasks.length * students.length;
      const submissionRate = totalExpectedSubmissions > 0
        ? (submissions.length / totalExpectedSubmissions) * 100
        : 0;

      // Calculate on-time rate
      const onTimeSubmissions = submissions.filter(s => {
        const task = tasks.find(t => t.id === s.taskId);
        if (!task) return false;
        const submittedAt = s.submittedAt?.toDate ? s.submittedAt.toDate() : new Date(s.submittedAt);
        const deadline = new Date(task.deadline);
        return submittedAt <= deadline;
      });
      const onTimeRate = submissions.length > 0
        ? (onTimeSubmissions.length / submissions.length) * 100
        : 0;

      // Grade distribution
      const gradeDistribution = {
        excellent: gradedSubmissions.filter(s => s.grade >= 90).length,
        good: gradedSubmissions.filter(s => s.grade >= 80 && s.grade < 90).length,
        average: gradedSubmissions.filter(s => s.grade >= 70 && s.grade < 80).length,
        below: gradedSubmissions.filter(s => s.grade < 70).length,
      };

      // Class statistics
      const classStats = classIds.map(classId => {
        const classStudents = students.filter(s => s.classId === classId);
        const classSubmissions = submissions.filter(s => 
          classStudents.some(st => st.id === s.studentId)
        );
        const classGradedSubmissions = classSubmissions.filter(s => s.grade !== null);
        const classAverage = classGradedSubmissions.length > 0
          ? classGradedSubmissions.reduce((sum, s) => sum + s.grade, 0) / classGradedSubmissions.length
          : 0;

        return {
          classId,
          studentCount: classStudents.length,
          submissionCount: classSubmissions.length,
          averageGrade: classAverage,
        };
      });

      setStats({
        totalTasks: tasks.length,
        totalSubmissions: submissions.length,
        totalStudents: students.length,
        averageGrade: Math.round(averageGrade * 10) / 10,
        submissionRate: Math.round(submissionRate),
        onTimeRate: Math.round(onTimeRate),
        classStats,
        gradeDistribution,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-blue-600" />
          Analytics Dashboard
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Comprehensive insights into student performance and engagement
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon={BookOpen}
          title="Total Tasks"
          value={stats.totalTasks}
          color="blue"
        />
        <MetricCard
          icon={CheckCircle}
          title="Submissions"
          value={stats.totalSubmissions}
          color="green"
        />
        <MetricCard
          icon={Users}
          title="Students"
          value={stats.totalStudents}
          color="purple"
        />
        <MetricCard
          icon={Award}
          title="Average Grade"
          value={`${stats.averageGrade}%`}
          color="orange"
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Target className="h-6 w-6 text-blue-600" />
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Submission Rate</h3>
          </div>
          <div className="flex items-end gap-4">
            <span className="text-5xl font-bold text-blue-600">{stats.submissionRate}%</span>
            <div className="flex-1 h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
                style={{ width: `${stats.submissionRate}%` }}
              ></div>
            </div>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
            Students submitting their assignments
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="h-6 w-6 text-green-600" />
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">On-Time Rate</h3>
          </div>
          <div className="flex items-end gap-4">
            <span className="text-5xl font-bold text-green-600">{stats.onTimeRate}%</span>
            <div className="flex-1 h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${stats.onTimeRate}%` }}
              ></div>
            </div>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
            Submissions completed before deadline
          </p>
        </div>
      </div>

      {/* Grade Distribution */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="h-6 w-6 text-purple-600" />
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">Grade Distribution</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <GradeCard
            label="Excellent (90-100)"
            value={stats.gradeDistribution.excellent}
            color="green"
          />
          <GradeCard
            label="Good (80-89)"
            value={stats.gradeDistribution.good}
            color="blue"
          />
          <GradeCard
            label="Average (70-79)"
            value={stats.gradeDistribution.average}
            color="yellow"
          />
          <GradeCard
            label="Below Average (<70)"
            value={stats.gradeDistribution.below}
            color="red"
          />
        </div>
      </div>

      {/* Class Statistics */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6">
        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Class Performance</h3>
        
        {stats.classStats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-300 font-semibold">Class</th>
                  <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-300 font-semibold">Students</th>
                  <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-300 font-semibold">Submissions</th>
                  <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-300 font-semibold">Average Grade</th>
                </tr>
              </thead>
              <tbody>
                {stats.classStats.map((classData, index) => (
                  <tr key={index} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium">{classData.classId}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{classData.studentCount}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{classData.submissionCount}</td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${
                        classData.averageGrade >= 80 ? 'text-green-600' :
                        classData.averageGrade >= 70 ? 'text-blue-600' :
                        classData.averageGrade >= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {classData.averageGrade > 0 ? `${Math.round(classData.averageGrade)}%` : 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">No class data available</p>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, title, value, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${colorClasses[color]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">{title}</p>
      <p className="text-3xl font-bold text-slate-800 dark:text-white">{value}</p>
    </div>
  );
}

function GradeCard({ label, value, color }) {
  const colorClasses = {
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  };

  const textClasses = {
    green: 'text-green-700 dark:text-green-400',
    blue: 'text-blue-700 dark:text-blue-400',
    yellow: 'text-yellow-700 dark:text-yellow-400',
    red: 'text-red-700 dark:text-red-400',
  };

  return (
    <div className={`${colorClasses[color]} border-2 rounded-xl p-4 text-center`}>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">{label}</p>
      <p className={`text-3xl font-bold ${textClasses[color]}`}>{value}</p>
    </div>
  );
}
