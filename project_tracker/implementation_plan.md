# Implementation Plan: Essay & Short Answer Question Types

## Goal
Add Essay and Short Answer question types to the exam system, enabling teachers to create text-based questions that require manual grading.

## User Review Required

> [!IMPORTANT]
> **Manual Grading Required**  
> Essay and Short Answer questions cannot be auto-graded. Teachers must manually review and score each student's text response. This means:
> - Students won't get instant results for these question types
> - Teachers need dedicated time for grading after exam closes
> - Grading status will show as "Pending" until teacher reviews

> [!WARNING]
> **Backward Compatibility**  
> Existing exams will continue to work normally. This only adds new question types, doesn't modify existing ones.

## Proposed Changes

### Data Model

#### Question Structure (Firestore `exams` collection)
```javascript
{
  type: 'essay' | 'short_answer' | 'single_choice' | ...,
  text: "Question text",
  points: 10,
  
  // NEW: For essay/short answer only
  expectedAnswer: "",  // Teacher's sample answer (optional)
  characterLimit: 500, // For short_answer only (optional)
  
  // Existing: For multiple choice (skip for essay)
  options: [...],
  attachments: [...]
}
```

#### Submission Structure
```javascript
{
  answers: [{
    questionId: "q1",
    
    // Multiple choice: array of selected option IDs
    selectedOptions: ['opt1'],
    
    // NEW: Essay/Short answer: text response
    textAnswer: "Student's written response...",
    
    // NEW: Manual grading fields
    score: null,        // null = not graded yet
    maxScore: 10,
    feedback: "",       // Teacher's comment
    gradedBy: "uid",
    gradedAt: timestamp
  }],
  
  // NEW: Scoring breakdown
  autoGradedScore: 70,    // From MC questions
  manualGradedScore: 0,   // From essay (pending)
  totalScore: 70,
  maxScore: 100,
  
  // NEW: Grading status
  gradingStatus: 'pending' | 'partial' | 'complete'
}
```

---

### Teacher Side Changes

#### [MODIFY] [ExamEditor.jsx](file:///c:/Project/src/pages/teacher/ExamEditor.jsx)

**What:** Add Essay & Short Answer types with Expected Answer UI

**Changes:**

1. Update type dropdown (line ~760):
```jsx
<select value={question.type}>
  <option value="single_choice">Pilihan Ganda</option>
  <option value="multiple_choice">Pilihan Jamak</option>
  <option value="true_false">Benar/Salah</option>
  <option value="matching">Menjodohkan</option>
  <option value="short_answer">Jawaban Singkat</option>  {/* NEW */}
  <option value="essay">Essay</option>  {/* NEW */}
</select>
```

2. Add conditional UI for text-based questions (after question text field):
```jsx
{(question.type === 'essay' || question.type === 'short_answer') && (
  <>
    <div>
      <label>Expected Answer (Referensi Guru)</label>
      <textarea
        placeholder="Contoh jawaban yang diharapkan..."
        value={question.expectedAnswer || ''}
        onChange={(e) => updateQuestion(question.id, {
          expectedAnswer: e.target.value
        })}
      />
    </div>
    
    {question.type === 'short_answer' && (
      <div>
        <label>Character Limit (Optional)</label>
        <input
          type="number"
          placeholder="e.g., 200"
          value={question.characterLimit || ''}
        />
      </div>
    )}
  </>
)}
```

3. Update `handleTypeChange` function (line 332):
```javascript
else if (newType === 'essay' || newType === 'short_answer') {
  updates.options = [];  // No options needed
  updates.expectedAnswer = '';
  if (newType === 'short_answer') {
    updates.characterLimit = 200;
  }
}
```

4. Update validation in `addQuestion` and `handleSubmit`:
```javascript
if (q.type === 'essay' || q.type === 'short_answer') {
  // No validation for options, text question is OK
  continue;
}
```

---

