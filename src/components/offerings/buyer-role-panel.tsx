'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import {
  createBuyerRoleAction,
  deleteBuyerRoleAction,
  updateBuyerRoleAction,
} from '@/app/actions/buyerRoles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { DeleteGuardDialog } from './delete-guard-dialog';

// OFR-06 / D-05: the SINGLE shared lookup CRUD panel for the firm-wide buyer
// role list — referenced by both Offerings (ranked buyer roles) and Signals
// (Persona Signal's Buyer Role field). It receives the role list as a prop
// from the page's server component (server-side data, no Server Action fetch);
// its only local state is the create/edit form expansion + the inline edit row.
//
// D-10 (LOCKED): destructive red is reserved EXCLUSIVELY for the row-level
// Delete TRIGGER — the DeleteGuardDialog's own confirm button stays
// variant="default" (near-black). Every delete routes through the guarded
// dialog's onDelete callback wrapping deleteBuyerRoleAction — this panel
// introduces no second, unguarded removal path for buyer roles (T-30-07-01).
//
// Buyer Role CRUD happens inline inside the SAME Sheet (UI-SPEC line 183):
// "New Buyer Role" toggles an inline name/description expansion above the
// list rather than a nested modal — avoids Sheet-over-Sheet stacking. Edit
// renders the row itself as an inline form. The create and edit forms share
// one internal InlineRoleForm renderer (same fields, different bindings).

export interface BuyerRolePanelRole {
  id: number;
  name: string;
  description: string | null;
}

function InlineRoleForm({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  error,
  pending,
  canSave,
  onSave,
  onCancel,
}: {
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  error: string | null;
  pending: boolean;
  canSave: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-2">
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">Name</label>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Buyer role name"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">Description</label>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Describe this buyer role…"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button variant="default" size="sm" onClick={onSave} disabled={!canSave || pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

export function BuyerRolePanel({
  buyerRoles,
  trigger,
}: {
  buyerRoles: BuyerRolePanelRole[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canCreate = newName.trim().length > 0;
  const canEdit = editName.trim().length > 0;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      // Reset all ephemeral expansion state when the Sheet closes so the next
      // open presents a fresh pre-attempt panel (same reset-on-open contract
      // as signal-form.tsx).
      setCreating(false);
      setNewName('');
      setNewDescription('');
      setEditingId(null);
      setEditName('');
      setEditDescription('');
      setError(null);
    }
  }

  function handleCreate() {
    if (!canCreate) return;
    startTransition(async () => {
      try {
        const result = await createBuyerRoleAction({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
        });
        if (!result.ok) {
          // Generic copy only — never the Server Action's raw reason.
          setError('Could not save this Buyer Role. Please try again.');
          return;
        }
        setCreating(false);
        setNewName('');
        setNewDescription('');
        setError(null);
        router.refresh();
      } catch {
        setError('Could not save this Buyer Role. Please try again.');
      }
    });
  }

  function handleEdit(role: BuyerRolePanelRole) {
    setCreating(false);
    setEditingId(role.id);
    setEditName(role.name);
    setEditDescription(role.description ?? '');
    setError(null);
  }

  function handleEditSave() {
    if (editingId === null || !canEdit) return;
    const id = editingId;
    startTransition(async () => {
      try {
        const result = await updateBuyerRoleAction(id, {
          name: editName.trim(),
          description: editDescription.trim() || undefined,
        });
        if (!result.ok) {
          setError('Could not save this Buyer Role. Please try again.');
          return;
        }
        setEditingId(null);
        setError(null);
        router.refresh();
      } catch {
        setError('Could not save this Buyer Role. Please try again.');
      }
    });
  }

  const showEmptyState = buyerRoles.length === 0 && !creating;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Manage Buyer Roles</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          <Button
            variant="default"
            onClick={() => {
              setEditingId(null);
              setError(null);
              setCreating((value) => !value);
            }}
          >
            New Buyer Role
          </Button>

          {creating && (
            <InlineRoleForm
              name={newName}
              description={newDescription}
              onNameChange={setNewName}
              onDescriptionChange={setNewDescription}
              error={error}
              pending={pending}
              canSave={canCreate}
              onSave={handleCreate}
              onCancel={() => {
                setCreating(false);
                setError(null);
              }}
            />
          )}

          {showEmptyState ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
              <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
                No buyer roles yet
              </p>
              <p className="text-sm text-slate-500">
                Click <strong>New Buyer Role</strong> to create the first one.
              </p>
            </div>
          ) : (
            buyerRoles.map((role) => {
              if (editingId === role.id) {
                return (
                  <InlineRoleForm
                    key={role.id}
                    name={editName}
                    description={editDescription}
                    onNameChange={setEditName}
                    onDescriptionChange={setEditDescription}
                    error={error}
                    pending={pending}
                    canSave={canEdit}
                    onSave={handleEditSave}
                    onCancel={() => {
                      setEditingId(null);
                      setError(null);
                    }}
                  />
                );
              }

              return (
                <div
                  key={role.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-slate-200 p-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{role.name}</p>
                    <p className="text-[12px] text-slate-500">{role.description}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${role.name}`}
                      onClick={() => handleEdit(role)}
                    >
                      <Pencil />
                    </Button>
                    <DeleteGuardDialog
                      entityLabel="Buyer Role"
                      onDelete={() => deleteBuyerRoleAction(role.id)}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${role.name}`}
                        >
                          <Trash2 />
                        </Button>
                      }
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
