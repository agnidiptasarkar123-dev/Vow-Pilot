import React, { useState } from 'react';
import { useEvent } from '../../context/EventContext';
import { formatCurrency } from '../../domain/currency';
import {
  Bot,
  Check,
  CornerDownLeft,
  Info,
  Sparkles,
  User,
} from 'lucide-react';

export const AssistantView: React.FC = () => {
  const {
    state,
    sendAssistantMessage,
    applyProposedAction,
    dismissProposedAction,
  } = useEvent();

  const [inputPrompt, setInputPrompt] = useState('');

  const quickPrompts = [
    'Explain my current budget',
    'Change guest count to 175',
    'Suggest ways to reduce expenses',
    'Protect my highest-priority category',
    'Find tasks that are overdue',
    'Explain which tasks are blocked',
    'Compare vendor quotations',
    'Identify missing vendor information',
    'Summarize the current event plan',
  ];

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputPrompt;
    if (!text.trim()) return;
    sendAssistantMessage(text.trim());
    setInputPrompt('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Header & Transparency Notice */}
      <div className="bg-white p-6 rounded-xl border border-[#E6DFD5] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#1C1917] font-serif-heading">
              Context-Aware Planning Coordinator
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF0EB] text-[#A2421D] font-bold border border-[#F3CEBE] uppercase">
              Rule-Based Engine
            </span>
          </div>
          <p className="text-xs text-[#78716C] mt-1">
            Deterministic decision analysis powered strictly by your active event data, constraints, and priorities.
          </p>
        </div>

        <div className="p-2.5 bg-[#FAF8F5] border border-[#E6DFD5] rounded-lg text-xs text-[#5C554E] max-w-sm flex items-start gap-2">
          <Info className="w-4 h-4 text-[#A2421D] shrink-0 mt-0.5" />
          <span>
            <strong>Deterministic Guarantee:</strong> No hallucinated quotes, fake vendor reviews, or unverified claims.
          </span>
        </div>
      </div>

      {/* Suggested Command Chips */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-[#5C554E] block">
          Documented Planning Commands:
        </span>
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((promptText) => (
            <button
              key={promptText}
              type="button"
              onClick={() => handleSend(promptText)}
              className="px-3 py-1.5 rounded-lg text-xs bg-white hover:bg-[#FAF0EB] text-[#1C1917] hover:text-[#A2421D] border border-[#E6DFD5] hover:border-[#F3CEBE] transition shadow-2xs font-medium"
            >
              "{promptText}"
            </button>
          ))}
        </div>
      </div>

      {/* Message Feed Container */}
      <div className="bg-white rounded-xl border border-[#E6DFD5] shadow-xs overflow-hidden flex flex-col h-[520px]">
        {/* Messages Scroll Area */}
        <div className="flex-1 p-6 overflow-y-auto space-y-5 divide-y divide-[#F4EFEA]/60">
          {state.messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`pt-5 first:pt-0 flex items-start gap-3 ${
                  isUser ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar Icon */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    isUser
                      ? 'bg-[#1C1917] text-white'
                      : 'bg-[#A2421D] text-white font-serif'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Content Bubble */}
                <div
                  className={`max-w-[85%] rounded-xl p-4 text-xs space-y-3 ${
                    isUser
                      ? 'bg-[#1C1917] text-white'
                      : 'bg-[#FAF8F5] text-[#1C1917] border border-[#E6DFD5]'
                  }`}
                >
                  {/* Markdown formatted text */}
                  <div className="prose prose-xs max-w-none space-y-2 leading-relaxed">
                    {msg.content.split('\n\n').map((paragraph, pIdx) => {
                      if (paragraph.startsWith('### ')) {
                        return (
                          <h4 key={pIdx} className="font-bold text-sm text-[#1C1917] pt-1">
                            {paragraph.replace('### ', '')}
                          </h4>
                        );
                      }
                      if (paragraph.startsWith('#### ')) {
                        return (
                          <h5 key={pIdx} className="font-bold text-xs text-[#5C554E] pt-1">
                            {paragraph.replace('#### ', '')}
                          </h5>
                        );
                      }
                      if (paragraph.startsWith('* ')) {
                        const items = paragraph.split('\n* ');
                        return (
                          <ul key={pIdx} className="list-disc list-inside space-y-1">
                            {items.map((it, itIdx) => (
                              <li key={itIdx}>
                                <span dangerouslySetInnerHTML={{ __html: formatInline(it.replace('* ', '')) }} />
                              </li>
                            ))}
                          </ul>
                        );
                      }
                      return (
                        <p
                          key={pIdx}
                          dangerouslySetInnerHTML={{ __html: formatInline(paragraph) }}
                        />
                      );
                    })}
                  </div>

                  {/* Rationale Footer */}
                  {msg.rationale && (
                    <div className="pt-2 border-t border-[#EAE4DB] text-[10px] text-[#78716C] italic">
                      Basis: {msg.rationale}
                    </div>
                  )}

                  {/* Structured Action Proposal Card */}
                  {msg.proposedAction && msg.requiresConfirmation && (
                    <div className="p-3.5 bg-white border border-[#E6DFD5] rounded-lg space-y-2.5 mt-2 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1C1917] text-xs flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#A2421D]" />
                          Proposed Plan Action: {msg.proposedAction.summary}
                        </span>
                        {msg.actionStatus === 'applied' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ Applied
                          </span>
                        )}
                        {msg.actionStatus === 'rejected' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                            Dismissed
                          </span>
                        )}
                      </div>

                      {/* Financial Impact Preview */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#FAF8F5] p-2.5 rounded border border-[#F4EFEA] font-mono">
                        <div>
                          <span className="text-[#78716C] block">Net Difference</span>
                          <span
                            className={`font-bold ${
                              msg.proposedAction.impact.difference > 0
                                ? 'text-[#BE123C]'
                                : 'text-[#047857]'
                            }`}
                          >
                            {msg.proposedAction.impact.difference >= 0 ? '+' : ''}
                            {formatCurrency(msg.proposedAction.impact.difference, state.event.currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#78716C] block">Revised Runway</span>
                          <span className="font-bold text-[#1C1917]">
                            {formatCurrency(msg.proposedAction.impact.remainingBudget, state.event.currency)}
                          </span>
                        </div>
                      </div>

                      {msg.actionStatus === 'pending' && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => dismissProposedAction(msg.id)}
                            className="px-3 py-1.5 rounded text-neutral-600 hover:text-black font-medium text-xs transition"
                          >
                            Dismiss
                          </button>
                          <button
                            type="button"
                            onClick={() => applyProposedAction(msg.id, msg.proposedAction!)}
                            className="px-3.5 py-1.5 rounded bg-[#A2421D] hover:bg-[#863414] text-white font-semibold text-xs shadow-xs transition flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Confirm & Apply
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-[#E6DFD5] bg-[#FAF8F5] flex items-center gap-2">
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a planning command, e.g. 'Explain my current budget' or 'Change guest count to 160'..."
            className="flex-1 text-xs px-3.5 py-2.5 bg-white border border-[#D5CCC0] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#A2421D] text-[#1C1917]"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!inputPrompt.trim()}
            className="px-4 py-2.5 bg-[#A2421D] hover:bg-[#863414] disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <span>Ask</span>
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

function formatInline(str: string): string {
  return str
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}
