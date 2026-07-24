"use client";

import { useState } from "react";

export default function ImporterPage() {
  const [questionsFile, setQuestionsFile] = useState<File | null>(null);
  const [answersFile, setAnswersFile] = useState<File | null>(null);
  const [year, setYear] = useState("2024");
  const [paper, setPaper] = useState("GS1");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleUpload = async () => {
    if (!questionsFile || !answersFile) {
      alert("Please select both PDF files.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("questionsFile", questionsFile);
    formData.append("answersFile", answersFile);
    formData.append("year", year);
    formData.append("paper", paper);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (res.ok) {
        setResults(json.data);
      } else {
        alert("Error: " + json.error);
      }
    } catch (e: any) {
      alert("Error uploading files: " + e.message);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/save-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: results, year, paperName: paper }),
      });
      const json = await res.json();
      if (res.ok) {
        alert(`Successfully saved ${json.savedCount} questions. ${json.reviewQueueCount} added to review queue.`);
        setResults([]);
      } else {
        alert("Error: " + json.error);
      }
    } catch (e: any) {
      alert("Error saving data: " + e.message);
    }
    setLoading(false);
  };

  const updateResult = (index: number, field: string, value: any) => {
    const newResults = [...results];
    newResults[index][field] = value;
    setResults(newResults);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-gray-900 font-sans">
      <div className="max-w-7xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">UPSC Automated Importer V2</h1>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 bg-gray-100 p-4 rounded">
          <div>
            <label className="block text-sm font-medium mb-1">Questions PDF</label>
            <input type="file" accept="application/pdf" onChange={e => setQuestionsFile(e.target.files?.[0] || null)} className="border bg-white p-2 w-full rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Answers PDF</label>
            <input type="file" accept="application/pdf" onChange={e => setAnswersFile(e.target.files?.[0] || null)} className="border bg-white p-2 w-full rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Year</label>
            <input type="text" value={year} onChange={e => setYear(e.target.value)} className="border p-2 w-full rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Paper</label>
            <select value={paper} onChange={e => setPaper(e.target.value)} className="border p-2 w-full rounded">
              <option value="GS1">GS 1</option>
              <option value="CSAT">CSAT (GS 2)</option>
            </select>
          </div>
        </div>

        <button 
          onClick={handleUpload} 
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 disabled:opacity-50 transition font-bold"
        >
          {loading ? "Processing via AI..." : "Extract & Run AI Classification"}
        </button>

        {results.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Review AI Extraction & Confidence</h2>
            <div className="overflow-x-auto border rounded mb-4">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-800 text-white border-b">
                  <tr>
                    <th className="p-3 text-left w-12">Q#</th>
                    <th className="p-3 text-left w-64">Question Block</th>
                    <th className="p-3 text-left">Category / Tags</th>
                    <th className="p-3 text-left w-20">Ans</th>
                    <th className="p-3 text-left w-32">Confidence</th>
                    <th className="p-3 text-left w-40">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((q, idx) => (
                    <tr key={idx} className={`border-b ${q.status === 'NEEDS_REVIEW' ? 'bg-orange-50' : 'bg-white'}`}>
                      <td className="p-3 font-bold align-top">{q.questionNo}</td>
                      <td className="p-3 align-top">
                        <textarea 
                          value={q.question} 
                          onChange={e => updateResult(idx, 'question', e.target.value)}
                          className="w-full border rounded p-1 text-xs h-20 mb-2 bg-gray-50"
                          title="Question Text"
                        />
                        <div className="text-xs text-gray-500 italic mb-1">Detected Options:</div>
                        <input value={q.optionA || ''} onChange={e => updateResult(idx, 'optionA', e.target.value)} className="w-full border rounded p-1 text-xs mb-1 bg-gray-50" placeholder="(a)" />
                        <input value={q.optionB || ''} onChange={e => updateResult(idx, 'optionB', e.target.value)} className="w-full border rounded p-1 text-xs mb-1 bg-gray-50" placeholder="(b)" />
                        <input value={q.optionC || ''} onChange={e => updateResult(idx, 'optionC', e.target.value)} className="w-full border rounded p-1 text-xs mb-1 bg-gray-50" placeholder="(c)" />
                        <input value={q.optionD || ''} onChange={e => updateResult(idx, 'optionD', e.target.value)} className="w-full border rounded p-1 text-xs bg-gray-50" placeholder="(d)" />
                      </td>
                      <td className="p-3 align-top">
                        <input 
                          type="text"
                          value={q.category} 
                          onChange={e => updateResult(idx, 'category', e.target.value)}
                          className="w-full border rounded p-1 font-bold mb-2"
                          placeholder="Primary Category"
                        />
                        <input 
                          type="text"
                          value={q.subcategory || ''} 
                          onChange={e => updateResult(idx, 'subcategory', e.target.value)}
                          className="w-full border rounded p-1 mb-2 text-sm"
                          placeholder="Subcategory"
                        />
                        <textarea 
                          value={(q.tags || []).join(", ")} 
                          onChange={e => updateResult(idx, 'tags', e.target.value.split(',').map((t: string) => t.trim()))}
                          className="w-full border rounded p-1 text-xs h-12"
                          placeholder="Secondary Tags"
                        />
                      </td>
                      <td className="p-3 align-top">
                        <input 
                          type="text"
                          value={q.correctAnswer || ""} 
                          onChange={e => updateResult(idx, 'correctAnswer', e.target.value.toUpperCase())}
                          className="w-full border rounded p-2 text-center font-bold text-lg"
                          maxLength={1}
                        />
                      </td>
                      <td className="p-3 align-top text-xs">
                        <div className="mb-1">Parse: <span className={q.parseConfidence > 0.8 ? 'text-green-600' : 'text-red-600 font-bold'}>{Math.round(q.parseConfidence * 100)}%</span></div>
                        <div className="mb-1">AI Cat: <span className={q.categoryConfidence > 0.8 ? 'text-green-600' : 'text-red-600 font-bold'}>{Math.round(q.categoryConfidence * 100)}%</span></div>
                        <div className="mb-1">Answer: <span className={q.answerConfidence > 0.8 ? 'text-green-600' : 'text-red-600 font-bold'}>{Math.round(q.answerConfidence * 100)}%</span></div>
                      </td>
                      <td className="p-3 align-top">
                        <select
                          value={q.status}
                          onChange={e => updateResult(idx, 'status', e.target.value)}
                          className={`w-full border rounded p-2 font-bold ${q.status === 'NEEDS_REVIEW' ? 'text-orange-700 border-orange-400 bg-orange-100' : 'text-green-700 border-green-400 bg-green-100'}`}
                        >
                          <option value="NEEDS_REVIEW">NEEDS REVIEW</option>
                          <option value="APPROVED">APPROVED</option>
                        </select>
                        {q.status === 'NEEDS_REVIEW' && q.reviewReason && (
                          <div className="text-xs text-red-600 mt-2 italic">{q.reviewReason}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button 
              onClick={handleSave} 
              disabled={loading}
              className="bg-green-600 text-white px-8 py-3 rounded shadow hover:bg-green-700 disabled:opacity-50 transition font-bold text-lg"
            >
              {loading ? "Saving to Database..." : "Save to Database"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
