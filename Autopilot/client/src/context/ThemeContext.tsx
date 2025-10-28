// src/context/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    // Default to 'dark' theme
    const [theme, setTheme] = useState<Theme>('dark');

    useEffect(() => {
        const storedTheme = localStorage.getItem('theme') as Theme | null;
        const initialTheme = storedTheme ? storedTheme : 'dark';
        setTheme(initialTheme);
    }, []);

    // 👇 THIS IS THE ADJUSTED PART 👇
    useEffect(() => {
        const root = window.document.documentElement;

        // Remove the 'dark' class if it exists
        root.classList.remove('dark');

        // Add it back if the theme is dark
        if (theme === 'dark') {
            root.classList.add('dark');
        }

        localStorage.setItem('theme', theme);
    }, [theme]);
    // 👆 END OF ADJUSTMENT 👆

    const toggleTheme = () => {
        setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};