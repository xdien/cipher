/**
 * Namespacing Utilities for MCP Aggregator
 * 
 * Provides utilities for creating and parsing namespaced names to avoid
 * conflicts when aggregating resources from multiple MCP servers.
 * Uses underscore separator pattern: {serverName}_{itemName}
 */

/**
 * Separator used for namespacing
 */
export const NAMESPACE_SEPARATOR = "_";

/**
 * Reserved prefixes that cannot be used as server names
 */
export const RESERVED_PREFIXES = new Set([
  'system',
  'internal',
  'aggregator',
  'mcp',
  'protocol',
]);

/**
 * Result of parsing a namespaced name
 */
export interface ParsedName {
  serverName: string | null;
  itemName: string | null;
  isNamespaced: boolean;
  originalName: string;
}

/**
 * Options for namespacing behavior
 */
export interface NamespacingOptions {
  /** Whether to enforce namespacing for all items */
  enforceNamespacing?: boolean;
  /** Whether to allow non-namespaced fallback lookups */
  allowFallback?: boolean;
  /** Custom separator (defaults to underscore) */
  separator?: string;
}

/**
 * Create a namespaced name from server name and item name
 * 
 * @param serverName The server name to use as namespace
 * @param itemName The item name to namespace
 * @param separator Optional custom separator (defaults to NAMESPACE_SEPARATOR)
 * @returns Namespaced name in format: {serverName}_{itemName}
 */
export function createNamespacedName(
  serverName: string, 
  itemName: string,
  separator: string = NAMESPACE_SEPARATOR
): string {
  validateServerName(serverName);
  validateItemName(itemName);
  
  return `${serverName}${separator}${itemName}`;
}

/**
 * Parse a potentially namespaced name to extract server and item names
 * 
 * @param namespacedName The name to parse
 * @param serverNames List of known server names for prefix matching
 * @param options Parsing options
 * @returns ParsedName object with server name, item name, and metadata
 */
export function parseNamespacedName(
  namespacedName: string,
  serverNames: string[],
  options: NamespacingOptions = {}
): ParsedName {
  const separator = options.separator || NAMESPACE_SEPARATOR;
  const originalName = namespacedName;
  
  if (!namespacedName.includes(separator)) {
    return {
      serverName: null,
      itemName: namespacedName,
      isNamespaced: false,
      originalName,
    };
  }

  // Sort server names by length (longest first) to handle nested prefixes correctly
  const sortedServerNames = [...serverNames].sort((a, b) => b.length - a.length);
  
  // Try to match server name prefix
  for (const serverName of sortedServerNames) {
    const prefix = `${serverName}${separator}`;
    
    if (namespacedName.startsWith(prefix)) {
      const itemName = namespacedName.substring(prefix.length);
      
      // Ensure we have a valid item name after the prefix
      if (itemName.length > 0) {
        return {
          serverName,
          itemName,
          isNamespaced: true,
          originalName,
        };
      }
    }
  }

  // No server prefix found - treat as non-namespaced
  return {
    serverName: null,
    itemName: namespacedName,
    isNamespaced: false,
    originalName,
  };
}

/**
 * Find the server that should handle a given name
 * Tries namespaced lookup first, then falls back to searching all servers
 * 
 * @param name The resource name to resolve
 * @param serverNames Available server names
 * @param resourceLookup Function to check if a server has the resource
 * @param options Lookup options
 * @returns Server name that provides the resource, or null if not found
 */
export async function resolveServerForResource<T>(
  name: string,
  serverNames: string[],
  resourceLookup: (serverName: string, itemName: string) => Promise<T | null>,
  options: NamespacingOptions = {}
): Promise<string | null> {
  const parsed = parseNamespacedName(name, serverNames, options);
  
  // If namespaced, try the specific server first
  if (parsed.isNamespaced && parsed.serverName) {
    const resource = await resourceLookup(parsed.serverName, parsed.itemName!);
    if (resource) {
      return parsed.serverName;
    }
  }
  
  // If not namespaced or namespaced lookup failed, try all servers
  if (options.allowFallback !== false) {
    const itemName = parsed.itemName || name;
    
    for (const serverName of serverNames) {
      try {
        const resource = await resourceLookup(serverName, itemName);
        if (resource) {
          return serverName;
        }
      } catch (error) {
        // Continue trying other servers
        continue;
      }
    }
  }
  
  return null;
}

