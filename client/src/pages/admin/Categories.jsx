import PageHeader from '../../components/layout/PageHeader.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import useAsync from '../../hooks/useAsync.js';
import adminService from '../../services/admin.js';
import { formatNumber } from '../../utils/format.js';

function TreeNode({ node, depth = 0 }) {
  return (
    <li>
      <div className="flex items-center justify-between py-2" style={{ paddingLeft: depth * 20 }}>
        <span className="text-[13.5px] text-ink">{node.name}</span>
        <span className="tnum text-[12.5px] text-muted">
          {formatNumber(node.productCount ?? 0)} products
        </span>
      </div>
      {node.children?.length ? (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.id ?? child.slug} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function AdminCategories() {
  const result = useAsync(() => adminService.categoryTree({ depth: 3 }), []);
  const tree = result.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Categories" description="The live CJ category tree imported into ZAVORA." />

      {result.loading ? (
        <Skeleton className="h-[320px] rounded-xl" />
      ) : result.error ? (
        <EmptyState title="Could not load categories" description={result.error?.message} />
      ) : tree.length === 0 ? (
        <EmptyState title="No categories" description="Run a CJ sync to import the category tree." />
      ) : (
        <section className="rounded-xl border border-line bg-surface px-5 py-4">
          <ul className="divide-y divide-line">
            {tree.map((node) => (
              <TreeNode key={node.id ?? node.slug} node={node} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
