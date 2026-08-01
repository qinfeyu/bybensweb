import React from 'react';
import { MessageCircle, Phone } from 'lucide-react';
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
  if (!phone) return <span className="text-slate-400">—</span>;

  const waUrl = getWhatsAppUrl(phone, message);

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {showPhoneText && (
        <a
          href={`tel:${phone}`}
          className="font-semibold text-slate-700 hover:text-blue-700 flex items-center gap-1 text-xs transition-colors"
          title={`Call ${phone}`}
        >
          <span>{phone}</span>
        </a>
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
