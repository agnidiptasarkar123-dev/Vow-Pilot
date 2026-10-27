import React, { useState } from 'react';
import { useEvent } from '../../context/EventContext';
import { formatCurrency } from '../../domain/currency';
import {
  Bot,
  Check,
  CornerDownLeft,
  Info,
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
      <div className="bg-surface p-6 rounded-xl border border-subtle shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-primary font-serif-heading">
              Context-Aware Planning Coordinator
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-subtle text-accent dark:text-[#D48668] font-bold border border-subtle uppercase">
              Rule-Based Engine
            </span>
          </div>
          <p className="text-xs text-secondary mt-1">
            Deterministic decision analysis powered strictly by your active event data, constraints, and priorities.
          </p>
        </div>

        <div className="p-2.5 bg-subtle border border-subtle rounded-lg text-xs text-secondary max-w-sm flex items-start gap-2">
          <Info className="w-4 h-4 text-accent dark:text-[#D48668] shrink-0 mt-0.5" />
          <span>
            <strong>Deterministic Guarantee:</strong> No hallucinated quotes, fake vendor reviews, or unverified claims.
          </span>
        </div>
      </div>

      {/* Suggested Command Chips */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-secondary block">
          Documented Planning Commands:
        </span>
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((promptText) => (
            <button
              key={promptText}
              type="button"
              onClick={() => handleSend(promptText)}
              className="px-3 py-1.5 rounded-lg text-xs bg-surface hover:bg-subtle text-primary hover:text-[#B85C3A] dark:hover:text-[#D48668] border border-subtle transition shadow-2xs font-medium cursor-pointer"
            >
              "{promptText}"
            </button>
          ))}
        </div>
      </div>

      {/* Message Feed Container */}
      <div className="bg-surface rounded-xl border border-subtle shadow-xs overflow-hidden flex flex-col h-[520px]">
        {/* Messages Scroll Area */}
        <div
          role="log"
          aria-live="polite"
          aria-atomic="false"
          aria-label="Planning assistant conversation history"
          tabIndex={0}
          className="flex-1 p-6 overflow-y-auto space-y-5 divide-y divide-subtle/60 focus:outline-hidden"
        >
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
                      ? 'bg-[#26221F] dark:bg-[#3D353B] text-white dark:text-[#F1E9E3]'
                      : 'bg-[#B85C3A] dark:bg-[#D48668] text-white font-serif'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Content Bubble */}
                <div
                  className={`max-w-[85%] rounded-xl p-4 text-xs space-y-3 ${
                    isUser
                      ? 'bg-[#26221F] dark:bg-[#3D353B] text-white dark:text-[#F1E9E3] border border-transparent dark:border-subtle'
                      : 'bg-subtle text-primary border border-subtle'
                  }`}
                >
                  {/* Markdown formatted text (rendered safely without dangerouslySetInnerHTML) */}
                  <div className="prose prose-xs max-w-none space-y-2 leading-relaxed">
                    {msg.content.split('\n\n').map((paragraph, pIdx) => {
                      if (paragraph.startsWith('### ')) {
                        return (
                          <h4 key={pIdx} className="font-bold text-sm text-primary pt-1 font-serif-heading">
                            {paragraph.replace('### ', '')}
                          </h4>
                        );
                      }
                      if (paragraph.startsWith('#### ')) {
                        return (
                          <h5 key={pIdx} className="font-bold text-xs text-secondary pt-1">
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
                                <span>{renderSafeInline(it.replace(/^\*\s*/, ''))}</span>
                              </li>
                            ))}
                          </ul>
                        );
                      }
                      return (
                        <p key={pIdx}>
                          {renderSafeInline(paragraph)}
                        </p>
                      );
                    })}
                  </div>

                  {/* Rationale Footer */}
                  {msg.rationale && (
                    <div className="pt-2 border-t border-subtle text-[10px] text-tertiary italic">
                      Basis: {msg.rationale}
                    </div>
                  )}

                  {/* Structured Action Proposal Card */}
                  {msg.proposedAction && msg.requiresConfirmation && (
                    <div className="p-3.5 bg-subtle border border-subtle rounded-lg space-y-2.5 mt-2 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-primary text-xs flex items-center gap-1.5">
                          <Bot className="w-3.5 h-3.5 text-[#B85C3A] dark:text-[#D48668]" />
                          Proposed Plan Action: {msg.proposedAction.summary}
                        </span>
                        {msg.actionStatus === 'applied' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            ✓ Applied
                          </span>
                        )}
                        {msg.actionStatus === 'rejected' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-subtle text-secondary">
                            Dismissed
                          </span>
                        )}
                      </div>

                      {/* Financial Impact Preview */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-surface p-2.5 rounded border border-subtle font-mono">
                        <div>
                          <span className="text-secondary block">Net Difference</span>
                          <span
                            className={`font-bold ${
                              msg.proposedAction.impact.difference > 0
                                ? 'text-[#BE123C] dark:text-rose-400'
                                : 'text-[#047857] dark:text-emerald-400'
                            }`}
                          >
                            {msg.proposedAction.impact.difference >= 0 ? '+' : ''}
                            {formatCurrency(msg.proposedAction.impact.difference, state.event.currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-secondary block">Revised Runway</span>
                          <span className="font-bold text-primary">
                            {formatCurrency(msg.proposedAction.impact.remainingBudget, state.event.currency)}
                          </span>
                        </div>
                      </div>

                      {msg.actionStatus === 'pending' && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => dismissProposedAction(msg.id)}
                            className="px-3 py-1.5 rounded text-secondary hover:text-primary font-medium text-xs transition cursor-pointer"
                            aria-label={`Dismiss proposed action: ${msg.proposedAction.summary}`}
                          >
                            Dismiss
                          </button>
                          <button
                            type="button"
                            onClick={() => applyProposedAction(msg.id, msg.proposedAction!)}
                            className="px-3.5 py-1.5 rounded bg-[#B85C3A] hover:bg-[#9E4B2D] text-white font-semibold text-xs shadow-xs transition flex items-center gap-1 cursor-pointer"
                            aria-label={`Confirm and apply proposed action: ${msg.proposedAction.summary}`}
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
        <div className="p-4 border-t border-subtle bg-subtle flex items-center gap-2">
          <label htmlFor="assistant-prompt-input" className="sr-only">
            Planning command input
          </label>
          <input
            id="assistant-prompt-input"
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a planning command, e.g. 'Explain my current budget' or 'Change guest count to 160'..."
            aria-label="Planning command input"
            className="flex-1 text-xs px-3.5 py-2.5 bg-surface border border-subtle rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A] text-primary"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!inputPrompt.trim()}
            aria-label="Ask: Send planning command"
            className="px-4 py-2.5 bg-[#B85C3A] hover:bg-[#9E4B2D] disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <span>Ask</span>
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Safe tokenized markdown renderer that converts **bold** and *italic*
 * into React elements without invoking dangerouslySetInnerHTML.
 */
function renderSafeInline(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|\*[^*]+?\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={`b-${lastIndex}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push(
        <em key={`i-${lastIndex}`} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens.length > 0 ? tokens : [text];
}
