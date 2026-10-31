import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { FolderPlus, Folder, Trash2, Pencil, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/collections")({
  component: CollectionsPage,
});

type Collection = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
};

const COLOR_OPTIONS = [
  { id: "brand", label: "Brand", className: "bg-brand/15 text-brand" },
  { id: "fuchsia", label: "Fuchsia", className: "bg-fuchsia-500/15 text-fuchsia-300" },
  { id: "blue", label: "Blue", className: "bg-blue-500/15 text-blue-300" },
  { id: "emerald", label: "Emerald", className: "bg-emerald-500/15 text-emerald-300" },
  { id: "amber", label: "Amber", className: "bg-amber-500/15 text-amber-300" },
  { id: "rose", label: "Rose", className: "bg-rose-500/15 text-rose-300" },
];

function colorClass(id: string) {
  return COLOR_OPTIONS.find((c) => c.id === id)?.className ?? COLOR_OPTIONS[0].className;
}

function CollectionsPage() {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; c: Collection } | null>(null);

  const refresh = async () => {
    if (!user) return;
    const [{ data: cols }, { data: ads }] = await Promise.all([
      supabase
        .from("collections")
        .select("id, name, description, color, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("ads")
        .select("collection_id")
        .eq("user_id", user.id)
        .not("collection_id", "is", null),
    ]);
    setCollections(cols ?? []);
    const tally: Record<string, number> = {};
    (ads ?? []).forEach((a) => {
      if (a.collection_id) tally[a.collection_id] = (tally[a.collection_id] ?? 0) + 1;
    });
    setCounts(tally);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, [user?.id]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this collection? Ads inside will be kept (uncategorised).")) return;
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Collection deleted");
      void refresh();
    }
  };

  return (
    <AppShell title="My Campaigns" subtitle='Organize ads into campaigns like "Summer Sale 2024" or "Black Friday"' action={
      <button
        onClick={() => setModal({ mode: "create" })}
        className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:brightness-110"
      >
        <FolderPlus className="size-4" /> New collection
      </button>
    }>

      {loading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="size-6 animate-spin text-brand" />
        </div>
      ) : collections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <Folder className="mx-auto size-10 text-muted-foreground" />
          <h2 className="mt-4 font-display text-lg font-semibold">No collections yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Group related ads together to keep your gallery tidy.
          </p>
          <button
            onClick={() => setModal({ mode: "create" })}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:brightness-110"
          >
            <FolderPlus className="size-4" /> Create your first collection
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <article
              key={c.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-colors hover:border-brand/40"
            >
              <div className="flex items-start justify-between">
                <div className={`grid size-12 place-items-center rounded-xl ${colorClass(c.color)}`}>
                  <Folder className="size-5" />
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => setModal({ mode: "edit", c })}
                    title="Rename"
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    title="Delete"
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">{c.name}</h3>
              {c.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
              )}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {counts[c.id] ?? 0} ad{(counts[c.id] ?? 0) === 1 ? "" : "s"}
                </span>
                <Link
                  to="/collections/$collectionId"
                  params={{ collectionId: c.id }}
                  className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:brightness-110"
                >
                  Open <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {modal && (
        <CollectionModal
          initial={modal.mode === "edit" ? modal.c : null}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void refresh();
          }}
        />
      )}
    </AppShell>
  );
}

function CollectionModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Collection | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState(initial?.color ?? "brand");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    if (initial) {
      const { error } = await supabase
        .from("collections")
        .update({ name: name.trim(), description: description.trim() || null, color, updated_at: new Date().toISOString() })
        .eq("id", initial.id);
      if (error) toast.error(error.message);
      else {
        toast.success("Collection updated");
        onSaved();
      }
    } else {
      const { error } = await supabase.from("collections").insert({
        user_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        color,
      });
      if (error) toast.error(error.message);
      else {
        toast.success("Collection created");
        onSaved();
      }
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-bold">
          {initial ? "Edit collection" : "New collection"}
        </h2>
        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Summer Sale 2024"
              autoFocus
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Beachwear + accessories campaign for June–August"
              className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Color</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setColor(c.id)}
                  className={`grid size-9 place-items-center rounded-lg border transition ${c.className} ${
                    color === c.id ? "border-foreground" : "border-transparent"
                  }`}
                  title={c.label}
                  aria-label={c.label}
                >
                  <Folder className="size-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:brightness-110 disabled:opacity-60"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            {initial ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
