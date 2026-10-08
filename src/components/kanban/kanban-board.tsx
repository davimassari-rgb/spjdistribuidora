"use client";

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type ReactNode, useId, useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { formatCents } from "@/lib/format";
import type { Stage } from "@/lib/kanban/stages";
import { ReasonDialog } from "./reason-dialog";

/** Card já renderizado no servidor; o quadro só cuida de posição e arrasto. */
export type KanbanCard = {
  id: string;
  stage: string;
  content: ReactNode;
  /** Destaque de alerta (ex.: cliente há muitas semanas sem pedido). */
  highlight?: boolean;
  /** Valor do card em centavos, somado no cabeçalho da coluna quando `showTotals`. */
  valueCents?: number | null;
};

export type MoveInput = { id: string; stage: string; index: number; reason?: string };
export type MoveResult = { error?: string };

type Columns = Record<string, string[]>;

function groupByStage(stages: readonly Stage[], cards: KanbanCard[]): Columns {
  const columns: Columns = Object.fromEntries(stages.map((stage) => [stage.id, []]));
  for (const card of cards) {
    columns[card.stage] ??= [];
    columns[card.stage].push(card.id);
  }
  return columns;
}

export function KanbanBoard({
  stages,
  cards,
  move,
  columnNotes = {},
  showTotals = false,
}: {
  stages: readonly Stage[];
  cards: KanbanCard[];
  move: (input: MoveInput) => Promise<MoveResult>;
  /** Texto pequeno abaixo do título da coluna (ex.: "últimos 30 dias"). */
  columnNotes?: Record<string, string>;
  /** Mostra a soma dos valores (R$) de cada coluna. */
  showTotals?: boolean;
}) {
  const dndId = useId();
  const toast = useToast();
  const byId = new Map(cards.map((card) => [card.id, card]));
  const [columns, setColumns] = useState(() => groupByStage(stages, cards));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Columns | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<{ input: MoveInput; label: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Quando o servidor devolve dados novos (após mover ou recarregar), ressincroniza as colunas.
  const serverKey = cards.map((card) => `${card.id}:${card.stage}`).join("|");
  const [syncedKey, setSyncedKey] = useState(serverKey);
  if (syncedKey !== serverKey) {
    setSyncedKey(serverKey);
    setColumns(groupByStage(stages, cards));
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // No celular, segurar o card por um instante inicia o arrasto (para não brigar com a rolagem).
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columnOf = (id: string, cols = columns) =>
    id in cols ? id : Object.keys(cols).find((stage) => cols[stage].includes(id));

  function commit(input: MoveInput, rollback: Columns) {
    const originalStage = byId.get(input.id)?.stage;
    const stage = stages.find((s) => s.id === input.stage);
    if (
      stage &&
      "requiresReason" in stage &&
      stage.requiresReason &&
      originalStage !== input.stage
    ) {
      setReasonFor({ input, label: stage.label });
      setSnapshot(rollback);
      return;
    }
    send(input, rollback);
  }

  function send(input: MoveInput, rollback: Columns) {
    setError(null);
    startTransition(async () => {
      const result = await move(input);
      if (result.error) {
        setError(result.error);
        toast("error", result.error);
        setColumns(rollback);
      }
    });
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setSnapshot(columns);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeKey = String(active.id);
    const overKey = String(over.id);
    const from = columnOf(activeKey);
    const to = columnOf(overKey);
    if (!from || !to || from === to) return;
    setColumns((prev) => {
      const target = prev[to].filter((id) => id !== activeKey);
      const overIndex = target.indexOf(overKey);
      const index = overIndex === -1 ? target.length : overIndex;
      return {
        ...prev,
        [from]: prev[from].filter((id) => id !== activeKey),
        [to]: [...target.slice(0, index), activeKey, ...target.slice(index)],
      };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const rollback = snapshot ?? columns;
    setActiveId(null);
    const activeKey = String(active.id);
    if (!over) {
      setColumns(rollback);
      return;
    }
    const stage = columnOf(activeKey);
    if (!stage) return;
    let next = columns;
    const overKey = String(over.id);
    if (columnOf(overKey) === stage && overKey !== stage) {
      const list = columns[stage];
      next = {
        ...columns,
        [stage]: arrayMove(list, list.indexOf(activeKey), list.indexOf(overKey)),
      };
      setColumns(next);
    }
    const index = next[stage].indexOf(activeKey);
    const originalStage = columnOf(activeKey, rollback);
    if (originalStage === stage && rollback[stage].indexOf(activeKey) === index) return;
    commit({ id: activeKey, stage, index }, rollback);
  }

  /** Alternativa ao arrasto (celular/teclado): move para o fim da coluna escolhida. */
  function moveTo(id: string, stage: string) {
    const from = columnOf(id);
    if (!from || from === stage) return;
    const rollback = columns;
    const next = {
      ...columns,
      [from]: columns[from].filter((other) => other !== id),
      [stage]: [...columns[stage], id],
    };
    setColumns(next);
    commit({ id, stage, index: next[stage].length - 1 }, rollback);
  }

  const activeCard = activeId ? byId.get(activeId) : undefined;

  return (
    <>
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-ui border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          if (snapshot) setColumns(snapshot);
        }}
      >
        <div
          className={`flex h-[calc(100vh-12rem)] min-h-[28rem] gap-3 overflow-x-auto pb-2 ${pending ? "cursor-progress" : ""}`}
        >
          {stages.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              ids={columns[stage.id] ?? []}
              note={columnNotes[stage.id]}
              totalCents={
                showTotals
                  ? (columns[stage.id] ?? []).reduce(
                      (sum, id) => sum + (byId.get(id)?.valueCents ?? 0),
                      0,
                    )
                  : undefined
              }
            >
              {(columns[stage.id] ?? []).map((id) => {
                const card = byId.get(id);
                if (!card) return null;
                return (
                  <SortableCard key={id} card={card}>
                    <select
                      className="mt-2 w-full rounded-md border border-line bg-surface-muted px-1.5 py-1 text-xs text-ink-subtle hover:border-line-strong"
                      aria-label="Mover para"
                      value=""
                      onChange={(e) => moveTo(id, e.currentTarget.value)}
                      // Não deixa o seletor iniciar um arrasto (mouse, toque ou teclado).
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <option value="">Mover para…</option>
                      {stages
                        .filter((s) => s.id !== stage.id)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                    </select>
                  </SortableCard>
                );
              })}
            </Column>
          ))}
        </div>
        <DragOverlay>
          {activeCard ? (
            <CardShell highlight={activeCard.highlight} dragging>
              {activeCard.content}
            </CardShell>
          ) : null}
        </DragOverlay>
      </DndContext>

      {reasonFor && (
        <ReasonDialog
          title={`Mover para “${reasonFor.label}”`}
          onCancel={() => {
            if (snapshot) setColumns(snapshot);
            setReasonFor(null);
          }}
          onConfirm={(reason) => {
            send({ ...reasonFor.input, reason }, snapshot ?? columns);
            setReasonFor(null);
          }}
        />
      )}
    </>
  );
}

const TONE: Record<NonNullable<Stage["tone"]>, { bar: string; dot: string }> = {
  neutral: { bar: "border-t-slate-400", dot: "bg-slate-400" },
  brand: { bar: "border-t-brand-500", dot: "bg-brand-500" },
  warning: { bar: "border-t-amber-500", dot: "bg-amber-500" },
  success: { bar: "border-t-green-600", dot: "bg-green-600" },
  danger: { bar: "border-t-red-500", dot: "bg-red-500" },
};

function Column({
  stage,
  ids,
  note,
  totalCents,
  children,
}: {
  stage: Stage;
  ids: string[];
  note?: string;
  totalCents?: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const tone = TONE[stage.tone ?? "neutral"];
  return (
    <section
      ref={setNodeRef}
      className={`flex h-full w-72 flex-none flex-col rounded-ui border border-t-4 ${tone.bar} transition ${
        isOver ? "border-brand-200 bg-brand-50" : "border-line bg-surface-sunken"
      }`}
      aria-label={stage.label}
    >
      <header className="px-3 pt-2.5 pb-2">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${tone.dot}`} aria-hidden />
          <h2 className="flex-1 truncate text-sm font-semibold text-ink">{stage.label}</h2>
          <span className="num rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-ink-muted shadow-ui">
            {ids.length}
          </span>
        </div>
        {totalCents !== undefined && (
          <p className="num mt-1 text-sm font-semibold text-ink-muted">
            {formatCents(totalCents, "R$ 0,00")}
          </p>
        )}
        {note && <p className="caption mt-0.5">{note}</p>}
      </header>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {ids.length === 0 ? (
            <p className="rounded-ui border border-dashed border-line-strong px-3 py-6 text-center text-xs text-ink-subtle">
              Arraste um card para cá
            </p>
          ) : (
            children
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({ card, children }: { card: KanbanCard; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-40" : ""}
      {...attributes}
      {...listeners}
    >
      <CardShell highlight={card.highlight}>
        {card.content}
        {children}
      </CardShell>
    </div>
  );
}

function CardShell({
  children,
  highlight,
  dragging,
}: {
  children: ReactNode;
  highlight?: boolean;
  dragging?: boolean;
}) {
  return (
    <article
      className={`cursor-grab touch-manipulation rounded-ui border bg-surface p-3 text-sm shadow-ui transition hover:shadow-pop ${
        highlight ? "border-danger-border border-l-4 border-l-red-500" : "border-line"
      } ${dragging ? "rotate-1 shadow-modal" : ""}`}
    >
      {children}
    </article>
  );
}
