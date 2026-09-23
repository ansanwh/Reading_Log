export type PublicReadingEntry = {
  id: string;
  entry_date: string;
  note: string;
  current_page: number;
  position: number;
};

export type PublicReadingLog = {
  id: string;
  user_id: string;
  title: string;
  genre: string;
  total_pages: number;
  final_summary: string | null;
  final_review: string | null;
  final_rating?: number | null;
  favorite_scene: string | null;
  favorite_scene_image: string | null;
  reading_log_entries: PublicReadingEntry[] | null;
};

export const publicReadingLogSelect = "id,user_id,title,genre,total_pages,final_summary,final_review,final_rating,favorite_scene,favorite_scene_image,reading_log_entries(id,entry_date,note,current_page,position)";
export const legacyPublicReadingLogSelect = "id,user_id,title,genre,total_pages,final_summary,final_review,favorite_scene,favorite_scene_image,reading_log_entries(id,entry_date,note,current_page,position)";

export function getReadingProgress(currentPage: number, totalPages: number) {
  return totalPages > 0 ? Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100))) : 0;
}

export function getReadingStatus(log: PublicReadingLog) {
  const currentPage = (log.reading_log_entries ?? []).reduce((maximum, entry) => Math.max(maximum, entry.current_page), 0);

  return log.total_pages > 0 && currentPage >= log.total_pages ? "완독" : "읽는 중";
}

type PublicReadingLogDetailProps = {
  log: PublicReadingLog;
  authorId?: string;
};

export function PublicReadingLogDetail({ log, authorId }: PublicReadingLogDetailProps) {
  const entries = [...(log.reading_log_entries ?? [])].sort((a, b) => a.position - b.position);
  const currentPage = entries.reduce((maximum, entry) => Math.max(maximum, entry.current_page), 0);
  const progress = getReadingProgress(currentPage, log.total_pages);

  return (
    <section className="public-log-detail" aria-label={`${log.title} 공개 독서 기록`}>
      <div className="public-log-detail-head">
        <div>
          <p className="eyebrow">공개 독서 기록</p>
          <h2>{log.title}</h2>
          <p>작성자 {authorId ?? "익명"} · 장르 {log.genre || "미지정"} · {getReadingStatus(log)} · 읽은 쪽수 {currentPage} / {log.total_pages} ({progress}%)</p>
        </div>
      </div>
      {entries.map((entry) => <article className="public-log-entry" key={entry.id}><h3>{entry.entry_date} · {entry.current_page}쪽</h3><p>{entry.note || "기록 없음"}</p></article>)}
      {log.final_summary ? <article className="public-log-entry"><h3>내용 간단 요약</h3><p>{log.final_summary}</p></article> : null}
      {log.final_review || log.final_rating ? <article className="public-log-entry"><h3>최종 감상평</h3>{log.final_rating ? <p className="public-log-rating" aria-label={`별점 ${log.final_rating}점`}>{[1, 2, 3, 4, 5].map((rating) => <span key={rating} className={`rating-star${log.final_rating! >= rating ? " selected" : log.final_rating === rating - 0.5 ? " half" : ""}`} aria-hidden="true">★</span>)} <span className="public-log-rating-value">{log.final_rating}/5</span></p> : null}{log.final_review ? <p>{log.final_review}</p> : null}</article> : null}
      {log.favorite_scene ? <article className="public-log-entry"><h3>가장 좋아하는 장면</h3><p>{log.favorite_scene}</p></article> : null}
      {log.favorite_scene_image ? <img className="public-log-image" src={log.favorite_scene_image} alt={`${log.title}에서 좋아하는 장면`} /> : null}
    </section>
  );
}
