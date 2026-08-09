'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { createCustomAgentAction, saveCustomAgentAction, setCustomAgentStatusAction } from '@/app/actions/analysisTemplates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import type { AnalysisTargetType } from '@/lib/analysis/contracts';
import type { BoundedOutputSchema, CustomAgentValidationIssue } from '@/lib/analysis/customAgentContracts';
import { CapabilityPresetCard } from './capability-preset-card';
import { schemaToDraft, StructuredOutputEditor, type OutputFieldDraft } from './structured-output-editor';

export type PracticeAreaOption = { readonly id: number; readonly name: string; readonly shortCode: string };
export type SafeCapabilityPreset = { readonly id: string; readonly label: string; readonly purpose: string; readonly supportedTargetTypes: readonly AnalysisTargetType[]; readonly supportedPracticeAreas: 'all'; readonly limits: { readonly maxSources: number; readonly maxRequests: number }; readonly provenance: 'internal-policy'; readonly compatibilityTags: readonly string[] };
export type CustomAgentEditorAgent = { readonly customAgentId: string; readonly targetType: AnalysisTargetType; readonly practiceAreaId: number; readonly practiceAreaName: string; readonly practiceAreaShortCode: string; readonly status: 'active' | 'retired'; readonly latest: { readonly version: number; readonly name: string; readonly description: string; readonly researchQuery: string; readonly behaviorInstruction: string; readonly outputSchema: BoundedOutputSchema | null; readonly capabilityPresetIds: readonly string[]; readonly defaultEffort: string }; readonly history: readonly { readonly version: number; readonly createdBy: string; readonly createdAt: string }[] };

type EditorProps = { readonly mode: 'create' | 'edit'; readonly practiceAreas: readonly PracticeAreaOption[]; readonly capabilities: readonly SafeCapabilityPreset[]; readonly agent?: CustomAgentEditorAgent; readonly issues?: readonly CustomAgentValidationIssue[]; readonly trigger?: React.ReactNode; readonly open?: boolean; readonly onOpenChange?: (open: boolean) => void };
type OutputSchemaDraft = { readonly fields: readonly OutputFieldDraft[] };
type Draft = { readonly name: string; readonly description: string; readonly targetType: AnalysisTargetType; readonly practiceAreaId: number; readonly researchQuery: string; readonly behaviorInstruction: string; readonly defaultEffort: 'standard'; readonly outputSchema: OutputSchemaDraft | null; readonly capabilityPresetIds: readonly string[] };

export function buildCustomAgentCreatePayload(input: Draft): Draft {
  return { ...input };
}

function issueFor(issues: readonly CustomAgentValidationIssue[] | undefined, path: string): CustomAgentValidationIssue | undefined {
  return issues?.find((issue) => issue.path === path || issue.path.startsWith(`${path}.`));
}

