type DeleteEntryButtonProps = {
  id: string;
  action: (formData: FormData) => void | Promise<void>;
};

export function DeleteEntryButton({ id, action }: DeleteEntryButtonProps) {
  return (
    <form action={action}>
      <input name="id" type="hidden" value={id} />
      <button className="button danger" type="submit">
        삭제
      </button>
    </form>
  );
}
