"use client";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
};

export function Pagination({ page, pageSize, total, onPage }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="pager">
      <button
        type="button"
        className="btn"
        disabled={page <= 0}
        onClick={() => onPage(page - 1)}
      >
        Prev
      </button>
      <span className="muted pager-meta">
        {from}–{to} / {total}
        <span className="pager-page"> · {page + 1}/{pageCount}</span>
      </span>
      <button
        type="button"
        className="btn"
        disabled={page >= pageCount - 1}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
