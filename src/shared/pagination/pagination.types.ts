import type { z } from "zod";

import { paginationMetadataSchema, paginationSchema } from "./pagination.schema.js";

export type PaginationQuery = z.infer<typeof paginationSchema>;
export type PaginationMetadata = z.infer<typeof paginationMetadataSchema>;
