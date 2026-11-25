import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "../api/api";
import { errorMessage } from "../api/client";

export function BoardsPage() {
  const queryClient = useQueryClient();
  const boards = useQuery({ queryKey: ["boards"], queryFn: boardsApi.list });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: () => boardsApi.create(name.trim(), description.trim()),
    onSuccess: () => {
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["boards"] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) create.mutate();
  }

  return (
    <div>
      <div className="page-head">
        <h1>Your boards</h1>
      </div>

      <form className="create-form" onSubmit={onSubmit}>
        <input
          placeholder="New board name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
        />
        <input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
        />
        <button className="btn btn-primary" disabled={create.isPending}>
          {create.isPending ? "Creating..." : "Create board"}
        </button>
      </form>
      {create.isError && <div className="error">{errorMessage(create.error)}</div>}

      {boards.isLoading && <p className="muted">Loading boards...</p>}
      {boards.isError && <div className="error">{errorMessage(boards.error)}</div>}
      {boards.data && boards.data.length === 0 && (
        <p className="muted">No boards yet. Create your first one above.</p>
      )}

      <div className="board-grid">
        {boards.data?.map((b) => (
          <Link key={b.id} to={`/boards/${b.id}`} className="board-card">
            <div className="board-card-top">
              <h3>{b.name}</h3>
              <span className={`badge badge-${b.role.toLowerCase()}`}>{b.role}</span>
            </div>
            <p className="muted">{b.description ?? "No description"}</p>
            <small className="muted">
              {b.memberCount} {b.memberCount === 1 ? "member" : "members"}
            </small>
          </Link>
        ))}
      </div>
    </div>
  );
}
