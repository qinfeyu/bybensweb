import React, { useState } from 'react';
import { MessageCircle, Phone, Copy, Check } from 'lucide-react';
import { getWhatsAppUrl } from '../lib/whatsapp';

interface PhoneContactActionProps {
  phone?: string;
  customerName?: string;
  message?: string;
  className?: string;
  showPhoneText?: boolean;
}

export const PhoneContactAction: React.FC<PhoneContactActionProps> = ({
  phone,
  customerName = '',
  message = '',
  className = '',
  showPhoneText = true
}) => {
  const [copied, setCopied] = useState(false);

  if (!phone) return <span className="text-slate-400">—</span>;

  const waUrl = getWhatsAppUrl(phone, message);

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!phone) return;

    const copyText = phone.trim();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(copyText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        fallbackCopy(copyText);
      });
    } else {
      fallbackCopy(copyText);
    }
  };

  const fallbackCopy = (text: string) => {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {}
    document.body.removeChild(input);
  };

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {showPhoneText && (
        <button
          type="button"
          onClick={handleCopyPhone}
          className="font-semibold text-slate-700 hover:text-blue-700 flex items-center gap-1 text-xs transition-colors cursor-pointer group px-1.5 py-0.5 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200"
          title="Click to copy phone number to clipboard"
        >
          <span>{phone}</span>
          {copied ? (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded flex items-center gap-0.5 animate-in fade-in">
              <Check className="w-3 h-3 text-emerald-600" /> Copied!
            </span>
          ) : (
            <Copy className="w-3 h-3 text-slate-400 group-hover:text-blue-600 transition-colors opacity-70 group-hover:opacity-100" />
          )}
        </button>
      )}

      {/* 1-Tap WhatsApp Button */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shrink-0 active:scale-95 shadow-2xs"
        title={`Send WhatsApp message to ${customerName || phone}`}
      >
        <MessageCircle className="w-3 h-3 text-emerald-600 fill-emerald-600/20" />
        <span className="hidden sm:inline">WhatsApp</span>
      </a>

      {/* 1-Tap Direct Call Button */}
      <a
        href={`tel:${phone}`}
        className="p-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shrink-0 active:scale-95 shadow-2xs"
        title={`Call ${phone}`}
      >
        <Phone className="w-3 h-3 text-blue-600" />
      </a>
    </div>
  );
};
