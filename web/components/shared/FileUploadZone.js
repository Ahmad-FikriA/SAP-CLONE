'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FileUploadZone({ onFile, accept = '.xlsx', label = 'Drag & drop file di sini, atau klik untuk memilih' }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function handleChange(e) {
    const file = e.target.files[0];
    if (file) {
      onFile(file);
      // Reset so same file can be re-selected
      e.target.value = '';
    }
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors',
        dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
      )}
    >
      <Upload size={32} className="text-gray-400" />
      <p className="text-sm text-gray-500 text-center">{label}</p>
      <p className="text-xs text-gray-400">Format: {accept}</p>
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />
    </div>
  );
}
