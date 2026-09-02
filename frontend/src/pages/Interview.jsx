import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/api";
import ProctorMonitor from "../components/ProctorMonitor";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function Interview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [proctorFlagged, setProctorFlagged] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState("javascript");
  const [runOutput, setRunOutput] = useState(null);
  const [running, setRunning] = useState(false);
  const [timePerQuestion, setTimePerQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const recognitionRef = useRef(null);
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    api.get(`/interviews/${id}`).then(({ data }) => setTimePerQuestion(data.timePerQuestion || 0));
  }, [id]);

  const handleRunCode = async () => {
    setRunning(true);
    setRunOutput(null);
    try {
      const { data } = await api.post("/code/run", { code: answer, language: codeLanguage });
      setRunOutput(data);
    } catch (err) {
      setRunOutput({ stderr: err.response?.data?.message || "Failed to run code" });
    } finally {
      setRunning(false);
    }
  };

  const fetchNextQuestion = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/interviews/${id}/next-question`);
      setQuestion(data);
      setRunOutput(null);
    } catch (err) {
      if (err.response?.status === 400) {
        setFinished(true);
      } else {
        setError(err.response?.data?.message || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNextQuestion();
    // eslint-disable-next-line
  }, [id]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const handleToggleMic = () => {
    if (!SpeechRecognition) {
      setError("Speech-to-text isn't supported in this browser. Try Chrome or Edge, or just type your answer.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setAnswer((prev) => (prev ? prev + " " + finalTranscript : finalTranscript));
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      const messages = {
        "not-allowed": "Microphone access was blocked. Click the mic icon in your browser's address bar and allow it.",
        "no-speech": "No speech detected — try speaking again, closer to the mic.",
        "audio-capture": "No microphone was found. Check that one is connected and selected as the default input.",
        network: "Speech recognition needs an internet connection (Chrome sends audio to Google's servers to transcribe it).",
      };
      setError(messages[event.error] || `Speech recognition error: ${event.error}`);
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const handleReadAloud = () => {
    if (!question || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(question.text);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  };

  const handleSubmitAnswer = async (isAutoSubmit = false) => {
    const answerToSend = answer.trim() || (isAutoSubmit ? "(No answer — time ran out)" : "");
    if (!answerToSend) {
      setError("Please enter an answer before continuing.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post(`/interviews/${id}/answer`, {
        questionId: question._id,
        answerText: answerToSend,
      });

      setHistory((h) => [...h, { question: question.text, answer: answerToSend, evaluation: data.response.evaluation }]);
      setAnswer("");

      if (data.interviewStatus === "completed") {
        setFinished(true);
      } else {
        await fetchNextQuestion();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswerRef = useRef(handleSubmitAnswer);
  handleSubmitAnswerRef.current = handleSubmitAnswer;

  useEffect(() => {
    setTimeLeft(question && timePerQuestion > 0 ? timePerQuestion : null);
    autoSubmittedRef.current = false;
  }, [question, timePerQuestion]);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      if (!autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        handleSubmitAnswerRef.current(true);
      }
      return;
    }
    const t = setTimeout(() => setTimeLeft((prev) => (prev !== null ? prev - 1 : prev)), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  if (finished) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <h1 className="text-2xl font-semibold mb-4">Interview complete</h1>
        <button
          onClick={() => navigate(`/report/${id}`)}
          className="bg-slate-900 text-white rounded-lg px-6 py-2 font-medium"
        >
          View Report
        </button>
      </div>
    );
  }

  const isCodeQuestion = question?.category?.toLowerCase().includes("dsa");

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-xl font-semibold">Interview in progress</h1>

        {proctorFlagged && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            This session has been flagged for review due to repeated proctoring warnings. You can continue the
            interview — this will just be visible to a reviewer on the final report.
          </div>
        )}

        {history.map((h, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-4 space-y-2">
            <p className="font-medium text-slate-700">Q: {h.question}</p>
            <p className="text-slate-600 whitespace-pre-wrap">A: {h.answer}</p>
            <p className="text-xs text-slate-400">Score: {h.evaluation?.score}/10</p>
          </div>
        ))}

        {question && !loading && (
          <div className="bg-white rounded-xl shadow-md p-6 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <p className="text-xs uppercase tracking-wide text-slate-400">{question.category}</p>
                {question.askedBy && (
                  <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                    {question.askedBy}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {timeLeft !== null && (
                  <span className={`text-sm font-mono font-semibold ${timeLeft <= 10 ? "text-red-500" : "text-slate-500"}`}>
                    ⏱ {timeLeft}s
                  </span>
                )}
                <button onClick={handleReadAloud} className="text-xs underline text-slate-500">
                  🔊 Read Aloud
                </button>
              </div>
            </div>
            <p className="text-lg font-medium">{question.text}</p>

            <textarea
              className={`w-full border rounded-lg px-3 py-2 min-h-[140px] ${
                isCodeQuestion ? "font-mono text-sm bg-slate-50" : ""
              }`}
              placeholder={isCodeQuestion ? "Write your code here..." : "Type your answer, or use the mic..."}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />

            {isCodeQuestion && (
              <div className="space-y-2">
                <div className="flex gap-2 items-center">
                  <select
                    className="border rounded-lg px-2 py-1 text-sm"
                    value={codeLanguage}
                    onChange={(e) => setCodeLanguage(e.target.value)}
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                  </select>
                  <button
                    onClick={handleRunCode}
                    disabled={running || !answer.trim()}
                    className="border rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-50"
                  >
                    {running ? "Running..." : "▶ Run Code"}
                  </button>
                </div>
                {runOutput && (
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap">
                    {runOutput.status && <p className="text-slate-400 mb-1">Status: {runOutput.status}</p>}
                    {runOutput.stdout && <p>{runOutput.stdout}</p>}
                    {runOutput.stderr && <p className="text-red-400">{runOutput.stderr}</p>}
                    {runOutput.compileOutput && <p className="text-amber-400">{runOutput.compileOutput}</p>}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleToggleMic}
                className={`border rounded-lg px-4 py-2 text-sm font-medium ${
                  listening ? "bg-red-50 border-red-300 text-red-600" : ""
                }`}
              >
                {listening ? "⏹ Stop Recording" : "🎤 Speak Answer"}
              </button>
              <button
                onClick={() => handleSubmitAnswer(false)}
                disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 transition text-white rounded-lg px-6 py-2 font-medium disabled:opacity-50"
              >
                Submit Answer
              </button>
            </div>
          </div>
        )}

        {loading && <p className="text-slate-400">Thinking...</p>}

        {error && !loading && (
          <div className="bg-white rounded-xl shadow-md p-6 space-y-3">
            <p className="text-red-500 text-sm">{error}</p>
            <button onClick={fetchNextQuestion} className="border rounded-lg px-4 py-2 text-sm font-medium">
              Try Again
            </button>
          </div>
        )}
      </div>

      <ProctorMonitor interviewId={id} onFlagged={() => setProctorFlagged(true)} />
    </div>
  );
}
