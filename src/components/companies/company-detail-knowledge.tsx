import type { ArcpediaArticle } from '@/lib/arcpedia';

export function CompanyDetailKnowledge({ articles }: { readonly articles: readonly ArcpediaArticle[] }) {
  return (
    <section>
      <h2 className="mb-4 text-[18px] font-semibold leading-[1.2] text-slate-900">
        Related Knowledge
      </h2>
      {articles.length > 0 ? (
        <ul className="space-y-4">
          {articles.map((article) => (
            <li key={article.slug}>
              <a
                href={`https://arcpedia.arclumen.de/wiki/${encodeURIComponent(article.slug)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[14px] font-normal leading-[1.5] text-indigo-600"
              >
                {article.title}
              </a>
              <p className="text-[14px] font-normal leading-[1.5] text-slate-500">
                {article.snippet}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] font-normal leading-[1.5] text-slate-500">No related knowledge found.</p>
      )}
    </section>
  );
}
