import type { PaginationMetadata, PaginationQuery } from "./pagination.types.js";

export function getPaginationOffset({ page, limit }: PaginationQuery): number {
    return (page - 1) * limit;
}

export function createPaginationMetadata(
    { page, limit }: PaginationQuery,
    total: number,
): PaginationMetadata {
    const totalPages = Math.ceil(total / limit);

    return {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
    };
}
