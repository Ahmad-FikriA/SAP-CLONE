import { STATUS_LABELS, STATUS_VARIANTS, CATEGORY_COLORS, ROLE_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';

const variantClasses = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
};

export function StatusBadge({ status, label: labelOverride }) {
  const label = labelOverride || STATUS_LABELS[status] || status;
  const variant = STATUS_VARIANTS[status] || 'pending';
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', variantClasses[variant])}>
      {label}
    </span>
  );
}

export function CategoryBadge({ category }) {
  const colors = CATEGORY_COLORS[category] || { bg: '#6B728022', text: '#6B7280' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: colors.bg, color: colors.text }}
    >
      {category}
    </span>
  );
}

export function RoleBadge({ role }) {
  const color = ROLE_COLORS[role] || '#6C757D';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: `${color}22`, color }}
    >
      {role}
    </span>
  );
}
