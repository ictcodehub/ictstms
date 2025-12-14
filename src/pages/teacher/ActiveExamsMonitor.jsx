import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Clock, Users, Pause, Play, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ActiveExamsMonitor({ examId }) {
    const [activeSessions, setActiveSessions] = useState([]);
    const [copiedCode, setCopiedCode] = useState(null);

    useEffect(() => {
        if (!examId) return;

        const q = query(
            collection(db, 'exam_sessions'),
            where('examId', '==', examId),
            where('status', 'in', ['in_progress', 'paused'])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort: in_progress first, then by student name
            sessions.sort((a, b) => {
                if (a.status === 'in_progress' && b.status === 'paused') return -1;
                if (a.status === 'paused' && b.status === 'in_progress') return 1;
                return (a.studentName || '').localeCompare(b.studentName || '');
            });

            setActiveSessions(sessions);
        });

        return () => unsubscribe();
    }, [examId]);

    const copyPauseCode = (code, sessionId) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(sessionId);
        toast.success('Pause code copied!');
        setTimeout(() => setCopiedCode(null), 2000);
    };

    if (!examId) return null;

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800">
                    Active Exam Sessions
                </h3>
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-lg">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-bold text-blue-600">
                        {activeSessions.length} Active
                    </span>
                </div>
            </div>

            {activeSessions.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl">
                    <Clock className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No active exam sessions</p>
                    <p className="text-sm text-slate-400 mt-1">Students will appear here when they start the exam</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {activeSessions.map(session => (
                        <div
                            key={session.id}
                            className={`border-2 rounded-xl p-4 transition-all ${session.status === 'paused'
                                ? 'border-amber-200 bg-amber-50'
                                : 'border-green-200 bg-green-50'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                {/* Student Info */}
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-800">
                                        {session.studentName || 'Unknown Student'}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className={`inline-flex items-center gap-1 text-xs font-bold ${session.status === 'paused'
                                            ? 'text-amber-600'
                                            : 'text-green-600'
                                            }`}>
                                            {session.status === 'paused' ? (
                                                <><Pause className="h-3 w-3" /> Paused</>
                                            ) : (
                                                <><Play className="h-3 w-3" /> In Progress</>
                                            )}
                                        </span>
                                        {session.pauseCount > 0 && (
                                            <span className="text-xs text-slate-500">
                                                Paused {session.pauseCount}x
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Pause Code */}
                                <div className="flex items-center gap-2">
                                    {session.pauseCode ? (
                                        <>
                                            <div className="text-right mr-3">
                                                <p className="text-xs text-slate-500 font-medium">
                                                    Pause Code
                                                </p>
                                                <p className={`text-2xl font-bold tracking-wider font-mono ${session.pauseCodeUsed ? 'text-slate-400 line-through' : 'text-slate-800'
                                                    }`}>
                                                    {session.pauseCode}
                                                </p>
                                                {session.pauseCodeUsed ? (
                                                    <p className="text-xs text-red-600 font-bold">
                                                        ✗ Expired
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-green-600 font-bold">
                                                        ✓ Active
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => copyPauseCode(session.pauseCode, session.id)}
                                                disabled={session.pauseCodeUsed}
                                                className={`p-2 rounded-lg transition-colors ${session.pauseCodeUsed
                                                        ? 'bg-slate-100 cursor-not-allowed'
                                                        : 'bg-blue-100 hover:bg-blue-200'
                                                    }`}
                                                title={session.pauseCodeUsed ? "Code expired" : "Copy code"}
                                            >
                                                {copiedCode === session.id ? (
                                                    <Check className="h-5 w-5 text-green-600" />
                                                ) : (
                                                    <Copy className={`h-5 w-5 ${session.pauseCodeUsed ? 'text-slate-400' : 'text-blue-600'
                                                        }`} />
                                                )}
                                            </button>
                                        </>
                                    ) : (
                                        <div className="text-right">
                                            <p className="text-xs text-amber-600 font-medium">
                                                ⚠️ Old Session
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                Student needs to restart exam
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
