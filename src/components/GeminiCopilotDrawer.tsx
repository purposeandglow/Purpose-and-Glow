import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, Sparkles, User, RefreshCw, X, MessageSquare, ChevronRight, Zap } from 'lucide-react';
import { LeadSignal } from '../data/purposeGlowData';
import { isStaticHostingMode, parseJsonApiResponse } from '../lib/hostingMode';

interface ChatMessage {
  id?: number;
  role: 'user' | 'model';
  content: string;
  createdAt?: string;
}

interface GeminiCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLead?: any;
  authToken?: string | null;
}

const QUICK_PROMPTS = [
  'What is their exact duty-vs-contribution gap?',
  'Draft a warm, non-salesy LinkedIn comment acknowledging their struggle.',
  'Which Purpose & Glow package should I recommend and why?',
  'What diagnostic question should I ask to uncover their measurable impact?'
];

export const GeminiCopilotDrawer: React.FC<GeminiCopilotDrawerProps> = ({
  isOpen,
  onClose,
  selectedLead,
  authToken
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const staticHosting = isStaticHostingMode();

  // Load chat history from server on mount when authenticated (skipped in static hosting mode)
  useEffect(() => {
    async function loadHistory() {
      if (staticHosting) {
        setMessages([
          {
            role: 'model',
            content:
              'Static Hosting Mode Active (Spark Plan): Live Gemini Copilot requires the Express API backend and is paused on static Firebase Hosting. Your Lead Qualifier, Keyword Rules, Firestore Sync, and JSON Backup/Restore remain fully active.'
          }
        ]);
        return;
      }

      if (authToken) {
        try {
          const res = await fetch('/api/copilot/history', {
            headers: { Authorization: `Bearer ${authToken}` }
          });
          const parsed = await parseJsonApiResponse<{ history?: ChatMessage[] }>(res);
          if (parsed.ok && parsed.data?.history && Array.isArray(parsed.data.history) && parsed.data.history.length > 0) {
            setMessages(parsed.data.history);
            return;
          }
        } catch (err) {
          console.warn('Could not load chat history:', err);
        }
      }

      // Default welcome message if empty
      setMessages([
        {
          role: 'model',
          content:
            "Hi Nicole! I'm your Purpose & Glow Diagnostic Copilot. Select any candidate to analyze their duty-vs-contribution gap, draft custom outreach, or pick the perfect package."
        }
      ]);
    }

    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, authToken, staticHosting]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    if (staticHosting) return;
    const text = textToSend || input.trim();
    if (!text || isLoading) return;

    setInput('');
    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: text,
          history: messages,
          currentLead: selectedLead
            ? {
                id: selectedLead.id,
                personName: selectedLead.personName,
                headline: selectedLead.headline,
                location: selectedLead.location,
                yearsExperience: selectedLead.yearsExperience,
                rawText: selectedLead.rawText,
                detectedCluster: selectedLead.detectedCluster,
                effectivePackage: selectedLead.effectivePackage
              }
            : null
        })
      });

      if (res.status === 401 || res.status === 403) {
        throw new Error('Admin Firebase Google Sign-In session expired or unauthorized.');
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const replyText =
        data.reply ||
        'I have analyzed this signal against Nicole’s Purpose & Glow positioning framework.';

      setMessages((prev) => [...prev, { role: 'model', content: replyText }]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content:
            err?.message && err.message.includes('Admin Firebase')
              ? err.message
              : 'Sorry Nicole, I ran into a connection issue. Remember her core principle: focus on what time they saved, errors they reduced, or revenue they protected!'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-white border-l border-slate-200 shadow-2xl flex flex-col">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-teal-900 text-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-800 border border-teal-700 flex items-center justify-center text-teal-200">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              Diagnostic Copilot
              <span className="text-[10px] bg-teal-800 text-teal-200 px-1.5 py-0.2 rounded font-mono font-normal">
                Gemini
              </span>
            </h2>
            <p className="text-[11px] text-teal-200 truncate">
              Purpose &amp; Glow Career Solutions Strategist
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Diagnostic Copilot"
          className="p-1.5 text-teal-200 hover:text-white hover:bg-teal-800 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Selected Candidate Context Banner */}
      {selectedLead && (
        <div className="px-4 py-2.5 bg-teal-50/80 border-b border-teal-100 flex items-center justify-between text-xs">
          <div className="truncate mr-2">
            <span className="text-slate-500">Active Candidate: </span>
            <span className="font-semibold text-teal-950">{selectedLead.personName}</span>
            <span className="text-slate-500 font-mono text-[11px] ml-1.5">
              ({selectedLead.effectivePackage.priceDisplay})
            </span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-teal-800 font-medium border border-teal-200 shrink-0">
            {selectedLead.detectedCluster || 'ICP Target'}
          </span>
        </div>
      )}

      {/* Message Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'model' && (
              <div className="w-7 h-7 rounded-full bg-teal-100 border border-teal-200 text-teal-800 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl p-3 leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-teal-900 text-white rounded-tr-none'
                  : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-none whitespace-pre-wrap'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-7 h-7 rounded-full bg-teal-100 border border-teal-200 text-teal-800 flex items-center justify-center shrink-0">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-500 italic">
              Analyzing candidate against Purpose &amp; Glow conversion framework...
            </div>
          </div>
        )}
      </div>

      {/* Quick Prompts Bar */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 space-y-1.5">
        <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-600" />
          One-Click Diagnostic Prompts:
        </span>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              disabled={isLoading || staticHosting}
              className="text-[11px] text-slate-700 bg-white hover:bg-teal-50 hover:text-teal-900 border border-slate-200 hover:border-teal-200 px-2 py-1 rounded-md text-left transition-colors cursor-pointer disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Bar */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={staticHosting}
            placeholder={
              staticHosting
                ? 'Copilot paused on static hosting (Express API required)...'
                : 'Ask Copilot to diagnose this candidate...'
            }
            className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-700 disabled:opacity-60"
          />
          <button
            type="submit"
            aria-label="Send prompt"
            disabled={!input.trim() || isLoading || staticHosting}
            className="p-2 bg-teal-900 hover:bg-teal-950 text-white rounded-lg disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
