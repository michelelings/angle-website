import Link from 'next/link';
import { categorySlug } from '@/lib/episodes';
export function Filters({ categories, active }: { categories: string[]; active: string }) {
  return <nav className="filters" aria-label="Story categories">{['all', 'new', 'popular', ...categories.filter(c => !['all','new','popular'].includes(c))].map(category =>
    <Link prefetch={false} key={category} href={category === 'all' ? '/' : `/${categorySlug(category)}`}
      className={`category-tag ${active === category ? 'active' : 'inactive'}`} aria-current={active === category ? 'page' : undefined}>{category}</Link>
  )}</nav>;
}