export function CustomAgentEditor({ mode, practiceAreas, capabilities, agent, issues = [], trigger, open, onOpenChange }: EditorProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const initial = agent?.latest;
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [targetType, setTargetType] = useState<AnalysisTargetType>(agent?.targetType ?? 'company');
  const [practiceAreaId, setPracticeAreaId] = useState(agent?.practiceAreaId ?? practiceAreas[0]?.id ?? 0);
  const [researchQuery, setResearchQuery] = useState(initial?.researchQuery ?? '');
  const [behaviorInstruction, setBehaviorInstruction] = useState(initial?.behaviorInstruction ?? '');
  const [fields, setFields] = useState<OutputFieldDraft[]>(schemaToDraft(initial?.outputSchema ?? null));
  const [capabilityPresetIds, setCapabilityPresetIds] = useState<readonly string[]>(initial?.capabilityPresetIds ?? ['none']);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const practiceArea = practiceAreas.find((candidate) => candidate.id === practiceAreaId);
  const fieldError = (path: string) => issueFor(issues, path);

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const payload = buildCustomAgentCreatePayload({ name, description, targetType, practiceAreaId, researchQuery, behaviorInstruction, defaultEffort: 'standard', outputSchema: fields.length === 0 ? null : { fields }, capabilityPresetIds });
    startTransition(async () => {
      try {
        const result = mode === 'create' ? await createCustomAgentAction(payload) : await saveCustomAgentAction({ ...payload, customAgentId: agent?.customAgentId ?? '' });
        if (!result.ok) {
          setFeedback('Could not save this custom agent. Review the highlighted fields and try again.');
          return;
        }
        setFeedback(mode === 'create' ? 'Version 1 saved as Retired. Activate it separately after review.' : 'New version saved. Lifecycle was not changed.');
        router.refresh();
      } catch (error: unknown) {
        if (error instanceof Error) setFeedback('Could not save this custom agent. Please try again.');
        else setFeedback('Could not save this custom agent. Please try again.');
      }
    });
  }

  function changeLifecycle(): void {
    if (!agent) return;
    startTransition(async () => {
      try {
        const result = await setCustomAgentStatusAction({ customAgentId: agent.customAgentId, status: agent.status === 'active' ? 'retired' : 'active' });
        setFeedback(result.ok ? (agent.status === 'active' ? 'Custom agent retired.' : 'Custom agent activated.') : 'Could not change lifecycle. Please try again.');
        if (result.ok) router.refresh();
      } catch (error: unknown) {
        if (error instanceof Error) setFeedback('Could not change lifecycle. Please try again.');
        else setFeedback('Could not change lifecycle. Please try again.');
      }
    });
  }

  const sectionClass = 'flex flex-col gap-3 border-t border-slate-100 pt-5';
  return (
    <Sheet open={isOpen} onOpenChange={(nextOpen) => { setInternalOpen(nextOpen); onOpenChange?.(nextOpen); }}>
      {trigger ? <SheetTrigger asChild>{trigger}</SheetTrigger> : null}
      <SheetContent side="right" className="w-full overflow-hidden sm:max-w-2xl" aria-label={mode === 'create' ? 'Create custom agent' : `Edit ${name}`}>
        <SheetHeader><SheetTitle>{mode === 'create' ? 'Create custom agent' : 'Edit custom agent'}</SheetTitle><SheetDescription>All authored configuration saves together as an immutable version.</SheetDescription></SheetHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
            <section className="flex flex-col gap-3" aria-labelledby="custom-identity-heading"><h2 id="custom-identity-heading" className="text-sm font-semibold text-slate-900">Identity</h2><Input aria-label="Name" aria-invalid={fieldError('name') ? true : undefined} value={name} onChange={(event) => setName(event.target.value)} placeholder="Agent name" /><Textarea aria-label="Description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this agent is for" rows={3} />{fieldError('name') ? <p role="alert" className="text-xs text-red-600">{fieldError('name')?.message}</p> : null}</section>
            <section className={sectionClass} aria-labelledby="custom-target-heading"><h2 id="custom-target-heading" className="text-sm font-semibold text-slate-900">Target / Practice Area</h2><div className="grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-1 text-xs font-medium text-slate-700">Target<select aria-label="Target type" value={targetType} disabled={mode === 'edit'} onChange={(event) => setTargetType(event.target.value as AnalysisTargetType)} className="h-8 rounded-lg border border-input bg-background px-2 text-sm"><option value="company">Company</option><option value="persona">Persona</option></select></label>{mode === 'create' ? <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">Practice Area <span className="font-normal text-slate-500">Server-approved Practice Area options</span><select name="practiceAreaId" aria-label="Practice Area" value={String(practiceAreaId)} onChange={(event) => setPracticeAreaId(Number(event.target.value))} className="h-8 rounded-lg border border-input bg-background px-2 text-sm"><option value="" disabled>Choose one</option>{practiceAreas.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.shortCode})</option>)}</select></label> : <div className="flex flex-col gap-1 text-xs font-medium text-slate-700">Practice Area<span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" aria-readonly="true">{agent?.practiceAreaName} ({agent?.practiceAreaShortCode})</span><span className="text-[11px] font-normal text-slate-500">Practice Area is fixed after creation.</span></div>}</div>{fieldError('practiceAreaId') ? <p role="alert" className="text-xs text-red-600">{fieldError('practiceAreaId')?.message}</p> : null}</section>
            <section className={sectionClass} aria-labelledby="custom-query-heading"><h2 id="custom-query-heading" className="text-sm font-semibold text-slate-900">Query / Behavior</h2><label className="flex flex-col gap-1 text-xs font-medium text-slate-700">Research query / objective<Textarea aria-label="Research query" aria-invalid={fieldError('researchQuery') ? true : undefined} value={researchQuery} onChange={(event) => setResearchQuery(event.target.value)} rows={4} /></label><label className="flex flex-col gap-1 text-xs font-medium text-slate-700">Behavior instruction<Textarea aria-label="Behavior instruction" aria-invalid={fieldError('behaviorInstruction') ? true : undefined} value={behaviorInstruction} onChange={(event) => setBehaviorInstruction(event.target.value)} rows={4} /></label>{fieldError('behaviorInstruction') ? <p role="alert" className="text-xs text-red-600">{fieldError('behaviorInstruction')?.message}</p> : null}</section>
            <section className={sectionClass} aria-labelledby="custom-schema-heading"><h2 id="custom-schema-heading" className="text-sm font-semibold text-slate-900">Output Schema</h2><StructuredOutputEditor fields={fields} onChange={(nextFields) => setFields([...nextFields])} />{fieldError('outputSchema') ? <p role="alert" className="text-xs text-red-600">{fieldError('outputSchema')?.message}</p> : null}</section>
            <section className={sectionClass} aria-labelledby="custom-capabilities-heading"><h2 id="custom-capabilities-heading" className="text-sm font-semibold text-slate-900">Capabilities</h2><p className="text-xs leading-5 text-slate-500">Select a server-approved capability to make available. Selection does not force invocation.</p><div className="grid gap-3">{capabilities.filter((capability) => capability.supportedTargetTypes.includes(targetType)).map((capability) => <CapabilityPresetCard key={capability.id} preset={capability} selected={capabilityPresetIds.includes(capability.id)} onSelect={() => setCapabilityPresetIds(capabilityPresetIds.includes(capability.id) ? capabilityPresetIds.filter((id) => id !== capability.id) : [...capabilityPresetIds, capability.id])} />)}</div>{fieldError('capabilityPresetIds') ? <p role="alert" className="text-xs text-red-600">{fieldError('capabilityPresetIds')?.message}</p> : null}</section>
            <section className={sectionClass} aria-labelledby="custom-review-heading"><h2 id="custom-review-heading" className="text-sm font-semibold text-slate-900">Review / Save</h2><div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><p><strong>Target:</strong> {targetType}</p><p><strong>Practice Area:</strong> {practiceArea?.name ?? agent?.practiceAreaName ?? 'Selected server option'}</p><p><strong>Effort:</strong> standard</p><p><strong>Output:</strong> {fields.length === 0 ? 'Narrative and findings' : `${fields.length} bounded fields`}</p><p><strong>Capabilities:</strong> {capabilityPresetIds.join(', ')}</p><p className="mt-2 font-semibold">{mode === 'create' ? 'Version 1 — Retired' : `Version ${agent?.latest.version ?? 1} · ${agent?.status === 'active' ? 'Active' : 'Retired'}`}</p></div>{feedback ? <p role="status" className="text-sm text-slate-600">{feedback}</p> : null}</section>
            {mode === 'edit' && agent?.history.length ? <section className={sectionClass} aria-labelledby="custom-history-heading"><h2 id="custom-history-heading" className="text-sm font-semibold text-slate-900">Read-only history</h2>{agent.history.map((version) => <div key={`${version.version}-${version.createdAt}`} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><span className="font-medium text-slate-800">Version {version.version}</span><Badge className="ml-2" variant="outline">Read-only</Badge><span className="ml-2">{version.createdBy} · {new Date(version.createdAt).toLocaleDateString('en')}</span></div>)}</section> : null}
          </div>
          <SheetFooter className="border-t border-slate-100"><div className="flex flex-wrap gap-2">{mode === 'edit' ? <Button type="button" variant="outline" onClick={changeLifecycle} disabled={pending}>{agent?.status === 'active' ? 'Retire custom agent' : 'Activate custom agent'}</Button> : null}<Button type="submit" disabled={pending}>{pending ? 'Saving…' : mode === 'create' ? 'Save retired agent' : 'Save new version'}</Button></div></SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
