"use client";

import type { CSSProperties, ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { fetchBookByIsbn, isValidIsbn, normalizeIsbn } from "@/lib/open-library";

export type ReadingLog = {
  id: string;
  title: string;
  genre: string;
  totalPages: number;
  isPublic: boolean;
  groupId: string | null;
  entries: ReadingEntry[];
  finalSummary: string;
  finalReview: string;
  finalRating: number | null;
  favoriteScene: string;
  favoriteSceneImage: string;
};

type ReadingEntry = {
  id: string;
  date: string;
  note: string;
  currentPage: number;
};

type SupabaseError = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

const optionalReadingLogColumns = ["final_rating", "genre", "group_id"] as const;

type LibraryContentProps = {
  initialReadingLogs?: ReadingLog[];
  userId: string;
  groups?: Group[];
};

export type Group = {
  id: string;
  name: string;
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

function getRatingFromPointer(clientX: number, element: HTMLElement) {
  const { left, width } = element.getBoundingClientRect();
  return Math.min(5, Math.max(0.5, Math.ceil(((clientX - left) / width) * 10) / 2));
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

function parseGenres(value: string) {
  return value.split(",").map((genre) => genre.trim()).filter(Boolean);
}

function normalizeGenres(value: string) {
  return parseGenres(value).join(", ");
}

function getCurrentPageInputValues(entries: ReadingEntry[]) {
  return Object.fromEntries(entries.map((entry) => [entry.id, String(entry.currentPage)]));
}

function hasIncreasingCurrentPages(entries: ReadingEntry[]) {
  return entries.every((entry, index) => index === 0 || entry.currentPage >= entries[index - 1].currentPage);
}

function getMissingReadingLogColumn(error: SupabaseError) {
  if (error.code !== "42703" && error.code !== "PGRST204") {
    return null;
  }

  const errorText = `${error.message} ${error.details ?? ""} ${error.hint ?? ""}`;

  return optionalReadingLogColumns.find((column) => errorText.includes(column)) ?? null;
}

function matchesSearch(log: ReadingLog, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    log.title,
    log.genre,
  ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
}

function resizeTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export function LibraryContent({ initialReadingLogs = [], userId, groups = [] }: LibraryContentProps) {
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>(initialReadingLogs);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(initialReadingLogs[0]?.id ?? null);
  const [draftLogId, setDraftLogId] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftIsbn, setDraftIsbn] = useState("");
  const [isLookingUpBook, setIsLookingUpBook] = useState(false);
  const [isbnLookupMessage, setIsbnLookupMessage] = useState("");
  const [isbnLookupHasError, setIsbnLookupHasError] = useState(false);
  const [isbnLookupRequest, setIsbnLookupRequest] = useState<{ isbn: string; logId: string } | null>(null);
  const [draftGenre, setDraftGenre] = useState("");
  const [draftTotalPages, setDraftTotalPages] = useState(300);
  const [draftTotalPagesInput, setDraftTotalPagesInput] = useState("300");
  const [draftIsPublic, setDraftIsPublic] = useState(false);
  const [draftGroupId, setDraftGroupId] = useState<string | null>(null);
  const [draftEntries, setDraftEntries] = useState<ReadingEntry[]>([]);
  const [draftCurrentPageInputs, setDraftCurrentPageInputs] = useState<Record<string, string>>({});
  const [draftFinalSummary, setDraftFinalSummary] = useState("");
  const [draftFinalReview, setDraftFinalReview] = useState("");
  const [draftFinalRating, setDraftFinalRating] = useState<number | null>(null);
  const [draftFavoriteScene, setDraftFavoriteScene] = useState("");
  const [draftFavoriteSceneImage, setDraftFavoriteSceneImage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveRequirementErrors, setSaveRequirementErrors] = useState<string[]>([]);
  const [pendingFocusEntryId, setPendingFocusEntryId] = useState<string | null>(null);
  const libraryMainRef = useRef<HTMLElement | null>(null);
  const entryTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const bookInfoRef = useRef({ title: draftTitle, totalPagesInput: draftTotalPagesInput });
  bookInfoRef.current = { title: draftTitle, totalPagesInput: draftTotalPagesInput };
  const selectedLog = readingLogs.find((log) => log.id === selectedLogId);
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredReadingLogs = readingLogs.filter((log) => matchesSearch(log, normalizedSearchQuery));
  const hasTitleChange = selectedLog ? draftTitle !== selectedLog.title : false;
  const hasGenreChange = selectedLog ? draftGenre !== selectedLog.genre : false;
  const isSelectedDraftLog = selectedLogId !== null && selectedLogId === draftLogId;
  const hasTotalPagesChange = selectedLog ? draftTotalPages !== selectedLog.totalPages : false;
  const hasEntriesChange = selectedLog ? JSON.stringify(draftEntries) !== JSON.stringify(selectedLog.entries) : false;
  const hasFinalChange = selectedLog
    ? draftFinalSummary !== selectedLog.finalSummary ||
      draftFinalReview !== selectedLog.finalReview ||
      draftFinalRating !== selectedLog.finalRating ||
      draftFavoriteScene !== selectedLog.favoriteScene ||
      draftFavoriteSceneImage !== selectedLog.favoriteSceneImage ||
       draftIsPublic !== selectedLog.isPublic ||
       draftGroupId !== selectedLog.groupId
    : false;
  const hasDraftChange = hasTitleChange || hasGenreChange || hasTotalPagesChange || hasEntriesChange || hasFinalChange;
  const hasValidTotalPages = draftTotalPages > 0;
  const hasValidGenres = parseGenres(draftGenre).length <= 5;
  const hasValidCurrentPages = hasIncreasingCurrentPages(draftEntries);
  const hasValidEntryDates = draftEntries.every((entry) => entry.date.trim().length > 0);
  const hasRequiredBookInfo = draftTitle.trim().length > 0 && hasValidTotalPages;
  const hasRequiredGroup = groups.length === 0 || draftGroupId !== null;
  const hasAnyFinalContent =
    draftFinalSummary.trim().length > 0 ||
    draftFinalReview.trim().length > 0 ||
    draftFinalRating !== null ||
    draftFavoriteScene.trim().length > 0 ||
    draftFavoriteSceneImage.trim().length > 0;
  const hasRequiredFinalContent =
    !hasAnyFinalContent ||
    (draftFinalSummary.trim().length > 0 &&
      draftFinalReview.trim().length > 0 &&
      draftFinalRating !== null);
  const unmetSaveRequirements: string[] = [];
  if (!draftTitle.trim()) unmetSaveRequirements.push("책 제목 입력");
  if (!hasValidTotalPages) unmetSaveRequirements.push("전체 쪽수 1 이상 입력");
  if (!hasValidGenres) unmetSaveRequirements.push("장르를 최대 5개까지만 입력");
  if (!hasValidCurrentPages) unmetSaveRequirements.push("읽은 쪽수를 이전 기록 이상으로 입력");
  if (!hasValidEntryDates) unmetSaveRequirements.push("모든 독서 날짜 입력");
  if (!hasRequiredGroup) unmetSaveRequirements.push("그룹 선택");
  if (!hasRequiredFinalContent) unmetSaveRequirements.push("최종 기록의 줄거리, 감상평, 별점을 모두 입력");
  const canConfirm = !isSaving && !isLookingUpBook && unmetSaveRequirements.length === 0 && hasRequiredBookInfo;
  const hasDraftLog = draftLogId !== null;
  const isEditingSelectedLog = isSelectedDraftLog || (selectedLogId !== null && selectedLogId === editingLogId);
  const isWriting = hasDraftLog || isEditingSelectedLog || hasDraftChange;
  const bookDetailStateClassName = isEditingSelectedLog ? " writing" : "";

  useEffect(() => {
    setDraftIsbn("");
    setIsbnLookupRequest(null);
    setIsbnLookupMessage("");
    setIsbnLookupHasError(false);
  }, [selectedLogId]);

  useEffect(() => {
    setIsLookingUpBook(false);
    setIsbnLookupMessage("");
    setIsbnLookupHasError(false);
    if (!isEditingSelectedLog || isSaving || !isbnLookupRequest ||
      isbnLookupRequest.logId !== selectedLogId || isbnLookupRequest.isbn !== draftIsbn) return;

    const isbn = normalizeIsbn(draftIsbn);
    if (!isValidIsbn(isbn)) {
      setIsbnLookupMessage("유효한 ISBN 10자리 또는 13자리를 입력해 주세요.");
      setIsbnLookupHasError(true);
      return;
    }

    const controller = new AbortController();
    let isActive = true;
    setIsLookingUpBook(true);
    setIsbnLookupMessage("도서 정보를 찾고 있습니다.");
      const originalInfo = { ...bookInfoRef.current };
      const timeout = setTimeout(() => controller.abort(), 15000);
      void (async () => {
        try {
          const book = await fetchBookByIsbn(isbn, controller.signal);
          if (!isActive) return;
          if (!book) {
            setIsbnLookupHasError(true);
            setIsbnLookupMessage("해당 ISBN의 도서를 찾지 못했습니다. 제목과 전체 쪽수를 직접 입력해 주세요.");
            return;
          }

          const updated: string[] = [];
          const missing: string[] = [];
          const edited: string[] = [];
          if (!book.title) missing.push("책 제목");
          else if (bookInfoRef.current.title !== originalInfo.title) edited.push("책 제목");
          else {
            setDraftTitle(book.title);
            updated.push("책 제목");
          }
          if (book.totalPages === null) missing.push("전체 쪽수");
          else if (bookInfoRef.current.totalPagesInput !== originalInfo.totalPagesInput) edited.push("전체 쪽수");
          else {
            setDraftTotalPages(book.totalPages);
            setDraftTotalPagesInput(String(book.totalPages));
            updated.push("전체 쪽수");
          }
          setIsbnLookupMessage([
            updated.length > 0 ? `${updated.join("과 ")}를 불러왔습니다.` : "",
            missing.length > 0 ? `${missing.join("과 ")} 정보가 없습니다. 직접 입력해 주세요.` : "",
            edited.length > 0 ? `조회 중 수정한 ${edited.join("과 ")}는 유지했습니다.` : "",
          ].filter(Boolean).join(" "));
        } catch {
          if (!isActive) return;
          setIsbnLookupHasError(true);
          setIsbnLookupMessage(controller.signal.aborted
            ? "조회 시간이 초과되었습니다. 다시 조회하거나 직접 입력해 주세요."
            : "도서 정보를 가져오지 못했습니다. 다시 조회하거나 직접 입력해 주세요.");
        } finally {
          clearTimeout(timeout);
          if (isActive) setIsLookingUpBook(false);
        }
      })();

    return () => {
      isActive = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [draftIsbn, selectedLogId, isEditingSelectedLog, isSaving, isbnLookupRequest]);

  useEffect(() => {
    setDraftTitle(selectedLog?.title ?? "");
    setDraftGenre(selectedLog?.genre ?? "");
    setDraftTotalPages(selectedLog?.totalPages ?? 300);
    setDraftTotalPagesInput(String(selectedLog?.totalPages ?? 300));
    setDraftIsPublic(groups.length === 0 && (selectedLog?.isPublic ?? false));
    setDraftGroupId(selectedLog?.groupId ?? groups[0]?.id ?? null);
    const selectedEntries = selectedLog?.entries ?? [];
    setDraftEntries(selectedEntries);
    setDraftCurrentPageInputs(getCurrentPageInputValues(selectedEntries));
    setDraftFinalSummary(selectedLog?.finalSummary ?? "");
    setDraftFinalReview(selectedLog?.finalReview ?? "");
    setDraftFinalRating(selectedLog?.finalRating ?? null);
    setDraftFavoriteScene(selectedLog?.favoriteScene ?? "");
    setDraftFavoriteSceneImage(selectedLog?.favoriteSceneImage ?? "");
  }, [selectedLog, selectedLogId, groups]);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      libraryMainRef.current
        ?.querySelectorAll<HTMLTextAreaElement>(".book-detail textarea, .book-final-section textarea")
        .forEach(resizeTextarea);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [selectedLogId, draftEntries.length, isEditingSelectedLog]);

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
      genre: "",
      totalPages: 300,
      isPublic: false,
      groupId: groups[0]?.id ?? null,
      finalSummary: "",
      finalReview: "",
      finalRating: null,
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
    setSaveRequirementErrors([]);
  }

  async function confirmSelectedTitle() {
    if (!selectedLogId) {
      return;
    }

    if (!canConfirm) {
      if (!isSaving) {
        setSaveError("");
        setSaveRequirementErrors(unmetSaveRequirements);
      }
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveRequirementErrors([]);

    const nextLog = {
      id: selectedLogId,
      title: draftTitle.trim(),
      genre: normalizeGenres(draftGenre),
      totalPages: draftTotalPages,
      isPublic: draftIsPublic,
      groupId: draftGroupId,
      entries: draftEntries,
      finalSummary: draftFinalSummary,
      finalReview: draftFinalReview,
      finalRating: draftFinalRating,
      favoriteScene: draftFavoriteScene,
      favoriteSceneImage: draftFavoriteSceneImage,
    };
    const supabase = createClient();
    const logPayload: Record<string, string | number | boolean | null> = {
      id: nextLog.id,
      user_id: userId,
      title: nextLog.title,
      genre: nextLog.genre,
      total_pages: nextLog.totalPages,
      is_public: nextLog.isPublic,
      group_id: nextLog.groupId,
      final_summary: nextLog.finalSummary,
      final_review: nextLog.finalReview,
      final_rating: nextLog.finalRating,
      favorite_scene: nextLog.favoriteScene,
      favorite_scene_image: nextLog.favoriteSceneImage,
    };
    let { error: logError } = await supabase.from("reading_logs").upsert(logPayload);

    // 배포 환경의 마이그레이션이 늦게 반영됐더라도 나머지 독서 기록은 저장한다.
    while (logError) {
      const missingColumn = getMissingReadingLogColumn(logError);

      if (!missingColumn || !(missingColumn in logPayload)) {
        break;
      }

      delete logPayload[missingColumn];
      ({ error: logError } = await supabase.from("reading_logs").upsert(logPayload));
    }

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

    setDraftIsbn("");
    if (isSelectedDraftLog) {
      setReadingLogs((logs) => logs.filter((log) => log.id !== selectedLogId));
      setSelectedLogId(null);
      setDraftLogId(null);
      setEditingLogId(null);
      setDraftTitle("");
      setDraftGenre("");
      setDraftTotalPages(300);
      setDraftTotalPagesInput("300");
      setDraftIsPublic(false);
      setDraftGroupId(null);
      setDraftEntries([]);
      setDraftCurrentPageInputs({});
      setDraftFinalSummary("");
      setDraftFinalReview("");
      setDraftFinalRating(null);
      setDraftFavoriteScene("");
      setDraftFavoriteSceneImage("");
      setSaveError("");
      setSaveRequirementErrors([]);
      return;
    }

    setDraftTitle(selectedLog.title);
    setDraftGenre(selectedLog.genre);
    setDraftTotalPages(selectedLog.totalPages);
    setDraftTotalPagesInput(String(selectedLog.totalPages));
    setDraftIsPublic(selectedLog.isPublic);
    setDraftGroupId(selectedLog.groupId);
    setDraftEntries(selectedLog.entries);
    setDraftCurrentPageInputs(getCurrentPageInputValues(selectedLog.entries));
    setDraftFinalSummary(selectedLog.finalSummary);
    setDraftFinalReview(selectedLog.finalReview);
    setDraftFinalRating(selectedLog.finalRating);
    setDraftFavoriteScene(selectedLog.favoriteScene);
    setDraftFavoriteSceneImage(selectedLog.favoriteSceneImage ?? "");
    setEditingLogId(null);
    setSaveError("");
    setSaveRequirementErrors([]);
  }

  function editSelectedLog() {
    if (!selectedLogId) {
      return;
    }

    setEditingLogId(selectedLogId);
    setSaveError("");
    setSaveRequirementErrors([]);
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
    setDraftGenre("");
    setDraftTotalPages(300);
    setDraftTotalPagesInput("300");
    setDraftIsPublic(false);
    setDraftGroupId(null);
    setDraftEntries([]);
    setDraftCurrentPageInputs({});
    setDraftFinalSummary("");
    setDraftFinalReview("");
    setDraftFinalRating(null);
    setDraftFavoriteScene("");
    setDraftFavoriteSceneImage("");
    setIsSaving(false);
  }

  return (
    <main className="library-main" ref={libraryMainRef}>
      <section className="library-search" aria-label="내 독서 기록장 검색 및 상태 필터">
        <label className="main-search-label" htmlFor="library-book-search">
          내 책 검색
        </label>
        <input
          id="library-book-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="제목, 장르로 검색"
        />
      </section>
      <section className="shelf-row" aria-label="독서 기록장 목록">
        {filteredReadingLogs.map((log) => {
          const isSelected = selectedLogId === log.id;
          const isEditing = draftLogId === log.id || editingLogId === log.id;
          const isDimmed = selectedLogId !== null && !isSelected;
          const currentPage = log.entries.reduce((maxPage, entry) => Math.max(maxPage, entry.currentPage), 0);
          const progress = getReadingProgress(currentPage, log.totalPages);
          const bookStyle = { "--book-width": `${getBookWidth(log.totalPages)}px` } as CSSProperties;

          return (
            <button
              className={`shelf-book${isSelected ? " active" : ""}${isEditing ? " editing" : ""}${isDimmed ? " dimmed" : ""}`}
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
        <p className="library-empty-state">{normalizedSearchQuery ? "검색 결과가 없습니다." : "아직 독서 기록장이 없습니다."}</p>
      ) : null}

      {selectedLog ? (
        <>
          <div className="book-title-actions top-actions">
            {isEditingSelectedLog ? (
              <div className="book-confirm-actions">
                <button className="button compact book-confirm-button" type="button" onClick={confirmSelectedTitle} disabled={isSaving || isLookingUpBook}>
                  {isSaving ? "저장 중" : "확인"}
                </button>
                <button className="button compact book-cancel-button" type="button" onClick={cancelDraftChange} disabled={isSaving}>
                  취소
                </button>
                <button className="button compact danger book-delete-button" type="button" onClick={deleteSelectedLog} disabled={isSaving}>
                  삭제
                </button>
              </div>
            ) : (
              <button className="button compact" type="button" onClick={editSelectedLog} disabled={isSaving}>
                수정
              </button>
            )}
          </div>
          <div className="book-options-row">
            <label className="public-toggle">
              <input
                type="checkbox"
                checked={groups.length > 0 ? false : draftIsPublic}
                disabled={!isEditingSelectedLog || groups.length > 0}
                onChange={(event) => setDraftIsPublic(event.target.checked)}
              />
              <span>{groups.length > 0 ? "그룹 기록은 그룹방에만 표시" : "검색에 공개"}</span>
            </label>
            <div className="book-isbn-controls">
              <label className="book-isbn-field">
                <span>ISBN</span>
                <input
                  type="text"
                  value={draftIsbn}
                  onChange={(event) => {
                    setIsbnLookupRequest(null);
                    setDraftIsbn(event.target.value);
                  }}
                  placeholder="ISBN 입력 후 Enter"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="isbn-lookup-status"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      if (selectedLogId && isEditingSelectedLog && !isSaving && !isLookingUpBook) {
                        setIsbnLookupRequest({ isbn: draftIsbn, logId: selectedLogId });
                      }
                    }
                  }}
                  readOnly={!isEditingSelectedLog}
                  disabled={isSaving}
                />
              </label>
            </div>
          </div>
          <p id="isbn-lookup-status" className={`isbn-lookup-status${isbnLookupHasError ? " error" : ""}`} role="status" aria-live="polite">
            {isbnLookupMessage}
          </p>
          {groups.length > 0 ? (
            <label className="public-toggle">
              <span>그룹 <span className="required-mark" aria-hidden="true">*</span></span>
              <select
                aria-label="그룹 선택"
                aria-required="true"
                required
                value={draftGroupId ?? ""}
                disabled={!isEditingSelectedLog}
                onChange={(event) => setDraftGroupId(event.target.value || null)}
              >
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
          ) : null}
          {saveRequirementErrors.length > 0 ? (
            <div className="save-requirement-alert" role="alert">
              <strong>저장 전 확인해 주세요</strong>
              <ul>
                {saveRequirementErrors.map((requirement) => <li key={requirement}>{requirement}</li>)}
              </ul>
            </div>
          ) : null}
          {saveError ? <p className="library-error-state" role="alert">{saveError}</p> : null}
          <section className={`book-detail${bookDetailStateClassName}`} aria-label="선택한 독서 기록장">
            <div className="book-title-bar">
              <label className="book-title-field">
                <span className="book-title-label">책 제목 <span className="required-mark" aria-hidden="true">*</span></span>
                <input
                  aria-label="책 제목"
                  aria-required="true"
                  required
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder="책 제목을 입력하세요"
                  readOnly={!isEditingSelectedLog}
                />
              </label>
            </div>
            <label className="book-genre-row">
              <span>장르</span>
              <input
                aria-label="책 장르"
                value={draftGenre}
                onChange={(event) => setDraftGenre(event.target.value)}
                placeholder="예: 소설, 에세이"
                maxLength={100}
                readOnly={!isEditingSelectedLog}
              />
              <small className={hasValidGenres ? "book-genre-help" : "book-genre-help error"}>쉼표로 구분해 최대 5개까지 입력할 수 있습니다.</small>
            </label>
            {draftEntries.map((entry, index) => (
              <section className="book-entry" aria-label="날짜별 독서 기록" key={entry.id}>
                <div className="book-meta-row">
                  <label className="book-date-field">
                    <span>날짜 <span className="required-mark" aria-hidden="true">*</span></span>
                    <input
                      aria-label="독서 날짜"
                      aria-required="true"
                      type="date"
                      required
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
                      <span>전체 쪽수 <span className="required-mark" aria-hidden="true">*</span></span>
                      <input
                        aria-label="전체 쪽수"
                        aria-required="true"
                        type="number"
                        min="1"
                        required
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
              <span>내용 간단 요약 {hasAnyFinalContent ? <span className="required-mark" aria-hidden="true">*</span> : null}</span>
              <textarea
                aria-label="내용 간단 요약"
                aria-required={hasAnyFinalContent}
                required={hasAnyFinalContent}
                value={draftFinalSummary}
                onInput={(event) => resizeTextarea(event.currentTarget)}
                onChange={(event) => setDraftFinalSummary(event.target.value)}
                placeholder="책을 다 읽고 기억에 남는 내용을 간단히 요약해 보세요."
                readOnly={!isEditingSelectedLog}
              />
            </label>
            <label className="book-final-field">
              <span>최종 감상평 {hasAnyFinalContent ? <span className="required-mark" aria-hidden="true">*</span> : null}</span>
              <textarea
                aria-label="최종 감상평"
                aria-required={hasAnyFinalContent}
                required={hasAnyFinalContent}
                value={draftFinalReview}
                onInput={(event) => resizeTextarea(event.currentTarget)}
                onChange={(event) => setDraftFinalReview(event.target.value)}
                placeholder="책을 다 읽은 뒤 느낀 점과 감상평을 적어보세요."
                readOnly={!isEditingSelectedLog}
              />
            </label>
            <div className="book-final-field">
              <span id="final-rating-label">별점 {hasAnyFinalContent ? <span className="required-mark" aria-hidden="true">*</span> : null}</span>
              <div className="final-rating">
                <div
                  className="final-rating-stars"
                  role="slider"
                  tabIndex={isEditingSelectedLog ? 0 : -1}
                  aria-labelledby="final-rating-label"
                  aria-valuemin={0}
                  aria-valuemax={5}
                  aria-valuenow={draftFinalRating ?? 0}
                  aria-valuetext={draftFinalRating === null ? "별점 없음" : `${draftFinalRating}점`}
                  aria-required={hasAnyFinalContent}
                  aria-disabled={!isEditingSelectedLog}
                  onPointerDown={(event) => {
                    if (!isEditingSelectedLog) return;
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDraftFinalRating(getRatingFromPointer(event.clientX, event.currentTarget));
                  }}
                  onPointerMove={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      setDraftFinalRating(getRatingFromPointer(event.clientX, event.currentTarget));
                    }
                  }}
                  onKeyDown={(event) => {
                    if (!isEditingSelectedLog) return;
                    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                      event.preventDefault();
                      setDraftFinalRating((rating) => Math.min(5, (rating ?? 0) + 0.5));
                    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                      event.preventDefault();
                      setDraftFinalRating((rating) => rating === null || rating <= 0.5 ? null : rating - 0.5);
                    } else if (event.key === "Home" || event.key === "Delete" || event.key === "Backspace") {
                      event.preventDefault();
                      setDraftFinalRating(null);
                    } else if (event.key === "End") {
                      event.preventDefault();
                      setDraftFinalRating(5);
                    }
                  }}
                >
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <span
                      className={`final-rating-star${draftFinalRating !== null && rating <= draftFinalRating ? " selected" : draftFinalRating === rating - 0.5 ? " half" : ""}`}
                      key={rating}
                      aria-hidden="true"
                    >★</span>
                  ))}
                </div>
                <output className="final-rating-value">{draftFinalRating === null ? "선택 안 함" : `${draftFinalRating}/5`}</output>
                {draftFinalRating !== null && isEditingSelectedLog ? (
                  <button className="final-rating-clear" type="button" onClick={() => setDraftFinalRating(null)}>
                    지우기
                  </button>
                ) : null}
              </div>
            </div>
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
