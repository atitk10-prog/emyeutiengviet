import React from 'react';
import { BookOpen, X, Sparkles, Lightbulb } from 'lucide-react';
import { VocabularyItem } from '@emytv/shared';

interface VocabModalProps {
  item: VocabularyItem | null;
  onClose: () => void;
}

export const VocabularyModal: React.FC<VocabModalProps> = ({ item, onClose }) => {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border-4 border-amber-300 relative transform transition-all animate-gentle-bounce">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
              Khám phá từ khó
            </span>
            <h3 className="text-2xl font-black text-slate-800">{item.word}</h3>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200">
            <div className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-600" />
              <span>Nghĩa của từ:</span>
            </div>
            <p className="text-slate-800 font-semibold text-base leading-relaxed">
              {item.meaning}
            </p>
          </div>

          {item.example && (
            <div className="bg-sky-50 p-3.5 rounded-2xl border border-sky-200">
              <div className="text-xs font-bold text-sky-700 mb-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                <span>Ví dụ câu:</span>
              </div>
              <p className="text-slate-700 italic text-sm">
                "{item.example}"
              </p>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-950 font-black rounded-2xl shadow-md transition active:scale-95 text-base flex items-center justify-center gap-2"
        >
          <span>Em đã hiểu rồi!</span>
          <Sparkles className="w-4 h-4 text-amber-900" />
        </button>
      </div>
    </div>
  );
};
