import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { boardsApi } from "../api/api";
import { errorMessage } from "../api/client";
import type { Card, Column, Role } from "../types";
import { useBoardRealtime } from "../realtime/useBoardRealtime";

const rank: Record<Role, number> = { Viewer: 0, Member: 1, Admin: 2, Owner: 3 };

function copyColumns(list: Column[]): Column[] {
  return list.map((c) => ({ ...c, cards: [...c.cards] }));
}

function findColumnOf(id: string, list: Column[]): Column | undefined {
  return list.find((c) => c.id === id) ?? list.find((c) => c.cards.some((k) => k.id === id));
}

function SortableCard({
  card,
  canEdit,
  onOpen,
}: {
  card: Card;
  canEdit: boolean;
  onOpen: (card: Card) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: !canEdit,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card"
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card)}
    >
      <div>{card.title}</div>
      {card.dueDate && <small className="muted">Due {card.dueDate.slice(0, 10)}</small>}
    </div>
  );
}

function AddCard({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd(t);
    setTitle("");
  }
  return (
    <form className="add-card" onSubmit={submit}>
      <input
        placeholder="+ Add a card"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
      />
    </form>
  );
}

function KanbanColumn({
  column,
  canEdit,
  onOpen,
  onAddCard,
}: {
  column: Column;
  canEdit: boolean;
  onOpen: (card: Card) => void;
  onAddCard: (columnId: string, title: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });
  return (
    <section className="column">
      <h2>
        {column.name} <span className="muted">{column.cards.length}</span>
      </h2>
      <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="column-body">
          {column.cards.map((card) => (
            <SortableCard key={card.id} card={card} canEdit={canEdit} onOpen={onOpen} />
          ))}
          {column.cards.length === 0 && <p className="muted empty">Drop cards here</p>}
        </div>
      </SortableContext>
      {canEdit && <AddCard onAdd={(title) => onAddCard(column.id, title)} />}
    </section>
  );
}

