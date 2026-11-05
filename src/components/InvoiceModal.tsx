import React from 'react';
import { X, Printer, Download, CheckCircle2, FileText } from 'lucide-react';
import { Project } from '../types';

interface InvoiceModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  project,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const invoiceNo = `ZK-${project.id.slice(-6).toUpperCase()}-${new Date().getFullYear()}`;
  const isPaid = project.status === 'paid_unlocked';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white text-neutral-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Actions bar (Screen only) */}
        <div className="p-3.5 bg-neutral-100 border-b border-neutral-200 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
            <FileText className="w-4 h-4 text-amber-600" />
            <span>Freelance Service Invoice</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs px-3 py-1.5 rounded-lg transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded-lg hover:bg-neutral-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Document */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-sm">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-neutral-200 pb-5">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-neutral-900">
                ZIK<span className="text-amber-600">RO</span>
              </h1>
              <p className="text-xs text-neutral-500 mt-0.5">Freelance Creative & Video Editing Services</p>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold text-xs text-neutral-800">INVOICE #{invoiceNo}</div>
              <div className="text-xs text-neutral-500 mt-0.5">Date: {new Date().toLocaleDateString('en-IN')}</div>
              {isPaid ? (
                <div className="inline-block mt-2 bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-bold text-[11px]">
                  PAID IN FULL
                </div>
              ) : (
                <div className="inline-block mt-2 bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-bold text-[11px]">
                  PAYMENT DUE
                </div>
              )}
            </div>
          </div>

          {/* Billed To / From */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="font-semibold text-neutral-400 uppercase tracking-wider text-[10px] mb-1">
                Issued By (Editor)
              </div>
              <div className="font-bold text-neutral-800">{project.upiPayeeName}</div>
              <div className="font-mono text-neutral-600">UPI: {project.upiId}</div>
              <div className="text-neutral-500">Freelance Video Editor / Designer</div>
            </div>

            <div>
              <div className="font-semibold text-neutral-400 uppercase tracking-wider text-[10px] mb-1">
                Billed To (Client)
              </div>
              <div className="font-bold text-neutral-800">{project.clientName}</div>
              <div className="text-neutral-600">{project.clientPhone || 'Client Phone'}</div>
              <div className="text-neutral-500">{project.clientEmail || 'Client Review Account'}</div>
            </div>
          </div>

          {/* Line Items Table */}
          <table className="w-full text-left text-xs border border-neutral-200 rounded-lg overflow-hidden">
            <thead className="bg-neutral-100 text-neutral-600 font-semibold uppercase text-[10px]">
              <tr>
                <th className="p-3">Description</th>
                <th className="p-3 text-center">Type</th>
                <th className="p-3 text-right">Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              <tr>
                <td className="p-3">
                  <div className="font-semibold text-neutral-900">{project.title}</div>
                  <div className="text-[11px] text-neutral-500">
                    Video editing, timeline cuts, sound design, color grading & master file release
                  </div>
                </td>
                <td className="p-3 text-center capitalize">{project.type} ({project.aspectRatio})</td>
                <td className="p-3 text-right font-mono font-semibold">₹{project.amountINR.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
            <tfoot className="bg-neutral-50 border-t border-neutral-200 font-bold">
              <tr>
                <td colSpan={2} className="p-3 text-right">Total Payable:</td>
                <td className="p-3 text-right font-mono text-base text-neutral-900">
                  ₹{project.amountINR.toLocaleString('en-IN')}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Payment Terms & Notes */}
          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-xs space-y-1">
            <div className="font-semibold text-neutral-800">Settlement Note:</div>
            <p className="text-neutral-600 text-[11px] leading-relaxed">
              * Payment is settled directly to editor's verified UPI account.
              Upon confirmation, original high-definition watermark-free master exports and intellectual delivery rights are granted to the client.
            </p>
            {project.paymentDetails?.utrNumber && (
              <div className="pt-1 font-mono text-[10px] text-emerald-700">
                Transaction Reference: {project.paymentDetails.utrNumber}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
