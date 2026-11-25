import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { boardsApi } from "../api/api";
import { errorMessage } from "../api/client";

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const id = boardId ?? "";

  const board = useQuery({
    queryKey: ["board", id],
    queryFn: () => boardsApi.get(id),
    enabled: id !== "",
  });
  const columns = useQuery({
    queryKey: ["columns", id],
    queryFn: () => boardsApi.columns(id),
    enabled: id !== "",
  });

  if (board.isLoading || columns.isLoading) return <p className="muted">Loading board...</p>;

  if (board.isError || columns.isError || !board.data) {
    return (
      <div>
        <Link to="/" className="back">&larr; All boards</Link>
        <div className="error">{errorMessage(board.error ?? columns.error)}</div>
      </div>
    );
  }

  const b = board.data;
  const cols = columns.data ?? [];

  return (
    <div>
      <Link to="/" className="back">&larr; All boards</Link>
      <div className="page-head">
        <div>
          <h1>{b.name}</h1>
          {b.description && <p className="muted">{b.description}</p>}
        </div>
        <span className={`badge badge-${b.myRole.toLowerCase()}`}>You: {b.myRole}</span>
      </div>

      <div className="chips">
        {b.members.map((m) => (
          <span key={m.userId} className="chip" title={m.email}>
            {m.displayName} <small>{m.role}</small>
          </span>
        ))}
      </div>

      <div className="columns">
        {cols.map((col) => (
          <section key={col.id} className="column">
            <h2>
              {col.name} <span className="muted">{col.cards.length}</span>
            </h2>
            {col.cards.map((card) => (
              <div key={card.id} className="card">{card.title}</div>
            ))}
            {col.cards.length === 0 && <p className="muted empty">No cards</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