#### [MODIFY] [ExamResults.jsx](file:///c:/Project/src/pages/teacher/ExamResults.jsx)

**What:** Add manual grading interface

**Changes:**

1. Add grading panel for ungraded text answers:
```jsx
<div className="manual-grading-section">
  <h3>Soal yang Perlu Dinilai Manual</h3>
  
  {submission.answers
    .filter(a => a.score === null && 
      (questions.find(q => q.id === a.questionId)?.type === 'essay' ||
       questions.find(q => q.id === a.questionId)?.type === 'short_answer'))
    .map((answer, idx) => {
      const question = questions.find(q => q.id === answer.questionId);
      return (
        <div key={idx} className="grading-card">
          <div className="question-ref">
            <h4>Pertanyaan #{idx + 1}</h4>
            <p>{question.text}</p>
          </div>
          
          {question.expectedAnswer && (
            <div className="expected bg-green-50">
              <strong>Expected Answer:</strong>
              <p>{question.expectedAnswer}</p>
            </div>
          )}
          
          <div className="student-response bg-blue-50">
            <strong>Jawaban Siswa:</strong>
            <p className="whitespace-pre-wrap">{answer.textAnswer}</p>
          </div>
          
          <div className="grading-controls">
            <input
              type="number"
              placeholder={`Score (Max: ${answer.maxScore})`}
              max={answer.maxScore}
              value={gradingData[answer.questionId]?.score || ''}
              onChange={(e) => handleScoreInput(answer.questionId, e.target.value)}
            />
            <textarea
              placeholder="Feedback (optional)"
              value={gradingData[answer.questionId]?.feedback || ''}
            />
            <button onClick={() => saveGrade(answer.questionId)}>
              Simpan Nilai
            </button>
          </div>
        </div>
      );
    })
  }
</div>
```

2. Add `saveGrade` function:
```javascript
const saveGrade = async (questionId) => {
  const gradeData = gradingData[questionId];
  
  // Update answer in submission
  const updatedAnswers = submission.answers.map(a =>
    a.questionId === questionId
      ? {
          ...a,
          score: parseInt(gradeData.score),
          feedback: gradeData.feedback,
          gradedBy: currentUser.uid,
          gradedAt: serverTimestamp()
        }
      : a
  );
  
  // Recalculate total score
  const manualScore = updatedAnswers
    .filter(a => a.score !== null)
    .reduce((sum, a) => sum + a.score, 0);
  
  const gradingStatus = updatedAnswers.every(a => a.score !== null)
    ? 'complete'
    : 'partial';
  
  // Update Firestore
  await updateDoc(doc(db, 'examSubmissions', submission.id), {
    answers: updatedAnswers,
    manualGradedScore: manualScore,
    totalScore: submission.autoGradedScore + manualScore,
    gradingStatus,
    updatedAt: serverTimestamp()
  });
  
  toast.success("Nilai disimpan");
};
```

---

### Student Side Changes

#### [MODIFY] [ExamTaker.jsx](file:///c:/Project/src/pages/student/ExamTaker.jsx)

**What:** Add text input UI for Essay & Short Answer

**Changes:**

1. Add conditional rendering in question display:
```jsx
{question.type === 'essay' ? (
  <div className="essay-input">
    <textarea
      placeholder="Tulis jawaban essay Anda di sini..."
      className="w-full min-h-[200px] p-4 border rounded-xl"
      value={answers[question.id]?.textAnswer || ''}
      onChange={(e) => handleTextAnswer(question.id, e.target.value)}
    />
  </div>
) : question.type === 'short_answer' ? (
  <div className="short-answer-input">
    <input
      type="text"
      placeholder="Tulis jawaban singkat..."
      maxLength={question.characterLimit || 500}
      className="w-full p-3 border rounded-xl"
      value={answers[question.id]?.textAnswer || ''}
      onChange={(e) => handleTextAnswer(question.id, e.target.value)}
    />
    {question.characterLimit && (
      <p className="text-xs text-slate-500 mt-1">
        {(answers[question.id]?.textAnswer || '').length} / {question.characterLimit}
      </p>
    )}
  </div>
) : (
  // Existing: Multiple choice UI
  <OptionsUI />
)}
```

