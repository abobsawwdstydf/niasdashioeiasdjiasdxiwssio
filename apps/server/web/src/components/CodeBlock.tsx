import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  language?: string;
  code: string;
}

export default function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-white/10 bg-[#0d0d0d]">
      {/* Header: language label + copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
        <span className="text-xs text-zinc-500 font-mono">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
        >
          {copied ? (
            <>
              <Check size={12} className="text-emerald-400" />
              <span className="text-emerald-400">Скопировано</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Копировать</span>
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code className={`language-${language || 'text'} text-zinc-300 font-mono`}>
          {code}
        </code>
      </pre>
    </div>
  );
}
