type ReadingEntryFormProps = {
  action: (formData: FormData) => void | Promise<void>;
};

export function ReadingEntryForm({ action }: ReadingEntryFormProps) {
  return (
    <form className="form" action={action}>
      <label className="field">
        <span>책 제목</span>
        <input name="title" required placeholder="예: 어린 왕자" />
      </label>

      <label className="field">
        <span>작가</span>
        <input name="author" placeholder="예: 생텍쥐페리" />
      </label>

      <label className="field">
        <span>상태</span>
        <select name="status" defaultValue="reading">
          <option value="reading">읽는 중</option>
          <option value="finished">완독</option>
          <option value="paused">잠시 멈춤</option>
        </select>
      </label>

      <label className="field">
        <span>별점</span>
        <select name="rating" defaultValue="">
          <option value="">선택 안 함</option>
          <option value="5">5</option>
          <option value="4">4</option>
          <option value="3">3</option>
          <option value="2">2</option>
          <option value="1">1</option>
        </select>
      </label>

      <label className="field">
        <span>메모</span>
        <textarea name="notes" placeholder="기억하고 싶은 문장이나 생각" />
      </label>

      <button className="button" type="submit">
        기록 추가
      </button>
    </form>
  );
}
