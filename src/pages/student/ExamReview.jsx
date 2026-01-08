import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, Video, File, Link as LinkIcon, Image as ImageIcon, ExternalLink } from 'lucide-react';

export default function ExamReview() {
    const { id } = useParams();
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [exam, setExam] = useState(null);
    const [result, setResult] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                // 1. Load Exam Data
                const examDoc = await getDoc(doc(db, 'exams', id));
                if (!examDoc.exists()) {
                    navigate('/student/exams');
                    return;
                }
                const examData = examDoc.data();

                // Check permission
                if (!examData.showResultToStudents) {
                    navigate('/student/exams'); // Kick out if review disabled
                    return;
                }

                setExam({ id: examDoc.id, ...examData });

                // 2. Load Student Result
                const q = query(
                    collection(db, 'exam_results'),
                    where('examId', '==', id),
                    where('studentId', '==', currentUser.uid)
                );

                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    // Get latest submission
                    const results = snapshot.docs.map(d => d.data());
                    results.sort((a, b) => b.submittedAt.toMillis() - a.submittedAt.toMillis());
                    setResult(results[0]);
                } else {
                    // No result found
                    navigate('/student/exams');
                }

            } catch (error) {
                console.error("Error loading review:", error);
            } finally {
                setLoading(false);
            }
        };

        if (currentUser) loadData();
    }, [id, currentUser, navigate]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    if (!exam || !result) return null;

    // Helper: Check if answer is correct
    const isCorrectInfo = (question, answer) => {
        if (!answer) return { correct: false, partial: false };

        if (question.type === 'single_choice' || question.type === 'true_false') {
            const correctOpt = question.options.find(o => o.isCorrect);
            return { correct: correctOpt?.id === answer, partial: false };
        }

        if (question.type === 'multiple_choice') {
            const correctIds = question.options.filter(o => o.isCorrect).map(o => o.id);
            const studentIds = Array.isArray(answer) ? answer : [];

            // Exact match for green
            const allCorrect = correctIds.every(id => studentIds.includes(id)) &&
                studentIds.every(id => correctIds.includes(id));
            if (allCorrect) return { correct: true, partial: false };

            // Partial match (at least one right)
            const someCorrect = studentIds.some(id => correctIds.includes(id));
            return { correct: false, partial: someCorrect };
        }

        if (question.type === 'matching') {
            // Complex logic handled in render, return generic
            return { correct: false, partial: false }; // Placeholder
        }

        // For Essay/Short Answer, correctness is determined by manual score vs max points
        if (question.type === 'essay' || question.type === 'short_answer') {
            // This is handled in render, return null here or generic
            return { correct: false, partial: false, manual: true };
        }

        return { correct: false };
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
                    <button onClick={() => navigate('/student/exams')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ArrowLeft className="h-5 w-5 text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">Review: {exam.title}</h1>
                        <p className="text-xs text-slate-500">
                            Your Score: <span className="font-bold text-blue-600">{Math.round(result.score)}</span>
                            {result.gradingStatus === 'pending' && (
                                <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                    Pending Review
                                </span>
                            )}
                        </p>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                {result.gradingStatus === 'pending' && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-3 text-yellow-800">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-sm">Grading in Progress</p>
                            <p className="text-sm opacity-90">Some questions (Essay/Short Answer) require manual grading by your teacher. Your final score may update later.</p>
                        </div>
                    </div>
                )}

                {exam.questions.map((question, idx) => {
                    const answer = result.answers[question.id];
                    const correctness = isCorrectInfo(question, answer);
                    const manualScore = result.manualScores?.[question.id];
                    const feedback = result.feedbacks?.[question.id];
                    const isManual = question.type === 'essay' || question.type === 'short_answer';

                    return (
                        <motion.div
                            key={question.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
                        >
                            {/* Question Header */}
                            <div className="p-5 border-b border-slate-100 flex gap-3">
                                <div className="flex-shrink-0">
                                    <span className="flex items-center justify-center w-7 h-7 rounded-md bg-slate-100 text-slate-600 font-bold text-xs">
                                        {idx + 1}
                                    </span>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-base text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">{question.text}</p>

                                        {/* Score Badge for Manual Questions */}
                                        {isManual && (
                                            <div className="flex-shrink-0 ml-4">
                                                {manualScore !== undefined ? (
                                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${parseFloat(manualScore) >= (question.points || 10) / 2
                                                            ? 'bg-green-50 text-green-700 border border-green-200'
                                                            : 'bg-red-50 text-red-700 border border-red-200'
                                                        }`}>
                                                        {manualScore} / {question.points || 10} Pts
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold border border-slate-200">
                                                        Pending
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Attachments */}
                                    {question.attachments && question.attachments.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {question.attachments.map(att => (
                                                <a
                                                    key={att.id}
                                                    href={att.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-blue-600 hover:underline"
                                                >
                                                    {att.type === 'image' && <ImageIcon className="h-3.5 w-3.5" />}
                                                    {att.type === 'video' && <Video className="h-3.5 w-3.5" />}
                                                    {att.type === 'file' && <File className="h-3.5 w-3.5" />}
                                                    {att.type === 'link' && <LinkIcon className="h-3.5 w-3.5" />}
                                                    {att.name}
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Answer Section */}
                            <div className="p-5 bg-slate-50/50">
                                {/* ESSAY & SHORT ANSWER (NEW) */}
                                {isManual && (
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Your Answer</p>
                                            <div className="p-4 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium font-serif leading-relaxed whitespace-pre-wrap">
                                                {answer || <span className="text-slate-400 italic">No answer provided</span>}
                                            </div>
                                        </div>

                                        {/* Teacher Feedback */}
                                        {feedback && (
                                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                                <p className="flex items-center gap-2 text-xs font-bold text-blue-700 uppercase mb-2">
                                                    <span className="p-1 bg-blue-100 rounded-md"><CheckCircle2 className="h-3 w-3" /></span>
                                                    Teacher Feedback
                                                </p>
                                                <p className="text-blue-900 text-sm">{feedback}</p>
                                            </div>
                                        )}

                                        {/* Expected Answer (Only if configured/graded) */}
                                        {result.gradingStatus === 'complete' && question.expectedAnswer && (
                                            <div className="mt-4 opacity-75 hover:opacity-100 transition-opacity">
                                                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Answer Key / Reference</p>
                                                <div className="text-xs text-slate-600 bg-slate-100 p-2 rounded-lg border border-slate-200 inline-block max-w-full">
                                                    {question.expectedAnswer}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* SINGLE / TRUE_FALSE */}
                                {(question.type === 'single_choice' || question.type === 'true_false') && (
                                    <div className="space-y-2">
                                        {question.options.map(opt => {
                                            const isSelected = answer === opt.id;
                                            const isCorrect = opt.isCorrect;

                                            let styleClass = "border-slate-200 bg-white";
                                            if (isCorrect) styleClass = "border-green-300 bg-green-50 ring-1 ring-green-500";
                                            else if (isSelected && !isCorrect) styleClass = "border-red-300 bg-red-50 ring-1 ring-red-500";

                                            return (
                                                <div key={opt.id} className={`p-3 rounded-lg border flex items-center justify-between ${styleClass}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0
                                                            ${isSelected ? (isCorrect ? 'border-green-600 bg-green-600' : 'border-red-600 bg-red-600') : 'border-slate-300'}
                                                        `}>
                                                            {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                        </div>
                                                        <span className={`text-sm ${isCorrect ? 'font-bold text-green-800' : isSelected ? 'font-medium text-red-800' : 'text-slate-600'}`}>
                                                            {opt.text}
                                                        </span>
                                                    </div>
                                                    {isCorrect && <span className="text-[10px] uppercase tracking-wider font-bold text-green-600 px-2 py-0.5 bg-green-100 rounded">Correct Answer</span>}
                                                    {isSelected && !isCorrect && <span className="text-[10px] uppercase tracking-wider font-bold text-red-600 px-2 py-0.5 bg-red-100 rounded">Your Answer</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* MULTIPLE CHOICE */}
                                {question.type === 'multiple_choice' && (
                                    <div className="space-y-2">
                                        {question.options.map(opt => {
                                            const studentAnswers = Array.isArray(answer) ? answer : [];
                                            const isSelected = studentAnswers.includes(opt.id);
                                            const isCorrect = opt.isCorrect;

                                            let styleClass = "border-slate-200 bg-white";
                                            if (isCorrect) styleClass = "border-green-300 bg-green-50 ring-1 ring-green-500";
                                            else if (isSelected && !isCorrect) styleClass = "border-red-300 bg-red-50 ring-1 ring-red-500";

                                            return (
                                                <div key={opt.id} className={`p-3 rounded-lg border flex items-center justify-between ${styleClass}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                                                            ${isSelected ? (isCorrect ? 'border-green-600 bg-green-600' : 'border-red-600 bg-red-600') : 'border-slate-300'}
                                                        `}>
                                                            {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                                                        </div>
                                                        <span className={`text-sm ${isCorrect ? 'font-bold text-green-800' : isSelected ? 'font-medium text-red-800' : 'text-slate-600'}`}>
                                                            {opt.text}
                                                        </span>
                                                    </div>
                                                    {isCorrect && <span className="text-[10px] uppercase tracking-wider font-bold text-green-600 px-2 py-0.5 bg-green-100 rounded">Correct</span>}
                                                    {isSelected && !isCorrect && <span className="text-[10px] uppercase tracking-wider font-bold text-red-600 px-2 py-0.5 bg-red-100 rounded">Incorrect</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* MATCHING */}
                                {question.type === 'matching' && (
                                    <div className="space-y-3">
                                        {question.options.map((pair, pIdx) => {
                                            const studentRight = answer ? answer[pIdx] : null;
                                            const isCorrect = studentRight && studentRight.trim().toLowerCase() === pair.right.trim().toLowerCase();

                                            // 1. Correct Pair
                                            if (isCorrect) {
                                                return (
                                                    <div key={pIdx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center p-2.5 bg-green-50 border border-green-200 rounded-md">
                                                        <div className="flex-1 text-sm font-medium text-slate-800">{pair.left}</div>
                                                        <div className="hidden sm:block text-green-400">➜</div>
                                                        <div className="flex-1 text-sm font-bold text-green-700 flex items-center gap-2">
                                                            {studentRight} <CheckCircle2 className="h-3.5 w-3.5" />
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            // 2. Incorrect Pair (Show Student's + Correction)
                                            return (
                                                <div key={pIdx} className="space-y-1.5">
                                                    {/* Student's Wrong Answer */}
                                                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center p-2.5 bg-red-50 border border-red-200 rounded-md">
                                                        <div className="flex-1 text-sm font-medium text-slate-800">{pair.left}</div>
                                                        <div className="hidden sm:block text-red-400">➜</div>
                                                        <div className="flex-1 text-sm font-bold text-red-700 flex items-center gap-2">
                                                            {studentRight || "(Unanswered)"} <XCircle className="h-3.5 w-3.5" />
                                                        </div>
                                                    </div>
                                                    {/* Correction */}
                                                    <div className="pl-4 sm:pl-8 flex items-center gap-2 text-xs text-green-700 font-medium">
                                                        <span className="text-slate-400">↪</span> Correct Answer: <span className="font-bold">{pair.right}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    );
                })}

                <div className="pt-4">
                    <button
                        onClick={() => navigate('/student/exams')}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Exam List
                    </button>
                </div>
            </div>
        </div>
    );
}
