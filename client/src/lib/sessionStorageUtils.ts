/**
 * Safely gets an item from sessionStorage, returning a default value if the item is null or undefined
 * @param key The key to get from sessionStorage
 * @param defaultValue The default value to return if the item is null or undefined
 * @returns The stored value or the default value
 */
export const getSessionItem = <T = string>(key: string, defaultValue: T | string | number = ''): T | string => {
  try {
    const value = sessionStorage.getItem(key);
    if (value === null || value === 'undefined' || value === 'null') {
      return defaultValue as T;
    }
    
    // Try to parse as JSON if it might be an object
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value) as T;
      } catch {
        // If parsing fails, return as string
        return value;
      }
    }
    
    // Return as is for simple values
    return value;
  } catch (error) {
    console.error(`Error accessing sessionStorage: ${error}`);
    return defaultValue as T;
  }
};

/**
 * Safely sets an item in sessionStorage, converting null/undefined values to empty strings or zero
 * @param key The key to set in sessionStorage
 * @param value The value to store
 */
export const setSessionItem = (key: string, value: any): void => {
  try {
    // Handle null, undefined, or string 'undefined'/'null'
    if (value === null || value === undefined || value === 'undefined' || value === 'null') {
      sessionStorage.setItem(key, '');
      return;
    }
    
    // Handle numbers
    if (typeof value === 'number') {
      sessionStorage.setItem(key, value.toString());
      return;
    }
    
    // Handle objects
    if (typeof value === 'object') {
      sessionStorage.setItem(key, JSON.stringify(value));
      return;
    }
    
    // Handle strings that might be 'undefined' or 'null'
    if (typeof value === 'string' && (value === 'undefined' || value === 'null')) {
      sessionStorage.setItem(key, '');
      return;
    }
    
    // Handle all other values
    sessionStorage.setItem(key, value);
  } catch (error) {
    console.error(`Error setting sessionStorage item: ${error}`);
  }
};

/**
 * Gets an item from sessionStorage and parses it as JSON
 * @param key The key to get from sessionStorage
 * @param defaultValue The default value to return if the item is null or undefined
 * @returns The parsed object or the default value
 */
export const getSessionObject = <T = Record<string, any>>(key: string, defaultValue: T = {} as T): T => {
  try {
    const value = sessionStorage.getItem(key);
    if (value === null || value === 'undefined' || value === 'null') {
      return defaultValue;
    }
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`Error parsing sessionStorage item: ${error}`);
    return defaultValue;
  }
};

/**
 * Safely clears all items from sessionStorage
 */
export const clearSessionStorage = (): void => {
  try {
    sessionStorage.clear();
  } catch (error) {
    console.error(`Error clearing sessionStorage: ${error}`);
  }
};


/**
 * Safely clears all items from localStorage
 */
export function clearLocalStorage() {
  if (typeof window !== 'undefined') {
    localStorage.clear();
  }
}
