export interface PaginationInput {
  page?: number;
  limit?: number;
  total?: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  total?: number;
  totalPages?: number;
  hasNext?: boolean;
  offset?: number;
}

export function normalizePagination(input: PaginationInput): PaginationResult {
  const pageValue = Number.isFinite(input.page) ? Number(input.page) : 1;
  const limitValue = Number.isFinite(input.limit) ? Number(input.limit) : 10;

  const safePage = pageValue > 0 ? Math.trunc(pageValue) : 1;
  const safeLimit = limitValue > 0 ? Math.min(50, Math.trunc(limitValue)) : 10;

  if (input.total === undefined) {
    return {
      page: safePage,
      limit: safeLimit,
    };
  }

  const total = Math.max(0, Number(input.total));
  const totalPages = total === 0 ? 1 : Math.ceil(total / safeLimit);
  const offset = (safePage - 1) * safeLimit;

  return {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
    hasNext: safePage < totalPages,
    offset,
  };
}