function CardDialog({
  card,
  canEdit,
  busy,
  onSave,
  onDelete,
  onClose,
}: {
  card: Card;
  canEdit: boolean;
  busy: boolean;
  onSave: (card: Card) => void;
  onDelete: (cardId: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [due, setDue] = useState(card.dueDate ? card.dueDate.slice(0, 10) : "");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      ...card,
      title: title.trim(),
      description: description.trim() || null,
      dueDate: due ? `${due}T00:00:00Z` : null,
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{canEdit ? "Edit card" : "Card"}</h2>
        <label className="field">
          <span>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            readOnly={!canEdit}
            required
            maxLength={200}
          />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            readOnly={!canEdit}
            rows={4}
            maxLength={2000}
          />
        </label>
        <label className="field">
          <span>Due date</span>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            disabled={!canEdit}
          />
        </label>
        <div className="modal-actions">
          {canEdit && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => onDelete(card.id)}
              disabled={busy}
            >
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {canEdit ? "Cancel" : "Close"}
          </button>
          {canEdit && (
            <button className="btn btn-primary" disabled={busy}>
              Save
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const id = boardId ?? "";
  const qc = useQueryClient();
  const live = useBoardRealtime(id);

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

  const [local, setLocal] = useState<Column[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Card | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [boardDesc, setBoardDesc] = useState("");
  const [newColumn, setNewColumn] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("Member");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const refreshColumns = () => qc.invalidateQueries({ queryKey: ["columns", id] });

  const addCard = useMutation({
    mutationFn: (v: { columnId: string; title: string }) =>
      boardsApi.createCard(id, v.columnId, v.title),
    onSuccess: refreshColumns,
  });
  const saveCard = useMutation({
    mutationFn: (card: Card) => boardsApi.updateCard(id, card),
    onSuccess: () => {
      setEditing(null);
      return refreshColumns();
    },
  });
  const removeCard = useMutation({
    mutationFn: (cardId: string) => boardsApi.deleteCard(id, cardId),
    onSuccess: () => {
      setEditing(null);
      return refreshColumns();
    },
  });
  const addColumn = useMutation({
    mutationFn: (name: string) => boardsApi.createColumn(id, name),
    onSuccess: () => {
      setNewColumn("");
      return refreshColumns();
    },
  });
  const moveCard = useMutation({
    mutationFn: (v: { cardId: string; columnId: string; index: number }) =>
      boardsApi.moveCard(id, v.cardId, v.columnId, v.index),
    onSettled: async () => {
      await refreshColumns();
      setLocal(null);
    },
  });
  const renameBoard = useMutation({
    mutationFn: (v: { name: string; description: string }) =>
      boardsApi.update(id, v.name, v.description),
    onSuccess: () => {
      setRenaming(false);
      qc.invalidateQueries({ queryKey: ["board", id] });
      qc.invalidateQueries({ queryKey: ["boards"] });
    },
  });
  const addMember = useMutation({
    mutationFn: (v: { email: string; role: string }) => boardsApi.addMember(id, v.email, v.role),
    onSuccess: () => {
      setMemberEmail("");
      qc.invalidateQueries({ queryKey: ["board", id] });
      qc.invalidateQueries({ queryKey: ["boards"] });
    },
  });

  const problem = [addCard, saveCard, removeCard, addColumn, moveCard, renameBoard, addMember].find(
    (m) => m.isError,
  )?.error;

  const serverCols = columns.data ?? [];
  const cols = local ?? serverCols;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setLocal(copyColumns(serverCols));
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over || !local) return;
    const activeKey = String(active.id);
    const overKey = String(over.id);
    const from = findColumnOf(activeKey, local);
    const to = findColumnOf(overKey, local);
    if (!from || !to || from.id === to.id) return;

    setLocal((prev) => {
      if (!prev) return prev;
      const source = prev.find((c) => c.id === from.id);
      const target = prev.find((c) => c.id === to.id);
      const moving = source?.cards.find((k) => k.id === activeKey);
      if (!source || !target || !moving) return prev;
      const overIndex = target.cards.findIndex((k) => k.id === overKey);
      const insertAt = overIndex >= 0 ? overIndex : target.cards.length;
      return prev.map((c) => {
        if (c.id === source.id) return { ...c, cards: c.cards.filter((k) => k.id !== activeKey) };
        if (c.id === target.id) {
          const next = [...c.cards];
          next.splice(insertAt, 0, { ...moving, columnId: target.id });
          return { ...c, cards: next };
        }
        return c;
      });
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!local || !over) {
      setLocal(null);
      return;
    }
    const activeKey = String(active.id);
    const overKey = String(over.id);
    const col = findColumnOf(activeKey, local);
    if (!col) {
      setLocal(null);
      return;
    }

    let cards = col.cards;
    const oldIndex = cards.findIndex((k) => k.id === activeKey);
    const overIndex = cards.findIndex((k) => k.id === overKey);
    if (overIndex >= 0 && overIndex !== oldIndex) cards = arrayMove(cards, oldIndex, overIndex);

    const finalIndex = cards.findIndex((k) => k.id === activeKey);
    const original = serverCols.find((c) => c.cards.some((k) => k.id === activeKey));
    const originalIndex = original ? original.cards.findIndex((k) => k.id === activeKey) : -1;

    if (original?.id === col.id && originalIndex === finalIndex) {
      setLocal(null);
      return;
    }

    setLocal(local.map((c) => (c.id === col.id ? { ...c, cards } : c)));
    moveCard.mutate({ cardId: activeKey, columnId: col.id, index: finalIndex });
  }

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
  const canEdit = rank[b.myRole] >= rank.Member;
  const canManage = rank[b.myRole] >= rank.Admin;
  const roleOptions = b.myRole === "Owner" ? ["Viewer", "Member", "Admin"] : ["Viewer", "Member"];
  const activeCard = activeId ? cols.flatMap((c) => c.cards).find((k) => k.id === activeId) : undefined;

  function startRename() {
    setBoardName(b.name);
    setBoardDesc(b.description ?? "");
    setRenaming(true);
  }

  return (
    <div>
      <Link to="/" className="back">&larr; All boards</Link>

      <div className="page-head">
        <div>
          {renaming ? (
            <form
              className="rename-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (boardName.trim())
                  renameBoard.mutate({ name: boardName.trim(), description: boardDesc.trim() });
              }}
            >
              <input
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                maxLength={100}
                required
                placeholder="Board name"
              />
              <input
                value={boardDesc}
                onChange={(e) => setBoardDesc(e.target.value)}
                maxLength={500}
                placeholder="Description (optional)"
              />
              <button className="btn btn-primary" disabled={renameBoard.isPending}>Save</button>
              <button type="button" className="btn btn-ghost" onClick={() => setRenaming(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <>
              <h1>{b.name}</h1>
              {b.description && <p className="muted">{b.description}</p>}
            </>
          )}
        </div>
        <div className="head-right">
          <span className={`live live-${live}`}>{live === "live" ? "Live" : live === "connecting" ? "Connecting" : "Offline"}</span>
          <span className={`badge badge-${b.myRole.toLowerCase()}`}>You: {b.myRole}</span>
          {canManage && !renaming && (
            <button className="btn btn-ghost" onClick={startRename}>Edit board</button>
          )}
        </div>
      </div>

      {problem && <div className="error">{errorMessage(problem)}</div>}

      <div className="chips">
        {b.members.map((m) => (
          <span key={m.userId} className="chip" title={m.email}>
            {m.displayName} <small>{m.role}</small>
          </span>
        ))}
      </div>

      {canManage && (
        <form
          className="member-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (memberEmail.trim()) addMember.mutate({ email: memberEmail.trim(), role: memberRole });
          }}
        >
          <input
            type="email"
            placeholder="Invite by email (they must have an account)"
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            required
          />
          <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
            {roleOptions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button className="btn btn-ghost" disabled={addMember.isPending}>Add member</button>
        </form>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setLocal(null);
        }}
      >
        <div className="columns">
          {cols.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              canEdit={canEdit}
              onOpen={setEditing}
              onAddCard={(columnId, title) => addCard.mutate({ columnId, title })}
            />
          ))}

          {canManage && (
            <form
              className="add-column"
              onSubmit={(e) => {
                e.preventDefault();
                if (newColumn.trim()) addColumn.mutate(newColumn.trim());
              }}
            >
              <input
                placeholder="+ Add a column"
                value={newColumn}
                onChange={(e) => setNewColumn(e.target.value)}
                maxLength={100}
              />
            </form>
          )}
        </div>

        <DragOverlay>
          {activeCard ? <div className="card card-overlay">{activeCard.title}</div> : null}
        </DragOverlay>
      </DndContext>

      {editing && (
        <CardDialog
          key={editing.id}
          card={editing}
          canEdit={canEdit}
          busy={saveCard.isPending || removeCard.isPending}
          onSave={(card) => saveCard.mutate(card)}
          onDelete={(cardId) => {
            if (window.confirm("Delete this card?")) removeCard.mutate(cardId);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

