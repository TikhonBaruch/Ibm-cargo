"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import NextImage from "next/image";

interface UploadedFile {
  url: string;
  name: string;
}

interface FileUploadProps {
  folder?: string;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  onUpload: (urls: string[]) => void;
  className?: string;
}

export function FileUpload({
  folder = "uploads",
  accept = "image/*",
  multiple = false,
  maxFiles = 10,
  onUpload,
  className = "",
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      return { url: data.url, name: file.name };
    } catch {
      return null;
    }
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList).slice(0, maxFiles - files.length);
    if (newFiles.length === 0) return;

    setUploading(true);
    const results = await Promise.all(newFiles.map(uploadFile));
    const successful = results.filter(Boolean) as UploadedFile[];

    const updated = [...files, ...successful];
    setFiles(updated);
    onUpload(updated.map((f) => f.url));
    setUploading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList) handleFiles(fileList);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleRemove = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    onUpload(updated.map((f) => f.url));
  };

  const handleClear = () => {
    setFiles([]);
    onUpload([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={className}>
      {/* Uploaded files grid */}
      {files.length > 0 && (
        <div className="mb-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Загружено: {files.length} {multiple ? `из ${maxFiles}` : ""}
            </span>
            {multiple && files.length > 1 && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Очистить всё
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {files.map((file, i) => (
              <div key={i} className="group relative">
                <div className="aspect-square overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                  {file.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <NextImage
                      src={file.url}
                      alt={file.name}
                      width={200}
                      height={200}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-slate-600" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-0.5 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="mt-1 truncate text-[10px] text-slate-500">
                  {file.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drop zone */}
      {(!multiple || files.length < maxFiles) && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-sm transition ${
            dragOver
              ? "border-slate-500 bg-slate-800/50 text-slate-200"
              : "border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600 hover:text-slate-300"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading
            ? "Загрузка..."
            : multiple
              ? "Нажмите или перетащите файлы"
              : "Нажмите или перетащите файл"}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
