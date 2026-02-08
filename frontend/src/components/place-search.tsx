"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface Place {
    id: number;
    name: string;
    type: string;
    lat: number;
    lon: number;
    nodeId: number;
}

interface PlaceSearchProps {
    placeholder: string;
    onSelect: (place: Place) => void;
    value?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function PlaceSearch({ placeholder, onSelect, value }: PlaceSearchProps) {
    const [query, setQuery] = useState(value || "");
    const [suggestions, setSuggestions] = useState<Place[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [offset, setOffset] = useState(0);
    const [total, setTotal] = useState(0);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const currentQuery = useRef("");
    const keyDebounceRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (value !== undefined && value !== query) {
            setQuery(value);
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const searchPlaces = useCallback(async (searchQuery: string, loadMore = false) => {
        const newOffset = loadMore ? offset : 0;
        currentQuery.current = searchQuery;

        if (!loadMore) {
            setIsLoading(true);
        }

        try {
            const res = await fetch(`${API_BASE}/api/places/search?q=${encodeURIComponent(searchQuery)}&limit=20&offset=${newOffset}`);

            if (!res.ok) {
                setSuggestions([]);
                return;
            }

            const data = await res.json();

            if (data.places && data.places.length > 0) {
                if (loadMore) {
                    setSuggestions(prev => [...prev, ...data.places]);
                } else {
                    setSuggestions(data.places);
                }
                setHasMore(data.hasMore || false);
                setTotal(data.total || 0);
                setOffset(newOffset + data.places.length);
                setIsOpen(true);
                if (!loadMore) setHighlightIndex(-1);
            } else if (!loadMore) {
                setSuggestions([]);
                setIsOpen(false);
            }
        } catch {
            if (!loadMore) setSuggestions([]);
        } finally {
            setIsLoading(false);
        }
    }, [offset]);

    const handleScroll = useCallback(() => {
        if (!listRef.current || isLoading || !hasMore) return;

        const { scrollTop, scrollHeight, clientHeight } = listRef.current;
        if (scrollHeight - scrollTop - clientHeight < 50) {
            searchPlaces(currentQuery.current, true);
        }
    }, [searchPlaces, isLoading, hasMore]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newQuery = e.target.value;
        setQuery(newQuery);
        setOffset(0);

        const debounceTimer = setTimeout(() => {
            searchPlaces(newQuery);
        }, 200);

        return () => clearTimeout(debounceTimer);
    };

    const handleSelect = (place: Place) => {
        setQuery(place.name);
        setIsOpen(false);
        onSelect(place);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return;

        const navigate = (direction: 'up' | 'down') => {
            if (keyDebounceRef.current) return;

            setHighlightIndex((prev) => {
                const newIndex = direction === 'down'
                    ? Math.min(prev + 1, suggestions.length - 1)
                    : Math.max(prev - 1, 0);

                setTimeout(() => {
                    const item = listRef.current?.querySelector(`[data-index="${newIndex}"]`);
                    item?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }, 0);

                return newIndex;
            });

            keyDebounceRef.current = setTimeout(() => {
                keyDebounceRef.current = null;
            }, 100);
        };

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                navigate('down');
                break;
            case "ArrowUp":
                e.preventDefault();
                navigate('up');
                break;
            case "Enter":
                e.preventDefault();
                if (highlightIndex >= 0 && suggestions[highlightIndex]) {
                    handleSelect(suggestions[highlightIndex]);
                }
                break;
            case "Escape":
                setIsOpen(false);
                break;
        }
    };

    return (
        <div ref={containerRef} className="relative">
            <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                    setOffset(0);
                    searchPlaces(query);
                }}
                placeholder={placeholder}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            {isLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="animate-spin h-4 w-4 text-slate-400" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                </div>
            )}

            {isOpen && suggestions.length > 0 && (
                <div
                    ref={listRef}
                    onScroll={handleScroll}
                    className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 max-h-64 overflow-y-auto z-[1000]"
                >
                    {total > 0 && (
                        <div className="px-3 py-1.5 bg-slate-50 text-xs text-slate-500 border-b border-slate-100 sticky top-0">
                            {total.toLocaleString()} places found
                        </div>
                    )}
                    {suggestions.map((place, index) => (
                        <button
                            key={`${place.id}-${index}`}
                            type="button"
                            data-index={index}
                            onClick={() => handleSelect(place)}
                            className={`w-full px-3 py-2.5 text-left flex items-center gap-3 transition-colors ${index === highlightIndex ? "bg-blue-50" : "hover:bg-slate-50"
                                }`}
                        >
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">{place.name}</p>
                                <p className="text-xs text-slate-500 truncate">{place.type}</p>
                            </div>
                        </button>
                    ))}
                    {hasMore && (
                        <div className="px-3 py-2 text-center text-xs text-slate-400">
                            Scroll for more...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
