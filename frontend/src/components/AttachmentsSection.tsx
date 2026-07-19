/**
 * AttachmentsSection — file attachment management for a flight log entry.
 *
 * Renders a collapsible section inside the EntryForm that lets the user:
 *   - View existing attachments (filename, size, upload date)
 *   - Attach new files
 *   - Download attachments (via the API, which returns Content-Disposition)
 *   - Delete attachments (with confirmation)
 *
 * Behaviour depends on whether the flight has been saved yet:
 *   - **Saved flight** (flightId != null): files upload immediately via the
 *     attachments API, and downloads are available.
 *   - **Unsaved flight** (flightId == null): selected files are *staged*
 *     locally and handed to the parent form via `onStagedFilesChange`. They
 *     are submitted together with the flight in a single request when the
 *     form is saved — just like the time category fields.
 *
 * @module components/AttachmentsSection
 */

import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { Attachment } from "../api/types";

/** Maximum file size the backend accepts (25 MB). Shown in the UI as a hint. */
const MAX_FILE_SIZE_MB = 25;

/** Human-readable file size formatting (e.g. "2.3 MB"). */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format an ISO 8601 timestamp to a short localised date string. */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Paperclip icon used as the section header / indicator. */
export function PaperclipIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
      />
    </svg>
  );
}

interface AttachmentsSectionProps {
  /** The flight whose attachments to manage. If null, files are staged locally
   *  and submitted with the flight when the form is saved. */
  flightId: number | null;
  /** Called whenever the staged (not-yet-uploaded) file list changes. Only
   *  used when flightId is null. */
  onStagedFilesChange?: (files: File[]) => void;
  /** When true, clears any staged files (used after a successful save). */
  clearStaged?: boolean;
}

export default function AttachmentsSection({ flightId, onStagedFilesChange, clearStaged }: AttachmentsSectionProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasFlight = flightId != null;

  // Notify the parent whenever the staged list changes (unsaved-flight mode).
  useEffect(() => {
    if (!hasFlight) {
      onStagedFilesChange?.(stagedFiles);
    }
  }, [stagedFiles, hasFlight, onStagedFilesChange]);

  // Clear staged files when the parent signals a successful save.
  useEffect(() => {
    if (clearStaged) {
      setStagedFiles([]);
    }
  }, [clearStaged]);

  // Fetch attachments on mount (only when we have a real flight ID)
  useEffect(() => {
    if (flightId == null) {
      setAttachments([]);
      setLoading(false);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .listAttachments(flightId)
      .then((atts) => {
        if (!cancelled) {
          setAttachments(atts);
          setLoading(false);
          // Auto-open if there are attachments
          if (atts.length > 0) setIsOpen(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [flightId]);

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`"${file.name}" exceeds the ${MAX_FILE_SIZE_MB} MB limit.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setError("");

    if (hasFlight) {
      // Saved flight — upload immediately.
      setUploading(true);
      try {
        const att = await api.uploadAttachment(flightId, file);
        setAttachments((prev) => [...prev, att]);
        setIsOpen(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    } else {
      // Unsaved flight — stage locally; it will be submitted with the form.
      setStagedFiles((prev) => [...prev, file]);
      setIsOpen(true);
    }
    // Reset the file input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = async (att: Attachment) => {
    try {
      await api.downloadAttachment(att.id, att.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  };

  const handleDelete = async (att: Attachment) => {
    if (!confirm(`Delete "${att.filename}"?`)) return;
    try {
      await api.deleteAttachment(att.id);
      setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleRemoveStaged = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const totalCount = attachments.length + stagedFiles.length;

  return (
    <div className="border border-gray-200 rounded-lg dark:border-zinc-400">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-700 rounded-lg transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-white">
          <PaperclipIcon />
          Attachments
          {totalCount > 0 && (
            <span className="inline-flex items-center justify-center bg-blue-100 text-blue-700 text-xs font-semibold rounded-full w-5 h-5 dark:bg-blue-800 dark:text-blue-100">
              {totalCount}
            </span>
          )}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable body */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          {/* Hint for unsaved flights */}
          {!hasFlight && (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              Files chosen here will be uploaded when you save the flight.
            </p>
          )}

          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 bg-red-100 text-red-700 px-3 py-2 rounded-lg text-sm">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Loading skeleton */}
          {hasFlight && loading && (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="skeleton h-10 w-full rounded-lg" />
              ))}
            </div>
          )}

          {/* Saved attachment list */}
          {hasFlight && !loading && attachments.length > 0 && (
            <ul className="space-y-1.5">
              {attachments.map((att) => (
                <li
                  key={att.id}
                  className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-zinc-700 rounded-lg px-3 py-2 group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                      {att.filename}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {formatSize(att.size)} &middot; {formatDate(att.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Download */}
                    <button
                      type="button"
                      onClick={() => handleDownload(att)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors"
                      title="Download"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleDelete(att)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Staged (not-yet-uploaded) file list */}
          {stagedFiles.length > 0 && (
            <ul className="space-y-1.5">
              {stagedFiles.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-2 bg-amber-50 dark:bg-zinc-700 border border-amber-200 dark:border-zinc-600 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {formatSize(file.size)} &middot; will upload on save
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRemoveStaged(index)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 transition-colors"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Empty state */}
          {((hasFlight && !loading && attachments.length === 0 && stagedFiles.length === 0) ||
            (!hasFlight && stagedFiles.length === 0)) && (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              No files attached yet.
            </p>
          )}

          {/* Upload area */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFilePicked}
              className="hidden"
              id={`file-upload-${flightId ?? "new"}`}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:text-blue-400 dark:border-blue-600 dark:hover:bg-blue-900"
            >
              {uploading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Attach File
                </>
              )}
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Max {MAX_FILE_SIZE_MB} MB
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