2. Add `handleTextAnswer` function:
```javascript
const handleTextAnswer = (questionId, text) => {
  setAnswers(prev => ({
    ...prev,
    [questionId]: {
      questionId,
      textAnswer: text,
      score: null,  // Will be graded manually
      maxScore: questions.find(q => q.id === questionId).points
    }
  }));
};
```

3. Update submission logic to handle both answer types:
```javascript
const handleSubmit = async () => {
  const answersArray = Object.values(answers).map(answer => {
    const question = questions.find(q => q.id === answer.questionId);
    
    if (question.type === 'essay' || question.type === 'short_answer') {
      return {
        questionId: answer.questionId,
        textAnswer: answer.textAnswer,
        score: null,  // Pending manual grading
        maxScore: question.points
      };
    } else {
      // Existing: Multiple choice auto-scoring
      return {
        questionId: answer.questionId,
        selectedOptions: answer.selectedOptions,
        score: calculateScore(answer, question),
        maxScore: question.points
      };
    }
  });
  
  // Calculate auto-graded score only
  const autoScore = answersArray
    .filter(a => a.score !== null)
    .reduce((sum, a) => sum + a.score, 0);
  
  const hasManualGrading = answersArray.some(a => a.score === null);
  
  await addDoc(collection(db, 'examSubmissions'), {
    examId,
    studentId: currentUser.uid,
    answers: answersArray,
    autoGradedScore: autoScore,
    manualGradedScore: 0,
    totalScore: autoScore,
    maxScore: /* total */,
    gradingStatus: hasManualGrading ? 'pending' : 'complete',
    submittedAt: serverTimestamp()
  });
};
```

---

#### [MODIFY] [ExamReview.jsx](file:///c:/Project/src/pages/student/ExamReview.jsx)

**What:** Show grading status and expected answers

**Changes:**

1. Add status indicator:
```jsx
{submission.gradingStatus === 'pending' && (
  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6">
    <p className="text-amber-800">
      ⏳ Guru sedang meninjau jawaban essay Anda. Nilai akan diperbarui setelah selesai.
    </p>
  </div>
)}
```

2. Update answer display:
```jsx
{question.type === 'essay' || question.type === 'short_answer' ? (
  <div className="text-answer-review">
    <div className="student-answer">
      <h4>Jawaban Anda:</h4>
      <p className="bg-blue-50 p-3 rounded whitespace-pre-wrap">
        {answer.textAnswer}
      </p>
    </div>
    
    {exam.showResultToStudents && question.expectedAnswer && (
      <div className="expected-answer mt-3">
        <h4>Expected Answer:</h4>
        <p className="bg-green-50 p-3 rounded whitespace-pre-wrap">
          {question.expectedAnswer}
        </p>
      </div>
    )}
    
    <div className="score mt-3">
      <p className="font-bold">
        Score: {answer.score !== null ? `${answer.score}/${answer.maxScore}` : 'Pending'}
      </p>
      {answer.feedback && (
        <p className="text-sm text-slate-600 mt-1">
          Feedback: {answer.feedback}
        </p>
      )}
    </div>
  </div>
) : (
  // Existing: Multiple choice review
  <MCReview />
)}
```

---

## Verification Plan

### Teacher Testing
1. Create exam with mix of MC + Essay questions
2. Set expected answers for essay questions
3. Publish exam
4. View submissions and manually grade essays
5. Verify score updates correctly

### Student Testing
1. Take exam with essay questions
2. Submit answers
3. Verify "Pending" status shows
4. After grading, check updated score appears
5. Test character limit on short answer

### Edge Cases
- Exam with only essay questions
- Mix of graded and ungraded answers
- showResultToStudents ON/OFF behavior
- Empty text answers