/**
 * Generate all possible names for a resource (namespaced and non-namespaced)
 * 
 * @param serverName Server that provides the resource
 * @param itemName Original item name
 * @param options Namespacing options
 * @returns Array of possible names for the resource
 */
export function generateResourceNames(
  serverName: string,
  itemName: string,
  options: NamespacingOptions = {}
): string[] {
  const separator = options.separator || NAMESPACE_SEPARATOR;
  const names: string[] = [];
  
  // Always include the namespaced version
  names.push(createNamespacedName(serverName, itemName, separator));
  
  // Include non-namespaced version unless enforcement is enabled
  if (!options.enforceNamespacing) {
    names.push(itemName);
  }
  
  return names;
}

/**
 * Check if a name is already namespaced
 * 
 * @param name Name to check
 * @param serverNames Known server names
 * @param separator Separator to use
 * @returns True if the name is namespaced
 */
export function isNamespaced(
  name: string,
  serverNames: string[],
  separator: string = NAMESPACE_SEPARATOR
): boolean {
  const parsed = parseNamespacedName(name, serverNames, { separator });
  return parsed.isNamespaced;
}

/**
 * Extract server name from a namespaced name
 * 
 * @param namespacedName Namespaced name
 * @param serverNames Known server names
 * @param separator Separator to use
 * @returns Server name or null if not namespaced
 */
export function extractServerName(
  namespacedName: string,
  serverNames: string[],
  separator: string = NAMESPACE_SEPARATOR
): string | null {
  const parsed = parseNamespacedName(namespacedName, serverNames, { separator });
  return parsed.serverName;
}

/**
 * Extract item name from a namespaced name
 * 
 * @param namespacedName Namespaced name
 * @param serverNames Known server names  
 * @param separator Separator to use
 * @returns Item name or the original name if not namespaced
 */
export function extractItemName(
  namespacedName: string,
  serverNames: string[],
  separator: string = NAMESPACE_SEPARATOR
): string {
  const parsed = parseNamespacedName(namespacedName, serverNames, { separator });
  return parsed.itemName || namespacedName;
}

/**
 * Create a namespace validator for server names
 * 
 * @param existingServerNames Already registered server names
 * @returns Validation function
 */
export function createServerNameValidator(existingServerNames: Set<string>) {
  return (serverName: string): { valid: boolean; error?: string } => {
    try {
      validateServerName(serverName);
      
      if (existingServerNames.has(serverName)) {
        return {
          valid: false,
          error: `Server name '${serverName}' is already registered`,
        };
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
}

/**
 * Validate server name for namespacing
 * 
 * @param serverName Server name to validate
 * @throws Error if server name is invalid
 */
export function validateServerName(serverName: string): void {
  if (!serverName || typeof serverName !== 'string') {
    throw new Error('Server name must be a non-empty string');
  }
  
  if (serverName.includes(NAMESPACE_SEPARATOR)) {
    throw new Error(`Server name cannot contain separator '${NAMESPACE_SEPARATOR}'`);
  }
  
  if (RESERVED_PREFIXES.has(serverName.toLowerCase())) {
    throw new Error(`Server name '${serverName}' is reserved and cannot be used`);
  }
  
  // Check for valid identifier characters
  if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(serverName)) {
    throw new Error('Server name must start with a letter and contain only letters, numbers, and hyphens');
  }
  
  if (serverName.length > 64) {
    throw new Error('Server name cannot be longer than 64 characters');
  }
}

/**
 * Validate item name for namespacing
 * 
 * @param itemName Item name to validate
 * @throws Error if item name is invalid
 */
export function validateItemName(itemName: string): void {
  if (!itemName || typeof itemName !== 'string') {
    throw new Error('Item name must be a non-empty string');
  }
  
  if (itemName.length > 256) {
    throw new Error('Item name cannot be longer than 256 characters');
  }
  
  // Item names can be more flexible than server names
  if (itemName.trim() !== itemName) {
    throw new Error('Item name cannot have leading or trailing whitespace');
  }
} 