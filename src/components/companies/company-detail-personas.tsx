import type { listPersonasForCompany } from '@/lib/db/queries/companyPersonaRoles';

type PersonaRoles = Awaited<ReturnType<typeof listPersonasForCompany>>;

export function CompanyDetailPersonas({ personaRoles }: { readonly personaRoles: PersonaRoles }) {
  return (
    <section>
      <h2 className="mb-4 text-[18px] font-semibold leading-[1.2] text-slate-900">
        Linked Personas
      </h2>
      {personaRoles.length > 0 ? (
        <ul className="space-y-2">
          {personaRoles.map(({ persona, role }) => (
            <li key={persona.id} className="text-[14px] font-normal leading-[1.5] text-slate-900">
              {persona.name}
              {role.title ? ` — ${role.title}` : ''}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] font-normal leading-[1.5] text-slate-500">
          No linked personas.
        </p>
      )}
    </section>
  );
}
