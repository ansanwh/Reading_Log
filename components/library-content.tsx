"use client";

import type { CSSProperties, ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export type ReadingLog = {
  id: string;
  title: string;
  totalPages: number;
  isPublic: boolean;
  entries: ReadingEntry[];
  finalSummary: string;
  finalReview: string;
  favoriteScene: string;
  favoriteSceneImage: string;
};

type ReadingStatus = "reading" | "finished";

type ReadingEntry = {
  id: string;
  date: string;
  note: string;
  currentPage: number;
};

type LibraryContentProps = {
  initialReadingLogs?: ReadingLog[];
  userId: string;
};

function getTodayDateInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createUuid() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getBookWidth(totalPages: number) {
  if (totalPages <= 0) {
    return 104;
  }

  return Math.min(160, Math.max(96, 88 + Math.round(totalPages / 7)));
}

function getReadingProgress(currentPage: number, totalPages: number) {
  if (totalPages <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100)));
}

function parsePageValue(value: string) {
  return Math.max(0, Number.parseInt(value, 10) || 0);
}

function getCurrentPageInputValues(entries: ReadingEntry[]) {
  return Object.fromEntries(entries.map((entry) => [entry.id, String(entry.currentPage)]));
}

function hasIncreasingCurrentPages(entries: ReadingEntry[]) {
  return entries.every((entry, index) => index === 0 || entry.currentPage >= entries[index - 1].currentPage);
}

function getReadingStatus(entries: ReadingEntry[], totalPages: number): ReadingStatus {
  const currentPage = entries.reduce((maximum, entry) => Math.max(maximum, entry.currentPage), 0);

  return totalPages > 0 && currentPage >= totalPages ? "finished" : "reading";
}

function matchesSearch(log: ReadingLog, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    log.title,
    log.finalSummary,
    log.finalReview,
    log.favoriteScene,
    ...log.entries.map((entry) => entry.note),
  ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
}

function resizeTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export function LibraryContent({ initialReadingLogs = [], userId }: LibraryContentProps) {
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>(initialReadingLogs);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(initialReadingLogs[0]?.id ?? null);
  const [draftLogId, setDraftLogId] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTotalPages, setDraftTotalPages] = useState(300);
  const [draftTotalPagesInput, setDraftTotalPagesInput] = useState("300");
  const [draftIsPublic, setDraftIsPublic] = useState(false);
  const [draftEntries, setDraftEntries] = useState<ReadingEntry[]>([]);
  const [draftCurrentPageInputs, setDraftCurrentPageInputs] = useState<Record<string, string>>({});
  const [draftFinalSummary, setDraftFinalSummary] = useState("");
  const [draftFinalReview, setDraftFinalReview] = useState("");
  const [draftFavoriteScene, setDraftFavoriteScene] = useState("");
  const [draftFavoriteSceneImage, setDraftFavoriteSceneImage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReadingStatus>("all");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [pendingFocusEntryId, setPendingFocusEntryId] = useState<string | null>(null);
  const entryTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const selectedLog = readingLogs.find((log) => log.id === selectedLogId);
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredReadingLogs = readingLogs.filter(
    (log) => matchesSearch(log, normalizedSearchQuery) && (statusFilter === "all" || getReadingStatus(log.entries, log.totalPages) === statusFilter),
  );
  const hasTitleChange = selectedLog ? draftTitle !== selectedLog.title : false;
  const isSelectedDraftLog = selectedLogId !== null && selectedLogId === draftLogId;
  const hasTotalPagesChange = selectedLog ? draftTotalPages !== selectedLog.totalPages : false;
  const hasEntriesChange = selectedLog ? JSON.stringify(draftEntries) !== JSON.stringify(selectedLog.entries) : false;
  const hasFinalChange = selectedLog
    ? draftFinalSummary !== selectedLog.finalSummary ||
      draftFinalReview !== selectedLog.finalReview ||
      draftFavoriteScene !== selectedLog.favoriteScene ||
      draftFavoriteSceneImage !== selectedLog.favoriteSceneImage ||
      draftIsPublic !== selectedLog.isPublic
    : false;
  const hasDraftChange = hasTitleChange || hasTotalPagesChange || hasEntriesChange || hasFinalChange;
  const hasValidTotalPages = draftTotalPages > 0;
  const hasValidCurrentPages = hasIncreasingCurrentPages(draftEntries);
  const hasRequiredBookInfo = draftTitle.trim().length > 0 && hasValidTotalPages;
  const hasAnyFinalContent =
    draftFinalSummary.trim().length > 0 ||
    draftFinalReview.trim().length > 0 ||
    draftFavoriteScene.trim().length > 0 ||
    draftFavoriteSceneImage.trim().length > 0;
  const hasRequiredFinalContent =
    !hasAnyFinalContent || (draftFinalSummary.trim().length > 0 && draftFinalReview.trim().length > 0);
  const canConfirm =
    !isSaving &&
    hasDraftChange &&
    hasValidTotalPages &&
    hasValidCurrentPages &&
    hasRequiredFinalContent &&
    (!isSelectedDraftLog || hasRequiredBookInfo);
  const hasDraftLog = draftLogId !== null;
  const isEditingSelectedLog = isSelectedDraftLog || (selectedLogId !== null && selectedLogId === editingLogId);
  const isWriting = hasDraftLog || isEditingSelectedLog || hasDraftChange;
  const bookDetailStateClassName = isEditingSelectedLog ? " writing" : getReadingStatus(draftEntries, draftTotalPages) === "finished" ? " completed" : "";

  useEffect(() => {
    setDraftTitle(selectedLog?.title ?? "");
    setDraftTotalPages(selectedLog?.totalPages ?? 300);
    setDraftTotalPagesInput(String(selectedLog?.totalPages ?? 300));
    setDraftIsPublic(selectedLog?.isPublic ?? false);
    const selectedEntries = selectedLog?.entries ?? [];
    setDraftEntries(selectedEntries);
    setDraftCurrentPageInputs(getCurrentPageInputValues(selectedEntries));
    setDraftFinalSummary(selectedLog?.finalSummary ?? "");
    setDraftFinalReview(selectedLog?.finalReview ?? "");
    setDraftFavoriteScene(selectedLog?.favoriteScene ?? "");
    setDraftFavoriteSceneImage(selectedLog?.favoriteSceneImage ?? "");
  }, [selectedLog, selectedLogId]);

  useEffect(() => {
    document.querySelectorAll<HTMLTextAreaElement>(".book-detail textarea, .book-final-section textarea").forEach(resizeTextarea);
  }, [draftEntries, draftFinalSummary, draftFinalReview, draftFavoriteScene]);

  useEffect(() => {
    if (!pendingFocusEntryId) {
      return;
    }

    const textarea = entryTextareaRefs.current[pendingFocusEntryId];

    if (textarea) {
      textarea.focus();
      setPendingFocusEntryId(null);
    }
  }, [draftEntries, pendingFocusEntryId]);

  function addReadingLog() {
    if (isWriting) {
      return;
    }

    const firstEntryId = createUuid();
    const newLog = {
      id: createUuid(),
      title: "",
      totalPages: 300,
      isPublic: false,
      finalSummary: "",
      finalReview: "",
      favoriteScene: "",
      favoriteSceneImage: "",
      entries: [
        {
          id: firstEntryId,
          date: getTodayDateInputValue(),
          note: "",
          currentPage: 0,
        },
      ],
    };

    setReadingLogs((logs) => [...logs, newLog]);
    setSelectedLogId(newLog.id);
    setDraftLogId(newLog.id);
    setEditingLogId(newLog.id);
    setDraftTotalPagesInput(String(newLog.totalPages));
    setDraftCurrentPageInputs({ [firstEntryId]: "0" });
    setSaveError("");
  }

  async function confirmSelectedTitle() {
    if (!selectedLogId || !canConfirm) {
      return;
    }

    setIsSaving(true);
    setSaveError("");

    const nextLog = {
      id: selectedLogId,
      title: draftTitle,
      totalPages: draftTotalPages,
      isPublic: draftIsPublic,
      entries: draftEntries,
      finalSummary: draftFinalSummary,
      finalReview: draftFinalReview,
      favoriteScene: draftFavoriteScene,
      favoriteSceneImage: draftFavoriteSceneImage,
    };
    const supabase = createClient();
    const { error: logError } = await supabase.from("reading_logs").upsert({
      id: nextLog.id,
      user_id: userId,
      title: nextLog.title,
      total_pages: nextLog.totalPages,
      is_public: nextLog.isPublic,
      final_summary: nextLog.finalSummary,
      final_review: nextLog.finalReview,
      favorite_scene: nextLog.favoriteScene,
      favorite_scene_image: nextLog.favoriteSceneImage,
    });

    if (logError) {
      setIsSaving(false);
      setSaveError("독서 기록장을 저장하지 못했습니다.");
      return;
    }

    const { error: deleteEntriesError } = await supabase
      .from("reading_log_entries")
      .delete()
      .eq("reading_log_id", nextLog.id);

    if (deleteEntriesError) {
      setIsSaving(false);
      setSaveError("기존 단락을 정리하지 못했습니다.");
      return;
    }

    if (nextLog.entries.length > 0) {
      const { error: entriesError } = await supabase.from("reading_log_entries").insert(
        nextLog.entries.map((entry, index) => ({
          id: entry.id,
          reading_log_id: nextLog.id,
          entry_date: entry.date,
          note: entry.note,
          current_page: entry.currentPage,
          position: index,
        })),
      );

      if (entriesError) {
        setIsSaving(false);
        setSaveError("단락을 저장하지 못했습니다.");
        return;
      }
    }

    setReadingLogs((logs) =>
      logs.map((log) =>
        log.id === selectedLogId
          ? nextLog
          : log,
      ),
    );
    setDraftLogId((id) => (id === selectedLogId ? null : id));
    setEditingLogId((id) => (id === selectedLogId ? null : id));
    setIsSaving(false);
  }

  function updateDraftEntry(entryId: string, fields: Partial<Omit<ReadingEntry, "id">>) {
    setDraftEntries((entries) => entries.map((entry) => (entry.id === entryId ? { ...entry, ...fields } : entry)));
  }

  function addDraftEntry() {
    const newEntryId = createUuid();
    const currentPage = draftEntries.at(-1)?.currentPage ?? 0;

    setDraftEntries((entries) => [
      ...entries,
      {
        id: newEntryId,
        date: getTodayDateInputValue(),
        note: "",
        currentPage,
      },
    ]);
    setDraftCurrentPageInputs((inputs) => ({ ...inputs, [newEntryId]: String(currentPage) }));
    setPendingFocusEntryId(newEntryId);
  }

  function deleteDraftEntry(entryId: string) {
    if (!window.confirm("이 단락을 삭제할까요?")) {
      return;
    }

    setDraftEntries((entries) => entries.filter((entry) => entry.id !== entryId));
    setDraftCurrentPageInputs((inputs) => {
      const { [entryId]: _deleted, ...rest } = inputs;

      return rest;
    });
  }

  function handleEntryNoteChange(entryId: string, event: ChangeEvent<HTMLTextAreaElement>) {
    resizeTextarea(event.currentTarget);
    updateDraftEntry(entryId, { note: event.currentTarget.value });
  }

  function cancelDraftChange() {
    if (!selectedLogId || !selectedLog) {
      return;
    }

    if (isSelectedDraftLog) {
      setReadingLogs((logs) => logs.filter((log) => log.id !== selectedLogId));
      setSelectedLogId(null);
      setDraftLogId(null);
      setEditingLogId(null);
      setDraftTitle("");
      setDraftTotalPages(300);
      setDraftTotalPagesInput("300");
      setDraftIsPublic(false);
      setDraftEntries([]);
      setDraftCurrentPageInputs({});
      setDraftFinalSummary("");
      setDraftFinalReview("");
      setDraftFavoriteScene("");
      setDraftFavoriteSceneImage("");
      return;
    }

    setDraftTitle(selectedLog.title);
    setDraftTotalPages(selectedLog.totalPages);
    setDraftTotalPagesInput(String(selectedLog.totalPages));
    setDraftIsPublic(selectedLog.isPublic);
    setDraftEntries(selectedLog.entries);
    setDraftCurrentPageInputs(getCurrentPageInputValues(selectedLog.entries));
    setDraftFinalSummary(selectedLog.finalSummary);
    setDraftFinalReview(selectedLog.finalReview);
    setDraftFavoriteScene(selectedLog.favoriteScene);
    setDraftFavoriteSceneImage(selectedLog.favoriteSceneImage ?? "");
    setEditingLogId(null);
    setSaveError("");
  }

  function editSelectedLog() {
    if (!selectedLogId) {
      return;
    }

    setEditingLogId(selectedLogId);
    setSaveError("");
  }

  function handleFavoriteSceneImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const maxDimension = 1600;
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      setDraftFavoriteSceneImage(canvas.toDataURL("image/webp", 0.82));
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setSaveError("이미지를 읽지 못했습니다.");
    };
    image.src = objectUrl;
    event.target.value = "";
  }

  async function deleteSelectedLog() {
    if (!selectedLogId) {
      return;
    }

    if (!window.confirm("이 독서 기록장을 삭제할까요?")) {
      return;
    }

    if (!isSelectedDraftLog) {
      setIsSaving(true);
      setSaveError("");

      const supabase = createClient();
      const { error } = await supabase.from("reading_logs").delete().eq("id", selectedLogId);

      if (error) {
        setIsSaving(false);
        setSaveError("독서 기록장을 삭제하지 못했습니다.");
        return;
      }
    }

    setReadingLogs((logs) => logs.filter((log) => log.id !== selectedLogId));
    setDraftLogId((id) => (id === selectedLogId ? null : id));
    setEditingLogId((id) => (id === selectedLogId ? null : id));
    setSelectedLogId(null);
    setDraftTitle("");
    setDraftTotalPages(300);
    setDraftTotalPagesInput("300");
    setDraftIsPublic(false);
    setDraftEntries([]);
    setDraftCurrentPageInputs({});
    setDraftFinalSummary("");
    setDraftFinalReview("");
    setDraftFavoriteScene("");
    setDraftFavoriteSceneImage("");
    setIsSaving(false);
  }

  return (
    <main className="library-main">
      <section className="library-search" aria-label="내 독서 기록장 검색 및 상태 필터">
        <label className="main-search-label" htmlFor="library-book-search">
          내 책 검색
        </label>
        <input
          id="library-book-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="제목, 메모, 요약, 감상으로 검색"
        />
        <select aria-label="독서 상태 필터" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | ReadingStatus)}>
          <option value="all">전체 상태</option>
          <option value="reading">읽는 중</option>
          <option value="finished">완독</option>
        </select>
      </section>
      <section className="shelf-row" aria-label="독서 기록장 목록">
        {filteredReadingLogs.map((log) => {
          const isSelected = selectedLogId === log.id;
          const isEditing = draftLogId === log.id || editingLogId === log.id;
          const isCompleted = !isEditing;
          const isDimmed = selectedLogId !== null && !isSelected;
          const currentPage = log.entries.reduce((maxPage, entry) => Math.max(maxPage, entry.currentPage), 0);
          const progress = getReadingProgress(currentPage, log.totalPages);
          const bookStyle = { "--book-width": `${getBookWidth(log.totalPages)}px` } as CSSProperties;

          return (
            <button
              className={`shelf-book${isSelected ? " active" : ""}${isEditing ? " editing" : ""}${isCompleted ? " completed" : ""}${isDimmed ? " dimmed" : ""}`}
              type="button"
              key={log.id}
              style={bookStyle}
              disabled={isWriting && !isSelected}
              onClick={() => setSelectedLogId(log.id)}
            >
              <span className="shelf-book-title">{log.title.trim() || "책"}</span>
              <span className="shelf-progress" aria-label={`읽은 쪽수 ${progress}%`}>
                <span style={{ width: `${progress}%` }} />
              </span>
            </button>
          );
        })}
        <button className="shelf-book shelf-add-book" type="button" aria-label="독서 기록장 추가" onClick={addReadingLog} disabled={isWriting || isSaving}>
          +
        </button>
      </section>
      {filteredReadingLogs.length === 0 ? (
        <p className="library-empty-state">{normalizedSearchQuery || statusFilter !== "all" ? "검색 결과가 없습니다." : "아직 독서 기록장이 없습니다."}</p>
      ) : null}

      {selectedLog ? (
        <>
          <div className="book-title-actions top-actions">
            {isEditingSelectedLog ? (
              <div className="book-confirm-actions">
                <button className="button compact secondary" type="button" onClick={cancelDraftChange} disabled={isSaving}>
                  취소
                </button>
                <button className="button compact" type="button" onClick={confirmSelectedTitle} disabled={!canConfirm}>
                  {isSaving ? "저장 중" : "확인"}
                </button>
              </div>
            ) : (
              <button className="button compact" type="button" onClick={editSelectedLog} disabled={isSaving}>
                수정
              </button>
            )}
          </div>
          <label className="public-toggle">
            <input
              type="checkbox"
              checked={draftIsPublic}
              disabled={!isEditingSelectedLog}
              onChange={(event) => setDraftIsPublic(event.target.checked)}
            />
            <span>검색에 공개</span>
          </label>
          {saveError ? <p className="library-error-state">{saveError}</p> : null}
          <section className={`book-detail${bookDetailStateClassName}`} aria-label="선택한 독서 기록장">
            <div className="book-title-bar">
              <input
                aria-label="책 제목"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder="책 제목"
                readOnly={!isEditingSelectedLog}
              />
              <button className="delete-log-button title-delete" type="button" onClick={deleteSelectedLog} disabled={!isEditingSelectedLog}>
                삭제
              </button>
            </div>
            {draftEntries.map((entry, index) => (
              <section className="book-entry" aria-label="날짜별 독서 기록" key={entry.id}>
                <div className="book-meta-row">
                  <label className="book-date-field">
                    <span>날짜</span>
                    <input
                      aria-label="독서 날짜"
                      type="date"
                      value={entry.date}
                      disabled={!isEditingSelectedLog}
                      onChange={(event) => updateDraftEntry(entry.id, { date: event.target.value })}
                    />
                  </label>
                  <label className="book-page-field">
                    <span>읽은 쪽수</span>
                    <input
                      aria-label="읽은 쪽수"
                      type="number"
                      min="0"
                      max={draftTotalPages}
                      value={draftCurrentPageInputs[entry.id] ?? String(entry.currentPage)}
                      disabled={!isEditingSelectedLog}
                      onChange={(event) => {
                        const inputValue = event.target.value;
                        const currentPage = Math.min(parsePageValue(inputValue), draftTotalPages);
                        setDraftCurrentPageInputs((inputs) => ({ ...inputs, [entry.id]: inputValue }));
                        updateDraftEntry(entry.id, { currentPage });
                      }}
                    />
                  </label>
                  {index === 0 ? (
                    <label className="book-page-field">
                      <span>전체 쪽수</span>
                      <input
                        aria-label="전체 쪽수"
                        type="number"
                        min="0"
                        value={draftTotalPagesInput}
                        disabled={!isEditingSelectedLog}
                        onChange={(event) => {
                          const inputValue = event.target.value;
                          const totalPages = parsePageValue(inputValue);
                          setDraftTotalPagesInput(inputValue);
                          setDraftTotalPages(totalPages);
                          setDraftEntries((entries) => {
                            const nextEntries = entries.map((entry) => ({ ...entry, currentPage: Math.min(entry.currentPage, totalPages) }));
                            setDraftCurrentPageInputs((inputs) => ({
                              ...inputs,
                              ...Object.fromEntries(
                                nextEntries.map((entry) => [
                                  entry.id,
                                  inputs[entry.id] === "" ? "" : String(entry.currentPage),
                                ]),
                              ),
                            }));
                            return nextEntries;
                          });
                        }}
                      />
                    </label>
                  ) : null}
                </div>
                <div className="book-note-area">
                  <textarea
                    ref={(textarea) => {
                      entryTextareaRefs.current[entry.id] = textarea;
                    }}
                    aria-label="독서 기록"
                    value={entry.note}
                    onInput={(event) => resizeTextarea(event.currentTarget)}
                    onChange={(event) => handleEntryNoteChange(entry.id, event)}
                    placeholder="책을 다 읽고 기억나는 내용과 그때의 감상평을 적어보세요."
                    readOnly={!isEditingSelectedLog}
                  />
                  {isEditingSelectedLog ? (
                    <div className="book-entry-actions">
                      <button className="delete-log-button entry-delete" type="button" onClick={() => deleteDraftEntry(entry.id)} disabled={isSaving}>
                        단락 삭제
                      </button>
                    </div>
                  ) : null}
                </div>
              </section>
            ))}
          </section>
          <div className="book-add-entry-actions">
            <button className="button compact secondary" type="button" aria-label="다른 날짜 독서 기록 추가" onClick={addDraftEntry} disabled={!isEditingSelectedLog}>
              +
            </button>
          </div>
          <section className={`book-final-section${bookDetailStateClassName}`} aria-label="최종 독서 기록">
            <div className="book-final-title">최종</div>
            <label className="book-final-field">
              <span>내용 간단 요약</span>
              <textarea
                aria-label="내용 간단 요약"
                value={draftFinalSummary}
                onInput={(event) => resizeTextarea(event.currentTarget)}
                onChange={(event) => setDraftFinalSummary(event.target.value)}
                placeholder="책을 다 읽고 기억에 남는 내용을 간단히 요약해 보세요."
                readOnly={!isEditingSelectedLog}
              />
            </label>
            <label className="book-final-field">
              <span>최종 감상평</span>
              <textarea
                aria-label="최종 감상평"
                value={draftFinalReview}
                onInput={(event) => resizeTextarea(event.currentTarget)}
                onChange={(event) => setDraftFinalReview(event.target.value)}
                placeholder="책을 다 읽은 뒤 느낀 점과 감상평을 적어보세요."
                readOnly={!isEditingSelectedLog}
              />
            </label>
            <label className="book-final-field">
              <span>가장 좋아하는 장면</span>
              <textarea
                aria-label="가장 좋아하는 장면"
                value={draftFavoriteScene}
                onInput={(event) => resizeTextarea(event.currentTarget)}
                onChange={(event) => setDraftFavoriteScene(event.target.value)}
                placeholder="가장 좋았던 글귀나 장면을 적거나, 이미지를 올려보세요."
                readOnly={!isEditingSelectedLog}
              />
              <span className="book-image-upload">
                <input aria-label="가장 좋아하는 장면 이미지" type="file" accept="image/*" onChange={handleFavoriteSceneImageChange} disabled={!isEditingSelectedLog} />
              </span>
              {draftFavoriteSceneImage ? (
                <div className="book-image-preview">
                  <img src={draftFavoriteSceneImage} alt="가장 좋아하는 장면 미리보기" />
                  <button className="button compact secondary" type="button" onClick={() => setDraftFavoriteSceneImage("")} disabled={!isEditingSelectedLog}>
                    이미지 삭제
                  </button>
                </div>
              ) : null}
            </label>
          </section>
        </>
      ) : null}
    </main>
  );
}
