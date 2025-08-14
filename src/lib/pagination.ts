export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface DatabaseQueryOptions {
  teamId: string;
  userId: string;
  pagination: PaginationOptions;
  filters?: Record<string, any>;
}

export class PaginationHelper {
  /**
   * Calculate pagination metadata
   */
  static calculatePagination(total: number, page: number, limit: number) {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev
    };
  }

  /**
   * Validate pagination options
   */
  static validatePagination(options: PaginationOptions): PaginationOptions {
    const { page, limit, sortBy, sortOrder } = options;
    
    return {
      page: Math.max(1, Math.floor(page) || 1),
      limit: Math.min(100, Math.max(1, Math.floor(limit) || 20)),
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc'
    };
  }

  /**
   * Apply pagination to array data
   */
  static paginateArray<T>(data: T[], options: PaginationOptions): PaginatedResult<T> {
    const { page, limit } = this.validatePagination(options);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedData = data.slice(startIndex, endIndex);
    
    return {
      data: paginatedData,
      pagination: this.calculatePagination(data.length, page, limit)
    };
  }

  /**
   * Generate pagination links
   */
  static generatePaginationLinks(baseUrl: string, pagination: PaginatedResult<any>['pagination']) {
    const { page, totalPages } = pagination;
    const links: Record<string, string> = {};

    if (pagination.hasPrev) {
      links.prev = `${baseUrl}?page=${page - 1}&limit=${pagination.limit}`;
    }

    if (pagination.hasNext) {
      links.next = `${baseUrl}?page=${page + 1}&limit=${pagination.limit}`;
    }

    links.first = `${baseUrl}?page=1&limit=${pagination.limit}`;
    links.last = `${baseUrl}?page=${totalPages}&limit=${pagination.limit}`;

    return links;
  }

  /**
   * Parse pagination from query parameters
   */
  static parseFromQuery(query: Record<string, any>): PaginationOptions {
    return this.validatePagination({
      page: parseInt(query.page as string) || 1,
      limit: parseInt(query.limit as string) || 20,
      sortBy: query.sortBy as string,
      sortOrder: query.sortOrder as 'asc' | 'desc'
    });
  }
}

/**
 * Pagination-aware database query helper
 */
export class DatabasePagination {
  /**
   * Get paginated contacts
   */
  static async getPaginatedContacts(
    convex: any,
    api: any,
    options: DatabaseQueryOptions
  ): Promise<PaginatedResult<any>> {
    const { teamId, pagination } = options;
    const validatedPagination = PaginationHelper.validatePagination(pagination);

    // Get total count first
    const allContacts = await convex.query(api.crm.getContactsByTeam, { teamId });
    const total = allContacts.length;

    // Apply pagination
    const startIndex = (validatedPagination.page - 1) * validatedPagination.limit;
    const endIndex = startIndex + validatedPagination.limit;
    
    const paginatedContacts = allContacts.slice(startIndex, endIndex);

    return {
      data: paginatedContacts,
      pagination: PaginationHelper.calculatePagination(total, validatedPagination.page, validatedPagination.limit)
    };
  }

  /**
   * Get paginated accounts
   */
  static async getPaginatedAccounts(
    convex: any,
    api: any,
    options: DatabaseQueryOptions
  ): Promise<PaginatedResult<any>> {
    const { teamId, pagination } = options;
    const validatedPagination = PaginationHelper.validatePagination(pagination);

    // Get total count first
    const allAccounts = await convex.query(api.crm.getAccountsByTeam, { teamId });
    const total = allAccounts.length;

    // Apply pagination
    const startIndex = (validatedPagination.page - 1) * validatedPagination.limit;
    const endIndex = startIndex + validatedPagination.limit;
    
    const paginatedAccounts = allAccounts.slice(startIndex, endIndex);

    return {
      data: paginatedAccounts,
      pagination: PaginationHelper.calculatePagination(total, validatedPagination.page, validatedPagination.limit)
    };
  }

  /**
   * Get paginated deals
   */
  static async getPaginatedDeals(
    convex: any,
    api: any,
    options: DatabaseQueryOptions
  ): Promise<PaginatedResult<any>> {
    const { teamId, pagination } = options;
    const validatedPagination = PaginationHelper.validatePagination(pagination);

    // Get total count first
    const allDeals = await convex.query(api.crm.getDealsByTeam, { teamId });
    const total = allDeals.length;

    // Apply pagination
    const startIndex = (validatedPagination.page - 1) * validatedPagination.limit;
    const endIndex = startIndex + validatedPagination.limit;
    
    const paginatedDeals = allDeals.slice(startIndex, endIndex);

    return {
      data: paginatedDeals,
      pagination: PaginationHelper.calculatePagination(total, validatedPagination.page, validatedPagination.limit)
    };
  }

  /**
   * Get paginated activities
   */
  static async getPaginatedActivities(
    convex: any,
    api: any,
    options: DatabaseQueryOptions
  ): Promise<PaginatedResult<any>> {
    const { teamId, pagination } = options;
    const validatedPagination = PaginationHelper.validatePagination(pagination);

    // Get total count first
    const allActivities = await convex.query(api.crm.getActivitiesByTeam, { teamId });
    const total = allActivities.length;

    // Apply pagination
    const startIndex = (validatedPagination.page - 1) * validatedPagination.limit;
    const endIndex = startIndex + validatedPagination.limit;
    
    const paginatedActivities = allActivities.slice(startIndex, endIndex);

    return {
      data: paginatedActivities,
      pagination: PaginationHelper.calculatePagination(total, validatedPagination.page, validatedPagination.limit)
    };
  }
} 